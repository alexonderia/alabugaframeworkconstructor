import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {savedDocument} from './project-helper';
import {makeComposition} from '@alabuga/framework/compositions';
test.use({reducedMotion:'reduce'});
async function project(page:Page,composed=false){const doc=JSON.parse(await readFile(new URL('./fixtures/audit-links.json',import.meta.url),'utf8'));if(composed)doc.pages=[makeComposition('split','page')];await page.goto('/builder/');await page.locator('.product-header input[type=file]').setInputFiles({name:'polish.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.locator('#project-name')).toBeVisible();await page.locator('#page-settings-open').click()}
async function previewsFit(cards:Locator){
 const bounds=await cards.evaluateAll(nodes=>nodes.filter(n=>n.querySelector('.composition-thumbnail>div')).map(n=>{const frame=n.querySelector('.composition-thumbnail')!.getBoundingClientRect(),content=n.querySelector('.composition-thumbnail>div')!.getBoundingClientRect(),button=n.querySelector('button')!.getBoundingClientRect(),card=n.getBoundingClientRect();return {left:content.left-frame.left,right:frame.right-content.right,top:content.top-frame.top,bottom:frame.bottom-content.bottom,after:button.top-frame.bottom,inset:frame.left-card.left,width:content.width}}));
 expect(bounds.length).toBeGreaterThan(2);for(const b of bounds){expect(b.width).toBeGreaterThan(20);expect(Math.min(b.left,b.right,b.top,b.bottom)).toBeGreaterThanOrEqual(11);expect(Math.abs(b.left-b.right)).toBeLessThan(2);expect(Math.abs(b.top-b.bottom)).toBeLessThan(2);expect(b.after).toBeGreaterThanOrEqual(15);expect(b.inset).toBeGreaterThanOrEqual(15)}
}
test('polish collapsed grid leaves no reserved heading gap',async({page},info)=>{
 await project(page);const grid=page.locator('.advanced-grid'),summary=grid.locator('summary');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});
  for(let i=0;i<2;i++){expect(await grid.evaluate(n=>n.getBoundingClientRect().height-n.querySelector('summary')!.getBoundingClientRect().height)).toBeLessThanOrEqual(1);expect(await page.locator('.page-settings').evaluate(n=>n.getBoundingClientRect().bottom-n.querySelector('.advanced-grid>summary')!.getBoundingClientRect().bottom)).toBeLessThanOrEqual(5);await summary.click();await expect(grid.locator('.settings-grid')).toBeVisible();expect(await grid.evaluate(n=>n.querySelector('.settings-grid')!.getBoundingClientRect().top-n.querySelector('summary')!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(15);await summary.click()}
  await summary.scrollIntoViewIfNeeded();await page.locator('#inspector').screenshot({path:info.outputPath(`settings-${width}.png`)});
 }
});
test('polish composition and layout previews fit centered inside padded cards',async({page},info)=>{
 await project(page,true);for(const title of ['Выбрать композицию визуально','Изменить компоновку']){
  await page.getByRole('button',{name:title,exact:true}).click();const dialog=page.locator('dialog[open]'),cards=dialog.locator('.variant-card');await expect(cards.first()).toBeVisible();
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await expect(async()=>previewsFit(cards)).toPass();expect(await dialog.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:info.outputPath(`${title.startsWith('Выбрать')?'compositions':'layouts'}-${width}.png`)})}
  const close=dialog.getByRole('button',{name:'Закрыть',exact:true});await expect(close.locator('.af-icon--close')).toBeVisible();await expect(close).toHaveAttribute('title','Закрыть');await close.click();await expect(dialog).toHaveCount(0);await page.setViewportSize({width:1440,height:900});
 }
});
test('polish Framework file action opens a chooser and imports a background',async({page},info)=>{
 await project(page);const input=page.getByLabel('Загрузить фон',{exact:true}),field=input.locator('xpath=ancestor::*[contains(@class,"af-field")][1]'),choose=field.getByRole('button',{name:'Выбрать файл',exact:true});await expect(choose).toHaveClass(/af-btn--secondary/);await expect(input).toBeHidden();await expect(choose.locator('.af-btn__icon')).toBeVisible();
 for(const width of [1440,320]){await page.setViewportSize({width,height:900});await choose.scrollIntoViewIfNeeded();expect(await field.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);await page.locator('#inspector').screenshot({path:info.outputPath(`file-${width}.png`)})}
 const buffer=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;c.getContext('2d')!.fillRect(0,0,2,2);return c.toDataURL().split(',')[1]}),'base64');
 const selected=page.waitForEvent('filechooser');await choose.focus();await choose.press('Enter');await (await selected).setFiles({name:'Фирменное изображение.png',mimeType:'image/png',buffer});await expect.poll(async()=>(await savedDocument(page)).pages[0].appearance?.background).toMatch(/^asset:[a-f0-9]{64}$/);await expect(choose).toBeVisible();
});
