const soundToggle=document.createElement('button');
soundToggle.id='soundToggle';
let soundOn=localStorage.getItem('narutoSound')!=='off';
if(localStorage.getItem('narutoAudioVersion')!=='unison-native-2'){soundOn=true;localStorage.setItem('narutoSound','on');localStorage.setItem('narutoAudioVersion','unison-native-2');}
function showSound(){soundToggle.textContent=soundOn?'🔊 SOM':'🔇 SOM';soundToggle.setAttribute('aria-pressed',soundOn);}
showSound();
document.querySelector('.windowTools').insertBefore(soundToggle,$('scaleButton'));
soundToggle.onclick=()=>{soundOn=!soundOn;localStorage.setItem('narutoSound',soundOn?'on':'off');showSound();if(soundOn)playSound('click');};
const soundFiles={scroll_open:'Scroll',scroll_close:'Cancel',skill_select:'Click',pass_turn:'NextTurn',click:'Click',match_start:'StartFirst',match_found:'StartSecond',my_turn:'StartTurn',death:'Death',victory:'Win',defeat:'Lose'};
const sounds={};
for(const name of ['scroll_open','skill_select','click']){const clip=sounds[name]=new Audio('/assets/audio/'+soundFiles[name]+'.ogg');clip.preload='auto';}

