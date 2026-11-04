// Inspection controls are independent from the action queue.
let inspectedSlot7=0,lobbyPreviewOpen7=false,resultAcknowledged7='';
const concise7=s=>descOf(s).replace(/\s*(?:Custo:|Cost:)[\s\S]*$/,'').replace(/\s*Adapta(?:ção|do)[\s\S]*$/,'');
const renderFighterBase7=fighterMarkup;
fighterMarkup=function(n){
 let html=renderFighterBase7(n).replace(/<div class="targetActions">[\s\S]*?<\/div>/g,'');
 const pending=queue.filter(m=>{const sk=state.fighters[m.actor].skills[m.skill];return sk.areaEnemies?n.slot>=3&&sk.targets.includes(n.slot):m.target===n.slot;}).map(m=>{const caster=state.fighters[m.actor],s=caster.skills[m.skill];return `<button class="targetAction pendingEffect" data-remove="${m.actor}" title="${esc(nameOf(s.name))} · ação preparada" aria-label="Remover ação em ${esc(nameOf(n.name))}: ${esc(nameOf(s.name))}"><img src="${picture(caster,s)}" alt=""></button>`;}).join('');
 return html.replace('<div class="statusRow">','<div class="statusRow">'+pending).replace('class="fighter ',`data-character-id="${n.id}" class="fighter `);
};
function inspectStrip7(){
 if(!state)return;const n=state.fighters[inspectedSlot7]||state.fighters[0];
 $('turnSummary').innerHTML=`<span class="inspectPrompt">${lang==='pt'?'Clique em uma habilidade':'Click on a skill'}</span>`+n.skills.map(s=>`<button data-inspect-slot="${n.slot}" data-inspect-skill="${s.index}" title="${esc(nameOf(s.name))}" aria-label="Consultar ${esc(nameOf(n.name))}: ${esc(nameOf(s.name))}"><img src="${picture(n,s)}" alt=""></button>`).join('');
}
showDetail=function(){
 if(!state)return;
 const d=viewed;
 if(d?.fighter!=null){inspectedSlot7=d.fighter;const n=state.fighters[d.fighter];$('details').innerHTML=`<img class="detailIcon characterDetail" data-character-id="${n.id}" src="${icon(n.id)}" alt="${esc(nameOf(n.name))}"><h2>${esc(nameOf(n.name))}</h2><p>${lang==='pt'?'Clique em uma das quatro habilidades acima para consultar seus efeitos.':'Click one of the four skills above to read its effects.'}</p><div class="miniEffects">${fxList(n).map((e,i)=>effectMarkup(e,n,i)).join('')}</div>`;inspectStrip7();return;}
 if(d?.effect){const e=d.effect;$('details').innerHTML=`<img class="detailIcon" src="${fxPicture(e)}" alt=""><h2>${esc(nameOf(e.name))}</h2><p>${esc(concise7(e))}</p><span class="meta">${e.turns} ${t('duration')}</span>`;return;}
 if(!d){$('details').innerHTML=`<h2>${t('skillPrompt')}</h2><p>${lang==='pt'?'Clique em um retrato para consultar suas quatro habilidades. Para agir, use as habilidades da sua equipe e escolha um alvo.':'Click a portrait to inspect all four skills. To act, select a skill from your team and choose a target.'}</p>`;return;}
 const n=state.fighters[d.actor],s=n.skills[d.index];
 $('details').innerHTML=`<img class="detailIcon" src="${picture(n,s)}" alt=""><h2>${esc(nameOf(s.name))}</h2><div class="costs" aria-label="${esc(energyExplanation(s.cost))}">${Object.entries(s.cost).flatMap(([k,count])=>Array.from({length:Math.min(count,9)},()=>orb(k))).join('')||'—'}</div><p>${esc(concise7(s))}</p><span class="recharge">${t('cooldown')}: ${s.baseCooldown}</span>`;
};
updateTurnSummary=function(){
 if(!state)return;const living=state.fighters.slice(0,3).filter(n=>n.hp>0).length;
 $('energyStatus').textContent='';inspectStrip7();
};
const previewClose7=document.createElement('button');previewClose7.id='closeCharacterPreview';previewClose7.className='scrollHandle';previewClose7.setAttribute('aria-label','Fechar pergaminho do personagem');previewClose7.title='Fechar pergaminho';previewClose7.innerHTML='<span>FECHAR</span>‹';$('characterPreview').append(previewClose7);
previewClose7.onclick=()=>{lobbyPreviewOpen7=false;renderLobby();};
const lobbyBase7=renderLobby;
renderLobby=function(){lobbyBase7();$('characterPreview').hidden=!lobbyPreviewOpen7;$('lobbyScreen').classList.toggle('previewClosed',!lobbyPreviewOpen7);$('previewPortrait').dataset.characterId=lobbyCharacterId;document.querySelectorAll('#lobbyRoster [data-lobby-character]').forEach(b=>b.dataset.characterId=b.dataset.lobbyCharacter);document.querySelectorAll('#previewDescription .menuCosts span').forEach(e=>e.remove());if(lobbySkillIndex!=null){const sk=state.roster.find(c=>c.id===lobbyCharacterId).skills[lobbySkillIndex];$('previewDescription').querySelector('p').textContent=concise7(sk);}previewClose7.innerHTML='<span>'+(lang==='pt'?'FECHAR':'CLOSE')+'</span>‹';};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-inspect-skill]');if(b){e.preventDefault();e.stopImmediatePropagation();inspectedSlot7=+b.dataset.inspectSlot;viewed={actor:inspectedSlot7,index:+b.dataset.inspectSkill};showDetail();inspectStrip7();return;}
 if(e.target.closest('[data-lobby-character]'))lobbyPreviewOpen7=true;
},true);
$('presetTrio').onclick=()=>{chosen=state.roster.filter(c=>c.side===lobbyFilter).slice(0,3).map(c=>c.id);renderLobby();};
const resultLayer7=document.createElement('div');resultLayer7.id='resultOverlay';resultLayer7.hidden=true;resultLayer7.innerHTML='<section id="resultScroll" role="dialog" aria-modal="true" aria-labelledby="resultTitle"><div class="scrollBinding" aria-hidden="true"></div><img id="resultPortrait" alt=""><div class="resultCopy"><h2 id="resultTitle"></h2><h3 id="resultSubtitle"></h3><p id="resultText"></p><button id="resultContinue">CONTINUAR</button></div></section>';$('arena').append(resultLayer7);
function result7(){
 const key=state?.winner?state.revision+':'+state.winner:'';const show=!!state?.winner&&state.started===true&&key!==resultAcknowledged7;resultLayer7.hidden=!show;if(!show)return;
 const won=state.winner==='Você venceu',own=state.fighters.slice(0,3),survivor=own.find(n=>n.hp>0)||own[0];
 $('resultTitle').textContent=lang==='pt'?(won?'VITÓRIA':'DERROTA'):(won?'VICTORY':'DEFEAT');$('resultScroll').classList.toggle('victory',won);$('resultSubtitle').textContent=lang==='pt'?(won?'Você venceu a CPU!':'A CPU venceu esta partida.'):(won?'You defeated the CPU!':'The CPU won this match.');$('resultText').textContent=lang==='pt'?(won?'Sua equipe prevaleceu na arena. Escolha outra formação e tente uma nova estratégia.':'O adversário venceu esta batalha. Reorganize sua equipe e tente novamente.'):(won?'Your team prevailed in the Fog. Choose another lineup and try a new strategy.':'The Fog claimed this victory. Reorganize your team and try again.');$('resultPortrait').src=icon(survivor.id);$('resultPortrait').dataset.characterId=survivor.id;$('resultPortrait').alt=nameOf(survivor.name);$('resultContinue').textContent=lang==='pt'?'CONTINUAR':'CONTINUE';
}
$('resultContinue').onclick=async()=>{resultAcknowledged7=state.revision+':'+state.winner;lobbyPreviewOpen7=false;await returnToLobby();};
const surrender7=document.createElement('button');surrender7.id='surrenderButton';surrender7.textContent='DESISTIR';surrender7.onclick=async()=>{if(busy||state.winner||!state.started)return;busy=true;try{state=await api('surrender');revision=state.revision;queue=[];selected=null;$('overlay').hidden=true;}catch(e){message(e.message);}finally{busy=false;render();}};document.querySelector('.bottomTools').insertBefore(surrender7,$('round'));
const renderBase7=render;render=function(){renderBase7();result7();surrender7.disabled=busy||!!state?.winner;surrender7.textContent=lang==='pt'?'DESISTIR':'SURRENDER';};
const returnToLobbyBase7=returnToLobby;
returnToLobby=async function(){lobbyPreviewOpen7=false;await returnToLobbyBase7();};
$('newGameButton').onclick=returnToLobby;$('teamButton').onclick=returnToLobby;
Object.assign(abilityEN,{'A Enfermeira':'The Nurse','O Vulto':'The Shape','A Bruxa':'The Hag','Piscada':'Blink','Último suspiro':'Last Breath','Tanatofobia':'Thanatophobia','Faca de cozinha':'Kitchen Knife','Espreitar':'Stalk','Mal encarnado':'Evil Incarnate','Armadilha de fantasma':'Phantasm Trap','Ruína':'Ruin','Devorar esperança':'Devour Hope','Sabotador':'Saboteur','Vontade de ferro':'Iron Will','Espírito calmo':'Calm Spirit','Aterrissagem equilibrada':'Balanced Landing','Evasão urbana':'Urban Evasion','Malícia':'Streetwise','Distração técnica':'Technical Distraction','Ágil':'Lithe','Alerta':'Alert'});
if(state)render();
