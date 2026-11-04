let state,images={},selected=null,viewed=null,queue=[],busy=false,chosen=[],lang='pt',zoom=1,revision=-1;
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const keys=['tai','blood','nin','gen'],colors={tai:['#20cf27','Taijutsu','Taijutsu'],blood:['#e32a32','Bloodline','Bloodline'],nin:['#139ad5','Ninjutsu','Ninjutsu'],gen:['#fff','Genjutsu','Genjutsu'],rand:['#171717','Genérica','Random']};
const words={auto:['Energia automática','Auto energy'],training:['TREINO LOCAL','LOCAL TRAINING'],mirror:['EQUIPE ADVERSÁRIA','OPPOSING TEAM'],exchange:['TROCAR ENERGIA','EXCHANGE ENERGY'],newGame:['NOVO JOGO','NEW GAME'],team:['ESCOLHER EQUIPE','CHOOSE TEAM'],clear:['LIMPAR AÇÕES','CLEAR ACTIONS'],journal:['REGISTRO','BATTLE LOG'],cancel:['CANCELAR','CANCEL'],chooseTeam:['ESCOLHA A ORDEM DA EQUIPE','CHOOSE YOUR TEAM ORDER'],resetHelp:['Inicia uma nova partida contra a CPU.','Starts a new match against the CPU.'],start:['INICIAR','START'],close:['FECHAR','CLOSE'],ready:['PRESSIONE QUANDO PRONTO','PRESS WHEN READY'],skillPrompt:['Selecione uma habilidade','Select a skill'],chooseTarget:['Escolha um retrato destacado.','Choose a highlighted portrait.'],insufficient:['Energia insuficiente. Guarde energia ou remova uma ação.','Not enough energy. Save energy or remove an action.'],queued:['Ação preparada. Clique na miniatura para remover.','Action queued. Click its thumbnail to remove.'],newTurn:['Seu turno. Escolha uma habilidade.','Your turn. Choose a skill.'],blocked:['Habilidade bloqueada, em recarga ou sem alvo.','Skill locked, on cooldown or without a valid target.'],choose:['ESCOLHA','CHOOSE'],random:['ENERGIA(S) GENÉRICA(S)','RANDOM ENERGY'],left:['ENERGIA RESTANTE:','ENERGY LEFT:'],spend:['ENERGIA GENÉRICA:','RANDOM ENERGY:'],round:['TURNO','TURN'],passive:['PASSIVA','PASSIVE'],duration:['turno(s)','turn(s)'],cooldown:['COOLDOWN','COOLDOWN'],resolving:['RESOLVENDO…','RESOLVING…']};
const t=k=>words[k]?.[lang==='pt'?0:1]||k,label=k=>colors[k][lang==='pt'?1:2],icon=id=>images[id]?.icon||(id.startsWith('custom-')?'/assets/logo.png':''),picture=(n,s)=>images[n.id]?.[norm(s.name)]||icon(n.id),orb=k=>`<i class="orb" style="--color:${colors[k][0]}" title="${label(k)}"></i>`;
const abilityEN={'Armadilheiro':'Bear Traps','Forma camuflada':'Cloaked Form','Motor da motosserra':'Chainsaw Engine','Proteção da Entidade':'Entity’s Protection','O Caçador':'The Trapper','O Espectro':'The Wraith','O Caipira':'The Hillbilly','Cutelo':'Cleaver','Armadilha de urso':'Bear Trap','Força brutal':'Brutal Strength','Presença perturbadora':'Unnerving Presence','Crânio de Azarov':"Azarov’s Skull",'Sino das Lamentações':'Wailing Bell','Emboscada':'Ambush','Cão de caça':'Bloodhound','Martelo':'Hammer','Preparar motosserra':'Rev the Chainsaw','Arrancada de motosserra':'Chainsaw Sprint','Resistência':'Enduring','Agitação':'Agitation','Predador':'Predator','Nascido da luz':'Lightborn'};
const enDesc={};
let ptBr={};
const nameOf=s=>lang==='en'?(abilityEN[s]||s):(ptBr[s]||s),descOf=e=>e.name==='Motor aquecido'?(lang==='pt'?'Motor aquecido: Overdrive está disponível. O aquecimento dura até 3 turnos ou até ser consumido pelo Overdrive.':enDesc['Motor aquecido']):lang==='en'?(enDesc[e.name]||e.desc):(ptBr[e.desc]||e.desc);
async function api(command,extra={}){const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,...extra})});const data=await r.json();if(data.error)throw Error(data.error.replace(/^user error \(|\)$/g,''));return data;}
function message(s){$('message').textContent=[...words.newTurn,...words.chooseTarget,...words.queued].includes(s)?'':s;}
function costs(){const c={blood:0,gen:0,nin:0,tai:0,rand:0};for(const m of queue)for(const k in c)c[k]+=state.fighters[m.actor].skills[m.skill].cost[k]||0;return c;}
function reserved(){const c=costs(),pool={...state.energy};for(const k of keys)pool[k]-=c[k];return {pool,generic:c.rand};}
function possible(){const {pool,generic}=reserved();return keys.every(k=>pool[k]>=0)&&keys.reduce((sum,k)=>sum+pool[k],0)>=generic;}
const fxList=n=>[...n.effects,...(n.defenses||[])],fxPicture=e=>images[e.ownerId]?.[norm(e.skill)]||icon(e.ownerId);
function effectMarkup(e,n,i){return `<button class="effectIcon ${e.permanent?'passive':''}" data-effect="${i}" data-owner="${n.slot}" aria-label="${esc(nameOf(e.name))}: ${e.permanent?t('passive'):e.turns+' '+t('duration')}" title="${esc(nameOf(e.name)+' · '+(e.permanent?t('passive'):e.turns+' '+t('duration')))}"><img src="${fxPicture(e)}" alt=""><b>${e.permanent?'∞':e.turns}</b></button>`;}
function fighterMarkup(n){const action=queue.find(m=>m.actor===n.slot),valid=selected?.targets.includes(n.slot)&&!state.winner,incoming=queue.filter(m=>m.target===n.slot),skill=action&&n.skills[action.skill];return `<div class="fighter ${n.hp<=0?'dead':''} ${valid?'validTarget':''}"><div class="portraitBlock"><button class="portrait" data-target="${n.slot}" aria-label="${esc(nameOf(n.name))} · ${n.slot<3?'aliado':'inimigo'}"><img src="${icon(n.id)}" alt="${esc(nameOf(n.name))}">${n.hp<=0?'<b class="deadMark">×</b>':''}</button><div class="hp ${n.hp<40?'low':''}"><i style="width:${Math.max(0,n.hp)}%"></i><b>${n.hp}/100</b></div>${incoming.length?`<div class="targetActions">${incoming.map(m=>`<button class="targetAction" data-remove="${m.actor}" title="${esc(nameOf(state.fighters[m.actor].skills[m.skill].name))}"><img src="${picture(state.fighters[m.actor],state.fighters[m.actor].skills[m.skill])}" alt="${esc(nameOf(state.fighters[m.actor].skills[m.skill].name))}"></button>`).join('')}</div>`:''}</div><div class="fighterInfo"><h3>${esc(nameOf(n.name))}</h3><div class="statusRow">${fxList(n).map((e,i)=>effectMarkup(e,n,i)).join('')}</div>${n.slot<3?`<div class="skills"><button class="preparedAction" ${action?`data-remove="${n.slot}"`:''} aria-label="${action?'Remover '+esc(nameOf(skill.name)):'Ação preparada'}">${action?`<img src="${picture(n,skill)}" alt="${esc(nameOf(skill.name))}">`:'?'}</button>${n.skills.map(s=>`<button ${canQueueSkill(n.slot,s)?'':'data-unavailable="true"'} class="skill ${!canQueueSkill(n.slot,s)?'unavailable':''} ${action?'queuedLock':''} ${selected?.actor===n.slot&&selected.index===s.index?'active':''}" data-actor="${n.slot}" data-skill="${s.index}" title="${esc(nameOf(s.name))}" aria-label="${esc(nameOf(n.name)+': '+nameOf(s.name))}"><img src="${picture(n,s)}" alt="">${s.cooldown?`<span class="cooldown">${s.cooldown}</span>`:''}</button>`).join('')}</div>`:''}</div></div>`;}
function showDetail(){const d=viewed;if(!d){$('details').innerHTML=`<span class="eyebrow">${t('skillPrompt')}</span><p>${lang==='pt'?'Clique em uma habilidade e depois em um alvo destacado. Os ícones pequenos aparecem somente quando há efeitos ativos e mostram a duração.':'Click a skill, then a highlighted target. Small icons show active effects and their duration.'}</p>`;return;}if(d.fighter!=null){const n=state.fighters[d.fighter];$('details').innerHTML=`<img class="detailIcon" src="${icon(n.id)}" alt=""><h2>${esc(nameOf(n.name))}</h2><div class="miniEffects">${fxList(n).map((e,i)=>effectMarkup(e,n,i)).join('')}</div><p>${n.hp}/100 HP</p>`;return;}if(d.effect){const e=d.effect;$('details').innerHTML=`<img class="detailIcon" src="${fxPicture(e)}" alt=""><h2>${esc(nameOf(e.name))}</h2><p>${esc(descOf(e))}</p><span class="meta">${e.permanent?t('passive')+' · ∞':e.turns+' '+t('duration')}</span>`;return;}const n=state.fighters[d.actor],s=n.skills[d.index];$('details').innerHTML=`<img class="detailIcon" src="${picture(n,s)}" alt=""><h2>${esc(nameOf(s.name))}</h2><div class="costs">${Object.entries(s.cost).flatMap(([k,count])=>Array.from({length:Math.min(count,9)},()=>orb(k))).join('')||'—'}</div><p>${esc(descOf(s))}</p><p class="energyExplanation">${energyExplanation(s.cost)}</p><span class="recharge">${t('cooldown')}: ${s.baseCooldown}</span>`;}
function render(){if(!state)return;const {pool,generic}=reserved();$('allies').innerHTML=state.fighters.slice(0,3).map(fighterMarkup).join('');$('enemies').innerHTML=state.fighters.slice(3).map(fighterMarkup).join('');$('energy').innerHTML=keys.map(k=>`<span class="energyItem" title="${label(k)}">${orb(k)}×${Math.max(0,pool[k])}</span>`).join('');$('energyTotal').title=lang==='pt'?'Soma das quatro cores exibidas. Custos genéricos serão pagos na distribuição.':'Sum of the four displayed colors. Random costs are paid in distribution.';$('energyTotal').textContent='T×'+Math.max(0,keys.reduce((s,k)=>s+pool[k],0));$('round').textContent=t('round')+' '+state.round;$('endTurn').disabled=busy||!!state.winner;$('readyLabel').textContent=state.winner||t(busy?'resolving':'ready');$('exchangeButton').disabled=busy||!!state.winner||queue.length>0||keys.reduce((s,k)=>s+state.energy[k],0)<5;$('log').innerHTML=state.log.map(l=>`<li>${esc(nameOf(l))}</li>`).join('');showDetail();updateTurnSummary();syncLobby();tick();}
function applyLanguage(){document.documentElement.lang=lang==='pt'?'pt-BR':'en';document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));$('languageButton').textContent='PORTUGUÊS';if(state)render();}
document.addEventListener('click',e=>{if(!state)return;const fx=e.target.closest('[data-effect]');if(fx){viewed={effect:fxList(state.fighters[+fx.dataset.owner])[+fx.dataset.effect]};showDetail();return;}const remove=e.target.closest('[data-remove]');if(remove&&!busy){queue=queue.filter(m=>m.actor!==+remove.dataset.remove);selected=null;render();return;}const sk=e.target.closest('[data-skill]');if(sk){const n=state.fighters[+sk.dataset.actor],s=n.skills[+sk.dataset.skill];viewed={actor:n.slot,index:s.index};if(!canQueueSkill(n.slot,s)){selected=null;showDetail();return;}if(busy||state.yourTurn===false){selected=null;showDetail();return;}if(state.winner){selected=null;showDetail();return message(state.winner+' · '+t('newGame'));}if(queue.some(m=>m.actor===n.slot)){selected=null;render();return message(lang==='pt'?'Este personagem já tem 1 ação preparada. Clique na miniatura à esquerda para removê-la antes de escolher outra.':'This character already has 1 queued action. Remove its thumbnail before choosing another.');}if(!s.targets.length){selected=null;showDetail();return message(t('blocked'));}if(!canQueueSkill(n.slot,s)){selected=null;render();return message(t('insufficient'));}selected=selected?.actor===n.slot&&selected.index===s.index?null:{...s,actor:n.slot};render();message(!s.targets.length?t('blocked'):t('chooseTarget'));return;}const target=e.target.closest('[data-target]');if(target&&!busy){const targetSlot=+target.dataset.target;if(!selected){viewed={fighter:targetSlot};showDetail();return;}if(!selected.targets.includes(targetSlot))return message(t('chooseTarget'));if(state.winner||queue.some(m=>m.actor===selected.actor))return message(lang==='pt'?'Só uma ação por personagem neste turno.':'Only one action per character per turn.');const previous=queue;queue=[...queue,{actor:selected.actor,skill:selected.index,target:targetSlot}];if(!possible()){queue=previous;return message(t('insufficient'));}selected=null;render();message(t('queued'));return;}const p=e.target.closest('[data-payment]');if(p){const i=+p.dataset.payment,step=+p.dataset.step,total=payment.reduce((s,n)=>s+n,0);if(step>0&&total<paymentRequired&&payment[i]<paymentPool[keys[i]])payment[i]++;if(step<0&&payment[i]>0)payment[i]--;drawPayment();}const character=e.target.closest('[data-character]');if(character){const id=character.dataset.character;chosen=chosen.includes(id)?chosen.filter(x=>x!==id):[...chosen,id];renderRoster();}});
let paymentMode='turn',payment=[0,0,0,0],paymentPool={},paymentRequired=0,exchangeColor=0,paymentRound=0;
function openPayment(mode){paymentMode=mode;paymentRound=state.round;payment=[0,0,0,0];exchangeColor=0;const r=reserved();paymentPool=mode==='turn'?r.pool:{...state.energy};paymentRequired=mode==='turn'?r.generic:5;$('overlay').hidden=false;$('paymentError').textContent='';drawPayment();$('closePayment').focus();}
function drawPayment(){const total=payment.reduce((s,n)=>s+n,0);$('paymentNotice').hidden=paymentMode==='turn';$('paymentNotice').textContent=paymentMode==='exchange'?(lang==='pt'?'Troque 5 energias guardadas por 1 da cor escolhida.':'Exchange 5 saved energy for 1 chosen color.'):(lang==='pt'?`Estoque: ${keys.reduce((n,k)=>n+state.energy[k],0)}. Este turno usa ${costs().rand} genérica(s). A energia que sobrar fica guardada.`:`Pool: ${keys.reduce((n,k)=>n+state.energy[k],0)}. This turn uses ${costs().rand} random energy. Unspent energy stays in your pool.`);$('paymentSkills').title=lang==='pt'?'Execução da esquerda para a direita. Arraste os ícones para mudar a ordem.':'Actions execute left to right. Drag icons to reorder.';$('paymentTitle').innerHTML=`${t('choose')} <em>${paymentRequired-total}</em> ${t('random')}`;$('paymentGrid').innerHTML=`<div class="paymentHeader"><span>${t('left')}</span><span>${t('spend')}</span></div>`+keys.map((k,i)=>`<div class="paymentRow"><span class="kind">${orb(k)} ${label(k)}</span><span class="leftNum">${paymentPool[k]-payment[i]}</span><button data-payment="${i}" data-step="-1" aria-label="Diminuir ${label(k)}" ${payment[i]?'':'disabled'}>−</button><button data-payment="${i}" data-step="1" aria-label="Aumentar ${label(k)}" ${total<paymentRequired&&payment[i]<paymentPool[k]?'':'disabled'}>+</button><span class="kind rightKind">${orb(k)} ${label(k)}</span><span class="spentNum">${payment[i]}</span></div>`).join('');if(paymentMode==='turn'&&paymentRequired===0){$('paymentTitle').textContent=queue.length?(lang==='pt'?'CONFIRMAR AÇÕES · SEM CUSTO GENÉRICO':'CONFIRM ACTIONS · NO RANDOM COST'):(lang==='pt'?'PASSAR TURNO E GUARDAR ENERGIA':'PASS TURN AND SAVE ENERGY');$('paymentNotice').textContent=lang==='pt'?(queue.length?'Estas ações não exigem distribuir energia genérica. Os custos fixos já estão reservados.':'Nenhuma habilidade preparada: você não gasta energia. O estoque permanece guardado.'):(queue.length?'These actions require no random energy. Fixed costs are already reserved.':'No skills queued: you spend no energy. The pool remains saved.');}$('paymentSkills').innerHTML=paymentMode==='turn'?queue.map((m,i)=>`<div class="queueSkill" draggable="true" data-order="${i}" role="listitem" aria-label="${i+1}: ${esc(nameOf(state.fighters[m.actor].skills[m.skill].name))}"><img draggable="false" src="${picture(state.fighters[m.actor],state.fighters[m.actor].skills[m.skill])}" title="${esc(nameOf(state.fighters[m.actor].skills[m.skill].name))}" alt="${esc(nameOf(state.fighters[m.actor].skills[m.skill].name))}"></div>`).join(''):'';$('confirmPayment').disabled=busy||total!==paymentRequired;$('exchangeChoice').innerHTML=paymentMode==='exchange'?`<label>${lang==='pt'?'Receber':'Receive'}: <select id="receiveColor">${keys.map((k,i)=>`<option value="${i}">${label(k)}</option>`).join('')}</select></label>`:'';if($('receiveColor')){$('receiveColor').value=String(exchangeColor);$('receiveColor').onchange=e=>exchangeColor=+e.target.value;}}
async function submitTurn(spending){if(busy)return;busy=true;selected=null;render();try{state=await api('turn',{moves:queue,payment:spending,round:state.round});queue=[];viewed=null;revision=state.revision;message(state.winner||t('newTurn'));}catch(e){message(e.message);}finally{busy=false;render();}}
function nativePayment(){return ['blood','gen','nin','tai'].map(k=>payment[keys.indexOf(k)]);}
function autoPayment(){const {pool,generic}=reserved(),p={blood:0,gen:0,nin:0,tai:0};let left=generic;while(left>0){const k=keys.filter(k=>pool[k]>0).sort((a,b)=>pool[b]-pool[a])[0];if(!k)throw Error(t('insufficient'));p[k]++;pool[k]--;left--;}return ['blood','gen','nin','tai'].map(k=>p[k]);}
$('endTurn').onclick=()=>{if(busy||!state||state.winner||state.yourTurn===false)return;if(!reserved().generic)return submitTurn([0,0,0,0]);if($('autoEnergy').checked)return submitTurn(autoPayment());openPayment('turn');};
$('confirmPayment').onclick=async()=>{if(busy||payment.reduce((s,n)=>s+n,0)!==paymentRequired)return;if(paymentRound!==state.round){$('overlay').hidden=true;return message(lang==='pt'?'O turno já terminou.':'The turn has ended.');}$('overlay').hidden=true;if(paymentMode==='turn')return submitTurn(nativePayment());busy=true;try{state=await api('exchange',{payment:nativePayment(),exchangeTo:['blood','gen','nin','tai'].indexOf(keys[exchangeColor])});revision=state.revision;message(lang==='pt'?'Troca concluída.':'Energy exchanged.');}catch(e){message(e.message);}finally{busy=false;render();}};
$('closePayment').onclick=()=>$('overlay').hidden=true;$('exchangeButton').onclick=()=>openPayment('exchange');$('clear').onclick=()=>{if(busy)return;queue=[];selected=null;render();};
$('autoEnergy').checked=localStorage.getItem('narutoAutoEnergy')==='true';$('autoEnergy').onchange=e=>{localStorage.setItem('narutoAutoEnergy',String(e.target.checked));updateTurnSummary();message(lang==='pt'?(e.target.checked?'Automático: os custos genéricos serão escolhidos por você ao confirmar.':'Manual: a distribuição aparece quando as ações exigem energia genérica.'):(e.target.checked?'Auto: random costs are chosen when confirming.':'Manual: choose energy when random costs are required.'));};$('languageButton').onclick=()=>{};
function renderRoster(){$('roster').innerHTML=state.roster.map(c=>`<button class="${chosen.includes(c.id)?'selected':''}" data-character="${c.id}"><img src="${icon(c.id)}" alt=""><b>${esc(nameOf(c.name))}</b>${chosen.includes(c.id)?chosen.indexOf(c.id)+1:'+'}</button>`).join('');$('startTeam').disabled=chosen.length!==3;}
$('teamButton').onclick=()=>{chosen=state.fighters.slice(0,3).map(n=>n.id).filter(id=>state.roster.some(c=>c.id===id));renderRoster();$('teamDialog').showModal();};$('closeTeam').onclick=()=>$('teamDialog').close();$('startTeam').onclick=async()=>{if(busy||chosen.length!==3)return;busy=true;try{state=await api('reset',{team:chosen});revision=state.revision;queue=[];selected=null;viewed=null;$('teamDialog').close();message(t('newTurn'));}catch(e){message(e.message);}finally{busy=false;render();}};
$('journalButton').onclick=()=>$('journalDialog').showModal();$('closeJournal').onclick=()=>$('journalDialog').close();$('settingsButton').onclick=()=>{$('autoEnergy').focus();message(lang==='pt'?'Marque Energia automática para distribuir os custos genéricos ao confirmar o turno.':'Enable Auto energy to distribute random costs when confirming your turn.');};
function fit(){const available=Math.min((window.innerWidth-16)/770,(window.innerHeight-26)/560);const scale=zoom==='fit'?Math.max(.1,Math.min(2.5,available)):Math.max(.1,Math.min(zoom,available));$('arena').style.transform=`scale(${scale})`;$('arena').style.transformOrigin='top left';$('gameWindow').style.width=770*scale+'px';$('gameWindow').style.height=560*scale+'px';$('scaleButton').textContent=(zoom==='fit'?(lang==='pt'?'Ajustar':'Fit')+' · ':'')+Math.round(scale*100)+'%';}window.addEventListener('resize',fit);$('scaleButton').onclick=()=>{zoom=zoom==='fit'?1:zoom===1?1.5:'fit';fit();};fit();
function tick(){if(!state)return;const remain=Math.max(0,state.deadline-Date.now());$('timerFill').style.width=(state.winner?0:Math.min(100,remain/(state.turnSeconds*1000||60000)*100))+'%';$('timerFill').classList.toggle('urgent',remain<15000);$('endTurn').title=Math.ceil(remain/1000)+'s';$('timerSeconds').textContent=state.winner?'':Math.ceil(remain/1000)+'s';}
setInterval(tick,200);let polling=false;setInterval(async()=>{if(!state||busy||polling)return;polling=true;try{const next=await api('state');if(next.revision!==revision){state=next;revision=next.revision;queue=[];selected=null;viewed=null;$('overlay').hidden=true;render();message(state.winner||state.notice||t('newTurn'));}else state.deadline=next.deadline;}catch{}finally{polling=false;}},1200);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('overlay').hidden)$('overlay').hidden=true;else{selected=null;render();}}});
applyLanguage();(async()=>{try{[images,ptBr]=await Promise.all([fetch('/images.json').then(r=>r.json()),fetch('/pt-br.json').then(r=>r.ok?r.json():{}).catch(()=>({}))]);const rawSandbox=sessionStorage.getItem('narutoSandboxMatch');
if(new URLSearchParams(location.search).has('sandbox')&&rawSandbox){
 state=await api('reset',JSON.parse(rawSandbox));
 sessionStorage.removeItem('narutoSandboxMatch');
 history.replaceState(null,'','/ingame');
}else state=await api('state');
revision=state.revision;render();message(t('newTurn'));}catch(e){message(e.message);}})();

