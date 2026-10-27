import {chooseOption} from './choose-option';
import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {savedDocument} from './project-helper';
const links=JSON.parse(await readFile(new URL('./fixtures/audit-links.json',import.meta.url),'utf8'));
const overflow=JSON.parse(await readFile(new URL('./fixtures/audit-overflow.json',import.meta.url),'utf8'));
async function importFixture(page:Page,document=links){await page.goto('/builder/');await page.locator('.library-tools').waitFor();await page.locator('input[type=file]').setInputFiles({name:'audit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))});await expect(page.locator('#project-name')).toHaveValue(document.title)}

test('stale tab cannot overwrite another tab and can save its own copy',async({page,context})=>{
 await importFixture(page);const original=page.url(),other=await context.newPage();await other.goto(original);await other.locator('#canvas').waitFor();
 await page.getByLabel('Название проекта',{exact:true}).fill('Название вкладки А');await page.getByLabel('Название проекта',{exact:true}).blur();await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');
 await other.locator('#canvas [data-widget-id=audit-text-a]').getByRole('textbox',{name:'Текст на странице',exact:true}).first().fill('Правка вкладки Б');
 await expect(other.getByRole('dialog',{name:'Конфликт сохранения'})).toBeVisible();expect((await savedDocument(page)).title).toBe('Название вкладки А');
 await other.getByRole('button',{name:'Сохранить мою копию',exact:true}).click();await expect(other).not.toHaveURL(original);expect((await savedDocument(other)).pages[0].widgets[0].content[0].text).toBe('Правка вкладки Б');await other.close();
});
test('document anchor stays inside preview instead of changing the application route',async({page})=>{
 await importFixture(page);await page.locator('#preview').click();await page.locator('.project-preview').waitFor();const url=page.url();
 const preview=page.frameLocator('.project-preview iframe');await preview.getByRole('link',{name:'К этому разделу',exact:true}).click();await expect(page).toHaveURL(url);await expect(page.locator('.project-preview')).toBeVisible();
});

test('malformed percent escape in an anchor does not throw or change the application route',async({page})=>{
 const document=structuredClone(links);for(const p of document.pages)for(const w of p.widgets)if(w.type==='text')for(const b of w.content)if(b.type==='link')b.href='#%';await importFixture(page,document);const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));await page.locator('#preview').click();const url=page.url();await page.frameLocator('.project-preview iframe').getByRole('link',{name:'К этому разделу',exact:true}).click();await expect(page).toHaveURL(url);await expect(page.locator('.project-preview')).toBeVisible();expect(errors).toEqual([]);
});
test('mobile settings close control receives pointer input and returns focus',async({page})=>{
 await importFixture(page);await page.setViewportSize({width:390,height:844});await page.locator('#page-settings-open').click();await expect(page.locator('#inspector')).toBeVisible();await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await expect(page.locator('#inspector')).toBeHidden();await expect(page.locator('#page-settings-open')).toBeFocused();
});
test('phone preview matches standalone mobile document geometry',async({page},info)=>{
 await importFixture(page);await chooseOption(page.locator('#device'),'mobile');await page.locator('#preview').click();const preview=page.frameLocator('.project-preview iframe');await expect(preview.locator('#audit-a')).toBeVisible();
 const simulated=await preview.locator('[data-widget-id=audit-text-a] .af-widget__content').evaluate(e=>({width:e.clientWidth,height:e.clientHeight,scroll:e.scrollHeight}));
 await page.getByRole('button',{name:'Редактировать',exact:true}).click();const pending=page.waitForEvent('download');await page.locator('#export').click();const file=info.outputPath('mobile.html');await(await pending).saveAs(file);
 const offline=await page.context().newPage();await offline.setViewportSize({width:390,height:844});await offline.route(/^https?:\/\//,r=>r.abort());await offline.goto(pathToFileURL(file).href);await offline.evaluate(async()=>document.fonts.ready);
 const actual=await offline.locator('[data-widget-id=audit-text-a] .af-widget__content').evaluate(e=>({width:e.clientWidth,height:e.clientHeight,scroll:e.scrollHeight}));expect(simulated).toEqual(actual);await offline.close();
});

test('fixed page blocks stay readable in the phone authoring canvas and on a phone viewport',async({page,browserName})=>{
 await importFixture(page);await chooseOption(page.locator('#device'),'mobile');const content=page.locator('#canvas [data-widget-id=audit-text-a] .af-widget__content');expect(await content.evaluate(n=>n.clientWidth)).toBeGreaterThan(300);await chooseOption(page.locator('#device'),'desktop');await page.setViewportSize({width:390,height:844});expect(await content.evaluate(n=>n.clientWidth)).toBeGreaterThan(300);await page.screenshot({path:`artifacts/audit/remediation/fixed-phone-authoring-${browserName}.png`});
});
test('quality and export identify content clipped only on a real mobile viewport',async({page})=>{
 await importFixture(page,overflow);if(!await page.locator('.project-menu').evaluate(n=>(n as HTMLDetailsElement).open))await page.locator('.project-menu>summary').click();await page.getByRole('button',{name:'Проверка качества',exact:true}).click();await expect(page.locator('.quality-issue').filter({hasText:'Телефон'})).toBeVisible();await page.locator('dialog[open]').getByRole('button',{name:'Закрыть',exact:true}).click();
 let downloaded=false;page.on('download',()=>downloaded=true);await page.locator('#export').click();await expect(page.locator('#status')).toContainText('Телефон');expect(downloaded).toBe(false);
});
