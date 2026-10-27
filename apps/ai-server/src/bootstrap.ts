import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import lock from '../../../config/model-lock.json';
import {preparePinnedModel} from './pinned-model';
import {writeBootstrapState} from './bootstrap-state';
const base=process.env.AF_OLLAMA_URL||'http://127.0.0.1:11434',dir=resolve(process.env.AF_AI_STATE_DIR||'artifacts/ai');
async function state(stage:string,message:string){await mkdir(dir,{recursive:true});await writeBootstrapState(resolve(dir,'bootstrap.json'),{stage,message,upstream:base,updated:new Date().toISOString()});console.log(message)}
async function request(path:string,options?:RequestInit){const r=await fetch(base+path,{...options,signal:options?.signal??AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`Ollama ${r.status}: ${await r.text()}`);return r}
export async function initializeModel(){
 try{
  await state('waiting','Ожидаем Ollama / Waiting for Ollama');let ready=false;
  for(let i=0;i<60;i++){try{const info=await(await request('/api/version')).json();if(info.version!==lock.ollama)throw new Error('Ollama version mismatch: '+info.version);ready=true;break}catch(e){if(String(e).includes('mismatch'))throw e;await new Promise(r=>setTimeout(r,2000))}}
  if(!ready)throw new Error('Ollama is unavailable after startup timeout');
  const find=async()=>((await(await request('/api/tags')).json()).models??[]).find((m:{name:string})=>m.name===lock.model);
  let model=await find();
  if(model&&model.digest!==lock.digest)throw new Error('Model digest mismatch. Existing model was not replaced.');
  if(process.env.AF_OLLAMA_MODELS_DIR){await preparePinnedModel(process.env.AF_OLLAMA_MODELS_DIR,process.env.AF_MODEL_REGISTRY||'https://registry.ollama.ai/v2/library/qwen3.5',message=>state('downloading',message));model=await find();if(!model)throw new Error('Pinned model is not visible to Ollama; check the shared model volume')}
  if(!model){
   await state('downloading','Загружаем модель / Downloading '+lock.model);
   const response=await request('/api/pull',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:lock.model,stream:true}),signal:AbortSignal.timeout(60*60*1000)});
   const reader=response.body!.getReader(),decoder=new TextDecoder();let pending='',last=0;
   for(;;){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let end;
    while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(!line.trim())continue;const item=JSON.parse(line);if(item.error)throw new Error(item.error);if(Date.now()-last>1000){last=Date.now();await state('downloading',`${item.status??'Downloading'}${item.total?' '+Math.round((item.completed??0)/item.total*100)+'%':''}`)}}
   }
   if(pending.trim()){const item=JSON.parse(pending);if(item.error)throw new Error(item.error)}
   model=await find();
  }
  if(!model||model.digest!==lock.digest)throw new Error('Downloaded model digest mismatch; AI remains unavailable.');
  await state('ready','Модель готова / Model ready');
 }catch(error){await state('error',String(error));throw error}
}
if(process.argv[1]?.replaceAll('\\','/').match(/\/bootstrap\.(ts|js)$/))await initializeModel();
