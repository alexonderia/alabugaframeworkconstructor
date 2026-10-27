import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.use({reducedMotion:'reduce',screenshot:'only-on-failure'});

/** Hold a real readonly result across rendered frames without holding a write transaction. */
async function holdRead(page:Page,store:string,key:string){
 await page.evaluate(({store,key})=>{
  const original=IDBObjectStore.prototype.get,descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'onsuccess')!;
  const gate={armed:true,pending:[] as (()=>void)[],release:()=>{}};
  gate.release=()=>{gate.armed=false;IDBObjectStore.prototype.get=original;gate.pending.splice(0).forEach(callback=>callback())};
  (window as any).transitionReadGate=gate;
  IDBObjectStore.prototype.get=function(query){
   const request=original.call(this,query);
   if(gate.armed&&this.name===store&&String(query)===key&&this.transaction.mode==='readonly')Object.defineProperty(request,'onsuccess',{set(handler){descriptor.set!.call(request,(event:Event)=>{const complete=()=>handler?.call(request,event);if(gate.armed)gate.pending.push(complete);else complete()})}});
   return request;
  };
 },{store,key});
}

for(const source of ['gallery','preview'] as const)test(`${source} stays intact until project editor is ready`,async({page},info)=>{
 await page.goto('/builder/');await page.locator('.product-header input[type=file]').setInputFiles({name:'transition.json',mimeType:'application/json',buffer:await readFile(new URL('./fixtures/audit-links.json',import.meta.url))});await expect(page.locator('#project-name')).toBeVisible();
 const id=new URL(page.url()).hash.slice('#/edit/'.length);
 if(source==='gallery'){
  await page.getByRole('button',{name:'← Проекты',exact:true}).click();await expect(page.locator('.project-thumbnail-inner .af-widget').first()).toBeVisible();
 }else{
  await page.locator('#preview').click();await expect(page.frameLocator('.project-preview iframe').locator('.af-widget').first()).toBeVisible();
 }
 await page.evaluate(()=>document.fonts.ready);const header=page.locator('.product-header'),before=(await header.boundingBox())!;
 // Cover both the project read and the later editor preferences read.
 await holdRead(page,source==='gallery'?'projects':'settings',source==='gallery'?id:'tutorial:'+id);
 try{
  await page.getByRole('button',{name:'Редактировать',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).transitionReadGate.pending.length)).toBeGreaterThan(0);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.screenshot({path:info.outputPath('waiting.png')});
  await expect(page.locator('#builder')).toHaveAttribute('inert');await expect(page.locator('#builder')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#builder')).toHaveClass('product-shell');await expect(page.locator('#canvas')).toHaveCount(0);
  const waiting=(await header.boundingBox())!;expect(waiting.x).toBeCloseTo(before.x,0);expect(waiting.width).toBeCloseTo(before.width,0);
  if(source==='gallery')await expect(page.locator('.project-thumbnail-inner .af-widget').first()).toBeVisible();
  else await expect(page.frameLocator('.project-preview iframe').locator('.af-widget').first()).toBeVisible();
  await page.evaluate(()=>(window as any).transitionReadGate.release());
  await expect(page.locator('#project-name')).toHaveValue('Аудит связей и данных');await expect(page.locator('#canvas .af-widget').first()).toBeVisible();await expect(page.locator('#builder')).not.toHaveClass(/product-shell/);await expect(page.locator('#builder')).not.toHaveAttribute('inert');await expect(page.locator('#builder')).not.toHaveAttribute('aria-busy');
  await page.screenshot({path:info.outputPath('ready.png')});
  await page.getByRole('button',{name:'← Проекты',exact:true}).click();await expect(page.locator('.library-tools')).toBeVisible();await expect(page.locator('#builder')).toHaveClass('product-shell');
 }finally{await page.evaluate(()=>(window as any).transitionReadGate?.release())}
});

test('outgoing editor cannot accept edits after saving while preview is loading',async({page})=>{
 await page.goto('/builder/');await page.locator('.product-header input[type=file]').setInputFiles({name:'pending-editor.json',mimeType:'application/json',buffer:await readFile(new URL('./fixtures/audit-links.json',import.meta.url))});const name=page.locator('#project-name');await expect(name).toBeVisible();const title=await name.inputValue(),id=new URL(page.url()).hash.slice('#/edit/'.length);
 await holdRead(page,'projects',id);
 try{
  await page.locator('#preview').click();await expect.poll(()=>page.evaluate(()=>(window as any).transitionReadGate.pending.length)).toBeGreaterThan(0);await expect(page.locator('#canvas .af-widget').first()).toBeVisible();await expect(page.locator('#builder')).toHaveAttribute('inert');
  const field=(await name.boundingBox())!;await page.mouse.click(field.x+field.width/2,field.y+field.height/2);await page.keyboard.type('Несохранённая правка');await expect(name).toHaveValue(title);
  await page.evaluate(()=>(window as any).transitionReadGate.release());await expect(page.frameLocator('.project-preview iframe').locator('.af-widget').first()).toBeVisible();await expect(page.locator('#builder')).not.toHaveAttribute('inert');
 }finally{await page.evaluate(()=>(window as any).transitionReadGate?.release())}
});