function energyExplanation(cost){const parts=keys.filter(k=>cost[k]>0).map(k=>cost[k]+' '+label(k));if(cost.rand)parts.push(cost.rand+' '+(lang==='pt'?'genérica(s), de qualquer cor':'random, any color'));return (lang==='pt'?'Custo: ':'Cost: ')+(parts.join(' + ')||(lang==='pt'?'nenhum':'none'));}
function showEnergyHelp(){ $('energyHelpTitle').textContent=lang==='pt'?'COMO FUNCIONA A ENERGIA':'HOW ENERGY WORKS';const roles={tai:lang==='pt'?'força física e potência. Ex.: Força brutal e Arrancada.':'physical force. Examples: Brutal Strength, Chainsaw Sprint.',blood:lang==='pt'?'vitalidade, ferimentos e letalidade. Ex.: cura, Armadilha e Overdrive.':'injury and lethality. Examples: Bear Trap, Overdrive.',nin:lang==='pt'?'camuflagem e poderes sobrenaturais. Ex.: Sino das Lamentações.':'concealment and supernatural powers. Example: Wailing Bell.',gen:lang==='pt'?'controle, emboscadas e respostas táticas. Ex.: Armadilha, Emboscada e Resistência.':'control, ambushes and tactical responses. Examples: Bear Trap, Ambush, Enduring.'};$('energyHelpBody').innerHTML=keys.map(k=>'<p>'+orb(k)+' <b>'+label(k)+'</b> — '+roles[k]+'</p>').join('')+'<p>'+orb('rand')+' <b>'+(lang==='pt'?'Genérica':'Random')+'</b> — '+(lang==='pt'?'custo pago com qualquer uma das quatro cores; não é uma quinta energia.':'a cost paid with any of the four colors; not a fifth energy.')+'</p><p>'+(lang==='pt'?'Você começa com 1 energia; depois recebe uma cor aleatória por aliado vivo ao fim do seu turno. Cada cor tem 25% de chance: verde = Brutalidade (Taijutsu), vermelho = Sangue (Bloodline), azul = Névoa (Ninjutsu), branco = Astúcia (Genjutsu). Sobras acumulam. Sem custo genérico, o turno é confirmado direto. Com custo genérico, o modo manual abre a distribuição; o automático escolhe as cores. Arraste as ações na distribuição ou use as setas para mudar a ordem.':'Start with 1 energy. Then gain one random energy per ally alive at the end of your turn. Unspent energy accumulates. No random cost: confirm directly. Otherwise choose colors manually or enable Auto energy. Reorder actions using drag or arrows.')+'</p>';$('energyDialog').showModal();}
$('energyHelpButton').onclick=showEnergyHelp;$('closeEnergy').onclick=()=>$('energyDialog').close();

