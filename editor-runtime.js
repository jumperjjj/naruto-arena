/* Sandbox entries are local to this browser; only launched entries enter the normal roster. */
function localNinjas(){try{return Object.values(JSON.parse(localStorage.getItem('narutoSandboxNinjas')||'{}'));}catch{return [];}}
function cleanNinja(n){return {...n,image:undefined,skills:n.skills.map(s=>({...s,image:undefined}))};}
function rosterSkill(s,i){return {...s,index:i,cost:Array.isArray(s.cost)?Object.fromEntries(['blood','gen','nin','tai','rand'].map((c,j)=>[c,s.cost[j]||0])):s.cost,baseCooldown:s.cooldown??s.baseCooldown??0};}
function mergeLocalRoster(){if(!state)return;for(const n of localNinjas()){
 const prior=state.roster.findIndex(c=>c.id===n.id);
 if(n.published){const entry={...n,side:'killers',skills:n.skills.slice(0,4).map(rosterSkill)};if(prior<0)state.roster.push(entry);else state.roster[prior]=entry;}
 const map=images[n.id]??={};if(n.image?.url)map.icon=n.image.display||n.image.url;
 for(const s of n.skills)if(s.image?.url)map[norm(s.name)]=s.image.display||s.image.url;
}}
const editorApiBase=api;
api=async function(command,extra={}){
 if(command==='reset'&&!extra.sandbox){const edits=localNinjas().filter(n=>n.published&&extra.team?.includes(n.id));if(edits.length)extra={...extra,sandbox:edits.map(cleanNinja)};}
 return editorApiBase(command,extra);
};
function applyEditorArt(){const art=new Map();for(const n of localNinjas()){if(n.image?.url)art.set(n.image.display||n.image.url,n.image.display?{...n.image,zoom:100,x:50,y:50}:n.image);for(const s of n.skills)if(s.image?.url)art.set(s.image.display||s.image.url,s.image.display?{...s.image,zoom:100,x:50,y:50}:s.image);}for(const img of document.querySelectorAll('#arena img')){const a=art.get(img.getAttribute('src'));if(!a)continue;img.style.objectPosition=`${a.x??50}% ${a.y??50}%`;img.style.transform=`scale(${(a.zoom||100)/100})`;img.style.transformOrigin=img.style.objectPosition;}}
const editorRenderBase=render;
render=function(){mergeLocalRoster();editorRenderBase();applyEditorArt();};
const editorLobbyBase=renderLobby;
renderLobby=function(){mergeLocalRoster();editorLobbyBase();applyEditorArt();};
window.addEventListener('storage',e=>{if(e.key==='narutoSandboxNinjas'&&state){lobbyRosterKey='';lobbyTeamKey='';render();}});
const classLabels={physical:'Física',chakra:'Chakra',mental:'Mental',affliction:'Aflição',melee:'Corpo a corpo',ranged:'À distância',unique:'Única',bypass:'Ignora invulnerabilidade'};
function skillClassText(s){if((s.classTags||[]).some(k=>classLabels[k]))return [...(s.classTags||[]).map(k=>classLabels[k]||k),({instant:'Instantânea',action:'Ação',control:'Controle',ongoing:'Contínua'}[s.channel]||'Instantânea')].join(', ');return (s.classTags||[]).join(', ');}
const detailClassesBase=showDetail;
showDetail=function(){detailClassesBase();const skill=viewed?.effect||((viewed?.actor!=null)?state?.fighters[viewed.actor]?.skills[viewed.index]:null);if(skill){const text=document.createElement('span');text.className='skillClasses';text.textContent='CLASSES: '+skillClassText(skill);$('details').append(text);}applyEditorArt();};
const previewClassesBase=renderLobby;
let previewFormPage=0,previewFormCharacter='';
const formToggle=document.createElement('button');formToggle.id='formToggle';formToggle.type='button';formToggle.title='Consultar técnicas alternativas';formToggle.setAttribute('aria-label','Consultar técnicas alternativas');formToggle.textContent='▶';$('characterPreview').append(formToggle);
formToggle.onclick=()=>{previewFormPage++;renderLobby();};
renderLobby=function(){
 previewClassesBase();const c=state?.roster.find(n=>n.id===lobbyCharacterId);if(!c)return;
 if(previewFormCharacter!==c.id){previewFormPage=0;previewFormCharacter=c.id;}
 const custom=localNinjas().find(n=>n.id===c.id);const forms=c.forms||c.skills.map((s,i)=>[s,...(custom?.skills.slice(4).filter(x=>+x.baseSlot===i+1)||[]).map(rosterSkill)]);
 const count=Math.max(1,...forms.map(a=>a.length));previewFormPage%=count;formToggle.hidden=count<2;formToggle.textContent=previewFormPage?'◀':'▶';
 const skills=forms.map((f,i)=>f[previewFormPage]||f[0]||c.skills[i]);
 if(previewFormPage){$('previewSkills').innerHTML=skills.map((s,i)=>`<button data-preview-skill="${i}" aria-label="Prévia: ${esc(nameOf(s.name))}" class="${lobbySkillIndex===i?'active':''}"><img src="${picture(c,s)}" alt=""></button>`).join('');if(lobbySkillIndex!=null){const sk=skills[lobbySkillIndex];$('previewDescription').innerHTML=`<h3>${esc(nameOf(sk.name))}</h3><p>${esc(descOf(sk))}</p><div class="menuCosts">${Object.entries(sk.cost).flatMap(([k,n])=>Array.from({length:n},()=>orb(k))).join('')}</div><span class="menuCooldown">COOLDOWN: ${sk.baseCooldown??sk.cooldown??0}</span>`;document.querySelector('.profileTechniqueArt').src=picture(c,sk);}}
 if(lobbySkillIndex!=null){const s=skills[lobbySkillIndex],text=document.createElement('span');text.className='skillClasses';text.textContent='CLASSES: '+skillClassText(s);$('previewDescription').append(text);}
 applyEditorArt();
};
const richDetailBase=showDetail;
showDetail=function(){richDetailBase();const s=viewed?.effect||(viewed?.actor!=null?state?.fighters[viewed.actor]?.skills[viewed.index]:null);if(s){const p=$('details').querySelector('p');if(p)p.innerHTML=arenaDescription(descOf(s));}};
const richLobbyBase=renderLobby;
renderLobby=function(){richLobbyBase();const c=state?.roster.find(x=>x.id===lobbyCharacterId);if(lobbySkillIndex!=null&&c){const custom=localNinjas().find(n=>n.id===c.id),forms=c.forms||c.skills.map((s,i)=>[s,...(custom?.skills.slice(4).filter(x=>+x.baseSlot===i+1)||[])]),s=forms[lobbySkillIndex]?.[previewFormPage]||c.skills[lobbySkillIndex],p=$('previewDescription').querySelector('p');if(p&&s)p.innerHTML=arenaDescription(descOf(s));}};

const classicMetadataLobby=renderLobby;
renderLobby=function(){classicMetadataLobby();const description=$('previewDescription'),cost=description.querySelector('.menuCosts');if(!cost)return;const old=cost.querySelector('b');let cooldown=description.querySelector('.menuCooldown');if(old){if(!cooldown){cooldown=document.createElement('span');cooldown.className='menuCooldown';description.append(cooldown);}cooldown.textContent=old.textContent.replace(/RECARGA/gi,'COOLDOWN');old.remove();}else if(cooldown)cooldown.textContent=cooldown.textContent.replace(/RECARGA/gi,'COOLDOWN');};
