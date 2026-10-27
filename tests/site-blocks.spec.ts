import {chooseOption} from './choose-option';
import {openGeometry,widgetTools} from './property-helper';
import {openEditor} from './open-editor';
import {savedDocument} from './project-helper';
import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
const doc=savedDocument;
test.beforeEach(async({page})=>{await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#new-page').click();await expect(page.locator('#project-name')).toHaveValue('Новый сайт');await expect(page.locator('#canvas .af-widget')).toHaveCount(0)});
test('header and footer are editable landmarks and survive export',async({page},info)=>{
  await page.locator('#canvas .section-insert').first().getByRole('button').click();await page.locator('[data-template="header"]').click();await expect(page.locator('#canvas header.af-page')).toHaveCount(1);await expect(page.locator('#canvas header.af-page nav [role=textbox]')).toHaveCount(3);
  await page.locator('#canvas header.af-page .af-title [contenteditable]').fill('Моя компания');await page.locator('#canvas header.af-page .af-title [contenteditable]').blur();
  await page.locator('#end-add .insert-button').click();await page.locator('[data-template="footer"]').click();await expect(page.locator('#canvas footer.af-page')).toHaveCount(1);expect((await doc(page)).pages.at(-1).role).toBe('footer');
  const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event,path=info.outputPath('site.html');await download.saveAs(path);await page.goto(pathToFileURL(path).href);await expect(page.locator('header.af-page')).toContainText('Моя компания');await expect(page.locator('footer.af-page nav a')).toHaveCount(3);
});
test('place a block right of center and align its contents independently',async({page},info)=>{
  await page.locator('#add-widget').click();await page.locator('[data-add="text"]').click();await page.locator('#canvas .af-widget').hover();await page.getByRole('button',{name:'Настройки блока',exact:true}).click();
  await openGeometry(page);await page.getByLabel('Ширина',{exact:true}).fill('3');await expect.poll(async()=>(await doc(page)).pages[0].widgets[0].position.width).toBe(3);await page.getByRole('button',{name:'Справа',exact:true}).click();await expect.poll(async()=>(await doc(page)).pages[0].widgets[0].position.col).toBe(10);
  await page.getByLabel('Смещение блока по горизонтали',{exact:true}).fill('8');await chooseOption(page.getByLabel('Выравнивание содержимого',{exact:true}),'center');await expect.poll(async()=>(await doc(page)).pages[0].widgets[0].position.col).toBe(8);await expect(page.locator('#canvas .af-widget')).toHaveCSS('text-align','center');
  await page.locator('#close-inspector').click();const box=await page.locator('#canvas .af-widget').boundingBox(),panel=await page.locator('#canvas .af-panel').boundingBox();expect(box!.x).toBeGreaterThan(panel!.x+panel!.width/2);
  const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event,path=info.outputPath('offset.html');await download.saveAs(path);await page.goto(pathToFileURL(path).href);await expect(page.locator('.af-widget')).toHaveCSS('grid-column','8 / span 3');await expect(page.locator('.af-widget')).toHaveCSS('text-align','center');
});
test('selected tools stay visible while unselected tools follow hover and keyboard focus',async({page})=>{
  for(const width of [1440,1000]){await page.setViewportSize({width,height:900});if(!(await page.locator('#canvas .af-widget').count())){await page.locator('#add-widget').click();await page.locator('[data-add="metric"]').click()}
    const box=page.locator('#canvas .af-widget').first(),bar=await widgetTools(page,box);
    await box.click({position:{x:4,y:4}});await page.mouse.move(1,1);await expect(bar).toBeVisible();
    await page.locator('#page-settings-open').click();await page.locator('#close-inspector').click();await expect(box).not.toHaveClass(/is-selected/);
    await page.mouse.move(1,1);await expect(bar).toBeHidden();await box.hover();await expect(bar).toBeVisible();await expect(box.locator('.move-handle')).toHaveCSS('opacity','1');await page.mouse.move(1,1);await expect(bar).toBeHidden();await page.keyboard.press('Tab');await box.locator('.move-handle').focus();await expect(bar).toBeVisible();await box.locator('.move-handle').blur();
  }
});

test('select and drag a block in a different section',async({page})=>{
  await page.setViewportSize({width:1440,height:1600});
  await page.locator('#add-widget').click();await page.locator('[data-add="metric"]').click();
  await page.locator('#end-add .insert-button').click();await page.locator('[data-template="blank"]').click();await page.locator('#page-settings-open').click();await chooseOption(page.getByLabel('Высота секции',{exact:true}),'fixed');await page.locator('#close-inspector').click();await page.locator('#add-widget').click();await page.locator('[data-add="metric"]').click();
  await page.locator('#canvas .af-widget').first().click();
  const section=page.locator('#canvas .af-page').nth(1),box=section.locator('.af-widget').first();await box.click({position:{x:4,y:4}});await box.locator('.move-handle').evaluate(n=>n.scrollIntoView({block:'center'}));
  const handle=await box.locator('.move-handle').boundingBox(),panel=await section.locator('.af-panel').boundingBox();expect(handle!.y+253).toBeLessThan(1600);
  await page.mouse.move(handle!.x+13,handle!.y+13);await page.mouse.down();await page.mouse.move(handle!.x+13+(panel!.width+16)/12,handle!.y+13+240,{steps:10});await page.mouse.up();
  await expect.poll(async()=>(await doc(page)).pages[1].widgets[0].position).toMatchObject({col:2,row:4});expect((await doc(page)).pages[0].widgets[0].position).toMatchObject({col:1,row:1});
});