function updateTurnSummary(){if(!state)return;const living=state.fighters.slice(0,3).filter(n=>n.hp>0).length,c=costs(),total=keys.reduce((n,k)=>n+state.energy[k],0);$('energyStatus').textContent=state.winner?(lang==='pt'?'PARTIDA ENCERRADA':'MATCH OVER'):(lang==='pt'?living+' vivo(s) · próximo ganho: +'+living:living+' alive · next income: +'+living);$('energyStatus').title=lang==='pt'?'O primeiro turno começa com 1 energia. Depois, recebe uma cor aleatória por personagem vivo ao fim do seu turno.':'First turn: 1 energy. Then receive one random energy per character alive at the end of your turn.';$('turnSummary').innerHTML='<span>'+(lang==='pt'?'Ações':'Actions')+': '+queue.length+'/3 · '+(lang==='pt'?'uma por personagem':'one per character')+'</span><span>'+(lang==='pt'?'Estoque':'Pool')+': '+total+' · '+(lang==='pt'?'genéricas a pagar':'random cost')+': '+c.rand+'</span><span>'+(lang==='pt'?'Distribuição':'Payment')+': '+($('autoEnergy').checked?(lang==='pt'?'automática':'automatic'):(lang==='pt'?'manual':'manual'))+'</span>';}
$('newGameButton').onclick=async()=>{if(busy)return;busy=true;try{state=await api('reset',{team:state.fighters.slice(0,3).map(n=>n.id)});revision=state.revision;queue=[];selected=null;viewed=null;$('overlay').hidden=true;message(t('newTurn'));}catch(e){message(e.message);}finally{busy=false;render();}};

