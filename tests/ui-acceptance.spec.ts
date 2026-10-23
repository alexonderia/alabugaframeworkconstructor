import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import axe from 'axe-core';

const fixture=JSON.parse(await readFile(new URL('./fixtures/audit-links.json',import.meta.url),'utf8'));
async function openRelease(page:Page){
 const doc={...fixture,title:('Длинное название рабочего проекта — '.repeat(8)).slice(0,200)};
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();
 await page.locator('.product-header input[type=file]').setInputFiles({name:'ui-acceptance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 await expect(page.locator('#project-name')).toHaveValue(doc.title);
}
async function expectAccessible(page:Page){
 await page.evaluate(axe.source);
 expect(await page.evaluate(async()=>(await (window as any).axe.run()).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary}))})))).toEqual([]);
}
test.beforeEach(async({page})=>openRelease(page));

test('compact actions fit narrow screens and text spacing without covering the page end',async({page})=>{
 for(const width of [320,360,375,390]){
  await page.setViewportSize({width,height:844});
  for(const spaced of [false,true]){
   const stylesheet=spaced?await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'}):undefined;
   const footer=page.locator('.mobile-editor-actions'),controls=footer.locator(':scope > .af-btn');await expect(controls).toHaveCount(4);
   await expect.poll(()=>controls.evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1))).toBe(true);
   if(!spaced)await expect.poll(()=>controls.evaluateAll(nodes=>nodes.every(n=>{const text=document.createRange();text.selectNodeContents(n);return text.getClientRects().length===1}))).toBe(true);
   for(const control of await controls.all())expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(48);
   await expect.poll(()=>page.locator('#builder').evaluate(n=>parseFloat(getComputedStyle(n).paddingBottom)>=document.querySelector('.mobile-editor-actions')!.getBoundingClientRect().height)).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
   const last=page.locator('#end-add button').last();expect((await last.boundingBox())!.y+(await last.boundingBox())!.height).toBeLessThanOrEqual((await footer.boundingBox())!.y);
   await page.evaluate(()=>window.scrollTo(0,0));
   if(stylesheet)await stylesheet.evaluate(n=>(n as Element).remove());
  }
 }
});

test('panel roles remain valid in compact and desktop layouts',async({page})=>{
 for(const size of [{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);await page.locator('#page-settings-open').click();
  await expect(page.getByRole('dialog',{name:'Настройки секции',exact:true})).toBeVisible();await expectAccessible(page);
  await page.locator('#close-inspector').click();await expect(page.locator('#page-settings-open')).toBeFocused();
  await page.locator('.outline-toggle').click();await expect(page.getByRole('dialog',{name:'Структура документа',exact:true})).toBeVisible();await expectAccessible(page);
  await page.keyboard.press('Escape');await expect(page.locator('.outline-toggle')).toBeFocused();
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#page-settings-open').click();
 await expect(page.locator('#inspector')).toHaveAttribute('role','complementary');await expect(page.locator('#inspector')).not.toHaveAttribute('aria-modal','true');
 await expect(page.locator('.editor-outline')).toHaveAttribute('role','complementary');await expectAccessible(page);
});

test('responsive command moves preserve focus or expose the containing disclosure',async({page})=>{
 for(const selector of ['#preview','#page-settings-open']){
  await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#preview')).not.toHaveClass(/af-btn--(?:sm|lg)/);await page.locator(selector).focus();await expect(page.locator(selector)).toBeFocused();
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#preview')).toHaveClass(/af-btn--lg/);await expect(page.locator(selector)).toBeFocused();
  await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#preview')).not.toHaveClass(/af-btn--(?:sm|lg)/);await expect(page.locator(selector)).toBeFocused();
 }
 await page.locator('#export').focus();await expect(page.locator('#export')).toBeFocused();await page.setViewportSize({width:390,height:844});await expect(page.locator('.project-menu>summary')).toBeFocused();
 await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#preview')).not.toHaveClass(/af-btn--(?:sm|lg)/);await page.locator('#device').focus();await expect(page.getByRole('combobox',{name:'Размер экрана',exact:true})).toBeFocused();await page.setViewportSize({width:390,height:844});await expect(page.locator('.editor-more>summary')).toBeFocused();
 await page.locator('.outline-toggle').focus();await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#preview')).not.toHaveClass(/af-btn--(?:sm|lg)/);await expect(page.locator('.outline-select[aria-current=true]')).toBeFocused();
});

test('a short landscape viewport keeps canvas commands compact and panels accessible',async({page})=>{
 await page.setViewportSize({width:844,height:390});await expect(page.locator('.mobile-editor-actions')).toBeVisible();
 await expect(page.locator('#preview')).toHaveText('Просмотр');expect((await page.locator('.canvas-scroll').boundingBox())!.y).toBeLessThan(240);
 await page.locator('#page-settings-open').click();const close=page.locator('#close-inspector');await expect(close).toBeInViewport();
 await close.focus();await page.keyboard.press('Shift+Tab');expect(await page.locator('#inspector').evaluate(n=>n.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#inspector')).toBeHidden();await expect(page.locator('#page-settings-open')).toBeFocused();
});

test('catalog and material descriptions inherit readable button states',async({page})=>{
 await page.setViewportSize({width:390,height:390});await page.locator('#add-widget').click();
 for(const type of ['text','cards','gallery']){await page.locator(`[data-add=${type}]`).hover();await expectAccessible(page)}
 await page.keyboard.press('Escape');await expect(page.locator('#add-widget')).toBeFocused();
 await page.setViewportSize({width:1440,height:1000});await page.locator('#page-settings-open').click();
 await page.getByRole('button',{name:'Выбрать из библиотеки',exact:true}).first().click();
 await page.locator('.asset-card').first().hover();await expectAccessible(page);
 await page.keyboard.press('Escape');await expect(page.locator('#inspector')).toBeVisible();
});
