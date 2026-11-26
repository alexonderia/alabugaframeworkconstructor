import {openEditor} from './open-editor';
import {test,expect} from '@playwright/test';
import {savedDocument} from './project-helper';

test('legacy migrates at startup and idle versions can be restored and undone',async({page})=>{
 const legacy={schemaVersion:1,kind:'page',title:'Старый проект',pages:[{id:'legacy',title:'Секция',grid:{columns:12,rowHeight:64,gap:16},widgets:[]}]};
 await page.addInitScript(doc=>{localStorage.setItem('alabuga.builder.document.v1',JSON.stringify(doc))},legacy);await openEditor(page);await expect(page.locator('#project-name')).toHaveValue('Старый проект');expect((await savedDocument(page)).schemaVersion).toBe(3);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alabuga.builder.document.v1')!).schemaVersion)).toBe(1);
 await page.clock.install();await page.locator('#project-name').fill('Первая версия');await page.locator('#project-name').blur();await savedDocument(page);await page.clock.fastForward(31000);
 await expect.poll(()=>page.evaluate(async()=>{const {listRevisions,currentProject}=await import('/apps/editor/src/storage.ts' as string);const current=await currentProject();return (await listRevisions(current.id)).length})).toBeGreaterThan(0);
 await page.locator('#project-name').fill('Вторая версия');await page.locator('#project-name').blur();await savedDocument(page);await page.locator('.project-menu summary').click();await page.getByRole('button',{name:'История версий',exact:true}).click();await page.getByRole('button',{name:/восстановить/i}).first().click();await expect(page.locator('#project-name')).toHaveValue('Первая версия');await page.locator('#undo').click();await expect(page.locator('#project-name')).toHaveValue('Вторая версия');
});

test('failed IndexedDB write is never shown as saved and a later edit recovers',async({page})=>{
 await openEditor(page);await savedDocument(page);
 await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;(window as any).originalTransaction=original;IDBDatabase.prototype.transaction=function(...args:any[]){if(args[1]==='readwrite')throw new DOMException('Simulated full storage','QuotaExceededError');return original.apply(this,args as any)}});
 await page.locator('#project-name').fill('Несохранённый проект');await page.locator('#project-name').blur();await expect(page.locator('#save-state')).toContainText('Есть несохранённые изменения');await page.evaluate(()=>IDBDatabase.prototype.transaction=(window as any).originalTransaction);await page.locator('#project-name').fill('Восстановленная запись');await page.locator('#project-name').blur();await expect(page.locator('#save-state')).toHaveText('Сохранено');expect((await savedDocument(page)).title).toBe('Восстановленная запись');
});

test('editor remains responsive when typing into 50 slides with 500 widgets',async({page},info)=>{
 await openEditor(page);const pages=Array.from({length:50},(_,i)=>({id:'large-'+i,title:'Слайд '+i,grid:{columns:12,rowHeight:64,gap:16},widgets:Array.from({length:10},(_,j)=>({id:`large-${i}-${j}`,title:'',type:'text',position:{col:1+(j%5)*2,row:1+Math.floor(j/5)*3,width:2,height:2},content:[{type:'paragraph',text:'Текст',dropCap:false}]}))}));
 await page.locator('#open').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:3,kind:'presentation',title:'Большой проект',pages}))});await expect(page.locator('#canvas [data-widget-id]')).toHaveCount(500);const input=page.locator('#canvas [data-widget-id=large-0-0] [contenteditable]').first();await input.click();await input.press('End');const start=Date.now();await input.pressSequentially(' продолжается',{delay:15});await expect(input).toBeFocused();const elapsed=Date.now()-start;await info.attach('editor-performance.json',{body:JSON.stringify({elements:500,slides:50,typingMs:elapsed}),contentType:'application/json'});expect(elapsed).toBeLessThan(5000);await savedDocument(page);await page.reload();await expect(page.locator('#canvas .af-slide--active')).toContainText('продолжается');
});

test('native vector assets retain vector format in portable projects',async({page})=>{
 await openEditor(page);const result=await page.evaluate(async()=>{
  const {portableProject,importProject}=await import('/apps/editor/src/storage.ts' as string);const manifest=await (await fetch('/assets/brand/manifest.json')).json();const asset=manifest.assets.find((a:any)=>a.sourceFiles.includes('image-5-29.svg'));
  const doc={schemaVersion:3,kind:'page',title:'Vector',pages:[{id:'p',title:'',grid:{columns:12,rowHeight:64,gap:16},widgets:[{id:'image',type:'image',title:'',position:{col:1,row:1,width:6,height:6},src:asset.url,alt:'Фирменная графика',fit:'contain',caption:''}]}]};const bundle=await portableProject(doc);const imported=importProject(bundle);const image=new Image();image.src=imported.pages[0].widgets[0].src;await image.decode();return {prefix:bundle.assets[0].data.slice(0,26),width:image.naturalWidth};
 });expect(result.prefix).toBe('data:image/svg+xml;base64,');expect(result.width).toBe(1018);
});
