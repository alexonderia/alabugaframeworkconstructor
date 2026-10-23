import {chooseOption} from '../tests/choose-option';
import {chromium,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {productFacts} from '@alabuga/ai/demo-facts';

// Isolated browser profile: this rehearsal never opens or changes the author's library.
const out=resolve(process.env.AF_DEMO_REHEARSAL_DIR||'artifacts/demo/rehearsal'),base=process.env.AF_DEMO_URL||'http://127.0.0.1:4176';
await mkdir(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1000}});
const report:{started:string;success?:boolean;error?:string;scenarios:any[];diagnostics?:unknown}={started:new Date().toISOString(),scenarios:[]};
async function record(page:Page,store:string,id:string){return page.evaluate(({store,id})=>new Promise<any>((resolve,reject)=>{const open=indexedDB.open('alabuga-workspace');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>{resolve(r.result);db.close()};r.onerror=()=>{reject(r.error);db.close()}}}),{store,id})}
try{
 await page.goto(base+'/demo/');await page.getByRole('button',{name:'Готовность к показу',exact:true}).click();const rehearsal=page.getByRole('button',{name:'Проверить сценарий показа',exact:true});await expect(rehearsal).toBeEnabled();await rehearsal.click();
 await expect(page.locator('.demo-diagnostics > [role=status]')).toContainText('Техническая репетиция пройдена',{timeout:300000});
 report.diagnostics=(await record(page,'settings','demo:diagnostics'))?.value;
 await page.screenshot({path:resolve(out,'diagnostics.png'),fullPage:true});await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 for(const kind of ['page','presentation'] as const){
  await page.goto(base+'/demo/');await chooseOption(page.getByRole('combobox',{name:'Формат проекта'}),kind);await page.getByRole('button',{name:'Собрать из шаблона',exact:true}).click();await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');
  const id=(await page.evaluate(()=>location.hash)).split('/').at(-1)!,before=(await record(page,'projects',id)).document;
  await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();await chooseOption(page.getByRole('combobox',{name:'Результат',exact:true}),kind==='page'?'section':'slide');
  const prompt=`Покажи три возможности ${kind==='page'?'в секции сайта':'на одном слайде'}: изображения, хранение проектов, автономный экспорт.`;
  await page.getByLabel('Запрос',{exact:true}).fill(prompt);await page.getByLabel('Исходные сведения',{exact:true}).fill(productFacts);
  const start=Date.now();await page.getByRole('button',{name:'Создать черновик',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('Черновик готов',{timeout:180000});
  const generationMs=Date.now()-start,text=await page.locator('.ai-preview').innerText();expect((await record(page,'projects',id)).document).toEqual(before);
  expect(text).toContain('Изображения можно выбрать из библиотеки');expect(text).toContain('Проекты сохраняются в этом браузере');expect(text).toContain('без интернета и без модели');
  await page.screenshot({path:resolve(out,kind+'-draft.png')});await page.locator('.ai-preview [contenteditable]').first().fill('Изображения, проекты и экспорт');await page.locator('.ai-preview [contenteditable]').first().blur();
  if(kind==='presentation'){await page.locator('.ai-dialog [data-fit]').click();await expect(page.locator('.ai-progress')).toContainText('Оформление подобрано',{timeout:30000});expect(await page.locator('.ai-preview').innerText()).toContain('Изображения, проекты и экспорт')}
  await page.getByLabel('Содержание и замечания проверены').check();await page.getByRole('button',{name:'Применить черновик',exact:true}).click();await expect(page.locator('.ai-dialog')).toHaveCount(0);await expect.poll(async()=>(await record(page,'projects',id)).document.pages.length).toBe(before.pages.length+1);
  await page.reload();await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');expect((await record(page,'projects',id)).document.pages.length).toBe(before.pages.length+1);
  const event=page.waitForEvent('download');await page.locator('#export').click();const file=resolve(out,kind+'.html');await(await event).saveAs(file);
  const offline=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await offline.route(/^https?:\/\//,r=>r.abort());await offline.goto(pathToFileURL(file).href);await offline.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});expect(await offline.locator('body').textContent()).toContain('Изображения, проекты и экспорт');await offline.screenshot({path:resolve(out,kind+'-offline.png')});await offline.close();
  report.scenarios.push({kind,prompt,generationMs,draftText:text,isolated:true,applied:true,reopened:true,offlineExport:true});console.log(kind,'PASS',generationMs+'ms');
 }
 report.success=true;
}catch(e){report.success=false;report.error=String(e);process.exitCode=1;await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});console.error(e)}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close()}