function canQueueSkill(actor,s){if(!state||state.winner||state.fighters[actor]?.hp<=0||!s.targets.length||queue.some(m=>m.actor===actor))return false;const c=costs();for(const k in c)c[k]+=s.cost[k]||0;const remaining=keys.map(k=>state.energy[k]-c[k]);return remaining.every(n=>n>=0)&&remaining.reduce((a,b)=>a+b,0)>=c.rand;}
function reorderActions(from,to){if(busy||paymentMode!=='turn'||from===to||from<0||to<0||from>=queue.length||to>=queue.length)return;const [move]=queue.splice(from,1);queue.splice(to,0,move);drawPayment();render();}
$('paymentSkills').setAttribute('role','list');$('paymentSkills').setAttribute('aria-label','Ordem de execução das habilidades');
$('paymentSkills').addEventListener('dragstart',e=>{const item=e.target.closest('[data-order]');if(!item)return;e.dataTransfer.setData('text/plain',item.dataset.order);e.dataTransfer.effectAllowed='move';item.classList.add('dragging');});
$('paymentSkills').addEventListener('dragover',e=>{if(e.target.closest('[data-order]')){e.preventDefault();e.dataTransfer.dropEffect='move';}});
$('paymentSkills').addEventListener('drop',e=>{const item=e.target.closest('[data-order]');if(!item)return;e.preventDefault();reorderActions(Number(e.dataTransfer.getData('text/plain')),+item.dataset.order);});
$('paymentSkills').addEventListener('dragend',()=>document.querySelectorAll('.dragging').forEach(e=>e.classList.remove('dragging')));


