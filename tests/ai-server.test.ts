import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import lock from '../config/model-lock.json';
async function listen(s:Server){await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));return (s.address() as {port:number}).port}
test('local service validates origin, budget, serial execution and forwards only fixed model options',async()=>{
 let busyResponse=false,last:any,memoryError=false,pinned=false;
 const upstream=createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url==='/api/version'){res.end(JSON.stringify({version:pinned?lock.ollama:'test'}));return}
  if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:lock.model,digest:pinned?lock.digest:'test-only'}]}));return}
  if(req.url==='/api/ps'){res.end(JSON.stringify({models:[]}));return}
  let body='';for await(const b of req)body+=b;last=JSON.parse(body);if(memoryError){res.statusCode=500;res.end(JSON.stringify({error:'out of memory'}));return}busyResponse=true;await new Promise(r=>setTimeout(r,150));busyResponse=false;res.end(JSON.stringify({message:{content:'{"commands":[]}'},done_reason:'stop',prompt_eval_count:8,eval_count:8}));
 });
 const upstreamPort=await listen(upstream),probe=createServer(),port=await listen(probe);await new Promise<void>(r=>probe.close(()=>r()));const dir=await mkdtemp(join(tmpdir(),'af-ai-test-'));
 const child=spawn(process.execPath,['--import','tsx','apps/ai-server/src/ai-server.ts'],{windowsHide:true,stdio:'ignore',env:{...process.env,AF_AI_ENFORCE_LOCK:'0',AF_AI_PORT:String(port),AF_OLLAMA_PORT:String(upstreamPort),AF_AI_ARTIFACT_DIR:dir,AF_AI_STATE_DIR:dir}}),base=`http://127.0.0.1:${port}`;
 try{
  for(let i=0;i<60;i++){try{if((await fetch(base+'/api/ai/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,50))}
  assert.equal((await fetch(base+'/api/ai/health')).status,200);
  const mismatch=await (await fetch(base+'/api/ai/readiness')).json();
  assert.equal(mismatch.ready,false);
  assert.equal(mismatch.reason,'pin-mismatch');
  assert.deepEqual(mismatch.ollama,{reachable:true,version:'test'});
  pinned=true;
  const ready=await (await fetch(base+'/api/ai/readiness')).json();
  assert.equal(ready.ready,true);
  assert.deepEqual(ready.ollama,{reachable:true,version:lock.ollama});
  assert.equal(ready.reason,undefined);
  assert.equal((await fetch(base+'/api/ai/status',{headers:{origin:'https://untrusted.invalid'}})).status,403);
  const send=(body:unknown)=>fetch(base+'/api/ai/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  for(const body of ['{','','null','[]','true','42','"text"','{"system":"ok","prompt":"x","format":[]}']){
   const invalid=await fetch(base+'/api/ai/generate',{method:'POST',headers:{'content-type':'application/json'},body});
   assert.equal(invalid.status,400,`Invalid JSON request: ${body}`);
   assert.equal((await invalid.json()).error,'Некорректный запрос');
  }
  assert.equal((await send({system:'ok',prompt:'x',format:{},model:'other'})).status,400);
  await writeFile(join(dir,'bootstrap.json'),JSON.stringify({stage:'downloading',message:'Preparing model'}));
  const initializing=await (await fetch(base+'/api/ai/readiness')).json();
  assert.equal(initializing.ready,false);
  assert.equal(initializing.activePreparation,'downloading');
  assert.equal(initializing.reason,'preparation');
  assert.equal((await send({system:'ok',prompt:'x',format:{}})).status,502);
  await writeFile(join(dir,'bootstrap.json'),JSON.stringify({stage:'ready',message:'Ready'}));
  assert.equal((await send({system:'ok',prompt:'я'.repeat(12000),format:{}})).status,413);
  const first=send({system:'ok',prompt:'hello',format:{type:'object'}});for(let i=0;i<30&&!busyResponse;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal((await send({system:'ok',prompt:'hello',format:{type:'object'}})).status,409);assert.equal((await first).status,200);
  assert.equal(last.model,'qwen3.5:2b');assert.equal(last.think,false);assert.equal(last.options.num_ctx,4096);assert.equal(last.options.num_gpu,99);assert.equal(last.stream,false);
  assert.equal((await fetch(base+'/api/ai/unknown')).status,404);
  memoryError=true;const oom=await send({system:'ok',prompt:'hello',format:{type:'object'}});assert.equal(oom.status,502);assert.match((await oom.json()).error,/Недостаточно памяти/);
  upstream.closeAllConnections();await new Promise<void>(r=>upstream.close(()=>r()));const stopped=await fetch(base+'/api/ai/status');assert.equal(stopped.status,503);assert.match((await stopped.json()).error,/Ollama недоступна/);
  assert.equal((await fetch(base+'/api/ai/health')).status,200);
  const offline=await (await fetch(base+'/api/ai/readiness')).json();
  assert.equal(offline.ready,false);
  assert.equal(offline.reason,'ollama-unavailable');
  assert.deepEqual(offline.ollama,{reachable:false});
  assert.match(offline.error,/Ollama недоступна/);
  assert.doesNotMatch(offline.error,/TypeError|fetch failed/);
 }finally{child.kill();await new Promise<void>(r=>child.once('exit',()=>r()));upstream.closeAllConnections();await new Promise<void>(r=>upstream.close(()=>r()));await rm(dir,{recursive:true,force:true})}
});
