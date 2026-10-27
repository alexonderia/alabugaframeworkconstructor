import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'vite';
const examples=process.argv.includes('--examples'),demoFacts=process.argv.includes('--demo-facts');
const run=promisify(execFile),out=process.env.AF_AI_REPORT_DIR||'artifacts/ai'+(examples?'/examples':'');await mkdir(out,{recursive:true});
const devServer=process.env.AF_TEST_URL?undefined:await createServer({server:{host:'127.0.0.1',port:4185,strictPort:true,hmr:false}});
await devServer?.listen();
const base=process.env.AF_TEST_URL||'http://127.0.0.1:4185';
const api=process.env.AF_AI_TEST_URL||'http://127.0.0.1:4176',lock=JSON.parse(await readFile('config/model-lock.json','utf8'));
const originalCases=[
 ['section','Создай текстовую секцию о визуальном конструкторе.'],
 ['section','Создай обложку сайта о фирменных композициях.'],
 ['slide','Создай титульный слайд об Alabuga Framework.'],
 ['section','Покажи три преимущества готовых композиций.'],
 ['slide','Покажи этапы: выбрать композицию, добавить содержание, экспортировать.'],
 ['section','Создай секцию с текстом и фирменной иллюстрацией.'],
 ['slide','Сравни сайт и презентацию.'],
 ['section','Объясни автономную работу без интернета после установки.'],
 ['slide','Создай финальный слайд с призывом начать свой проект, без ссылки.'],
 ['section','Покажи таблицу сравнения форматов по исходным сведениям.'],
 ['section','Создай шапку сайта с названием Alabuga Framework.'],
 ['slide','Создай слайд-разделитель «От идеи к форме».'],
 ['section','Создай подвал страницы без выдуманных контактов.'],
 ['slide','Сделай тезис о редактируемых компонентах.'],
 ['section','Создай секцию о хранении локальных проектов.'],
 ['slide','Покажи три возможности: текст, изображения, таблицы.'],
 ['section','Объясни, как просмотреть сайт на мобильном экране.'],
 ['slide','Сделай слайд с показателями из исходных сведений: 5 секций и 6 слайдов.'],
 ['page','Создай лендинг из пяти секций об Alabuga Framework: идея, возможности, композиции, процесс, следующий шаг.'],
 ['presentation','Создай презентацию из шести слайдов об Alabuga Framework: идея, фирменный стиль, композиции, редактирование, предпросмотр, экспорт.'],
];
const custom=process.env.AF_AI_TASKS_FILE?JSON.parse(await readFile(process.env.AF_AI_TASKS_FILE,'utf8')):undefined;
if(custom&&(!custom.label||typeof custom.sources!=='string'||!Array.isArray(custom.cases)||custom.cases.some(c=>!['section','slide','page','presentation'].includes(c.target)||typeof c.prompt!=='string'||c.count!==undefined&&(!Number.isInteger(c.count)||c.count<1||c.count>(c.target==='page'?5:6)))))throw new Error('Invalid AI task fixture');
if(custom&&demoFacts)throw new Error('Custom source facts cannot be combined with --demo-facts');
const cases=custom?custom.cases.map(c=>[c.target,c.prompt,c.count]):originalCases;
const sources=custom?.sources??'Alabuga Framework — локальный визуальный конструктор. Проекты сохраняются в браузере в IndexedDB. Пользователь выбирает фирменные композиции, редактирует тексты и изображения, просматривает результат и экспортирует HTML. Сайт адаптируется к экрану. Презентация сохраняет формат 16:9. ИИ-прототип создаёт до 5 секций сайта и до 6 слайдов за запрос. Экспортированный HTML работает без модели.';
const smoke=process.argv.includes('--smoke');
const browser=await chromium.launch({channel:process.env.AF_BROWSER_CHANNEL||undefined});const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(base+'/builder/');await page.locator('.library-tools').waitFor();
const report={mode:'real-local-model',flow:'generator-through-dev-server',base,api,sourceSet:custom?.label||(demoFacts?'product-facts':'original-acceptance'),sources,model:lock.model,started:new Date().toISOString(),cases:[],memory:[],sourceHashes:{}};
for(const file of ['scripts/ai-live.mjs','config/model-lock.json','packages/ai/src/generate.ts','packages/ai/src/content-format.ts','packages/ai/src/content-review.ts','packages/ai/src/planning.ts','packages/ai/src/prompt-policy.ts','packages/ai/src/topic-guidance.ts','packages/ai/src/source-table.ts','apps/editor/src/ai/quality.ts',...(custom?[process.env.AF_AI_TASKS_FILE]:[])])report.sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
let responseTasks=[];
page.on('response',response=>{if(new URL(response.url()).pathname==='/api/ai/generate')responseTasks.push((async()=>({request:response.request().postDataJSON(),status:response.status(),response:await response.json()}))().catch(error=>({status:response.status(),captureError:String(error)})))});
const requestedCases=process.env.AF_AI_CASES?.split(',').map(Number);if(requestedCases?.some(n=>!Number.isInteger(n)||n<1||n>cases.length))throw new Error('AF_AI_CASES must contain case numbers from 1 to '+cases.length);
const selected=[...cases.entries()].filter(([i])=>(examples?i>=18:!smoke||i===0)&&(!requestedCases||requestedCases.includes(i+1)));report.expectedCases=selected.length;report.selection=requestedCases?'debug-subset':'complete-set';
let sampling=false;const timer=setInterval(async()=>{if(sampling)return;sampling=true;try{const {stdout}=await run('nvidia-smi',['--query-gpu=memory.used,memory.total','--format=csv,noheader,nounits'],{windowsHide:true,timeout:4000});report.memory.push({at:Date.now(),usedMiB:Number(stdout.split(',')[0]),totalMiB:Number(stdout.split(',')[1])})}catch{}finally{sampling=false}},1500);
try{
 const status=await fetch(api+'/api/ai/status');report.environment=await status.json();if(!status.ok)throw new Error(JSON.stringify(report.environment));
 if(report.environment.digest!==lock.digest||report.environment.version!==lock.ollama)throw new Error('Model pin mismatch');
 try{report.gpu=(await run('nvidia-smi',['--query-gpu=name,memory.total,driver_version','--format=csv,noheader'],{windowsHide:true,timeout:4000})).stdout.trim()}catch{}
 for(const [i,[target,prompt,count]]of selected){
  console.log(`Case ${i+1}: ${prompt}`);const started=Date.now();
  const result=await page.evaluate(async({target,prompt,sources,demoFacts,count})=>{
   if(demoFacts)sources=(await import('/packages/ai/src/demo-facts.ts')).productFacts;
   const {newDraft,generateDraft}=await import('/apps/editor/src/ai/generation.ts');const {OllamaProvider}=await import('/packages/ai/src/provider.ts');const {checkSection}=await import('/apps/editor/src/ai/quality.ts');const {draftDocument}=await import('/packages/ai/src/contracts.ts');
   const {brandAssets}=await import('/tests/framework/brand.ts');const manifest=await (await fetch('/assets/brand/manifest.json')).json();
   const request={kind:target==='presentation'||target==='slide'?'presentation':'page',scope:target==='page'||target==='presentation'?'document':'section',count:count??(target==='page'?5:target==='presentation'?6:1),prompt,audience:'Авторы контента',sources};
   const wanted=[brandAssets.logo,brandAssets.blue,brandAssets.glass];const materials=manifest.assets.filter(a=>wanted.includes(a.url)).map(a=>({id:a.id,name:a.name,description:a.usage,src:a.url,category:a.category}));
   const provider=new OllamaProvider();
   const progress=[];const d=await generateDraft(newDraft(request,'acceptance','anchor'),provider,materials,new AbortController().signal,async d=>{progress.push(d.status)},p=>checkSection(p,request.kind));
   return {draft:d,document:d.sections.some(Boolean)?draftDocument(d):null,progress};
  },{target,prompt,sources,demoFacts,count});
  result.modelCalls=await Promise.all(responseTasks);responseTasks=[];
  report.sources=result.draft.request.sources;
  const success=result.draft.status.stage==='ready';report.cases.push({index:i+1,target,prompt,elapsedMs:Date.now()-started,success,errors:result.draft.errors,warnings:result.draft.warnings,status:result.draft.status.message,modelCalls:result.modelCalls.length});
  await writeFile(`${out}/case-${String(i+1).padStart(2,'0')}.json`,JSON.stringify(result,null,2));
  if(examples&&success)await writeFile(`${out}/${i===18?'landing':'presentation'}-source.json`,JSON.stringify(result,null,2));
  if(result.document){
   await page.evaluate(async doc=>{const {renderDocument}=await import('/tests/framework/runtime.ts');const host=document.createElement('div');host.id='ai-acceptance';document.body.replaceChildren(host);window.aiAcceptance=renderDocument(host,doc,{editing:true});await document.fonts.ready},result.document);
   await page.screenshot({path:`${out}/case-${String(i+1).padStart(2,'0')}.png`,fullPage:target==='page'});
   if(target==='presentation')for(let s=0;s<6;s++){await page.evaluate(i=>window.aiAcceptance.goToSlide(i),s);await page.screenshot({path:`${out}/slide-${s+1}.png`})}
   if(target==='page'){await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/landing-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000})}
   await page.goto(base+'/builder/');
  }
  await writeFile(`${out}/${smoke?'smoke':'acceptance'}.json`,JSON.stringify(report,null,2));console.log(`  ${success?'PASS':'FAIL'} ${report.cases.at(-1).elapsedMs}ms ${result.draft.status.message}`);
 }
 report.loaded={models:(await (await fetch(api+'/api/ai/status')).json()).loaded};
}catch(e){report.error=String(e);console.error(e);process.exitCode=1}finally{
 clearInterval(timer);report.finished=new Date().toISOString();report.passed=report.cases.filter(c=>c.success).length;report.complete=!report.error&&report.cases.length===selected.length;report.technicalPassed=report.complete&&report.passed===selected.length;report.peakMiB=Math.max(0,...report.memory.map(s=>s.usedMiB));if(!report.technicalPassed)process.exitCode=1;await writeFile(`${out}/${smoke?'smoke':'acceptance'}.json`,JSON.stringify(report,null,2));await browser.close();await devServer?.close();
}