Object.assign(abilityEN,{"Overdrive":"Overdrive","Motor aquecido":"Heated Engine"});

let lobbyCharacterId='naruto-uzumaki',lobbySkillIndex=null,lobbyFilter='killers',lobbyReady=false;
let lobbyRosterKey='',lobbyTeamKey='';
let teamPointerDrag=null,ignoreLobbyClickUntil=0;
const previousTeamSlots=new Map();
const selectedTeam=()=>chosen.filter(Boolean);
const canEditTeam=()=>!!state&&!state.started&&!busy&&!state.online?.ready;
function inspectLobbyCharacter(id){
 if(!state.roster.some(c=>c.id===id))return;
 lobbyCharacterId=id;lobbySkillIndex=null;lobbyPreviewOpen7=true;renderLobby();
}
function removeTeamMember(id){
 if(!canEditTeam())return;
 const slot=chosen.indexOf(id);if(slot<0)return;
 previousTeamSlots.set(id,slot);chosen[slot]=null;renderLobby();
}
function placeTeamMember(id,destination=null){
 if(!canEditTeam()||!state.roster.some(c=>c.id===id))return;
 chosen=Array.from({length:3},(_,i)=>chosen[i]||null);
 const current=chosen.indexOf(id);
 if(destination===null){
  if(current>=0)return;
  const preferred=previousTeamSlots.get(id);
  destination=Number.isInteger(preferred)&&!chosen[preferred]?preferred:chosen.findIndex(c=>!c);
 }
 if(!Number.isInteger(destination)||destination<0||destination>2){
  $('lobbyNotice').textContent=lang==='pt'?'Equipe cheia. Remova alguém ou arraste para o espaço que deseja substituir.':'Team full. Remove a character or drop onto the slot you want to replace.';return;
 }
 if(current===destination)return;
 const displaced=chosen[destination];
 if(current>=0)chosen[current]=displaced||null;
 else if(displaced)previousTeamSlots.set(displaced,destination);
 chosen[destination]=id;previousTeamSlots.set(id,destination);renderLobby();
}
function toggleTeamMember(id){if(chosen.includes(id))removeTeamMember(id);else placeTeamMember(id);}
function syncLobby(){
 const open=state.started!==true;$('arena').classList.toggle('inLobby',open);$('lobbyScreen').hidden=!open;
 if(open){if(!lobbyReady){chosen=state.fighters.slice(0,3).map(n=>n.id);if(chosen.some(id=>!state.roster.some(c=>c.id===id)))chosen=['naruto-uzumaki','sasuke-uchiha','sakura-haruno'];lobbyReady=true;}renderLobby();}
 document.querySelector('.profile.own img').src=icon(state.fighters[0].id);document.querySelector('.profile.opponent img').src=icon(state.fighters[3].id);
}
function renderLobby(){
 const c=state.roster.find(c=>c.id===lobbyCharacterId)||state.roster[0];lobbyCharacterId=c.id;
 const side=lang==='pt'?('COMBATENTE'):(c.side==='killers'?'KILLER':'SURVIVOR');
 $('previewName').textContent=nameOf(c.name);$('previewPortrait').src=icon(c.id);$('previewPortrait').alt=nameOf(c.name);$('previewRole').textContent=side;
 $('previewSkills').innerHTML=c.skills.map((sk,i)=>'<button data-preview-skill="'+i+'" class="'+(lobbySkillIndex===i?'active':'')+'" aria-label="Prévia: '+esc(nameOf(sk.name))+'" title="'+esc(nameOf(sk.name))+'"><img src="'+picture(c,sk)+'" alt=""></button>').join('');
 const sk=lobbySkillIndex==null?null:c.skills[lobbySkillIndex];
 $('previewDescription').innerHTML=sk?'<h3>'+esc(nameOf(sk.name))+'</h3><p>'+esc(descOf(sk))+'</p><div class="menuCosts">'+Object.entries(sk.cost).flatMap(([k,n])=>Array.from({length:n},()=>orb(k))).join('')+' <span>'+energyExplanation(sk.cost)+'</span><b>'+t('cooldown')+': '+sk.baseCooldown+'</b></div>':'<h3>'+esc(nameOf(c.name))+'</h3><p>'+esc(lang==='pt'?(ptBr[c.bio]||c.bio):c.bio)+'</p><small>'+(lang==='pt'?'Clique em uma das quatro habilidades para consultar efeito, custo e recarga.':'Click any of the four skills for effect, cost and cooldown.')+'</small>';
 const editable=canEditTeam(),count=selectedTeam().length;
 $('addPreview').textContent=chosen.includes(c.id)?(lang==='pt'?'REMOVER DA EQUIPE':'REMOVE FROM TEAM'):(lang==='pt'?'ADICIONAR À EQUIPE':'ADD TO TEAM');
 $('addPreview').disabled=!editable||(!chosen.includes(c.id)&&count>=3);
 const roster=state.roster.filter(c=>c.side===lobbyFilter),key=lang+':'+roster.map(c=>c.id).join(',');
 // Preserve portrait buttons between clicks so native double-click and drag
 // gestures are not cancelled by replacing the element under the pointer.
 if(lobbyRosterKey!==key){
  $('lobbyRoster').innerHTML=roster.map(c=>'<button data-lobby-character="'+c.id+'" aria-label="Consultar '+esc(nameOf(c.name))+'"><img draggable="false" src="'+icon(c.id)+'" alt=""><b>'+esc(nameOf(c.name))+'</b></button>').join('');lobbyRosterKey=key;
 }
 document.querySelectorAll('[data-lobby-character]').forEach(b=>{b.classList.toggle('inspected',b.dataset.lobbyCharacter===lobbyCharacterId);b.classList.toggle('picked',chosen.includes(b.dataset.lobbyCharacter));b.draggable=false;b.dataset.teamDraggable=String(editable);b.title=lang==='pt'?'Arraste para a equipe ou dê dois cliques para adicionar/remover.':'Drag to your team or double-click to add/remove.';});
 const slots=Array.from({length:3},(_,i)=>{const member=state.roster.find(c=>c.id===chosen[i]);return member?'<div class="teamSlot" data-team-slot="'+i+'"><button data-team-character="'+member.id+'" draggable="false" title="'+esc(nameOf(member.name))+' · '+(lang==='pt'?'dois cliques para remover':'double-click to remove')+'" aria-label="Consultar integrante '+(i+1)+': '+esc(nameOf(member.name))+'"><img draggable="false" src="'+icon(member.id)+'" alt="'+esc(nameOf(member.name))+'"><span>'+esc(nameOf(member.name))+'</span></button><button class="removeTeamMember" data-lobby-remove="'+member.id+'" aria-label="Remover '+esc(nameOf(member.name))+'" '+(editable?'':'disabled')+'>×</button></div>':'<div class="emptySlot" data-team-slot="'+i+'" aria-label="Espaço '+(i+1)+' vazio">'+(i+1)+'</div>';}).join('');
 // Keep team portrait elements stable as well, including the second click.
 const teamKey=JSON.stringify([chosen,lang,editable]);if(lobbyTeamKey!==teamKey){$('teamSlots').innerHTML=slots;lobbyTeamKey=teamKey;}
 $('teamCount').textContent=count+'/3';$('startCpuButton').disabled=busy||count!==3;
 $('startCpuButton').textContent=lang==='pt'?'PARTIDA RÁPIDA · CPU':'PLAY AGAINST CPU';
 $('presetTrio').disabled=!editable;document.querySelectorAll('[data-filter]').forEach(e=>e.classList.toggle('active',e.dataset.filter===lobbyFilter));
 $('lobbyNotice').textContent=count===3?(lang==='pt'?'Equipe pronta. A partida começa somente ao clicar no botão.':'Team ready. The match starts only when you press Play.'):(lang==='pt'?'Arraste um personagem para um espaço vazio ou dê dois cliques.':'Drag a character to an empty slot or double-click.');
}
document.addEventListener('click',e=>{
 if(!state)return;
 const remove=e.target.closest('[data-lobby-remove]');if(remove){removeTeamMember(remove.dataset.lobbyRemove);return;}
 const character=e.target.closest('[data-lobby-character],[data-team-character]');if(character){inspectLobbyCharacter(character.dataset.lobbyCharacter||character.dataset.teamCharacter);return;}
 const sk=e.target.closest('[data-preview-skill]');if(sk){lobbySkillIndex=+sk.dataset.previewSkill;renderLobby();return;}
 const filter=e.target.closest('[data-filter]');if(filter){if(filter.disabled||!state.roster.some(c=>c.side===filter.dataset.filter))return;lobbyFilter=filter.dataset.filter;lobbyCharacterId=state.roster.find(c=>c.side===lobbyFilter).id;lobbySkillIndex=null;renderLobby();}
});
document.addEventListener('dblclick',e=>{
 const portrait=e.target.closest('[data-lobby-character],[data-team-character]');if(!portrait)return;e.preventDefault();
 toggleTeamMember(portrait.dataset.lobbyCharacter||portrait.dataset.teamCharacter);
});
document.addEventListener('keydown',e=>{
 const portrait=e.target.closest('[data-lobby-character],[data-team-character]');if(!portrait||e.key!=='Enter'||e.repeat)return;e.preventDefault();toggleTeamMember(portrait.dataset.lobbyCharacter||portrait.dataset.teamCharacter);
});
function clearTeamDrag(){document.querySelectorAll('.draggingCharacter,.dropTarget,.acceptingCharacter').forEach(el=>el.classList.remove('draggingCharacter','dropTarget','acceptingCharacter'));}
// Pointer dragging works with mouse, touch and browsers that do not initiate
// HTML drag-and-drop from a button. Native image dragging stays disabled.
document.addEventListener('click',e=>{if(Date.now()<ignoreLobbyClickUntil&&e.target.closest('[data-lobby-character],[data-team-character]')){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('pointerdown',e=>{
 const source=e.target.closest('[data-lobby-character],[data-team-character]');if(!source||e.button!==0||!canEditTeam())return;
 teamPointerDrag={id:source.dataset.lobbyCharacter||source.dataset.teamCharacter,source,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false,ghost:null};source.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove',e=>{
 const drag=teamPointerDrag;if(!drag||drag.pointerId!==e.pointerId)return;
 if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
 e.preventDefault();
 if(!drag.active){drag.active=true;drag.source.classList.add('draggingCharacter');$('teamSlots').classList.add('acceptingCharacter');drag.ghost=document.createElement('img');drag.ghost.className='teamDragGhost';drag.ghost.src=icon(drag.id);drag.ghost.alt='';document.body.append(drag.ghost);}
 drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';
 document.querySelectorAll('.dropTarget').forEach(el=>el.classList.remove('dropTarget'));
 document.elementFromPoint(e.clientX,e.clientY)?.closest('#teamSlots [data-team-slot]')?.classList.add('dropTarget');
},{passive:false});
function finishTeamPointer(e,cancelled=false){
 const drag=teamPointerDrag;if(!drag||drag.pointerId!==e.pointerId)return;teamPointerDrag=null;
 drag.ghost?.remove();clearTeamDrag();
 if(drag.active){ignoreLobbyClickUntil=Date.now()+400;e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY);if(!cancelled&&target?.closest('#teamSlots')){const slot=target.closest('[data-team-slot]');placeTeamMember(drag.id,slot?+slot.dataset.teamSlot:null);}}
}
document.addEventListener('pointerup',e=>finishTeamPointer(e));document.addEventListener('pointercancel',e=>finishTeamPointer(e,true));
$('addPreview').onclick=()=>toggleTeamMember(lobbyCharacterId);
$('presetTrio').onclick=()=>{if(!canEditTeam())return;chosen=state.roster.filter(c=>c.side===lobbyFilter).slice(0,3).map(c=>c.id);renderLobby();};
$('startCpuButton').onclick=async()=>{if(busy||selectedTeam().length!==3)return;busy=true;let failure='';renderLobby();try{state=await api('reset',{team:selectedTeam()});revision=state.revision;queue=[];selected=null;viewed=null;message(t('newTurn'));}catch(e){failure=e.message;}finally{busy=false;render();if(failure)$('lobbyNotice').textContent=failure;}};

async function returnToLobby(){if(busy)return;busy=true;try{state=await api('lobby');revision=state.revision;queue=[];selected=null;viewed=null;lobbyReady=false;$('overlay').hidden=true;}catch(e){message(e.message);}finally{busy=false;render();}}
$('newGameButton').onclick=returnToLobby;$('teamButton').onclick=returnToLobby;

Object.assign(abilityEN,{"Golpe coordenado":"Coordinated Strike","Prove seu valor":"Prove Thyself","Líder":"Leader","Explosão de velocidade":"Sprint Burst","Rápida e silenciosa":"Quick & Quiet","Adrenalina":"Adrenaline","Defesa com pallet":"Pallet Strike","Conhecimento botânico":"Botany Knowledge","Autocuidado":"Self-Care"});

Object.assign(abilityEN,{
 'O Doutor':'The Doctor','A Caçadora':'The Huntress','O Canibal':'The Cannibal','O Pesadelo':'The Nightmare','A Porca':'The Pig','O Palhaço':'The Clown','O Espírito':'The Spirit','A Legião':'The Legion','A Praga':'The Plague',
 'Terapia de choque':'Shock Therapy','Explosão estática':'Static Blast','Presença avassaladora':'Overwhelming Presence','Loucura':'Madness',
 'Machadinha de caça':'Hunting Hatchet','Arremesso carregado':'Charged Throw','Imperativo territorial':'Territorial Imperative',
 'Motosserra de Bubba':"Bubba’s Chainsaw",'Martelo de abate':'Slaughter Mallet','A morte de Franklin':"Franklin’s Demise",
 'Demônio dos sonhos':'Dream Demon','Laço dos sonhos':'Dream Snare','Projeção onírica':'Dream Projection','Mundo dos Sonhos':'Dream World',
 'Lâmina oculta':'Hidden Blade','Armadilha reversa':'Reverse Bear Trap','Investida de emboscada':'Ambush Dash',
 'Tônico roxo':'Afterpiece Tonic','Antídoto amarelo':'Afterpiece Antidote','Coulrofobia':'Coulrophobia','Aceleração':'Haste',
 'Assombração de Yamaoka':"Yamaoka’s Haunting",'Corte de katana':'Katana Slash','Rancor':'Rancor',
 'Frenesi feral':'Feral Frenzy','Golpe profundo':'Deep Slash','Discordância':'Discordance',
 'Expurgo vil':'Vile Purge','Fonte corrompida':'Corrupted Pool','Expurgo corrupto':'Corrupt Purge','Corrupção':'Corruption',
 'Manto noturno':'Night Shroud','Facada furtiva':'Stealth Stab','Tremores emocionantes':'Thrilling Tremors','Vítima marcada':'Marked Victim'
});
Object.assign(enDesc,{
 'Terapia de choque':'Deals 15 mental damage, blocks physical skills for 1 turn and applies Madness for 3 turns. Mental skills remain usable.',
 'Explosão estática':'Deals 10 mental damage to each enemy and applies Madness for 3 turns.',
 'Presença avassaladora':'Requires Madness applied by this Doctor. Deals 10 mental damage. The target’s skills cost 1 extra random energy for 1 turn.',
 'Machadinha de caça':'Deals 30 ranged physical damage. Does not bypass damage reduction or invulnerability.',
 'Arremesso carregado':'Deals 45 ranged piercing damage. Ignores damage reduction, but not invulnerability.',
 'Imperativo territorial':'Hidden trap for up to 2 enemy turns. The target’s next physical skill deals 20 damage to them. Consumed when triggered; does not cancel the action.',
 'Motosserra de Bubba':'Deals 15 piercing damage to each enemy. Ignores damage reduction, but not invulnerability.',
 'Martelo de abate':'Deals 20 physical damage to one enemy.',
 'A morte de Franklin':'Destroys the target’s destructible protection and deals 15 physical damage. Does not remove invulnerability.',
 'Demônio dos sonhos':'Deals 20 mental damage and sends the target into the Dream World for 3 turns.',
 'Laço dos sonhos':'Requires Dream World applied by this Freddy. Deals 15 mental damage and blocks physical skills for 1 turn. Mental skills remain usable.',
 'Projeção onírica':'Deals 30 physical damage. Deals 15 extra against this Freddy’s sleeping victim, consuming Dream World and waking the target.',
 'Lâmina oculta':'Deals 20 physical damage to one enemy.',
 'Armadilha reversa':'Visible trap for up to 2 enemy turns. The target’s next action deals 25 damage to them and consumes the trap. Does not cancel or stun. No action means no damage.',
 'Investida de emboscada':'Deals 30 physical damage and reduces the Pig’s incoming physical damage by 10 for 1 turn.',
 'Tônico roxo':'Deals 15 physical damage and reduces the target’s physical damage by 10 for 2 turns. Does not stack with itself.',
 'Antídoto amarelo':'An ally, including the Clown, deals 10 extra physical damage for 2 turns and ignores stuns for 1 turn. The damage bonus does not stack with itself.',
 'Coulrofobia':'Deals 10 mental damage and prevents healing and curing negative effects for 2 turns.',
 'Assombração de Yamaoka':'Reduces incoming physical damage by 15 for 2 turns. Your next Katana Slash deals 15 extra damage and consumes the phase. Does not grant invulnerability.',
 'Corte de katana':'Deals 20 physical damage, or 35 while phasing. Consumes Yamaoka’s Haunting.',
 'Rancor':'Only targets enemies at 40 HP or less. Deals 30 piercing damage and bypasses invulnerability. Does not instantly kill.',
 'Frenesi feral':'Deals 5 physical damage to each enemy, then 5 bleeding damage per turn for 2 turns. Bleeding does not stack with itself. Up to 15 damage per target before modifiers.',
 'Golpe profundo':'Deals 20 physical damage, or 35 against this Legion’s Feral Frenzy wound. Consumes that wound.',
 'Discordância':'For 2 turns, one enemy takes 10 extra damage from each physical attack. Does not affect mental damage or bleeding, and does not stack with itself.',
 'Expurgo vil':'Deals 10 mental damage and infects for 2 turns: 5 damage each turn, with healing and curing blocked. Does not stack with itself. Up to 20 damage before modifiers.',
 'Fonte corrompida':'Heals self for 10 and gains Corruption for 3 turns, unlocking one use of Corrupt Purge.',
 'Expurgo corrupto':'Requires and consumes Corruption. Deals 25 ranged piercing damage to each enemy. Ignores damage reduction, but not invulnerability.',
 'Manto noturno':'Marks an enemy for 3 turns and reduces Ghost Face’s incoming physical damage by 15 for 1 turn. His next Stealth Stab against that victim deals 25 extra damage and consumes the mark.',
 'Facada furtiva':'Deals 20 physical damage, or 45 against a victim marked by this Ghost Face. Consumes the mark. Does not bypass invulnerability.',
 'Tremores emocionantes':'Deals 10 physical damage and blocks mental skills for 1 turn. Physical skills remain usable.'
});

Object.assign(abilityEN,{'Demogorgon':'Demogorgon','O Oni':'The Oni','Dilacerar':'Shred','Portal do Mundo Invertido':'Upside Down Portal','Quebra-mente':'Mindbreaker','Katana ensanguentada':'Bloodied Katana','Orbes de sangue':'Blood Orbs','Fúria de sangue':'Blood Fury','Golpe demoníaco':'Demon Strike'});