function playSound(name){
 if(!soundOn)return;
 const clip=sounds[name]??=new Audio('/assets/audio/'+(soundFiles[name]||'Click')+'.ogg');
 clip.volume=.65;clip.muted=false;clip.currentTime=0;clip.play().catch(()=>{});
}
window.addEventListener('click',e=>{
 if(Date.now()<ignoreLobbyClickUntil&&e.target.closest('[data-lobby-character],[data-team-character]'))return;
 if(!e.target.closest('button')||e.target.closest('#soundToggle'))return;
 if(e.target.closest('[data-lobby-character], [data-team-character]'))playSound('scroll_open');
 else if(e.target.closest('#closeCharacterPreview'))playSound('scroll_close');
 else if(e.target.closest('[data-skill], [data-preview-skill], [data-inspect-skill]'))playSound('skill_select');
 else if(e.target.closest('#endTurn'))playSound('pass_turn');
 else playSound('click');
},true);
const narutoRender=render;
let lastStarted=false,lastTurn=false,lastWinner='',lastHP=[];
render=function(){
 narutoRender();
 if(!state)return;
 if(state.started&&!lastStarted)playSound('match_start');
 else if(state.started&&state.winner&&state.winner!==lastWinner)playSound(state.winner==='Você venceu'?'victory':'defeat');
 else if(state.started&&lastHP.some((hp,i)=>hp>0&&state.fighters[i]?.hp===0))playSound('death');
 else if(state.started&&state.yourTurn&&!lastTurn&&!state.winner)playSound('my_turn');
 lastStarted=state.started;lastTurn=state.yourTurn;lastWinner=state.winner;lastHP=state.fighters.map(n=>n.hp);
};
const rosterSearch=document.createElement('input');
const arenaBanner=document.createElement('div');
arenaBanner.className='arenaBanner';
arenaBanner.innerHTML='<img src="/assets/bg/kyuubi.png" alt=""><h1>Naruto Arena</h1>';
$('lobbyScreen').prepend(arenaBanner);
const privateMatch=document.createElement('button');
privateMatch.id='privateMatch';
privateMatch.textContent='START PRIVATE GAME';
privateMatch.onclick=showPrivateMatch;
$('startCpuButton').after(privateMatch);
const localProfile=document.createElement('div');
localProfile.className='localProfile';
localProfile.innerHTML='<img src="/assets/ninja/naruto-uzumaki/icon.jpg" alt=""><div><b>JOGADOR LOCAL</b><span>ESTUDANTE DA ACADEMIA</span><span>VILA DA FOLHA</span></div>';
$('teamSelection').prepend(localProfile);
rosterSearch.type='search';rosterSearch.placeholder='Buscar ninja';rosterSearch.setAttribute('aria-label','Buscar ninja');
$('rosterFilters').append(rosterSearch);
const originalLobby=renderLobby;
let rosterPage=0;
const pageSize=21;
const pager=document.createElement('nav');
pager.className='rosterPager';
pager.innerHTML='<button type="button" aria-label="Página anterior">❮</button><button type="button" aria-label="Próxima página">❯</button>';
$('lobbyBottom').append(pager);
const [prevPage,nextPage]=pager.children;
prevPage.onclick=()=>{rosterPage--;filterRoster();};
nextPage.onclick=()=>{rosterPage++;filterRoster();};
const previewArt=document.createElement('img');
previewArt.className='profileTechniqueArt';
previewArt.alt='';
$('characterPreview').append(previewArt);
function filterRoster(){
 const query=rosterSearch.value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
 const buttons=[...$('lobbyRoster').children];
 const matches=buttons.filter(b=>b.textContent.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').includes(query));
 const lastPage=Math.max(0,Math.ceil(matches.length/pageSize)-1);
 rosterPage=Math.max(0,Math.min(rosterPage,lastPage));
 const visible=new Set(matches.slice(rosterPage*pageSize,(rosterPage+1)*pageSize));
 for(const button of buttons){button.hidden=!visible.has(button);const picked=chosen.includes(button.dataset.lobbyCharacter);button.classList.toggle('rosterVacancy',picked);button.setAttribute('aria-label',picked?'Espaço vazio: ninja na equipe':'Consultar '+button.textContent);}
 prevPage.disabled=rosterPage===0;
 nextPage.disabled=rosterPage===lastPage;
}
renderLobby=function(){
 originalLobby();
 filterRoster();
 const quick=$('startCpuButton');
 quick.classList.toggle('classicQuick',!state.online);
 quick.title=state.online?'Confirmar equipe':'Partida rápida contra CPU';
 const character=state.roster.find(c=>c.id===lobbyCharacterId);
 const technique=character?.skills[lobbySkillIndex];
 if(character)previewArt.src=technique?picture(character,technique):icon(character.id);
};
$('presetTrio').onclick=()=>{
 if(!canEditTeam())return;
 chosen=['naruto-uzumaki','sasuke-uchiha','sakura-haruno'];
 renderLobby();
};
rosterSearch.addEventListener('input',()=>{rosterPage=0;filterRoster();});
$('languageButton').textContent='PT-BR';
showEnergyHelp=function(){
 $('energyHelpTitle').textContent='CHAKRA';
 $('energyHelpBody').innerHTML=keys.map(k=>'<p>'+orb(k)+' '+label(k)+'</p>').join('')+
 '<p>'+orb('rand')+' Aleatório: pague com qualquer uma das quatro cores.</p><p>Os chakras acumulam. Em cada turno, ganhe um chakra aleatório por ninja vivo. Você pode preparar uma técnica nova por ninja.</p>';
 $('energyDialog').showModal();
};
$('energyHelpButton').onclick=showEnergyHelp;

const sandboxLink=document.createElement('a');
sandboxLink.className='sandboxLink';
sandboxLink.href='/sandbox';
sandboxLink.textContent='SANDBOX';
document.querySelector('.windowTools').insertBefore(sandboxLink,$('scaleButton'));

const effectTip=document.createElement('aside');
effectTip.className='effectTip';
effectTip.id='effectTooltip';
effectTip.role='tooltip';
effectTip.hidden=true;
document.body.append(effectTip);
const tipSelector='#enemies [data-effect], #turnSummary [data-inspect-skill]';
function showEffectTip(button){
 const owner=Number(button.dataset.owner??button.dataset.inspectSlot);
 if(!state?.fighters[owner]||owner<3)return;
 const fighter=state.fighters[owner];
 const effect=button.hasAttribute('data-effect')
   ? fxList(fighter)[Number(button.dataset.effect)]
   : fighter.skills[Number(button.dataset.inspectSkill)];
 if(!effect)return;
 const label=effect.permanent?'Passivo':effect.turns!=null
   ? effect.turns+' '+(effect.turns===1?'rodada restante':'rodadas restantes'):'';
 effectTip.replaceChildren();
 const title=document.createElement('strong');
 title.textContent=nameOf(effect.name);
 const description=document.createElement('p');
 description.innerHTML=arenaDescription(descOf(effect)||'Técnica usada.');
 effectTip.append(title,description);
 if(label){const remaining=document.createElement('small');remaining.textContent=label;effectTip.append(remaining);}
 button.removeAttribute('title');
 button.setAttribute('aria-describedby',effectTip.id);
 effectTip.hidden=false;
 const rect=button.getBoundingClientRect();
 const left=rect.left-effectTip.offsetWidth-8;
 effectTip.style.left=Math.max(8,Math.min(left,innerWidth-effectTip.offsetWidth-8))+'px';
 effectTip.style.top=Math.max(8,Math.min(rect.top,innerHeight-effectTip.offsetHeight-8))+'px';
}
for(const event of ['pointerover','focusin'])document.addEventListener(event,e=>{
 const button=e.target.closest(tipSelector);
 if(button)showEffectTip(button);
});
for(const event of ['pointerout','focusout'])document.addEventListener(event,e=>{
 const button=e.target.closest(tipSelector);
 if(button&&!button.contains(e.relatedTarget))effectTip.hidden=true;
});
const renderWithEffects=render;
render=function(){effectTip.hidden=true;renderWithEffects();};
/* Replay the unroll when another character is opened, not when a skill is selected. */
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-lobby-character],[data-team-character]'))return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 requestAnimationFrame(()=>{
  const scroll=$('characterPreview');if(scroll.hidden)return;
  for(const animation of scroll.getAnimations())animation.cancel();
  scroll.animate([
   {clipPath:'inset(-8px 94% -8px -8px)',transform:'translateX(-5px) scaleX(.985)',filter:'brightness(.86)'},
   {clipPath:'inset(-8px 2% -8px -8px)',transform:'translateX(1px) scaleX(1.003)',filter:'brightness(1.025)',offset:.65},
   {clipPath:'inset(-8px)',transform:'none',filter:'none'}
  ],{duration:240,easing:'cubic-bezier(.18,.72,.22,1)'});
 });
});

{ const classicButton=document.createElement("button");classicButton.textContent="NOVOS NINJAS";classicButton.onclick=()=>location.href="/classic";document.querySelector(".windowTools").insertBefore(classicButton,document.getElementById("scaleButton")); }
