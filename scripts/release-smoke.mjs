import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const port=process.env.AF_SMOKE_PORT||'4388',base=process.env.AF_SMOKE_URL||`http://127.0.0.1:${port}`,out=resolve('artifacts/release-smoke');
await mkdir(out,{recursive:true});
const service=process.env.AF_SMOKE_URL?null:spawn(process.execPath,['apps/ai-server/dist/ai-server.js'],{windowsHide:true,stdio:'inherit',env:{...process.env,AF_AI_PORT:port,AF_OLLAMA_PORT:'1'}});
const report={base,modelAcceptanceRun:false,externalService:Boolean(process.env.AF_SMOKE_URL),documents:[],screens:[]};let browser;
try{
 browser=await chromium.launch({channel:process.env.AF_BROWSER_CHANNEL||undefined});
 for(let i=0;i<60;i++){try{if((await fetch(base+'/api/ai/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 for(const lang of ['ru','en']){
  await page.goto(base+`/docs/${lang}/reference.html`);await expect(page.locator('#live-example .af-widget')).toHaveCount(2);
  await page.locator(`header a[lang="${lang==='ru'?'en':'ru'}"]`).click();await expect(page).toHaveURL(new RegExp(`/docs/${lang==='ru'?'en':'ru'}/reference.html$`));
 }
 for(const width of [390,768,1440,1920]){await page.setViewportSize({width,height:1000});await page.goto(base+'/demo/');await page.screenshot({path:resolve(out,`demo-${width}.png`),fullPage:true});report.screens.push(width)}
 await page.setViewportSize({width:1440,height:1000});
 for(const kind of ['page','presentation']){
  await page.goto(base+'/demo/');await page.getByLabel('Формат проекта').selectOption(kind);await page.getByRole('button',{name:'Собрать из шаблона',exact:true}).click();await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');
  await page.screenshot({path:resolve(out,`${kind}-editor.png`)});
  const download=page.waitForEvent('download');await page.locator('#export').click();const path=resolve(out,kind+'.html');await(await download).saveAs(path);
  const offline=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});await offline.route(/^https?:\/\//,r=>r.abort());await offline.goto(pathToFileURL(path).href);
  await offline.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});
  const count=kind==='page'?10:11;await expect(offline.locator(kind==='page'?'.af-page':'.af-slide')).toHaveCount(count);await offline.screenshot({path:resolve(out,`${kind}-offline.png`)});
  if(kind==='presentation')await offline.pdf({path:resolve(out,'presentation.pdf'),printBackground:true,preferCSSPageSize:true});
  await offline.close();report.documents.push({kind,count,exportedOffline:true});
 }
 expect(errors).toEqual([]);report.passed=true;
}catch(e){report.passed=false;report.error=String(e);throw e}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();service?.kill()}
