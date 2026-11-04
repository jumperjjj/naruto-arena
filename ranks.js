const ninjaRanks=[
 ['Estudante da Academia','academy-student'],
 ['Genin','genin'],
 ['Chūnin','chuunin'],
 ['Ninja Renegado','missing-nin'],
 ['ANBU','anbu'],
 ['Jōnin','jounin'],
 ['Sannin','sannin'],
 ['Jinchūriki','jinchuuriki'],
 ['Akatsuki','akatsuki'],
 ['Kage','kage'],
 ['Hokage','hokage']
];
let rankIndex=Number(localStorage.getItem('narutoRank'))||0;
if(!ninjaRanks[rankIndex])rankIndex=0;
const rankSelect=document.createElement('select');
rankSelect.id='ninjaRank';
rankSelect.setAttribute('aria-label','Rank ninja');
ninjaRanks.forEach(([name],i)=>rankSelect.add(new Option(name,i)));
rankSelect.value=rankIndex;
document.querySelector('.localProfile span').replaceWith(rankSelect);
rankSelect.onchange=()=>{
 rankIndex=Number(rankSelect.value);
 localStorage.setItem('narutoRank',rankIndex);
 if(state)render();
};
function rankBadge(){
 const [name,image]=ninjaRanks[rankIndex];
 return '<img class="rankBadge" src="/assets/ranks/'+image+'.png" title="'+name+'" alt="'+name+'">';
}
const rankedFighterMarkup=fighterMarkup;
fighterMarkup=function(n){
 const html=rankedFighterMarkup(n);
 return n.slot<3?html.replace('<div class="portraitBlock">','<div class="portraitBlock">'+rankBadge()):html;
};
const renderWithRank=render;
render=function(){
 renderWithRank();
 if(!state?.online)document.querySelector('.profile.own span').textContent=ninjaRanks[rankIndex][0].toUpperCase();
};
