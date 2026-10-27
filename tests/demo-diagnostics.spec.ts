import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import axe from 'axe-core';

const lock=JSON.parse(await readFile(new URL('../config/model-lock.json',import.meta.url),'utf8'));
const info={model:lock.model,version:lock.ollama,digest:lock.digest,context:4096,loaded:[{name:lock.model,size:2048,size_vram:2048}]};
test.use({reducedMotion:'reduce'});test.setTimeout(60000);
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));await page.route('**/api/ai/diagnostics',r=>r.fulfill({json:{gpu:'test double'}}))});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function open(page:Page){await page.getByRole('button',{name:'Готовность к показу',exact:true}).click();return page.getByRole('dialog',{name:'Готовность к показу',exact:true})}
async function records(page:Page){
 return page.evaluate(()=>new Promise<{projects:number;diagnostics:any}>((resolve,reject)=>{const request=indexedDB.open('alabuga-workspace',3);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction(['projects','settings']),projects=tx.objectStore('projects').count(),diagnostics=tx.objectStore('settings').get('demo:diagnostics');tx.oncomplete=()=>{db.close();resolve({projects:projects.result,diagnostics:diagnostics.result?.value})};tx.onerror=()=>{db.close();reject(tx.error)}}}));
}
async function geometry(page:Page,dialog:Locator,engine:string,state:string){
 const directory=`artifacts/ai/diagnostics/verified/${engine}`;await mkdir(directory,{recursive:true});
 for(const [width,height]of [[1536,1000],[390,844],[320,568],[844,390]]){
  await page.setViewportSize({width,height});
  for(const spaced of [false,true]){
   if(spaced&&width!==320&&width!==844)continue;
   const style=spaced?await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'}):undefined;
   let headerY=0;
   for(const end of [false,true]){
    const value=await dialog.evaluate((n,end)=>{const body=n.querySelector<HTMLElement>('.library-dialog-body')!,header=n.querySelector<HTMLElement>('header')!,close=header.querySelector('button')!;body.scrollTop=end?body.scrollHeight:0;const r=close.getBoundingClientRect();return {header:header.getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON(),overflow:Math.max(n.scrollWidth-n.clientWidth,body.scrollWidth-body.clientWidth),clipped:[...n.querySelectorAll('button,summary')].filter(b=>b.getClientRects().length&&b.scrollWidth>b.clientWidth+1).map(b=>b.textContent),hittable:r.top>=0&&r.bottom<=innerHeight&&close.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}},end);
    const label=`${state} ${width}x${height} spaced=${spaced} end=${end}`;if(!end)headerY=value.header.y;
    expect(value.header.y,label).toBeCloseTo(headerY,0);expect(value.header.bottom,label).toBeLessThanOrEqual(value.body.top+1);expect(value.body.height,label).toBeGreaterThan(30);expect(value.overflow,label).toBeLessThanOrEqual(1);expect(value.clipped,label).toEqual([]);expect(value.hittable,label).toBe(true);
   }
   if(!spaced)await page.screenshot({path:`${directory}/${state}-${width}x${height}.png`});if(style)await style.evaluate(n=>(n as Element).remove());
  }
 }
 await page.evaluate(axe.source);expect(await dialog.evaluate(async n=>(await (window as any).axe.run(n)).violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)})))).toEqual([]);
}
async function generated(page:Page){
 await page.route('**/api/ai/generate',r=>{const {format}=r.request().postDataJSON();const data=format.properties.sections?{title:'Возможности',sections:[{composition:'features',title:'Возможности',purpose:'F1'}]}:{composition:'features',content:{slot0:{heading:'Возможности',text:''},slot1:{items:Object.fromEntries(Object.entries(format.properties.content.properties.slot1.properties.items.properties).map(([key,item]:[string,any])=>[key,{title:item.properties.title.const,sourceId:item.properties.sourceId.enum[0]}]))}}};return r.fulfill({json:{data}})});
}

