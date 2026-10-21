import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'vite';
const examples=process.argv.includes('--examples'),demoFacts=process.argv.includes('--demo-facts');
const run=promisify(execFile),out=process.env.AF_AI_REPORT_DIR||'artifacts/ai'+(examples?'/examples':'');await mkdir(out,{recursive:true});
const devServer=process.env.AF_TEST_URL?undefined:await createServer({server:{host:'127.0.0.1',port:4185,strictPort:true,hmr:false}});
await devServer?.listen();
const base=process.env.AF_TEST_URL||'http://127.0.0.1:4185';
const cases=[
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
const sources='Alabuga Framework — локальный визуальный конструктор. Проекты сохраняются в браузере в IndexedDB. Пользователь выбирает фирменные композиции, редактирует тексты и изображения, просматривает результат и экспортирует HTML. Сайт адаптируется к экрану. Презентация сохраняет формат 16:9. ИИ-прототип создаёт до 5 секций сайта и до 6 слайдов за запрос. Экспортированный HTML работает без модели.';
const smoke=process.argv.includes('--smoke');
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(base+'/builder/');await page.locator('.library-tools').waitFor();
const report={mode:'real-local-model',sourceSet:demoFacts?'product-facts':'original-acceptance',model:'qwen3.5:2b',started:new Date().toISOString(),cases:[],memory:[]};
let sampling=false;const timer=setInterval(async()=>{if(sampling)return;sampling=true;try{const {stdout}=await run('nvidia-smi',['--query-gpu=memory.used,memory.total','--format=csv,noheader,nounits'],{windowsHide:true,timeout:4000});report.memory.push({at:Date.now(),usedMiB:Number(stdout.split(',')[0]),totalMiB:Number(stdout.split(',')[1])})}catch{}finally{sampling=false}},1500);
try{
 const status=await fetch('http://127.0.0.1:4176/api/ai/status');report.environment=await status.json();if(!status.ok)throw new Error(JSON.stringify(report.environment));
 for(const [i,[target,prompt]]of [...cases.entries()].filter(([i])=>examples?i>=18:!smoke||i===0)){
  console.log(`Case ${i+1}: ${prompt}`);const started=Date.now();
  const result=await page.evaluate(async({target,prompt,sources,demoFacts})=>{
   if(demoFacts)sources=(await import('/packages/ai/src/demo-facts.ts')).productFacts;
   const {newDraft,generateDraft}=await import('/apps/editor/src/ai/generation.ts');const {OllamaProvider}=await import('/packages/ai/src/provider.ts');const {checkSection}=await import('/apps/editor/src/ai/quality.ts');const {draftDocument}=await import('/packages/ai/src/contracts.ts');
   const {brandAssets}=await import('/tests/framework/brand.ts');const manifest=await (await fetch('/assets/brand/manifest.json')).json();
   const request={kind:target==='presentation'||target==='slide'?'presentation':'page',scope:target==='page'||target==='presentation'?'document':'section',count:target==='page'?5:target==='presentation'?6:1,prompt,audience:'Авторы контента',sources};
   const wanted=[brandAssets.logo,brandAssets.blue,brandAssets.glass];const materials=manifest.assets.filter(a=>wanted.includes(a.url)).map(a=>({id:a.id,name:a.name,description:a.usage,src:a.url,category:a.category}));
   const provider=new OllamaProvider();
   const progress=[];const d=await generateDraft(newDraft(request,'acceptance','anchor'),provider,materials,new AbortController().signal,async d=>{progress.push(d.status)},p=>checkSection(p,request.kind));
   return {draft:d,document:d.sections.some(Boolean)?draftDocument(d):null,progress};
  },{target,prompt,sources,demoFacts});
  const success=result.draft.status.stage==='ready';report.cases.push({index:i+1,target,prompt,elapsedMs:Date.now()-started,success,errors:result.draft.errors,warnings:result.draft.warnings,status:result.draft.status.message});
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
 report.loaded=await (await fetch('http://127.0.0.1:11434/api/ps')).json();
}catch(e){report.error=String(e);console.error(e);process.exitCode=1}finally{
 clearInterval(timer);report.finished=new Date().toISOString();report.passed=report.cases.filter(c=>c.success).length;report.peakMiB=Math.max(0,...report.memory.map(s=>s.usedMiB));await writeFile(`${out}/${smoke?'smoke':'acceptance'}.json`,JSON.stringify(report,null,2));await browser.close();await devServer?.close();
}
