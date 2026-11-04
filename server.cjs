const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const {randomUUID,randomInt}=require('node:crypto');
const root=__dirname;
const binary=path.resolve(process.env.ARENA_ENGINE||path.join(root,'engine/bin/naruto-engine-classic-v11.exe'));
const toolchain='Z:/Codex/Projetos/na-test-20261023/programs/x86_64-windows/ghc-9.10.3';
const hosted=process.env.ARENA_HOSTED==='1';
const port=Number(process.env.PORT||process.env.ARENA_PORT||3224);
const host=hosted?'0.0.0.0':'127.0.0.1';
const engineEnv=process.platform==='win32'
 ? {...process.env,PATH:[toolchain+'/bin',toolchain+'/mingw/bin',process.env.PATH].join(path.delimiter)}
 : process.env;
let activeEngines=0;
const sessions=new Map();
function makeEngine(){
if(hosted&&activeEngines>=6)throw new Error('Servidor de teste cheio. Tente novamente em alguns minutos.');
const child=spawn(binary,[],{windowsHide:true,env:engineEnv,stdio:['pipe','pipe','pipe']});
activeEngines++;
child.once('close',()=>activeEngines--);
const waiting=[];
let engineError='';
child.on('error',e=>{engineError=e.message;for(const p of waiting.splice(0))p.reject(e);});
child.on('exit',code=>{engineError=`Motor encerrado (${code}).`;for(const p of waiting.splice(0))p.reject(new Error(engineError));});
child.stderr.on('data',b=>process.stderr.write(b));
readline.createInterface({input:child.stdout}).on('line',line=>{const p=waiting.shift();if(p){try{p.resolve(JSON.parse(line));}catch(e){p.reject(e);}}});
function call(data){return new Promise((resolve,reject)=>{if(engineError)return reject(new Error(engineError));waiting.push({resolve,reject});child.stdin.write(JSON.stringify(data)+'\n');});}
return {call,close(){child.kill();}};
}
function createSession(){
const engine=makeEngine(),call=engine.call;
const turnMs=Number(process.env.ARENA_TURN_MS||60000);
let cpuMs=5000;
let deadline=0, turnTimer=null, serial=Promise.resolve(), revision=0, notice='', started=false;
function schedule(state){
 clearTimeout(turnTimer);
 if(!state.yourTurn)cpuMs=5000+randomInt(5001);
 const delay=state.yourTurn?turnMs:cpuMs,scheduledRevision=revision;
 deadline=state.winner?0:Date.now()+delay;
 if(deadline)turnTimer=setTimeout(()=>transact({command:state.yourTurn?'turn':'cpuTurn',moves:[],payment:[],timerRevision:scheduledRevision},true).catch(e=>console.error(e.message)),delay+5);
}
function transact(data,timedOut=false){
 const run=async()=>{
  const current=await call({command:'state'});
  if(!timedOut&&data.round!=null&&data.command==='turn'&&data.round!==current.round)return {error:'O turno já terminou. Atualize suas ações.'};
  if(timedOut&&(!started||data.timerRevision!==revision||current.winner||deadline>Date.now()))return {...current,deadline,revision};
  if(data.command==='lobby'){started=false;clearTimeout(turnTimer);deadline=0;revision++;notice='';return {...current,deadline,revision,turnSeconds:turnMs/1000,started};}
  if(data.command==='turn'&&!started)return {error:'Escolha a equipe e clique em Jogar contra CPU.'};
  if(['turn','exchange'].includes(data.command)&&!current.yourTurn)return {error:'Aguarde o turno da CPU.'};
  const state=data.command==='state'?current:await call(data.command==='turn'?{...data,command:'playerTurn'}:data);
  if(state.error)return state;
  if(data.command==='reset')started=true;
  if(started&&(['turn','cpuTurn','reset','surrender'].includes(data.command)||!deadline&&!state.winner)){
   revision++;
   notice=timedOut&&data.command==='turn'?'Tempo esgotado: seu turno foi encerrado sem ações.':'';
   schedule(state);
  }
  return {...state,deadline,revision,turnSeconds:(state.yourTurn?turnMs:cpuMs)/1000,notice,started,cpuThinking:started&&!state.winner&&!state.yourTurn};
 };
 const task=serial.then(run);serial=task.catch(()=>{});return task;
}
return {transact,lastUsed:Date.now(),close(){clearTimeout(turnTimer);engine.close();}};
}
const roomService=require('./rooms.cjs')(makeEngine,Number(process.env.ARENA_TURN_MS||60000));
function sessionFor(req,res){
 const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('narutoBattle='));
 let id=cookie?.slice('narutoBattle='.length),session=id&&sessions.get(id);
 if(!session){
  if(sessions.size>=(hosted?4:16))throw new Error('Muitas sessões abertas. Tente novamente em alguns minutos.');
  id=randomUUID();session=createSession();sessions.set(id,session);
  res.setHeader('Set-Cookie',`narutoBattle=${id}; Path=/; HttpOnly; SameSite=Strict${req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);
 }
 session.lastUsed=Date.now();return session;
}
const sessionTimeout=(hosted?5:30)*60*1000;
const cleanup=setInterval(()=>{for(const [id,session]of sessions)if(Date.now()-session.lastUsed>sessionTimeout){session.close();sessions.delete(id);}},60000);cleanup.unref();
const imgRoot=path.join(__dirname,'assets');
const normalized=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const classicCatalog=JSON.parse(fs.readFileSync(path.join(root,'classic/catalog.json'),'utf8'));
const images = {};
const assetRoot = path.join(root, 'assets');
const mime = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.ttf':'font/ttf','.svg':'image/svg+xml'};
for(const id of fs.readdirSync(path.join(assetRoot,'ninja'))){
 const folder=path.join(assetRoot,'ninja',id);
 if(!fs.statSync(folder).isDirectory()) continue;
 images[id]={};
 for(const name of fs.readdirSync(folder)){
  const ext=path.extname(name);
  if(mime[ext]) images[id][normalized(path.basename(name,ext))]='/assets/ninja/'+encodeURIComponent(id)+'/'+encodeURIComponent(name);
 }
}
for(const n of classicCatalog){images[n.id]??={};images[n.id].icon=n.image;for(const skill of n.skills)images[n.id][normalized(skill.name)]=skill.image;}
const send=(res,code,data,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(typeof data==='string'?data:JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/healthz')return send(res,fs.existsSync(binary)?200:503,{ok:fs.existsSync(binary)});
  if(url.pathname==='/classic-catalog.json'){
   const implemented=JSON.parse(fs.readFileSync(path.join(root,'classic/implemented.json'),'utf8'));
   return send(res,200,classicCatalog.map(n=>({...n,implementation:implemented.includes(n.id)?'playable':'reference'})));
  }
  if(['/classic','/classic.js','/classic.css'].includes(url.pathname))return send(res,200,fs.readFileSync(path.join(root,url.pathname==='/classic'?'classic.html':url.pathname.slice(1)),'utf8'),url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
  if(url.pathname==='/rank-layout.js'||url.pathname==='/rank-layout.css')return send(res,200,fs.readFileSync(path.join(root,url.pathname.slice(1)),'utf8'),url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');
  if(url.pathname==='/rank-layout'||url.pathname==='/rank-overlay-layout'){
   const file=path.join(root,url.pathname==='/rank-overlay-layout'?'outputs/rank-overlay-layout.json':'outputs/rank-layout.json');
   if(req.method==='GET')return send(res,200,fs.existsSync(file)?fs.readFileSync(file,'utf8'):'{}');
   if(req.method!=='POST')return send(res,405,{error:'Método inválido.'});
   if(hosted)return send(res,403,{error:'Use o editor local para salvar alinhamentos do servidor.'});
   if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Origem inválida.'});
   let body='';for await(const chunk of req){body+=chunk;if(body.length>8000)return send(res,413,{error:'Arquivo muito grande.'});}
   const data=JSON.parse(body),allowed=['academy-student','genin','chuunin','missing-nin','anbu','jounin','sannin','jinchuuriki','akatsuki','kage','hokage'];
   if(!data||Array.isArray(data)||typeof data!=='object')return send(res,400,{error:'Alinhamentos inválidos.'});
   const clean={};for(const [id,v]of Object.entries(data)){if(!allowed.includes(id)||!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||!Number.isFinite(v.size)||Math.abs(v.x)>(url.pathname==='/rank-overlay-layout'?60:40)||Math.abs(v.y)>(url.pathname==='/rank-overlay-layout'?60:40)||v.size<(url.pathname==='/rank-overlay-layout'?60:45)||v.size>(url.pathname==='/rank-overlay-layout'?180:100))return send(res,400,{error:'Medidas inválidas.'});clean[id]={x:v.x,y:v.y,size:v.size};}
   fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(clean,null,2));fs.renameSync(file+'.tmp',file);return send(res,200,{saved:true});
  }
  if(['/api','/room-api'].includes(url.pathname)&&req.method==='POST'){
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Origem inválida.'});
   if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(res,415,{error:'Use JSON.'});
   let data='';for await(const chunk of req){data+=chunk;if(data.length>256000)throw new Error('Requisição muito grande.');}
   const session=sessionFor(req,res),input=JSON.parse(data);
   if(!input||typeof input!=='object'||typeof input.command!=='string')return send(res,400,{error:'Requisição inválida.'});
   if(url.pathname==='/room-api'){
    try{send(res,200,await roomService.handle(input,session));}catch(e){send(res,400,{error:e.message});}return;
   }
   if(!['state','reset','turn','exchange','surrender','lobby'].includes(input.command))return send(res,400,{error:'Comando inválido.'});
   const result=await session.transact({command:input.command,team:input.team,moves:input.moves,payment:input.payment,exchangeTo:input.exchangeTo,round:input.round,sandbox:input.sandbox});send(res,result.error?400:200,result);return;
  }
  if(url.pathname==='/defense.svg'){send(res,200,fs.readFileSync(path.join(root,'assets/defense.svg'),'utf8'),'image/svg+xml');return;}
  if(url.pathname==='/pt-br.json'){const file=path.join(root,'pt-br.json');send(res,200,fs.existsSync(file)?fs.readFileSync(file,'utf8'):'{}');return;}
  if(url.pathname==='/reference'){
   const id=url.searchParams.get('id')||'';if(!/^[a-z0-9-]+$/.test(id))return send(res,400,{error:'Ninja inválido'});
   const label=id.replace(/-(s|r)$/,'').split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' ');
   const folder=path.join(root,'engine/src/Game/Characters',id.endsWith('-s')?'Shippuden':id.endsWith('-r')?'Reanimated':'Original');
   let source='';for(const file of fs.readdirSync(folder)){if(!file.endsWith('.hs'))continue;const text=fs.readFileSync(path.join(folder,file),'utf8');const blocks=text.split(/(?=  (?:\[|,) Character\r?\n)/);const block=blocks.find(x=>x.includes('"'+label+'"'));if(block){source=block;break;}}
   return send(res,200,{source:source||'Esta ficha usa um nome especial no catálogo. Consulte as classes, os requisitos e a descrição originais acima.'});
  }
  if(url.pathname==='/images.json'){send(res,200,images);return;}
  if(url.pathname==='/connection.json'){
   let publicUrl='';
   try{const tunnelPid=Number(fs.readFileSync(path.join(root,'naruto-tunnel.pid'),'utf8'));process.kill(tunnelPid,0);const candidate=fs.readFileSync(path.join(root,'outputs/naruto-link-publico.txt'),'utf8').trim();if(/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(candidate))publicUrl=candidate;}catch{}
   send(res,200,{publicUrl});return;
  }
  if(url.pathname.startsWith('/assets/')){
   const parts=url.pathname.slice(8).split('/').map(decodeURIComponent);
   const valid=parts.every(p=>p && p!=='.' && p!=='..' && !/[\\/:]/.test(p));
   const file=path.join(assetRoot,...parts);
   const type=mime[path.extname(file)];
   if(!valid||!type||!fs.existsSync(file)||!fs.statSync(file).isFile()) return send(res,404,{error:'Imagem ou som indisponível'});
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'public,max-age=86400'});
   fs.createReadStream(file).pipe(res);
   return;
  }
  if(url.pathname==='/naruto.js'||url.pathname==='/naruto.css'){const f=url.pathname.slice(1);send(res,200,fs.readFileSync(path.join(__dirname,f),'utf8'),f.endsWith('.js')?'text/javascript':'text/css');return;}
  const name={'/arena-text.js':'arena-text.js','/editor-runtime.js':'editor-runtime.js','/sandbox':'sandbox.html','/sandbox.js':'sandbox.js','/sandbox-guide.js':'sandbox-guide.js','/sandbox.css':'sandbox.css','/ranks.js':'ranks.js','/ingame':'index.html','/':'index.html','/app.js':'app.js','/v2.js':'v2.js','/style.css':'style.css','/hud.js':'hud.js','/hud.css':'hud.css','/online.js':'online.js','/online.css':'online.css'}[url.pathname];
  if(!name)return send(res,404,{error:'Não encontrado'});
  send(res,200,fs.readFileSync(path.join(__dirname,name),'utf8'),name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');
 }catch(e){send(res,500,{error:e.message});}
});
server.listen(port,host,()=>console.log(`Arena: http://${host}:${port}`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{clearInterval(cleanup);roomService.close();for(const session of sessions.values())session.close();server.close(()=>process.exit());});

