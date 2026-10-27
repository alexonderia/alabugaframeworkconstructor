import {test,expect,type Page} from '@playwright/test';
import {readFile,copyFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chooseOption} from './choose-option';
import axe from 'axe-core';

test.use({reducedMotion:'reduce'});test.setTimeout(60000);
const fixture={schemaVersion:3,kind:'page',title:'Независимые размеры',pages:[{id:'responsive-section',title:'Раздел',appearance:{layout:'flow',theme:'light'},grid:{columns:12,rowHeight:64,gap:16},widgets:[{id:'responsive-text',type:'text',title:'Текстовый блок',position:{col:1,row:1,width:12,height:2},content:[{type:'paragraph',text:'Содержание блока растёт вместе с текстом.',dropCap:false}]}]}]};
async function open(page:Page){await page.goto('/builder/');await page.locator('.product-header input[type=file]').setInputFiles({name:'responsive.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await expect(page.locator('#project-name')).toBeVisible()}
async function portable(page:Page){await expect(page.locator('#save-state')).not.toContainText(/Проверяем|Сохраняем/);const event=page.waitForEvent('download');await page.keyboard.press('Control+s');return JSON.parse(await readFile((await(await event).path())!,'utf8')).document}
const box=(page:Page)=>page.locator('#canvas [data-widget-id=responsive-text]');
async function properties(page:Page){await box(page).focus();await box(page).press('Enter');const group=page.locator('.property-group').filter({hasText:'Размеры и положение'});if(!await group.evaluate(n=>(n as HTMLDetailsElement).open))await group.locator('summary').click()}
async function size(page:Page,width:number,height:number){const device=await page.locator('#device').inputValue();await page.getByLabel('Ширина, %',{exact:true}).fill(String(width));await page.getByLabel('Минимальная высота, px',{exact:true}).fill(String(height));await page.getByLabel('Минимальная высота, px',{exact:true}).blur();await expect.poll(async()=>(await portable(page)).pages[0].widgets[0].responsive?.[device]).toEqual({width,minHeight:height})}
async function measured(page:Page,selector:string,width:number,height:number){const target=page.locator(selector);await expect.poll(()=>target.evaluate((n,width)=>{const gap=parseFloat(getComputedStyle(n.parentElement!).gap),expected=(n.parentElement!.getBoundingClientRect().width+gap)*width/100-gap;return Math.abs(n.getBoundingClientRect().width-expected)},width)).toBeLessThan(1);expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(height)}

test('responsive properties survive device changes, invalid input, save and reopen',async({page},info)=>{
 await open(page);await chooseOption(page.locator('#device'),'tablet');await properties(page);await size(page,73,271);await measured(page,'#canvas [data-widget-id=responsive-text]',73,271);
 await chooseOption(page.locator('#device'),'mobile');
 // Opening the new geometry group after changing device also verifies its scope.
 const geometry=page.locator('.property-group').filter({hasText:'Размеры и положение'});if(!await geometry.evaluate(n=>(n as HTMLDetailsElement).open))await geometry.locator('summary').click();
 await size(page,91,193);await measured(page,'#canvas [data-widget-id=responsive-text]',91,193);
 const saved=await portable(page);expect(saved.schemaVersion).toBe(4);expect(saved.pages[0].widgets[0].position).toEqual(fixture.pages[0].widgets[0].position);expect(saved.pages[0].widgets[0].responsive).toEqual({tablet:{width:73,minHeight:271},mobile:{width:91,minHeight:193}});
 await page.getByLabel('Ширина, %',{exact:true}).fill('101');await page.getByLabel('Ширина, %',{exact:true}).blur();await expect(page.locator('.property-feedback')).toHaveClass(/af-error/);const device=page.locator('#device').locator('..');await device.getByRole('combobox').click();await device.getByRole('option',{name:'Планшет',exact:true}).click();await expect(page.locator('#device')).toHaveValue('mobile');await expect(page.getByLabel('Ширина, %',{exact:true})).toHaveValue('101');
 await page.getByLabel('Ширина, %',{exact:true}).fill('91');await page.getByLabel('Ширина, %',{exact:true}).blur();await expect(page.locator('.property-feedback')).not.toHaveClass(/af-error/);await page.locator('#close-inspector').click();
 await page.reload();await expect(page.locator('#project-name')).toBeVisible();await chooseOption(page.locator('#device'),'tablet');await measured(page,'#canvas [data-widget-id=responsive-text]',73,271);
 const directory=`artifacts/editor/responsive/verified/${info.project.name}`;await mkdir(directory,{recursive:true});await page.screenshot({path:`${directory}/tablet.png`});
 await chooseOption(page.locator('#device'),'mobile');await properties(page);await page.getByRole('button',{name:'Автоматический размер',exact:true}).click();
 await expect.poll(async()=>(await portable(page)).pages[0].widgets[0].responsive).toEqual({tablet:{width:73,minHeight:271}});
 await page.evaluate(axe.source);expect(await page.evaluate(async()=>(await (window as any).axe.run()).violations.map((v:any)=>({id:v.id,target:v.nodes.map((n:any)=>n.target)})))).toEqual([]);
});

test('responsive resize supports keyboard, cancellation and undo without altering desktop',async({page})=>{
 await open(page);await chooseOption(page.locator('#device'),'mobile');const handle=box(page).locator('.resize-handle');await box(page).scrollIntoViewIfNeeded();await box(page).click({position:{x:4,y:4}});await handle.focus();await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await portable(page)).pages[0].widgets[0].responsive.mobile.width).toBe(95);
 await handle.focus();await page.keyboard.press('ArrowDown');const saved=await portable(page),rect=(await box(page).boundingBox())!,r=(await handle.boundingBox())!;
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2-60,r.y+r.height/2+60,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
 expect((await portable(page)).pages[0].widgets[0].responsive).toEqual(saved.pages[0].widgets[0].responsive);await expect.poll(async()=>Math.abs((await box(page).boundingBox())!.width-rect.width)).toBeLessThan(1);
 await page.locator('#undo').click();await expect.poll(async()=>(await portable(page)).pages[0].widgets[0].responsive.mobile.minHeight).toBe(0);await page.locator('#redo').click();expect((await portable(page)).pages[0].widgets[0].responsive).toEqual(saved.pages[0].widgets[0].responsive);
 await chooseOption(page.locator('#device'),'desktop');expect((await portable(page)).pages[0].widgets[0].position).toEqual(fixture.pages[0].widgets[0].position);
});

test('standalone HTML retains responsive dimensions without editor or network',async({page,context},info)=>{
 await open(page);await chooseOption(page.locator('#device'),'tablet');await properties(page);await size(page,73,271);await page.locator('#close-inspector').click();await chooseOption(page.locator('#device'),'mobile');await properties(page);await size(page,91,193);await page.locator('#close-inspector').click();
 const event=page.waitForEvent('download');await page.locator('#export').click();const exported=await event,destination=info.outputPath('responsive.html');await copyFile((await exported.path())!,destination);
 await context.setOffline(true);const standalone=await context.newPage();await standalone.goto(pathToFileURL(destination).href);
 for(const [width,percentage,height]of [[800,73,271],[390,91,193]]){await standalone.setViewportSize({width,height:800});await measured(standalone,'[data-widget-id=responsive-text]',percentage,height)}
 await standalone.close();await context.setOffline(false);
});

test('fixed sections explain automatic narrow layout instead of offering ignored responsive sizes',async({page})=>{
 await page.goto('/builder/');const fixed=structuredClone(fixture);delete (fixed.pages[0] as any).appearance;
 await page.locator('.product-header input[type=file]').setInputFiles({name:'fixed-layout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixed))});await expect(page.locator('#project-name')).toBeVisible();await chooseOption(page.locator('#device'),'mobile');await box(page).scrollIntoViewIfNeeded();await box(page).click({position:{x:4,y:4}});
 await expect(box(page)).toHaveAttribute('data-editor-layout','auto');await expect(box(page).locator('.resize-handle')).toBeDisabled();await expect(box(page).locator('.move-handle')).toBeDisabled();await properties(page);await expect(page.getByLabel('Ширина, %',{exact:true})).toHaveCount(0);await expect(page.locator('.geometry')).toContainText('По содержимому');expect((await portable(page)).pages[0].widgets[0].responsive).toBeUndefined();
});