test('readiness report stays scrollable and closable without generating or creating projects',async({page},testInfo)=>{
 let calls=0;await page.route('**/api/ai/status',r=>r.fulfill({json:{...info,loaded:[]}}));await page.route('**/api/ai/generate',r=>{calls++;return r.fulfill({status:503,json:{error:'Offline'}})});
 await page.goto('/demo/');const dialog=await open(page);await expect(dialog.locator('.demo-checks')).toContainText('Модель ещё не загружена');await dialog.getByText('Технические сведения',{exact:true}).click();await geometry(page,dialog,testInfo.project.name,'unloaded');expect(calls).toBe(0);expect((await records(page)).projects).toBe(0);expect((await records(page)).diagnostics.ready).toBe(false);
 const body=dialog.getByRole('region',{name:'Содержимое окна: Готовность к показу',exact:true});await dialog.getByRole('button',{name:'Закрыть',exact:true}).focus();await page.keyboard.press('Tab');await expect(body).toBeFocused();await body.press('Home');await expect.poll(()=>body.evaluate(n=>n.scrollTop)).toBe(0);await body.press('PageDown');await expect.poll(()=>body.evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Готовность к показу',exact:true})).toBeFocused();
});

test('complete rehearsal displays both previews and stores an isolated report',async({page},testInfo)=>{
 await page.route('**/api/ai/status',r=>r.fulfill({json:info}));await generated(page);await page.goto('/demo/');const dialog=await open(page),run=dialog.getByRole('button',{name:'Проверить сценарий показа',exact:true});await expect(run).toBeEnabled();await run.click();await expect(dialog.getByRole('status')).toContainText('Техническая репетиция пройдена',{timeout:30000});await expect(dialog.locator('.demo-probe')).toHaveCount(2);await geometry(page,dialog,testInfo.project.name,'rehearsal');
 const stored=await records(page);expect(stored.projects).toBe(0);expect(stored.diagnostics.ready).toBe(true);expect(stored.diagnostics.probes.map((p:any)=>p.kind)).toEqual(['page','presentation']);await dialog.getByRole('button',{name:'Вернуться к готовым образцам',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Готовность к показу',exact:true})).toBeFocused();
});

test('connection failure keeps retry and closing available',async({page})=>{
 let available=false;await page.route('**/api/ai/status',r=>r.fulfill(available?{json:info}:{status:503,json:{error:'Сервис временно недоступен'}}));await page.goto('/demo/');const dialog=await open(page);await expect(dialog.getByRole('status')).toContainText('Сервис временно недоступен');const retry=dialog.getByRole('button',{name:'Проверить подключение',exact:true});await expect(retry).toBeEnabled();available=true;await retry.click();await expect(dialog.locator('.demo-checks')).toContainText('Запись локального отчёта проверена');expect((await records(page)).projects).toBe(0);await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(dialog).toHaveCount(0);
});

test('closing during generation aborts the request and a new dialog can run again',async({page})=>{
 await page.route('**/api/ai/status',r=>r.fulfill({json:info}));let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);await page.route('**/api/ai/generate',async r=>{await held;await r.fulfill({status:503,json:{error:'Поздний ответ'}}).catch(()=>{})});await page.goto('/demo/');let dialog=await open(page);const run=dialog.getByRole('button',{name:'Проверить сценарий показа',exact:true});await expect(run).toBeEnabled();const request=page.waitForRequest('**/api/ai/generate');await run.click();const pending=await request;await expect(dialog.locator('.demo-diagnostic-commands button:enabled')).toHaveCount(0);
 const cancelled=page.waitForEvent('requestfailed',r=>r===pending);await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();await cancelled;release();await expect(dialog).toHaveCount(0);expect((await records(page)).diagnostics.probes).toEqual([]);await page.unroute('**/api/ai/generate');await generated(page);dialog=await open(page);await expect(dialog.getByRole('button',{name:'Проверить сценарий показа',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Проверить сценарий показа',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Техническая репетиция пройдена',{timeout:30000});expect((await records(page)).projects).toBe(0);
});

test('failed report storage can retry without marking readiness or creating projects',async({page})=>{
 await page.route('**/api/ai/status',r=>r.fulfill({json:info}));await page.goto('/demo/');let dialog=await open(page);await expect(dialog.getByRole('status')).toContainText('Диагностика сохранена');await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;(window as any).restoreDiagnosticsWrites=()=>IDBDatabase.prototype.transaction=original;IDBDatabase.prototype.transaction=function(...args:Parameters<IDBDatabase['transaction']>){if(args[1]==='readwrite')throw new DOMException('Отчёт не записан','QuotaExceededError');return original.apply(this,args)}});await dialog.getByRole('button',{name:'Проверить подключение',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Отчёт не записан');await expect(dialog.getByRole('button',{name:'Проверить подключение',exact:true})).toBeEnabled();expect((await records(page)).diagnostics.ready).toBe(false);
 await page.evaluate(()=>(window as any).restoreDiagnosticsWrites());await dialog.getByRole('button',{name:'Проверить подключение',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Диагностика сохранена');expect((await records(page)).projects).toBe(0);
});
