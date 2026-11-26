import {chooseOption} from './choose-option';
import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {savedDocument} from './project-helper';
import {makeComposition} from '@alabuga/framework/compositions';
const links=JSON.parse(await readFile(new URL('./fixtures/audit-links.json',import.meta.url),'utf8'));
const overflow=JSON.parse(await readFile(new URL('./fixtures/audit-overflow.json',import.meta.url),'utf8'));
async function importFixture(page:Page,document=links){await page.goto('/builder/');await page.locator('.library-tools').waitFor();await page.locator('input[type=file]').setInputFiles({name:'audit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))});await expect(page.locator('#project-name')).toHaveValue(document.title)}

function headingFixture(kind:'page'|'presentation',title:string,heading='Заголовок элемента'){
 return {schemaVersion:3,kind,title:'Независимые заголовки',pages:[{id:'heading-section',title,grid:{columns:12,rowHeight:64,gap:16},widgets:[{id:'heading-text',type:'text',title:'',position:{col:1,row:1,width:8,height:4},content:[{type:'heading',text:heading},{type:'paragraph',text:'Неизменный абзац.',dropCap:false}]}]}]};
}

test('section name 4 stays in settings and outline without appearing above the header',async({page},info)=>{
 const header=makeComposition('header','page');header.id='heading-section';header.title='4';header.widgets[0].id='heading-text';
 if(header.widgets[0].type==='text')header.widgets[0].content=[{type:'heading',text:'alabuga'}];
 const fixture={schemaVersion:3,kind:'page',title:'Независимые заголовки',pages:[header]};
 await importFixture(page,fixture);await page.locator('#page-settings-open').click();
 const title=page.getByLabel('Заголовок секции',{exact:true});await expect(title).toHaveValue('4');await expect(title).toHaveJSProperty('tagName','INPUT');
 await expect(page.locator('.outline-select').first()).toHaveAttribute('aria-label','1. 4');
 await expect(page.locator('#canvas').getByText('4',{exact:true})).toHaveCount(0);await expect(page.locator('#canvas .af-heading,#canvas .af-slide__title')).toHaveCount(0);
 await expect(page.locator('#canvas [data-widget-id=heading-text] .af-prose h2')).toHaveText('alabuga');
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:info.outputPath('section-name-4.png')});
});

for(const kind of ['page','presentation'] as const){
 const label=kind==='page'?'Заголовок секции':'Заголовок слайда';
 test(`${kind} section title and element heading edit independently through undo, reload and export`,async({page,context},info)=>{
  test.setTimeout(60000);
  await importFixture(page,headingFixture(kind,'Название секции'));const before=await savedDocument(page);
  await page.locator('#page-settings-open').click();const title=page.getByLabel(label,{exact:true});
  await expect(title).toHaveJSProperty('tagName','INPUT');await expect(title).toHaveValue('Название секции');
  const contentBefore=await page.locator('#canvas .af-panel').innerText();
  await title.fill('Новое название секции');await title.blur();
  await expect(page.locator('#canvas .af-panel')).toHaveText(contentBefore,{useInnerText:true});
  await expect(page.locator('#canvas .af-heading,#canvas .af-slide__title')).toHaveCount(0);
  await expect(page.locator('.outline-select').first()).toHaveAttribute('aria-label','1. Новое название секции');
  let saved=await savedDocument(page);expect(saved.pages[0].title).toBe('Новое название секции');expect(saved.pages[0].widgets).toEqual(before.pages[0].widgets);
  await page.locator('#close-inspector').click();
  const element=page.locator('#canvas [data-widget-id=heading-text]').getByRole('textbox',{name:'Заголовок на странице',exact:true});
  await element.fill('Новый заголовок элемента');await element.blur();
  saved=await savedDocument(page);expect(saved.pages[0].title).toBe('Новое название секции');expect(saved.pages[0].widgets[0].content[0].text).toBe('Новый заголовок элемента');expect(saved.pages[0].widgets[0].content[1]).toEqual(before.pages[0].widgets[0].content[1]);
  await page.locator('#page-settings-open').click();await expect(title).toHaveValue('Новое название секции');
  await page.locator('#undo').click();await expect(element).toHaveText('Заголовок элемента');await expect(title).toHaveValue('Новое название секции');
  await page.locator('#undo').click();await expect(title).toHaveValue('Название секции');await expect(element).toHaveText('Заголовок элемента');
  await page.locator('#redo').click();await expect(title).toHaveValue('Новое название секции');await expect(element).toHaveText('Заголовок элемента');
  await page.locator('#redo').click();await expect(element).toHaveText('Новый заголовок элемента');
  saved=await savedDocument(page);expect(saved.pages[0].title).toBe('Новое название секции');expect(saved.pages[0].widgets[0].content[0].text).toBe('Новый заголовок элемента');
  await page.reload();await page.locator('#page-settings-open').click();await expect(title).toHaveValue('Новое название секции');await expect(element).toHaveText('Новый заголовок элемента');await page.locator('#close-inspector').click();
  await page.locator('#preview').click();const preview=page.frameLocator('.project-preview iframe');
  await expect(preview.locator('[data-widget-id=heading-text] .af-prose h2')).toHaveText('Новый заголовок элемента');await expect(preview.locator('#heading-section>.af-heading,#heading-section>.af-slide__title')).toHaveCount(0);
  await page.getByRole('button',{name:'Редактировать',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();
  const projectDownload=page.waitForEvent('download');await page.keyboard.press('Control+s');const projectPath=await(await projectDownload).path();const portable=JSON.parse(await readFile(projectPath!,'utf8'));expect(portable.document.pages[0].title).toBe('Новое название секции');expect(portable.document.pages[0].widgets[0].content[0].text).toBe('Новый заголовок элемента');
  const pending=page.waitForEvent('download');await page.locator('#export').click();const file=info.outputPath(`${kind}-headings.html`);await(await pending).saveAs(file);
  const offline=await context.newPage();await offline.route(/^https?:\/\//,r=>r.abort());await offline.goto(pathToFileURL(file).href);
  await expect(offline.locator('#heading-section>.af-heading,#heading-section>.af-slide__title')).toHaveCount(0);await expect(offline.locator('[data-widget-id=heading-text] .af-prose h2')).toHaveText('Новый заголовок элемента');await offline.close();
 });

 test(`${kind} equal section and element headings are retained independently`,async({page})=>{
  await importFixture(page,headingFixture(kind,'Одинаковый заголовок','Одинаковый заголовок'));
  let saved=await savedDocument(page);expect(saved.pages[0].title).toBe('Одинаковый заголовок');expect(saved.pages[0].widgets[0].content[0].text).toBe('Одинаковый заголовок');
  await page.reload();await page.locator('#page-settings-open').click();const title=page.getByLabel(label,{exact:true});await expect(title).toHaveValue('Одинаковый заголовок');
  await title.fill('Только секция');await title.blur();saved=await savedDocument(page);expect(saved.pages[0].title).toBe('Только секция');expect(saved.pages[0].widgets[0].content[0].text).toBe('Одинаковый заголовок');
  await page.locator('#undo').click();await expect(title).toHaveValue('Одинаковый заголовок');expect((await savedDocument(page)).pages[0].widgets[0].content[0].text).toBe('Одинаковый заголовок');
 });

 test(`${kind} an empty section title is never populated from a text element`,async({page})=>{
  await importFixture(page,headingFixture(kind,''));await page.locator('#page-settings-open').click();const title=page.getByLabel(label,{exact:true});await expect(title).toHaveValue('');
  if(kind==='page'){await page.locator('.advanced-grid>summary').click();await page.locator('#gap').fill('20');await page.locator('#gap').blur();expect((await savedDocument(page)).pages[0].title).toBe('');}
  await page.locator('#close-inspector').click();const element=page.locator('#canvas [data-widget-id=heading-text]').getByRole('textbox',{name:'Заголовок на странице',exact:true});await element.fill('Другой текст элемента');await element.blur();
  await page.locator('#page-settings-open').click();await expect(title).toHaveValue('');
  await title.fill('Название секции');await title.blur();expect((await savedDocument(page)).pages[0].widgets[0].content[0].text).toBe('Другой текст элемента');
  await title.fill('');await title.blur();await expect(title).toHaveValue('');
  await page.locator('#close-inspector').click();await page.locator('#preview').click();await expect(page.frameLocator('.project-preview iframe').locator('[data-widget-id=heading-text] .af-prose h2')).toHaveText('Другой текст элемента');
  await page.getByRole('button',{name:'Редактировать',exact:true}).click();await page.locator('#page-settings-open').click();await expect(title).toHaveValue('');
  const saved=await savedDocument(page);expect(saved.pages[0].title).toBe('');expect(saved.pages[0].widgets[0].content[0].text).toBe('Другой текст элемента');
 });
}

test('stale tab cannot overwrite another tab and can save its own copy',async({page,context})=>{
 await importFixture(page);const original=page.url(),other=await context.newPage();await other.goto(original);await other.locator('#canvas').waitFor();
 await page.getByLabel('Название проекта',{exact:true}).fill('Название вкладки А');await page.getByLabel('Название проекта',{exact:true}).blur();await expect(page.locator('#save-state')).toHaveText('Сохранено');
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
