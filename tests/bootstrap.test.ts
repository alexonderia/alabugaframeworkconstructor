import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rename,rm,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import lock from '../config/model-lock.json';
import {writeBootstrapState} from '../apps/ai-server/src/bootstrap-state';

test('bootstrap state retries temporary Windows locks and publishes a complete replacement',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'alabuga-bootstrap-state-')),file=join(dir,'bootstrap.json');
 try{
  await writeFile(file,JSON.stringify({stage:'waiting'}));let attempts=0;
  await writeBootstrapState(file,{stage:'ready'},async(from,to)=>{attempts++;if(attempts<=3){assert.equal(JSON.parse(await readFile(file,'utf8')).stage,'waiting');throw Object.assign(new Error('Reader holds state'),{code:['EPERM','EACCES','EBUSY'][attempts-1]})}await rename(from,to)});
  assert.equal(attempts,4);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{stage:'ready'});
 }finally{await rm(file,{force:true});await rm(file+'.tmp',{force:true});await rmdir(dir)}
});

test('bootstrap state preserves the previous report and stops retrying permanent failures',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'alabuga-bootstrap-state-')),file=join(dir,'bootstrap.json');
 try{
  await writeFile(file,JSON.stringify({stage:'waiting'}));
  for(const [code,expected]of [['EPERM',6],['ENOSPC',1]] as const){let attempts=0;const failure=Object.assign(new Error('Cannot publish'),{code});await assert.rejects(writeBootstrapState(file,{stage:'ready'},async()=>{attempts++;throw failure}),error=>error===failure);assert.equal(attempts,expected);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{stage:'waiting'})}
 }finally{await rm(file,{force:true});await rm(file+'.tmp',{force:true});await rmdir(dir)}
});
test('initializer installs once, verifies pin, preserves cached weights and recovers interrupted pulls',async()=>{
 let installed=false,pulls=0,wrong=false,interrupt=false;
 const server=createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url==='/api/version'){res.end(JSON.stringify({version:lock.ollama}));return}
  if(req.url==='/api/tags'){res.end(JSON.stringify({models:installed?[{name:lock.model,digest:wrong?'wrong':lock.digest}]:[]}));return}
  if(req.url==='/api/pull'){pulls++;if(interrupt){res.end('{"error":"connection interrupted"}\n');return}installed=true;res.end('{"status":"downloading","completed":5,"total":10}\n{"status":"success"}\n');return}
  res.statusCode=404;res.end();
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port,dir=await mkdtemp(join(tmpdir(),'alabuga-bootstrap-'));
 const run=()=>new Promise<number|null>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','apps/ai-server/src/bootstrap.ts'],{windowsHide:true,stdio:'ignore',env:{...process.env,AF_OLLAMA_URL:`http://127.0.0.1:${port}`,AF_AI_STATE_DIR:dir}});child.on('error',reject);child.on('exit',resolve)});
 try{
  assert.equal(await run(),0);assert.equal(pulls,1);assert.equal(JSON.parse(await readFile(join(dir,'bootstrap.json'),'utf8')).stage,'ready');
  assert.equal(await run(),0);assert.equal(pulls,1);
  wrong=true;assert.notEqual(await run(),0);assert.equal(pulls,1);assert.equal(JSON.parse(await readFile(join(dir,'bootstrap.json'),'utf8')).stage,'error');
  wrong=false;installed=false;interrupt=true;assert.notEqual(await run(),0);interrupt=false;assert.equal(await run(),0);assert.equal(pulls,3);
 }finally{await new Promise<void>(r=>server.close(()=>r()));const target=resolve(dir);if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('alabuga-bootstrap-'))throw new Error('Unsafe temporary directory');await rm(target,{recursive:true,force:true})}
});
