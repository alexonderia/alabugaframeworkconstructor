import lock from '../../../config/model-lock.json';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const ollamaPort=Number(process.env.AF_OLLAMA_PORT||11434);
if(!Number.isInteger(ollamaPort)||ollamaPort<1||ollamaPort>65535)throw new Error('Invalid local Ollama port');
const upstream=process.env.AF_OLLAMA_URL||'http://127.0.0.1:'+ollamaPort,model=lock.model;
const bind=process.env.AF_AI_HOST||'127.0.0.1',allowedOrigins=(process.env.AF_ALLOWED_ORIGINS||'http://127.0.0.1:4176,http://localhost:4176').split(',');
const port=Number(process.env.AF_AI_PORT||4176),context=Number(process.env.AF_AI_CONTEXT||4096);
if(![2048,4096].includes(context))throw new Error('AF_AI_CONTEXT must be 2048 or 4096');
const run=promisify(execFile),root=resolve(process.env.AF_STATIC_ROOT||'dist/site');let busy=false;
async function preparation(){try{return JSON.parse(await readFile(resolve(process.env.AF_AI_STATE_DIR||'artifacts/ai','bootstrap.json'),'utf8')) as {stage:string;message:string;upstream?:string}}catch{return undefined}}
function preparing(value:Awaited<ReturnType<typeof preparation>>){return !!value&&(!value.upstream||value.upstream===upstream)&&value.stage!=='ready'}
async function ollama(path:string,init?:RequestInit){const r=await fetch(upstream+path,{...init,signal:init?.signal??AbortSignal.timeout(5000)});if(!r.ok)throw new Error(await r.text());return r.json()}
class ModelStatusError extends Error {
 constructor(readonly code: 'model-missing' | 'pin-mismatch', message: string) { super(message) }
}
async function ollamaVersion(): Promise<string> {
 const data = await ollama('/api/version');
 if(typeof data?.version!=='string'||!data.version.trim())throw new Error('Invalid Ollama version response');
 return data.version;
}
async function status(versionRequest = ollamaVersion()){
 const [version,tags,loaded]=await Promise.all([versionRequest,ollama('/api/tags'),ollama('/api/ps')]);
 const found=tags.models?.find((m:{name:string})=>m.name===model);
 if(!found)throw new ModelStatusError('model-missing','Модель отсутствует. Выполните npm run ai:setup.');
 if(process.env.AF_AI_ENFORCE_LOCK!=='0'&&(found.digest!==lock.digest||version!==lock.ollama))
  throw new ModelStatusError('pin-mismatch','Model or Ollama version mismatch; generation disabled.');
 return {model,version,digest:found.digest,context,loaded:loaded.models};
}
const build = process.env.AF_APP_VERSION && process.env.AF_REVISION
 ? {version:process.env.AF_APP_VERSION,revision:process.env.AF_REVISION}
 : undefined;
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const json=(code:number,data:unknown)=>{if(!res.destroyed){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}};
 try{
  if(bind==='127.0.0.1'&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'')){json(403,{error:'Только локальный доступ'});return}
  if(bind==='127.0.0.1'&&!/^127\.0\.0\.1:\d+$|^localhost:\d+$/.test(req.headers.host??'')){json(403,{error:'Недопустимый Host'});return}
  if(req.headers.origin&&!allowedOrigins.includes(req.headers.origin)&&!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin)){json(403,{error:'Недопустимый Origin'});return}
  const path=new URL(req.url!,'http://localhost').pathname;
  if(path==='/api/ai/health'){json(200,{status:'ok',build});return}
  if(path==='/api/ai/readiness'){
   const versionRequest=ollamaVersion();
   const [state,version,result]=await Promise.all([
    preparation(), versionRequest.catch(()=>undefined),
    status(versionRequest).then(info=>({info} as const), (error:unknown)=>({error} as const)),
   ]);
   const runtime=version?{reachable:true,version}:{reachable:false};
   const activePreparation=preparing(state)?state?.stage:undefined;
   if('error' in result){
    const error=result.error;
    const reason=!version?'ollama-unavailable':error instanceof ModelStatusError?error.code:'status-unavailable';
    json(200,{ready:false,model,preparation:state,activePreparation,ollama:runtime,reason,error:reason==='ollama-unavailable'?'Ollama недоступна. Запустите локальную Ollama и повторите проверку.':String(error)});
   }else{
    const pinned=result.info.digest===lock.digest&&result.info.version===lock.ollama;
    const ready=!activePreparation&&pinned;
    const reason=ready?undefined:!pinned?'pin-mismatch':'preparation';
    json(200,{ready,preparation:state,activePreparation,ollama:runtime,reason,...result.info});
   }
   return;
  }
  if(path==='/api/ai/status'&&req.method==='GET'){json(200,await status());return}
  if(path==='/api/ai/diagnostics'&&req.method==='GET'){
   const info=await status();let gpu='Недоступно';try{gpu=(await run('nvidia-smi',['--query-gpu=name,memory.total,memory.used','--format=csv'],{windowsHide:true,timeout:5000})).stdout.trim()}catch{}
   json(200,{...info,gpu});return;
  }
  if(path==='/api/ai/generate'&&req.method==='POST'){
   if(busy){json(409,{error:'Модель занята. Дождитесь завершения текущего запроса.'});return}
   if(!req.headers['content-type']?.startsWith('application/json')){json(415,{error:'Требуется JSON'});return}
   let body='';for await(const data of req){body+=data;if(Buffer.byteLength(body)>64000){json(413,{error:'Слишком большой запрос'});return}}
   let input;
   try{input=JSON.parse(body)}catch{json(400,{error:'Некорректный запрос'});return}
   if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.system!=='string'||typeof input.prompt!=='string'||!input.format||typeof input.format!=='object'||Array.isArray(input.format)||Object.keys(input).some(k=>!['system','prompt','format'].includes(k))){json(400,{error:'Некорректный запрос'});return}
   // Conservative estimate: Cyrillic/non-ASCII characters each receive a token budget.
   const text=input.system+input.prompt+JSON.stringify(input.format),nonAscii=(text.match(/[^\x00-\x7f]/g)??[]).length;
   const estimate=Math.ceil((text.length-nonAscii)/3+nonAscii)+128,output=1024;
   if(estimate+output>context){json(413,{error:`Материалы превышают бюджет контекста ${context}. Сократите запрос или исходные сведения.`,estimate});return}
   if(busy){json(409,{error:'Модель занята. Дождитесь завершения текущего запроса.'});return}
   busy=true;const abort=new AbortController(),timer=setTimeout(()=>abort.abort(new Error('Истекло время ожидания (120 секунд).')),120000);
   res.on('close',()=>{if(!res.writableEnded)abort.abort(new Error('Запрос отменён'))});
   try{
    const state=await preparation();if(preparing(state))throw new Error('Подготовка модели не завершена: '+state!.message);
    const info=await status(),start=Date.now();
    const result=await ollama('/api/chat',{method:'POST',headers:{'content-type':'application/json'},signal:abort.signal,body:JSON.stringify({model,messages:[{role:'system',content:input.system},{role:'user',content:input.prompt}],format:input.format,stream:false,think:false,keep_alive:'10m',options:{num_ctx:context,num_predict:output,temperature:0.2,presence_penalty:0,num_batch:128,num_gpu:99}})});
    if(result.done_reason==='length')throw new Error('Ответ модели не завершён. Уменьшите объём секции.');
    const data=JSON.parse(result.message.content);
    const telemetry={...info,loaded:(await ollama('/api/ps')).models,elapsedMs:Date.now()-start,promptTokens:result.prompt_eval_count,outputTokens:result.eval_count,updated:new Date().toISOString()};
    const artifactDir=process.env.AF_AI_ARTIFACT_DIR||'artifacts/ai';await mkdir(artifactDir,{recursive:true});await writeFile(resolve(artifactDir,'runtime.json'),JSON.stringify(telemetry,null,2));
    json(200,{data,telemetry});
   }catch(e){const reason=String(e);json(502,{error:abort.signal.aborted?String(abort.signal.reason):/out of memory|insufficient.*memory|allocation failed|not enough.*memory|requires more.*memory/i.test(reason)?'Недостаточно памяти для Qwen3.5-2B. Закройте другие приложения GPU и повторите проверку с AF_AI_CONTEXT=2048. '+reason:reason})}finally{clearTimeout(timer);busy=false}return;
  }
  if(path.startsWith('/api/')){json(404,{error:'Неизвестная команда'});return}
  if(req.method!=='GET'&&req.method!=='HEAD'){json(405,{error:'Метод не поддерживается'});return}
  let file=resolve(root,'.'+decodeURIComponent(path));if(file!==root&&!file.startsWith(root+sep)){json(403,{error:'Недопустимый путь'});return}
  try{if((await stat(file)).isDirectory())file=resolve(file,'index.html');const data=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data)}catch{json(404,{error:'Файл не найден. Выполните npm run build.'})}
 }catch(e){json(503,{error:String(e).includes('fetch failed')?'Ollama недоступна. Выполните npm run ai:setup или запустите Ollama.':String(e)})}
});
server.listen(port,bind,()=>console.log(`Alabuga AI: http://127.0.0.1:${port}/builder/index.html · ${model} · context ${context}`));
