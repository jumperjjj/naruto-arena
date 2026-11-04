/* Guided UI over the same editor fields: switching mode never converts or discards a recipe. */
let sandboxMode=localStorage.getItem('narutoSandboxMode')==='advanced'?'advanced':'simple';
const guideSteps=['Escolher o efeito','Alvos e valores','Classes da técnica','Chakra e recarga','Condições e preparação'];
const guidePhases=new Map();
const templates={
 damage:{label:'Ataque direto',explain:'25 de dano em um inimigo. Um ponto de partida para um ataque simples.',recipes:[{kind:'damage',target:'enemy',value:25,turns:1}],classTags:['physical','melee'],cost:[0,0,0,1,0],cooldown:0},
 heal:{label:'Cura',explain:'Recupera 25 PV de um aliado. Não exige duração, pois a cura acontece uma vez.',recipes:[{kind:'heal',target:'ally',value:25,turns:1}],classTags:['chakra','ranged'],cost:[0,0,1,0,0],cooldown:1},
 poison:{label:'Veneno',explain:'Aplica 10 de dano de aflição por rodada durante 3 rodadas.',recipes:[{kind:'dot',target:'enemy',value:10,turns:3}],classTags:['affliction','ranged'],cost:[1,0,0,0,1],cooldown:2},
 protect:{label:'Proteção',explain:'Reduz em 50% o dano recebido durante 2 rodadas.',recipes:[{kind:'reduce',target:'self',value:50,turns:2,unit:'percent'}],classTags:['chakra'],cost:[0,1,0,0,0],cooldown:3},
 stun:{label:'Golpe com atordoamento',explain:'Combina 15 de dano com bloqueio de técnicas físicas por 1 turno.',recipes:[{kind:'damage',target:'enemy',value:15,turns:1},{kind:'stun',target:'enemy',value:0,turns:1,class:'physical'}],classTags:['physical','melee'],cost:[0,0,0,1,1],cooldown:2},
 defense:{label:'Esquiva de um turno',explain:'Invulnerabilidade por 1 turno, custa 1 chakra aleatório e recarrega em 4 rodadas.',recipes:[{kind:'invulnerable',target:'self',value:0,turns:1}],classTags:['physical'],cost:[0,0,0,0,1],cooldown:4},
 preparation:{label:'Preparação',explain:'Registra um uso desta técnica por 3 rodadas. Na técnica que deseja liberar, configure esta preparação na etapa 5.',recipes:[],classTags:['chakra'],cost:[0,0,0,0,1],cooldown:2,markTurns:3}
};
const modePanel=document.createElement('section');modePanel.id='editorMode';modePanel.innerHTML='<div><b>Como você quer editar?</b><p>Comece no Simples. O Avançado mostra todos os campos juntos, com a mesma configuração.</p></div><div class="modeButtons"><button type="button" data-editor-mode="simple">Simples · passo a passo</button><button type="button" data-editor-mode="advanced">Avançado</button></div>';
$('editor').before(modePanel);
const learning=document.createElement('details');learning.id='editorLearning';learning.innerHTML='<summary>Primeira vez? Veja como criar e testar</summary><ol><li>Clique em <b>Criar ninja</b>, dê um nome e escolha a imagem.</li><li>Escolha um dos quatro espaços de técnica. Use um modelo ou monte seus próprios efeitos.</li><li>Siga as cinco etapas. A ficha ao lado explica o resultado.</li><li><b>Salvar</b> guarda um rascunho. <b>Testar contra a CPU</b> abre uma partida com ele.</li><li>Quando estiver pronto, use <b>Lançar no elenco</b> para aparecer na seleção normal deste navegador.</li></ol><p>Para editar um personagem existente, escolha-o na lista. Você pode manter a lógica original ou criar sua versão; isso não apaga a referência original.</p>';
modePanel.after(learning);
function setEditorMode(mode){sandboxMode=mode;localStorage.setItem('narutoSandboxMode',mode);document.body.dataset.editorMode=mode;modePanel.querySelectorAll('[data-editor-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.editorMode===mode)));document.querySelectorAll('.skillEditor').forEach(box=>{box.querySelector('.guideWriting').open=mode==='advanced';refreshGuide(box);});}
function guideField(box,name){return box.querySelector(`[name="${name}"]`);}
function guideValue(box,name){return guideField(box,name)?.value;}
function guideStep(box,phase){box.dataset.phase=String(phase);guidePhases.set(+box.dataset.technique,phase);box.querySelectorAll('[data-guide-phase]').forEach(b=>b.setAttribute('aria-current',+b.dataset.guidePhase===phase?'step':'false'));box.querySelector('.guideStepTitle').textContent=(phase+1)+'. '+guideSteps[phase];box.querySelector('[data-guide-back]').disabled=phase===0;box.querySelector('[data-guide-next]').textContent=phase===4?'Voltar ao início':'Próxima etapa →';}
function tagStep(node,phase){if(node)node.dataset.guideContent=phase;}
function mountGuide(box){
 const i=+box.dataset.technique;
 const direct=[...box.children];
 const name=guideField(box,'name').closest('label');name.classList.add('techniqueName');
 const description=guideField(box,'desc').closest('label'),toolbar=box.querySelector('.textToolbar'),legacyPreview=box.querySelector('.richTextPreview');
 const writing=document.createElement('details');writing.className='guideWriting';writing.innerHTML='<summary>Personalizar o texto e as cores</summary>';
 description.before(writing);writing.append(description,toolbar,legacyPreview);
 const autoLabel=document.createElement('label');autoLabel.className='check autoDescription';autoLabel.innerHTML='<input type="checkbox" data-auto-description> Gerar a descrição a partir dos efeitos';writing.before(autoLabel);
 autoLabel.querySelector('input').checked=current.skills[i].autoDescription??(guideValue(box,'effect')==='configured'&&!guideValue(box,'desc').trim());
 const wizard=document.createElement('div');wizard.className='guideWizard';wizard.innerHTML='<nav class="guideStepNav" aria-label="Etapas da técnica">'+guideSteps.map((s,j)=>'<button type="button" data-guide-phase="'+j+'" title="'+s+'">'+(j+1)+'<span>'+s+'</span></button>').join('')+'</nav><h3 class="guideStepTitle"></h3><div class="guideNativeNotice"></div><section class="guideTemplates" data-guide-content="0"><label>Começar com um modelo<select data-guide-template>'+Object.entries(templates).map(([key,t])=>'<option value="'+key+'">'+t.label+'</option>').join('')+'</select></label><p data-template-help>'+templates.damage.explain+'</p><button type="button" data-apply-template>Aplicar modelo nesta técnica</button><small>Substitui os efeitos desta técnica. As outras técnicas e a imagem são mantidas.</small></section>';
 const first=direct.find(n=>n.classList?.contains('chakra'));first.before(wizard);
 tagStep(first,3);first.classList.add('guideChakra');
 const cooldown=guideField(box,'cooldown').closest('label');tagStep(cooldown,3);
 const effect=guideField(box,'effect').closest('label');effect.classList.add('advancedOnly');
 const slot=guideField(box,'baseSlot')?.closest('label');tagStep(slot,4);
 const config=box.querySelector('.configuration');config.querySelector('h3')?.classList.add('advancedOnly');
 const folds=config.querySelectorAll(':scope > .optionFold');tagStep(folds[0],2);tagStep(folds[1],4);tagStep(folds[2],4);
 if(folds[0]){const help=document.createElement('p');help.className='guideHelp';help.textContent='Tipo é a natureza da técnica; distância é onde ela é usada. Essas classes definem quais atordoamentos e proteções podem afetá-la.';folds[0].prepend(help);}
 const addEffect=config.querySelector('[data-add-effect]');tagStep(addEffect,0);
 const invisible=guideField(box,'invisible')?.closest('label');tagStep(invisible,2);
 const ref=box.querySelector('.native');if(ref)ref.classList.add('advancedReference');
 const bottom=document.createElement('div');bottom.className='guideNavigation';bottom.innerHTML='<button type="button" data-guide-back>← Anterior</button><button type="button" data-guide-next>Próxima etapa →</button>';
 box.append(bottom);
 const preview=document.createElement('aside');preview.className='guidePreview';preview.setAttribute('aria-label','Prévia da técnica');preview.innerHTML='<small>ASSIM A TÉCNICA VAI FUNCIONAR</small><h3></h3><div class="guidePreviewCost"></div><div class="guidePreviewText"></div><div class="guidePreviewClasses"></div><div class="guideWarnings" role="status"></div>';
 box.append(preview);guideStep(box,guidePhases.get(i)||0);refreshGuide(box);
}
function recipeSettings(kind){return {quantity:['damage','pierce','afflict','dot','heal','regen','shield','reduce','strengthen','weaken','bleed','deplete','steal','gain'].includes(kind),duration:['dot','regen','shield','reduce','strengthen','weaken','bleed','stun','invulnerable','reflect','counter','copy','prepare','prolong','shorten','ignore','focus','expose'].includes(kind),unit:['damage','pierce','afflict','heal','reduce','strengthen','weaken','bleed'].includes(kind),class:['reduce','strengthen','weaken','bleed','stun','invulnerable','counter'].includes(kind),label:['remove','prolong','shorten','prepare'].includes(kind)};}
function effectSentence(r){
 const recipient={enemy:'um inimigo',enemies:'todos os inimigos',ally:'um aliado',allies:'todos os aliados',self:'o próprio personagem'}[r.target]||'o alvo';
 const amount=r.unit==='currentPercent'?r.value+'% dos PV atuais':r.unit==='percent'?r.value+'%':String(r.value),duration=r.turns+' '+(r.turns===1?'turno':'turnos'),affected=classes[r.class]||'Todas';
 const base={damage:`Causa ${amount} de dano a ${recipient}.`,pierce:`Causa ${amount} de dano perfurante a ${recipient}; ignora redução de dano.`,afflict:`Causa ${amount} de dano de aflição a ${recipient}; ignora redução e defesa destrutível.`,dot:`Causa ${r.value} de dano de aflição por rodada a ${recipient}, durante ${duration}.`,heal:`Cura ${amount} PV de ${recipient}.`,regen:`Cura ${r.value} PV por rodada de ${recipient}, durante ${duration}.`,shield:`Concede ${r.value} pontos de defesa destrutível a ${recipient}, por ${duration}.`,reduce:`Reduz o dano recebido por ${recipient} em ${amount}${r.unit==='percent'?'':' pontos'}, por ${duration}.`,strengthen:`Aumenta o dano causado por ${recipient} em ${amount}${r.unit==='percent'?'':' pontos'}, por ${duration}.`,bleed:`Aumenta o dano recebido por ${recipient} em ${amount}${r.unit==='percent'?'':' pontos'}, por ${duration}.`,weaken:`Diminui o dano causado por ${recipient} em ${amount}${r.unit==='percent'?'':' pontos'}, por ${duration}.`,stun:`Atordoa as técnicas de ${recipient} por ${duration}. Classe afetada: ${affected}.`,invulnerable:`Torna ${recipient} invulnerável por ${duration}. Classe protegida: ${affected}.`,reflect:`Reflete a próxima técnica inimiga recebida por ${recipient}, dentro de ${duration}.`,counter:`Anula a próxima técnica inimiga recebida por ${recipient}, dentro de ${duration}. Classe: ${affected}.`,copy:`Copia a última técnica usada por ${recipient} e substitui esta técnica por ${duration}.`,deplete:`Remove ${r.value} chakra(s) aleatório(s) do time de ${recipient}.`,steal:`Rouba ${r.value} chakra(s) aleatório(s) do time de ${recipient}.`,gain:`Adiciona ${r.value} chakra(s) aleatório(s) ao time de ${recipient}.`,cure:`Remove efeitos negativos removíveis de ${recipient}.`,cureStun:`Remove atordoamentos removíveis de ${recipient}.`,purge:`Remove efeitos positivos removíveis de ${recipient}.`,remove:`Remove o efeito “${r.label||'nome não informado'}” de ${recipient}, se criado por este usuário.`,prolong:`Prolonga em ${duration} o efeito “${r.label||'nome não informado'}” em ${recipient}.`,shorten:`Encurta em ${duration} o efeito “${r.label||'nome não informado'}” em ${recipient}.`,prepare:`Aplica a marca “${r.label||'nome não informado'}” em ${recipient} por ${duration}.`,focus:`Faz ${recipient} ignorar atordoamentos por ${duration}.`,ignore:`Faz ${recipient} ignorar efeitos negativos por ${duration}.`,expose:`Impede redução de dano e invulnerabilidade de ${recipient} por ${duration}.`};
 return base[r.kind]||'Efeito não reconhecido.';
}
function describeTechnique(s,skills,index){
 const lines=(s.recipes||[]).map(effectSentence);
 if(s.requiresSkill){lines.push(`Requer ${s.requiresUses||1} uso(s) de “${skills[s.requiresSkill-1]?.name||'técnica inexistente'}” antes de poder ser usada.${s.consume?' Consome esses usos ao executar.':''}`);}
 const usedBy=skills.some(x=>+x.requiresSkill===index+1);if(usedBy||s.markTurns>0)lines.push(`Registra um uso de preparação${s.markTurns?' por '+s.markTurns+' turnos':' até ser consumido'}.`);
 for(const swap of s.replacements||[])lines.push(`Substitui a técnica do espaço ${swap.slot} por “${skills[swap.technique-1]?.name||'alternativa inexistente'}” durante ${s.replacementTurns||3} turnos.`);
 if(!lines.length)lines.push('Esta técnica ainda não tem efeitos. Adicione um efeito ou configure uma preparação para outra técnica.');
 if(s.channel&&s.channel!=='instant')lines.push(`Execução ${s.channel==='action'?'de ação':s.channel==='control'?'de controle':'contínua'} por ${s.duration||1} turno(s).`);
 if(s.invisible)lines.push('O adversário não vê o ícone do efeito.');return lines.join('\n');
}
function techniqueWarnings(s,skills,index){const out=[];
 let cursor=index,visited=new Set();while(skills[cursor]?.requiresSkill){if(visited.has(cursor)){out.push('Existe um ciclo de preparação: as técnicas dependem umas das outras e ficam bloqueadas.');break;}visited.add(cursor);cursor=+skills[cursor].requiresSkill-1;}
 if(s.requiresSkill===index+1)out.push('Esta técnica exige o próprio uso. Escolha outra preparação.');
 if(s.requiresSkill&&!skills[s.requiresSkill-1])out.push('A preparação escolhida não existe mais.');
 if(s.requiresSkill&&skills[s.requiresSkill-1]&&(skills[s.requiresSkill-1].effect==null||skills[s.requiresSkill-1].effect==='original'))out.push('A preparação escolhida preserva a lógica nativa e não gera a marca do editor. Configure essa técnica também.');
 for(const r of s.recipes||[]){if(['remove','prolong','shorten','prepare'].includes(r.kind)&&!r.label?.trim())out.push('Informe o nome do efeito para “'+kinds[r.kind][0]+'”.');if(['heal','regen','shield','reduce','invulnerable'].includes(r.kind)&&['enemy','enemies'].includes(r.target))out.push('Atenção: “'+kinds[r.kind][0]+'” está ajudando o inimigo. Confira o alvo.');}
 for(const swap of s.replacements||[]){const extra=skills[swap.technique-1];if(!extra||swap.technique<=4)out.push('A substituição precisa apontar para uma técnica alternativa existente (5 ou maior).');else if(+extra.baseSlot!==+swap.slot)out.push('A alternativa “'+extra.name+'” pertence a outro espaço. Ajuste seu espaço na etapa 5.');}
 if(index>=4&&!skills.some(x=>x.replacements?.some(r=>+r.technique===index+1)))out.push('Esta alternativa ainda não é liberada por nenhuma técnica. Na preparação, adicione uma substituição na etapa 5.');
 if(s.markTurns>0&&!(s.recipes||[]).length&&!(s.replacements||[]).length&&!skills.some(x=>+x.requiresSkill===index+1))out.push('A preparação registra usos, mas nenhuma técnica depende dela ainda. Na técnica que deseja liberar, selecione esta preparação na etapa 5.');return [...new Set(out)];}
function refreshGuide(box){
 if(!box.querySelector('.guideWizard'))return;
 const index=+box.dataset.technique,s=readSkill(box,index),native=s.effect==null||s.effect==='original';
 box.dataset.native=String(native);box.querySelector('.autoDescription').hidden=native;
 const notice=box.querySelector('.guideNativeNotice');notice.innerHTML=native?'<b>Lógica original preservada</b><p>'+esc(tr(s.desc))+'</p><p>Você pode ajustar chakra e recarga na etapa 4. Para mudar os efeitos, crie sua versão abaixo; a referência original continua disponível no Avançado.</p><button type="button" data-edit-original>Criar minha versão desta técnica</button>':'';notice.hidden=!native;
 for(const row of box.querySelectorAll('.recipe')){
  const get=n=>row.querySelector(`[name="${n}"]`),kind=get('kind').value,settings=recipeSettings(kind);tagStep(row.querySelector('.recipeHeader'),0);tagStep(row.querySelector('.help'),0);tagStep(row.querySelector('.fields'),1);tagStep(get('label').closest('label'),1);
  for(const field of ['value','turns','unit','class','label']){const show={value:settings.quantity,turns:settings.duration,unit:settings.unit,class:settings.class,label:settings.label}[field];get(field).closest('label').classList.toggle('simpleIrrelevant',!show);}
  let heading=row.querySelector('.recipeGuideTitle');if(!heading){heading=document.createElement('strong');heading.className='recipeGuideTitle';row.prepend(heading);}heading.textContent=kinds[kind]?.[0]||kind;
 }
 const skills=[...$('skills').children].map((other,j)=>j===index?s:{...current.skills[j],name:guideValue(other,'name'),effect:guideValue(other,'effect'),requiresSkill:+guideValue(other,'requiresSkill'),replacements:[...other.querySelectorAll('.swap')].map(row=>({slot:+row.querySelector('[name=slot]').value,technique:+row.querySelector('[name=technique]').value}))}),description=native?tr(s.desc):describeTechnique(s,skills,index);
 const auto=box.querySelector('[data-auto-description]');if(!native&&auto.checked){guideField(box,'desc').value=description;s.desc=description;box.querySelector('.richTextPreview').innerHTML=arenaDescription(description);}
 current.skills[index].autoDescription=auto.checked;
 const preview=box.querySelector('.guidePreview');preview.querySelector('h3').textContent=s.name;preview.querySelector('.guidePreviewText').innerHTML=arenaDescription(native?description:(auto.checked?description:s.desc||description));
 preview.querySelector('.guidePreviewCost').innerHTML='<span>CHAKRA: </span>'+engineOrder.flatMap((c,i)=>Array.from({length:s.cost[i]||0},()=>'<i class="chakraSymbol" style="background:'+chakra.find(x=>x[0]===c)[1]+'" title="'+chakra.find(x=>x[0]===c)[2]+'"></i>')).join('')+'<span class="guideCooldown">RECARGA: '+s.cooldown+'</span>';
 preview.querySelector('.guidePreviewClasses').textContent='CLASSES: '+(native?(roster.find(n=>n.id===current.id)?.skills[index]?.classTags||[]).join(', '):s.classTags.map(c=>({physical:'Física',chakra:'Chakra',mental:'Mental',affliction:'Aflição',melee:'Corpo a corpo',ranged:'À distância',unique:'Única',bypass:'Ignora invulnerabilidade'}[c]||c)).join(', '));
 if(!native)preview.querySelector('.guidePreviewClasses').textContent+=', '+({instant:'Instantânea',action:'Ação',control:'Controle',ongoing:'Contínua'}[s.channel]||'Instantânea');if(!s.cost.some(Boolean))preview.querySelector('.guidePreviewCost').insertAdjacentHTML('beforeend','<span>Sem custo de chakra</span>');const warnings=native?[]:techniqueWarnings(s,skills,index);preview.querySelector('.guideWarnings').innerHTML=warnings.length?'<b>Confira antes de testar</b><ul>'+warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>':'<span class="guideOkay">'+(native?'Regras originais mantidas.':'Sem avisos de configuração nesta técnica.')+'</span>';
 for(const fold of box.querySelectorAll('.optionFold'))if(sandboxMode==='simple')fold.open=true;
 guideStep(box,guidePhases.get(index)||0);
}
const guideRenderSkillsBase=renderSkills;
renderSkills=function(){guideRenderSkillsBase();document.querySelectorAll('.skillEditor').forEach(mountGuide);setEditorMode(sandboxMode);};
const guideReadSkillBase=readSkill;
readSkill=function(box,index){const s=guideReadSkillBase(box,index),auto=box.querySelector('[data-auto-description]');if(auto)s.autoDescription=auto.checked;return s;};
function refreshActiveGuide(){const box=$('skills').children[activeTechnique];if(box)refreshGuide(box);}
document.addEventListener('input',event=>{const box=event.target.closest('.skillEditor');if(box){refreshGuide(box);if(event.target.name==='name')drawSkillTabs();}});
document.addEventListener('change',event=>{const box=event.target.closest('.skillEditor');if(!box)return;if(event.target.hasAttribute('data-guide-template'))box.querySelector('[data-template-help]').textContent=templates[event.target.value].explain;refreshGuide(box);});
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.editorMode)return setEditorMode(button.dataset.editorMode);
 const box=button.closest('.skillEditor');if(!box)return;
 if(button.hasAttribute('data-guide-phase'))return guideStep(box,+button.dataset.guidePhase);
 if(button.hasAttribute('data-guide-back'))return guideStep(box,Math.max(0,+box.dataset.phase-1));
 if(button.hasAttribute('data-guide-next'))return guideStep(box,(+box.dataset.phase+1)%5);
 if(button.hasAttribute('data-edit-original')){guideField(box,'effect').value='configured';box.querySelector('.configuration').hidden=false;guideField(box,'name').readOnly=false;box.querySelector('[data-auto-description]').checked=true;guideStep(box,0);refreshGuide(box);return;}
 if(button.hasAttribute('data-apply-template')){const i=+box.dataset.technique,t=templates[box.querySelector('[data-guide-template]').value];collect();current.skills[i]={...current.skills[i],...structuredClone(t),effect:'configured',autoDescription:true,channel:'instant',duration:1,requiresSkill:0,requiresUses:1,consume:false,replacements:[],markTurns:t.markTurns||0,invisible:false};guidePhases.set(i,1);renderSkills();status('Modelo aplicado somente nesta técnica. Ajuste os alvos e valores na etapa 2.');return;}
 if(button.dataset.step||button.hasAttribute('data-add-effect')||button.hasAttribute('data-remove-effect')||button.hasAttribute('data-add-swap')||button.hasAttribute('data-remove-swap'))refreshGuide(box);
});
setEditorMode(sandboxMode);

if(current)document.querySelectorAll('.skillEditor').forEach(box=>{if(!box.querySelector('.guideWizard'))mountGuide(box);});

document.addEventListener('invalid',event=>{const box=event.target.closest('.skillEditor');if(!box)return;activeTechnique=+box.dataset.technique;drawSkillTabs();if(sandboxMode==='simple'){const field=event.target.name;const phase=/^c[0-4]$/.test(field)||field==='cooldown'?3:event.target.closest('.recipe')?1:event.target.closest('.replacements')||['baseSlot','requiresSkill','requiresUses','markTurns','replacementTurns'].includes(field)?4:2;guideStep(box,phase);}for(let parent=event.target.parentElement;parent&&parent!==box;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;status('Confira o campo destacado antes de salvar.',true);},true);
