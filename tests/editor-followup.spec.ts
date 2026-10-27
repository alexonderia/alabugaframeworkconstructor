import {test,expect,type Page} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {chooseOption} from './choose-option';
test.use({reducedMotion:'reduce'});test.setTimeout(60000);
async function fixture(page:Page){await page.goto('/builder/');await page.locator('.product-header input[type=file]').setInputFiles({name:'interaction.json',mimeType:'application/json',buffer:await readFile(new URL('./fixtures/audit-links.json',import.meta.url))});await expect(page.locator('#project-name')).toBeVisible()}
async function portable(page:Page){await expect(page.locator('#save-state')).not.toContainText(/Проверяем|Сохраняем/);const event=page.waitForEvent('download');await page.keyboard.press('Control+s');return JSON.parse(await readFile((await(await event).path())!,'utf8')).document}
async function capture(page:Page,name:string,engine:string){const directory=`artifacts/editor/followup/verified/${engine}`;await mkdir(directory,{recursive:true});await page.screenshot({path:`${directory}/${name}.png`})}

test('inspector keeps canvas text when another property is changed',async({page})=>{
 await fixture(page);const box=page.locator('#canvas [data-widget-id="audit-text-a"]');await box.focus();await box.press('Enter');
 const inline=box.getByRole('textbox',{name:'Текст на странице',exact:true}).first();await inline.fill('Текст, изменённый непосредственно на холсте.');
 await page.getByLabel('Название блока',{exact:true}).fill('Новое название');await page.getByLabel('Название блока',{exact:true}).blur();
 await expect.poll(async()=>(await portable(page)).pages[0].widgets[0].title).toBe('Новое название');
 expect((await portable(page)).pages[0].widgets[0].content[0].text).toBe('Текст, изменённый непосредственно на холсте.');await expect(inline).toHaveText('Текст, изменённый непосредственно на холсте.');
});

test('cancelled resizing restores the visible block and clears positioning guides',async({page},info)=>{
 await page.setViewportSize({width:1440,height:1000});await fixture(page);const box=page.locator('#canvas [data-widget-id="audit-text-a"]');await box.click({position:{x:4,y:4}});const before=(await portable(page)).pages[0].widgets[0].position,rect=(await box.boundingBox())!,handle=box.locator('.resize-handle'),r=(await handle.boundingBox())!;
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+r.height/2+80,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();
 await expect.poll(async()=>Math.abs((await box.boundingBox())!.height-rect.height)).toBeLessThan(1);await expect(box.locator('..')).not.toHaveClass(/is-positioning/);expect((await portable(page)).pages[0].widgets[0].position).toEqual(before);await capture(page,'cancelled-resize',info.project.name);
});

test('a pending inspector edit does not consume the first resize gesture',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await fixture(page);const box=page.locator('#canvas [data-widget-id="audit-text-a"]');await box.focus();await box.press('Enter');const before=(await portable(page)).pages[0].widgets[0].position;
 const handle=box.locator('.resize-handle');await expect(handle).toBeVisible();const r=(await handle.boundingBox())!;await page.getByLabel('Название блока',{exact:true}).fill('Сохранено перед жестом');
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+r.height/2+80,{steps:4});await page.mouse.up();
 await expect.poll(async()=>(await portable(page)).pages[0].widgets[0].position.height).toBe(before.height+1);expect((await portable(page)).pages[0].widgets[0].title).toBe('Сохранено перед жестом');await expect(box.locator('..')).not.toHaveClass(/is-positioning/);
});

test('responsive handles change visible width and order instead of invisible grid values',async({page},info)=>{
 await page.setViewportSize({width:1536,height:1000});await page.goto('/demo/');await page.getByRole('button',{name:'Собрать из шаблона',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();await chooseOption(page.locator('#device'),'tablet');
 const box=page.locator('#canvas .af-widget--cards').first(),id=await box.getAttribute('data-widget-id');await box.scrollIntoViewIfNeeded();await box.click({position:{x:4,y:4}});await expect(box).toHaveAttribute('data-editor-layout','tablet');
 const original=(await box.boundingBox())!,resize=box.locator('.resize-handle');await resize.focus();await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await box.boundingBox())!.width).toBeLessThan(original.width*.98);
 const current=()=>portable(page).then(doc=>doc.pages.flatMap((p:any)=>p.widgets).find((w:any)=>w.id===id));const saved=await current();await resize.focus();await page.keyboard.press('ArrowDown');await expect.poll(async()=>(await current()).responsive.tablet.minHeight).toBeGreaterThan(0);expect((await current()).position.height).toBe(saved.position.height);
 const r=(await resize.boundingBox())!;await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+40,r.y+r.height/2,{steps:4});await page.mouse.up();await expect.poll(async()=>(await box.boundingBox())!.width).toBeGreaterThan(original.width*.9);
 await box.locator('.move-handle').focus();await page.keyboard.press('ArrowUp');await expect.poll(async()=>(await current()).tabletOrder).toBe(0);const heading=box.locator('..').locator('.af-widget--text').first();await expect.poll(async()=>(await box.boundingBox())!.y<(await heading.boundingBox())!.y).toBe(true);await capture(page,'tablet-width-and-order',info.project.name);
 await chooseOption(page.locator('#device'),'mobile');await box.scrollIntoViewIfNeeded();await expect(resize).toBeEnabled();await expect(resize).toHaveAttribute('title',/Телефон/);await box.locator('.move-handle').focus();await page.keyboard.press('ArrowUp');await expect.poll(async()=>(await current()).mobileOrder).toBe(0);await capture(page,'phone-order',info.project.name);
});

test('tutorial and dialog geometry share aligned edges and single spacing',async({page},info)=>{
 await page.setViewportSize({width:1536,height:1000});await page.goto('/demo/');await page.getByRole('button',{name:'Настроить элементы',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();await page.locator('#close-inspector').click();
 for(const width of [1536,1024,390,844]){
  await page.setViewportSize({width,height:width===844?390:1000});await page.evaluate(()=>scrollTo(0,0));const toolbar=(await page.locator('.canvas-toolbar').boundingBox())!,tutorial=(await page.locator('.author-tutorial').boundingBox())!;expect(Math.abs(toolbar.x-tutorial.x)).toBeLessThan(1);expect(Math.abs(toolbar.width-tutorial.width)).toBeLessThan(1);
  const gap=await page.locator('.author-tutorial').evaluate(n=>{const list=n.querySelector('ol')!.getBoundingClientRect(),close=n.querySelector('.tutorial-dismiss')!.getBoundingClientRect();return close.top-list.bottom});expect(gap).toBeGreaterThanOrEqual(15);expect(gap).toBeLessThanOrEqual(17);
  const heights=await page.locator('.author-tutorial li>.af-btn').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));expect(Math.max(...heights)-Math.min(...heights)).toBeLessThan(1);
  await page.locator('#add-widget').click();const header=page.locator('#catalog .af-dialog__header'),title=(await header.locator('h2').boundingBox())!,close=(await header.locator('button').boundingBox())!;expect(Math.abs(title.y+title.height/2-close.y-close.height/2)).toBeLessThan(1);await page.locator('#close-catalog').click();
 }
 await page.setViewportSize({width:1536,height:1000});await page.evaluate(()=>scrollTo(0,0));await capture(page,'toolbar-and-tutorial',info.project.name);await page.locator('#add-widget').click();await capture(page,'catalog',info.project.name);
});
