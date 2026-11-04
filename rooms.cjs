const {randomBytes}=require('node:crypto');

module.exports=function roomService(makeEngine,turnMs){
 const rooms=new Map();
 const requests=new Map();
 let matching=Promise.resolve();
 const error=msg=>{throw new Error(msg)};
 const nickname=value=>String(value||'Jogador').replace(/[\r\n\t]/g,' ').trim().slice(0,20)||'Jogador';
 function locked(room,fn){const task=room.serial.then(fn);room.serial=task.catch(()=>{});return task;}
 function codeRoom(code){const room=rooms.get(String(code||'').replace(/[^a-z0-9]/gi,'').toUpperCase());if(!room)error('Sala não encontrada. Confira o código.');return room;}
 function ownRoom(session){const room=rooms.get(session.roomCode);if(!room||!room.seats.some(s=>s?.session===session&&!s.left))error('Você não está nesta sala.');room.used=Date.now();return room;}
 function info(room,session){const seat=room.seats.findIndex(s=>s?.session===session);return {code:room.code,seat,stage:room.stage,you:room.seats[seat].name,opponent:room.seats[1-seat]?.name||'',joined:!!room.seats[1-seat],ready:room.seats[seat].ready,opponentReady:!!room.seats[1-seat]?.ready};}
 function privateView(state){
  // An opponent's changing costs, cooldowns and legal targets are private.
  state.fighters=state.fighters.map((n,i)=>i<3?n:{...n,skills:state.roster.find(c=>c.id===n.id).skills.map(s=>({...s,cooldown:0,targets:[],affordable:false}))});
  return state;
 }
 async function refresh(room){room.views=await Promise.all([0,1].map(async player=>privateView(await room.engine.call({command:'state',player}))));}
 function schedule(room,preserveDeadline=false){
  clearTimeout(room.timer);room.deadline=room.stage==='playing'?(preserveDeadline?room.deadline:Date.now()+turnMs):0;
  if(!room.deadline)return;
  const revision=room.revision;
  room.timer=setTimeout(()=>locked(room,async()=>{
   if(room.stage!=='playing'||room.revision!==revision||room.deadline>Date.now())return;
   const player=room.views[0].activePlayer;
   const next=await room.engine.call({command:'humanTurn',player,moves:[],payment:[]});
   if(next.error)throw Error(next.error);
   room.notice='Tempo esgotado: '+room.seats[player].name+' passou sem ações.';
   await changed(room,next);
  }).catch(e=>console.error('Sala:',e.message)),Math.max(0,room.deadline-Date.now())+10);
 }
 async function changed(room,next,resetClock=true){
  room.revision++;if(next.winner)room.stage='finished';await refresh(room);schedule(room,!resetClock);
 }
 async function view(room,session){
  let state;
  if(room.stage==='waiting'){
   state=await session.transact({command:'state'});
   const seat=room.seats.find(s=>s?.session===session);
   if(seat.team)state.fighters=state.fighters.map((n,i)=>i>=3?n:{...n,id:seat.team[i],name:state.roster.find(c=>c.id===seat.team[i]).name,effects:[],defenses:[],skills:state.roster.find(c=>c.id===seat.team[i]).skills.map(s=>({...s,cooldown:0,targets:[],affordable:false}))});
  }else state=structuredClone(room.views[room.seats.findIndex(s=>s?.session===session)]);
  return {...state,started:room.stage!=='waiting',revision:1000000+room.revision,deadline:room.deadline,turnSeconds:turnMs/1000,notice:room.notice,online:info(room,session)};
 }
 async function leave(room,session){
  const seat=room.seats.findIndex(s=>s?.session===session);
  if(room.stage==='playing'){
   const next=await room.engine.call({command:'surrender',player:seat});await changed(room,next);
  }
  room.seats[seat].left=true;session.roomCode=null;
  if(room.stage==='waiting'||room.seats.every(s=>!s||s.left)){
   if(room.stage==='waiting')for(const s of room.seats)if(s)s.session.roomCode=null;
   clearTimeout(room.timer);room.engine?.close();rooms.delete(room.code);
  }
  return {...await session.transact({command:'lobby'}),online:null};
 }
 function matchNick(value){
  const name=String(value??'').normalize('NFKC').trim();
  if(!/^[\p{L}\p{N}_-]{1,20}$/u.test(name))error('Use de 1 a 20 letras, números, hífens ou sublinhados no nick.');
  return {name,key:name.toLowerCase()};
 }
 async function match(data,session){
  if(session.roomCode)return view(ownRoom(session),session);
  const nick=matchNick(data.nickname),opponent=matchNick(data.opponent);
  if(nick.key===opponent.key)error('Digite um nick diferente do seu.');
  const current=await session.transact({command:'state'});
  if(current.started&&!current.winner)error('Encerre a partida atual antes de procurar outra.');
  const team=data.team;
  if(!Array.isArray(team)||team.length!==3||new Set(team).size!==3||team.some(id=>!current.roster.some(c=>c.id===id)))error('Escolha três personagens diferentes.');
  for(const [key,request] of requests)if(request.expires<=Date.now())requests.delete(key);
  const existing=requests.get(nick.key);
  if(existing&&existing.session!==session)error('Esse nick já está procurando partida. Escolha outro.');
  const other=requests.get(opponent.key);
  if(other?.opponent===nick.key&&other.session!==session&&!other.session.roomCode){
   if(rooms.size>=8)error('As salas de teste estão ocupadas. Tente novamente mais tarde.');
   const code=randomBytes(5).toString('hex').toUpperCase();
   const room={code,seats:[other,{session,name:nick.name,team,ready:true,left:false}],stage:'playing',revision:1,serial:Promise.resolve(),used:Date.now(),deadline:0,notice:'',engine:makeEngine()};
   try{
    const next=await room.engine.call({command:'humanReset',team:other.team,opponentTeam:team});
    if(next.error)error(next.error);
    await changed(room,next);
   }catch(e){room.engine.close();throw e;}
   rooms.set(code,room);
   other.session.roomCode=code;session.roomCode=code;
   requests.delete(other.key);requests.delete(nick.key);
   return view(room,session);
  }
  for(const [key,request] of requests)if(request.session===session)requests.delete(key);
  requests.set(nick.key,{...nick,opponent:opponent.key,session,team,ready:true,left:false,expires:Date.now()+120000});
  return {...current,online:null,searching:true};
 }
 async function run(data,session){
  if(['match','cancelMatch'].includes(data.command)){
   const task=matching.then(()=>{
    if(data.command==='match')return match(data,session);
    if(session.roomCode)return view(ownRoom(session),session);
    for(const [key,request] of requests)if(request.session===session)requests.delete(key);
    return {searching:false};
   });
   matching=task.catch(()=>{});
   return task;
  }
  if(data.command==='state'&&!session.roomCode)return {...await session.transact({command:'state'}),online:null};
  if(data.command==='create'){
   if(session.roomCode)error('Saia da sala atual antes de criar outra.');
   if(rooms.size>=8)error('As salas de teste estão ocupadas. Tente novamente mais tarde.');
   const code=randomBytes(5).toString('hex').toUpperCase();
   const room={code,seats:[{session,name:nickname(data.nickname),ready:false,left:false},null],stage:'waiting',revision:1,serial:Promise.resolve(),used:Date.now(),deadline:0,notice:''};
   rooms.set(code,room);session.roomCode=code;await session.transact({command:'lobby'});return view(room,session);
  }
  if(data.command==='join'){
   const room=codeRoom(data.code);
   return locked(room,async()=>{
    const existing=room.seats.findIndex(s=>s?.session===session&&!s.left);
    if(existing>=0)return view(room,session);
    if(session.roomCode)error('Saia da sala atual antes de entrar em outra.');
    if(room.stage!=='waiting'||room.seats[1])error('Esta sala já tem dois jogadores ou a partida começou.');
    room.seats[1]={session,name:nickname(data.nickname),ready:false,left:false};session.roomCode=room.code;room.revision++;room.used=Date.now();await session.transact({command:'lobby'});return view(room,session);
   });
  }
  const room=ownRoom(session);
  return locked(room,async()=>{
   const seat=room.seats.findIndex(s=>s?.session===session);
   if(data.command==='state')return view(room,session);
   if(data.command==='leave')return leave(room,session);
   if(data.command==='ready'){
    if(room.stage!=='waiting')error('A partida já começou.');
    const catalog=(await session.transact({command:'state'})).roster;
    if(!Array.isArray(data.team)||data.team.length!==3||new Set(data.team).size!==3||data.team.some(id=>!catalog.some(c=>c.id===id)))error('Escolha três personagens diferentes.');
    room.seats[seat].team=[...data.team];room.seats[seat].ready=true;room.revision++;
    if(room.seats.every(s=>s?.ready)){
     room.engine=makeEngine();
     const next=await room.engine.call({command:'humanReset',team:room.seats[0].team,opponentTeam:room.seats[1].team});
     if(next.error)error(next.error);room.stage='playing';room.notice='';await changed(room,next);
    }
    return view(room,session);
   }
   if(data.command==='unready'){
    if(room.stage!=='waiting')error('A partida já começou.');room.seats[seat].ready=false;room.revision++;return view(room,session);
   }
   if(room.stage!=='playing')error('A partida não está em andamento.');
   if(!['turn','exchange','surrender'].includes(data.command))error('Comando de sala inválido.');
   if(data.command!=='surrender'){
    if(room.views[0].activePlayer!==seat)error('Aguarde o turno do seu amigo.');
    if(data.round!==room.views[seat].round)error('Este turno já terminou. Atualize suas ações.');
   }
   const command={turn:'humanTurn',exchange:'humanExchange',surrender:'surrender'}[data.command];
   const next=await room.engine.call({command,player:seat,moves:data.moves,payment:data.payment,exchangeTo:data.exchangeTo});
   if(next.error)error(next.error);room.notice='';await changed(room,next,data.command!=='exchange');return view(room,session);
  });
 }
 const cleanup=setInterval(()=>{for(const [key,request] of requests)if(request.expires<=Date.now())requests.delete(key);for(const [code,room]of rooms)if(Date.now()-room.used>30*60*1000){clearTimeout(room.timer);room.engine?.close();for(const s of room.seats)if(s)s.session.roomCode=null;rooms.delete(code);}},60000);cleanup.unref();
 return {handle(data,session){
  const now=Date.now();if(!session.roomRate||now-session.roomRate.at>60000)session.roomRate={at:now,count:0};if(++session.roomRate.count>180)return Promise.reject(Error('Muitas requisições. Aguarde um momento.'));
  if(['join','create','match'].includes(data.command)){if(!session.joinRate||now-session.joinRate.at>60000)session.joinRate={at:now,count:0};if(++session.joinRate.count>12)return Promise.reject(Error('Muitas tentativas de entrada. Aguarde um minuto.'));}
  const task=(session.roomSerial||Promise.resolve()).then(()=>run(data,session));session.roomSerial=task.catch(()=>{});return task;
 },close(){clearInterval(cleanup);for(const room of rooms.values()){clearTimeout(room.timer);room.engine?.close();}}};
};
