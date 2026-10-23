import {chooseOption} from './choose-option';
import {test,expect} from '@playwright/test';
import {savedDocument} from './project-helper';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
const lock=JSON.parse(readFileSync(new URL('../config/model-lock.json',import.meta.url),'utf8'));
test.use({viewport:{width:1440,height:1000}});
test('diagnostics checks readiness without starting generation or saving a project',async({page})=>{
 let generated=0;
 await page.route('**/api/ai/status',r=>r.fulfill({json:{model:'qwen3.5:2b',version:'test',digest:'test',loaded:[]}}));
 await page.route('**/api/ai/diagnostics',r=>r.fulfill({json:{gpu:[]}}));
 await page.route('**/api/ai/generate',r=>{generated++;return r.fulfill({status:503,json:{error:'Offline'}})});
 await page.goto('/demo/');await page.getByRole('button',{name:'Готовность к показу',exact:true}).click();await expect(page.locator('.demo-checks')).toContainText('Модель ещё не загружена');expect(generated).toBe(0);
 expect(await page.evaluate(async()=>{const s=await import('/apps/editor/src/storage.ts' as string);return (await s.listProjectSummaries()).length})).toBe(0);
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('.demo-diagnostics')).toHaveCount(0);
});
test('rehearsal requires both real request paths and shows previews without creating projects',async({page})=>{
 let calls=0;
 await page.route('**/api/ai/status',r=>r.fulfill({json:{model:'qwen3.5:2b',version:lock.ollama,digest:lock.digest,context:4096,loaded:[{name:'qwen3.5:2b',size:2048,size_vram:2048}]}}));
 await page.route('**/api/ai/diagnostics',r=>r.fulfill({json:{gpu:'test double'}}));
 await page.route('**/api/ai/generate',async r=>{
  calls++;const {format}=r.request().postDataJSON();
  const data=format.properties.sections?{title:'Возможности',sections:[{composition:'features',title:'Возможности',purpose:'F1'}]}:{composition:'features',content:{slot0:{heading:'Возможности',text:''},slot1:{items:Object.fromEntries(Object.entries(format.properties.content.properties.slot1.properties.items.properties).map(([key,item]:[string,any])=>[key,{title:item.properties.title.const,sourceId:item.properties.sourceId.enum[0]}]))}}};
  await r.fulfill({json:{data}});
 });
 await page.goto('/demo/');await page.getByRole('button',{name:'Готовность к показу',exact:true}).click();const run=page.getByRole('button',{name:'Проверить сценарий показа',exact:true});await expect(run).toBeEnabled();await run.click();await expect(page.locator('.demo-diagnostics > [role=status]')).toContainText('Техническая репетиция пройдена',{timeout:30000});await expect(page.locator('.demo-probe')).toHaveCount(2);expect(calls).toBe(4);
 expect(await page.evaluate(async()=>{const s=await import('/apps/editor/src/storage.ts' as string);return (await s.listProjectSummaries()).length})).toBe(0);
 await page.getByRole('button',{name:'Вернуться к готовым образцам',exact:true}).click();await expect(page.locator('.demo-diagnostics')).toHaveCount(0);
});
test('demo preview does not save; each explicit action creates its own editable copy',async({page})=>{
 await page.goto('/demo/');await expect(page.getByRole('heading',{name:'От идеи — к своей истории.'})).toBeVisible();
 expect(await page.evaluate(async()=>{const s=await import('/apps/editor/src/storage.ts' as string);return (await s.listProjectSummaries()).length})).toBe(0);
 await page.getByRole('button',{name:'Настроить элементы',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();await expect(page.locator('.author-tutorial')).toBeVisible();const first=await savedDocument(page);expect(first.pages).toHaveLength(10);
 await chooseOption(page.getByLabel('Масштаб текста',{exact:true}),'large');await chooseOption(page.getByLabel('Цвет текста',{exact:true}),'blue');await expect.poll(async()=>(await savedDocument(page)).pages[4].widgets[0].style?.color).toBe('blue');await page.reload();await expect(page.locator('#canvas [data-element-color]').first()).toBeVisible();
 await page.goto('/demo/');await chooseOption(page.getByLabel('Формат проекта'),'presentation');await page.getByRole('button',{name:'Собрать из шаблона',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();expect((await savedDocument(page)).pages).toHaveLength(11);
 expect(await page.evaluate(async()=>{const s=await import('/apps/editor/src/storage.ts' as string);return (await s.listProjectSummaries()).length})).toBe(2);
});
test('semantic layout keeps content and manual formatting and rejects additional widgets',async({page})=>{
 await page.goto('/demo/');const result=await page.evaluate(async()=>{const {makeComposition,changeComposition}=await import('/tests/framework/compositions.ts' as string),{applyLayoutVariant}=await import('/tests/framework/layout-variants.ts' as string);const p=makeComposition('split','page');p.widgets.reverse();p.widgets[0].style={color:'blue',locked:true};const next=applyLayoutVariant(p,'asymmetric','page'),changed=changeComposition(p,'split','page');const content=(doc:any)=>doc.widgets.map(({position,slot,...w}:any)=>w);let rejected=false;p.widgets.push({...p.widgets[0],id:'extra'});try{applyLayoutVariant(p,'stacked','page')}catch{rejected=true}return {before:content({...p,widgets:p.widgets.slice(0,-1)}),after:content(next),changed:content(changed),variant:next.layoutVariant,rejected}});
 expect(result.after).toEqual(result.before);expect(result.changed).toEqual(result.before);expect(result.variant).toBe('asymmetric');expect(result.rejected).toBe(true);
});
test('demo specimens validate and slides fit with fonts and images loaded',async({page})=>{
 await page.goto('/demo/');const issues=await page.evaluate(async()=>{const {demoDocument}=await import('/tests/framework/demo-documents.ts' as string),{validateDocument}=await import('/tests/framework/schema.ts' as string),{renderDocument}=await import('/tests/framework/runtime.ts' as string);const doc=demoDocument('presentation');const valid=validateDocument(doc);if(!valid.success)return valid.issues;const host=document.createElement('div');host.style.width='1600px';document.body.append(host);const c=renderDocument(host,doc,{editing:true});await document.fonts.ready;await Promise.all([...host.querySelectorAll('img')].map(i=>i.decode()));const errors=c.checkOverflow();c.destroy();host.remove();return errors});expect(issues).toEqual([]);
});
test('layout preview applies in one undo step and author typography survives offline export',async({page},info)=>{
 await page.goto('/demo/');await chooseOption(page.getByLabel('Формат проекта'),'presentation');await page.getByRole('button',{name:'Собрать из шаблона',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();const before=await savedDocument(page);
 await page.locator('#page-settings-open').click();await page.getByRole('button',{name:'Изменить компоновку',exact:true}).click();await page.getByRole('button',{name:'Применить: Асимметрия / справа',exact:true}).click();await expect.poll(async()=>(await savedDocument(page)).pages[0].layoutVariant).toBe('asymmetric');await page.locator('#undo').click();expect((await savedDocument(page)).pages[0]).toEqual(before.pages[0]);
 await page.locator('#canvas .af-slide--active [data-widget-id]').first().press('Enter');await chooseOption(page.getByLabel('Размер заголовка',{exact:true}),'96');await expect.poll(async()=>(await savedDocument(page)).pages[0].widgets[0].typography.heading).toBe(96);
 const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event,file=info.outputPath('styled.html');await download.saveAs(file);await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(file).href);await expect(page.locator('.af-slide--active .af-title')).toHaveCSS('font-size','96px');
});
test('slide fitting retains individually locked author typography',async({page})=>{
 await page.goto('/demo/');const result=await page.evaluate(async()=>{const {makeComposition}=await import('/tests/framework/compositions.ts' as string),{fitSlide}=await import('/tests/framework/slide-fit.ts' as string),{slideTypeDefaults}=await import('/tests/framework/element-style.ts' as string);const p=makeComposition('thesis','presentation');p.widgets[0].content=[{type:'heading',text:'Идея'}];p.widgets[0].typography={...slideTypeDefaults,heading:96};p.widgets[0].style={locked:true};return fitSlide(p,{keepBackground:true})});expect(result.success).toBe(true);expect(result.slide.widgets[0].typography.heading).toBe(96);
});
