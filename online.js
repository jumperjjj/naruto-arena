const roomButton=document.createElement('button');roomButton.id='onlineButton';roomButton.textContent='ESCOLHER NICK';document.querySelector('.windowTools').insertBefore(roomButton,$('scaleButton'));
const roomDialog=document.createElement('dialog');roomDialog.id='onlineDialog';roomDialog.setAttribute('aria-labelledby','onlineTitle');roomDialog.innerHTML=`<h2 id="onlineTitle">JOGAR COM AMIGO</h2><p>Crie uma sala e envie o link ou código. Cada um escolhe três personagens e confirma a equipe.</p><label for="onlineNickname">Seu apelido</label><input id="onlineNickname" maxlength="20" autocomplete="nickname" placeholder="Como seu amigo vai te chamar"><button id="createRoom">CRIAR SALA</button><div class="joinRoom"><label for="roomCode">Código da sala</label><input id="roomCode" maxlength="14" placeholder="Código recebido" autocapitalize="characters" autocomplete="off"><button id="joinRoom">ENTRAR NA SALA</button></div><div id="roomShare" hidden><label for="roomInvite">Link para convidar seu amigo</label><input id="roomInvite" readonly><button id="copyRoomLink">COPIAR LINK</button><button id="leaveRoom">SAIR DA SALA</button></div><p id="onlineError" role="status"></p><button id="closeOnline">FECHAR</button>`;$('arena').append(roomDialog);
const roomPanel=document.createElement('aside');roomPanel.id='roomPanel';roomPanel.hidden=true;roomPanel.innerHTML='<b id="roomBadge"></b><button id="copyRoomQuick">COPIAR LINK</button><p id="roomOpponent"></p><button id="cancelReady">ALTERAR EQUIPE</button>';$('lobbyScreen').append(roomPanel);
const invitedCode=new URLSearchParams(location.search).get('sala');let inviteHandled=false,onlineWorking=false;
async function roomRequest(command,extra={}){const r=await fetch('/room-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,...extra})});const next=await r.json();if(next.error)throw Error(next.error.replace(/^user error \(|\)$/g,''));return next;}
const cpuApi=api;
api=async function(command,extra={}){
 if(command==='state')return roomRequest('state',extra);
 if(state?.online){const mapped={reset:'ready',lobby:'leave'}[command]||command;return roomRequest(mapped,{round:state.round,...extra});}
 return cpuApi(command,extra);
};
const canQueueOffline=canQueueSkill;
canQueueSkill=function(actor,skill){return state?.yourTurn!==false&&canQueueOffline(actor,skill);};
const offlineMessage=message;
message=function(text){if(state?.started&&!state.winner&&!state.yourTurn)text='';offlineMessage(text);};
let publicInvitationBase=location.origin;
fetch('/connection.json').then(r=>r.json()).then(connection=>{if(['localhost','127.0.0.1'].includes(location.hostname)&&connection.publicUrl)publicInvitationBase=connection.publicUrl;}).catch(()=>{});
function invitation(){return publicInvitationBase+'/?sala='+state.online.code;}
function showOnline(){
 $('onlineNickname').value=state?.online?.you||localStorage.getItem('narutoNickname')||'';
 $('roomCode').value=state?.online?.code||invitedCode||$('roomCode').value;
 $('createRoom').disabled=!!state?.online||onlineWorking;$('joinRoom').disabled=!!state?.online||onlineWorking;
 $('roomShare').hidden=!state?.online;if(state?.online)$('roomInvite').value=invitation();
 $('onlineError').textContent='';roomDialog.showModal();
}
roomButton.onclick=showOnline;$('closeOnline').onclick=()=>roomDialog.close();
async function enterRoom(command){
 if(onlineWorking)return;const nick=$('onlineNickname').value.trim();if(!nick){$('onlineError').textContent='Digite seu apelido.';$('onlineNickname').focus();return;}
 onlineWorking=true;$('createRoom').disabled=true;$('joinRoom').disabled=true;$('onlineError').textContent='Conectando…';
 try{
  const next=await roomRequest(command,{nickname:nick,code:$('roomCode').value});
  localStorage.setItem('narutoNickname',nick);state=next;revision=state.revision;queue=[];selected=null;viewed=null;lobbyReady=false;lobbyPreviewOpen7=false;inviteHandled=true;roomDialog.close();render();
 }catch(e){$('onlineError').textContent=e.message;}finally{onlineWorking=false;$('createRoom').disabled=!!state?.online;$('joinRoom').disabled=!!state?.online;}
}
$('createRoom').onclick=()=>enterRoom('create');$('joinRoom').onclick=()=>enterRoom('join');
$('roomCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();enterRoom('join');}});
async function copyInvitation(){
 if(!state?.online)return;
 try{await navigator.clipboard.writeText(invitation());$('onlineError').textContent='Link copiado. Envie para seu amigo.';$('lobbyNotice').textContent='Link copiado. Envie para seu amigo.';}catch{showOnline();$('roomInvite').value=invitation();$('roomInvite').focus();$('roomInvite').select();$('onlineError').textContent='Copie o link selecionado e envie para seu amigo.';}
}
$('copyRoomLink').onclick=copyInvitation;$('copyRoomQuick').onclick=copyInvitation;
$('leaveRoom').onclick=async()=>{roomDialog.close();await returnToLobby();};
$('cancelReady').onclick=async()=>{try{state=await roomRequest('unready');revision=state.revision;render();}catch(e){$('lobbyNotice').textContent=e.message;}};
const renderOffline=render;
render=function(){
 renderOffline();const room=state?.online;roomPanel.hidden=!room;const waiting=!!(state?.started&&!state.winner&&!state.yourTurn);$('arena').classList.toggle('opponentTurn',waiting);document.querySelector('.profile.own').classList.toggle('activePlayer',!!state.started&&!state.winner&&!waiting);document.querySelector('.profile.opponent').classList.toggle('activePlayer',waiting);
 roomButton.textContent=room?'SALA '+room.code:'JOGAR COM AMIGO';
 if(room){
  document.querySelector('.profile.own b').textContent=room.you;document.querySelector('.profile.own span').textContent='SALA PRIVADA';document.querySelector('.profile.opponent b').textContent=room.opponent||'AMIGO';document.querySelector('.profile.opponent span').textContent='SALA PRIVADA';
  $('roomBadge').textContent='SALA '+room.code;$('roomOpponent').textContent=room.opponent?(room.opponent+(room.opponentReady?' · PRONTO':' · escolhendo equipe')):'Aguardando seu amigo entrar';$('cancelReady').hidden=!room.ready;
  if(!state.started){
   $('startCpuButton').textContent=room.ready?'EQUIPE CONFIRMADA':'CONFIRMAR EQUIPE';$('startCpuButton').disabled=busy||selectedTeam().length!==3||room.ready;
   $('lobbyNotice').textContent=room.ready?'Equipe confirmada. A partida começa quando os dois estiverem prontos.':room.joined?'Escolha três personagens e confirme sua equipe.':'Envie o link ou o código para seu amigo entrar.';
   $('addPreview').disabled=room.ready||(!chosen.includes(lobbyCharacterId)&&selectedTeam().length>=3);$('presetTrio').disabled=room.ready;document.querySelectorAll('[data-lobby-remove]').forEach(b=>b.disabled=room.ready);
  }else if(!state.winner&&!state.yourTurn){
   $('readyLabel').textContent=lang==='pt'?'TURNO DO ADVERSÁRIO…':'OPPONENT TURN…';$('endTurn').disabled=true;$('exchangeButton').disabled=true;message('');
  }
  if(state.winner)$('resultSubtitle').textContent=state.winner==='Você venceu'?'Você venceu '+room.opponent+'!':room.opponent+' venceu esta partida.';
  $('newGameButton').textContent='SAIR DA SALA';$('teamButton').disabled=state.started;
 }else{
  document.querySelector('.profile.own b').textContent='VOCÊ';document.querySelector('.profile.own span').textContent=t('training');document.querySelector('.profile.opponent b').textContent='CPU';document.querySelector('.profile.opponent span').textContent=t('mirror');$('newGameButton').textContent=t('newGame');$('teamButton').disabled=false;$('presetTrio').disabled=false;
 }
 if(!room&&waiting){$('readyLabel').textContent=lang==='pt'?'TURNO DA CPU…':'CPU TURN…';$('endTurn').disabled=true;$('exchangeButton').disabled=true;message('');}
 if(!room&&invitedCode&&!inviteHandled){inviteHandled=true;showOnline();}
};
// Lobby interactions redraw independently of the combat renderer.
const onlineLobbyBase=renderLobby;
renderLobby=function(){onlineLobbyBase();if(state?.online&&!state.started){const r=state.online;$('startCpuButton').textContent=r.ready?'EQUIPE CONFIRMADA':'CONFIRMAR EQUIPE';$('startCpuButton').disabled=busy||selectedTeam().length!==3||r.ready;$('addPreview').disabled=r.ready||(!chosen.includes(lobbyCharacterId)&&selectedTeam().length>=3);$('presetTrio').disabled=r.ready;document.querySelectorAll('[data-lobby-remove]').forEach(b=>b.disabled=r.ready);}};
if(state)render();

const nickDialog=document.createElement('dialog');
nickDialog.id='nickDialog';
nickDialog.innerHTML='<form method="dialog"><h2>ESCOLHER NICK</h2><label for="playerNick">Seu nick</label><input id="playerNick" maxlength="20" autocomplete="nickname" required><p>Use até 20 letras, números, hífens ou sublinhados.</p><p id="nickStatus" role="status"></p><button type="submit">SALVAR NICK</button><button type="button" id="closeNick">FECHAR</button></form>';
$('arena').append(nickDialog);
const matchDialog=document.createElement('dialog');
matchDialog.id='matchDialog';
matchDialog.innerHTML='<form method="dialog"><h2>START PRIVATE GAME</h2><p id="matchOwnNick"></p><label for="opponentNick">Nick do adversário</label><input id="opponentNick" maxlength="20" autocomplete="off" required><p>Seu adversário precisa digitar o seu nick também.</p><p id="matchStatus" role="status"></p><button id="startSearch" type="submit">PROCURAR PARTIDA</button><button id="cancelSearch" type="button">CANCELAR</button></form>';
$('arena').append(matchDialog);
const searchEye=document.createElement('div');
searchEye.className='matchSharingan';
searchEye.hidden=true;
searchEye.setAttribute('aria-hidden','true');
searchEye.innerHTML='<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#a30c18" stroke="#1c0a0b" stroke-width="6"/><circle cx="50" cy="50" r="29" fill="none" stroke="#401217" stroke-width="2"/><circle cx="50" cy="50" r="10" fill="#1c0a0b"/><path id="matchTomoe" d="M43 24c0-11 13-12 17-5-6-3-8 1-6 5 3 7-11 10-11 0Z" fill="#1c0a0b"/><use href="#matchTomoe" transform="rotate(120 50 50)"/><use href="#matchTomoe" transform="rotate(240 50 50)"/></svg>';
matchDialog.querySelector('h2').after(searchEye);
for(const dialog of [nickDialog,matchDialog])dialog.className='nickMatchDialog';
const savedNick=()=>localStorage.getItem('narutoNickname')||'';
const validNick=value=>/^[\p{L}\p{N}_-]{1,20}$/u.test(value);
let returnToSearch=null,searchTimer,searchMode='private';
function showNick(forMatch=false){
 returnToSearch=forMatch;$('playerNick').value=savedNick();$('nickStatus').textContent='';nickDialog.showModal();
}
function showMatch(mode){
 if(state?.online){showOnline();return;}
 if(selectedTeam().length!==3){$('lobbyNotice').textContent='Escolha três personagens diferentes.';return;}
 if(!validNick(savedNick())){showNick(mode);return;}
 searchMode=mode;
 const quick=mode==='quick';
 matchDialog.querySelector('h2').textContent=quick?'START QUICK GAME':'START PRIVATE GAME';
 $('opponentNick').required=!quick;
 $('opponentNick').hidden=quick;
 matchDialog.querySelector('label').hidden=quick;
 $('opponentNick').nextElementSibling.hidden=quick;
 $('startSearch').hidden=quick;
 $('matchOwnNick').textContent='Seu nick: '+savedNick();
 $('matchStatus').textContent='';matchDialog.showModal();
 if(quick)startMatchSearch();
}
function showPrivateMatch(){showMatch('private');}
roomButton.onclick=()=>showNick();
$('closeNick').onclick=()=>nickDialog.close();
nickDialog.querySelector('form').onsubmit=async event=>{
 event.preventDefault();
 if(onlineWorking)return;
 const name=$('playerNick').value.normalize('NFKC').trim();
 if(!validNick(name)){$('nickStatus').textContent='Digite um nick válido.';return;}
 onlineWorking=true;$('nickStatus').textContent='Reservando nick…';
 try{
  await roomRequest('claimNick',{nickname:name});
  localStorage.setItem('narutoNickname',name);nickDialog.close();
 }catch(e){$('nickStatus').textContent=e.message;return;}
 finally{onlineWorking=false;}
 if(returnToSearch)showMatch(returnToSearch);else renderLobby();
};
function searchControls(searching){
 searchEye.hidden=!searching;
 $('startSearch').disabled=searching;$('opponentNick').disabled=searching;
}
function acceptMatch(next){
 clearTimeout(searchTimer);searchControls(false);matchDialog.close();
 state=next;revision=next.revision;queue=[];selected=null;viewed=null;lobbyReady=false;lobbyPreviewOpen7=false;
 render();
}
async function startMatchSearch(){
 if(onlineWorking)return;
 onlineWorking=true;busy=true;searchControls(true);$('cancelSearch').disabled=true;$('matchStatus').textContent='Conectando ao servidor…';
 try{
  const next=await roomRequest(searchMode==='quick'?'quickMatch':'match',{nickname:savedNick(),opponent:$('opponentNick').value,team:selectedTeam()});
  if(next.online){acceptMatch(next);return;}
  $('matchStatus').textContent=searchMode==='quick'?'Na fila. Aguardando outro jogador…':'Aguardando o adversário procurar pelo seu nick…';
  searchTimer=setTimeout(()=>{searchControls(false);$('matchStatus').textContent='A busca expirou. Tente novamente.';},120000);
 }catch(e){searchControls(false);$('matchStatus').textContent=e.message;}
 finally{onlineWorking=false;busy=false;$('cancelSearch').disabled=false;if(state?.online)render();}
}
matchDialog.querySelector('form').onsubmit=event=>{event.preventDefault();startMatchSearch();};
async function cancelPrivateSearch(){
 if(onlineWorking)return;
 if(!$('startSearch').disabled){matchDialog.close();return;}
 onlineWorking=true;$('cancelSearch').disabled=true;
 try{
  const next=await roomRequest('cancelMatch');
  if(next.online){acceptMatch(next);return;}
  clearTimeout(searchTimer);searchControls(false);matchDialog.close();
 }catch(e){$('matchStatus').textContent=e.message;}
 finally{onlineWorking=false;$('cancelSearch').disabled=false;}
}
$('cancelSearch').onclick=cancelPrivateSearch;
matchDialog.addEventListener('cancel',event=>{event.preventDefault();cancelPrivateSearch();});
const renderOnline=render;
render=function(){
 renderOnline();
 roomButton.textContent='ESCOLHER NICK';
 if(state?.online&&matchDialog.open){clearTimeout(searchTimer);searchControls(false);matchDialog.close();}
};
