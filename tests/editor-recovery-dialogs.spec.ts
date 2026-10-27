import {test,expect,type Page,type Locator,type BrowserContext} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import axe from 'axe-core';
import {savedDocument} from './project-helper';
import {chooseOption} from './choose-option';

test.use({reducedMotion:'reduce',screenshot:'only-on-failure'});test.setTimeout(60000);
const longTitle='Название рабочего проекта '.repeat(10).slice(0,200),messages=new WeakMap<Page,string[]>();
test.beforeEach(({page,context})=>{const errors:string[]=[];messages.set(page,errors);page.on('pageerror',e=>errors.push(e.message));context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)))});
test.afterEach(({page})=>expect(messages.get(page)).toEqual([]));
async function fixture(page:Page){
 const doc=JSON.parse(await readFile(new URL('./fixtures/audit-links.json',import.meta.url),'utf8'));doc.title=longTitle;
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();await page.locator('.product-header input[type=file]').setInputFiles({name:'recovery-dialogs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.locator('#project-name')).toHaveValue(longTitle);
}
async function storedProject(page:Page){
 const id=decodeURIComponent(new URL(page.url()).hash.slice('#/edit/'.length));
 return page.evaluate(id=>new Promise<any>((resolve,reject)=>{const request=indexedDB.open('alabuga-workspace',3);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,get=db.transaction('projects').objectStore('projects').get(id);get.onerror=()=>{db.close();reject(get.error)};get.onsuccess=()=>{db.close();resolve(get.result)}}}),id);
}
async function openName(page:Page){
 if(!await page.locator('.editor-outline').isVisible())await page.locator('.outline-toggle').click();
 const menu=page.locator('.outline-row').first().locator('.outline-menu');if(!await menu.evaluate(n=>(n as HTMLDetailsElement).open))await menu.locator('summary').click();
 await menu.locator('[data-action=rename]').click();return page.getByRole('dialog',{name:'Название в структуре',exact:true});
}
async function geometry(page:Page,dialog:Locator,name:string,engine:string){
 const directory=`artifacts/editor-recovery-2026-10-26/verified/${engine}`;await mkdir(directory,{recursive:true});
 for(const [width,height]of [[1536,1000],[390,844],[320,568],[844,390]]){
  await page.setViewportSize({width,height});
  for(const spaced of [false,true]){
   if(spaced&&width!==320&&width!==844)continue;
   const style=spaced?await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'}):undefined;
   let headerY=0;
   for(const end of [false,true]){
    const sample=await dialog.evaluate((n,end)=>{
     const body=n.querySelector<HTMLElement>('.library-dialog-body')!,header=n.querySelector<HTMLElement>('.af-dialog__header')!,actions=n.querySelector('.library-dialog-actions');body.scrollTop=end?body.scrollHeight:0;
     const buttons=[...header.querySelectorAll('button'),...actions?.querySelectorAll('button')??[]];
     return {dialog:n.getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON(),header:header.getBoundingClientRect().toJSON(),actions:actions?.getBoundingClientRect().toJSON(),overflow:Math.max(n.scrollWidth-n.clientWidth,body.scrollWidth-body.clientWidth),labels:[...n.querySelectorAll('button')].filter(b=>b.getClientRects().length).every(b=>b.scrollWidth<=b.clientWidth+1),hittable:buttons.every(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})};
    },end);
    const state=`${name} ${width}x${height} spaced=${spaced} end=${end}`;if(!end)headerY=sample.header.y;
    expect(sample.header.y,state).toBeCloseTo(headerY,0);expect(sample.header.y,state).toBeGreaterThanOrEqual(sample.dialog.y);expect(sample.header.bottom,state).toBeLessThanOrEqual(sample.body.top+1);expect(sample.body.height,state).toBeGreaterThan(30);
    expect(sample.overflow,state).toBeLessThanOrEqual(1);expect(sample.labels,state).toBe(true);expect(sample.hittable,state).toBe(true);if(sample.actions)expect(sample.actions.top,state).toBeGreaterThanOrEqual(sample.body.bottom-1);
   }
   if(!spaced)await page.screenshot({path:`${directory}/${name}-${width}x${height}.png`});if(style)await style.evaluate(n=>(n as Element).remove());
  }
 }
 await page.evaluate(axe.source);expect(await dialog.evaluate(async n=>(await (window as any).axe.run(n)).violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)})))).toEqual([]);
}
async function conflict(page:Page,context:BrowserContext){
 await fixture(page);const other=await context.newPage();await other.goto(page.url());await expect(other.locator('#project-name')).toHaveValue(longTitle);
 await page.locator('#project-name').fill('Версия вкладки A');await page.locator('#project-name').blur();await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');
 const editable=other.locator('#canvas [data-widget-id=audit-text-a]').getByRole('textbox',{name:'Текст на странице',exact:true}).first();await editable.fill('Несохранённый текст вкладки B');const dialog=other.getByRole('dialog',{name:'Конфликт сохранения',exact:true});await expect(dialog).toBeVisible();
 return {other,editable,dialog,original:await storedProject(page)};
}
async function failWrites(page:Page,store:string){
 await page.evaluate(store=>{const original=IDBDatabase.prototype.transaction;(window as any).restoreDialogWrites=()=>IDBDatabase.prototype.transaction=original;IDBDatabase.prototype.transaction=function(...args:Parameters<IDBDatabase['transaction']>){const stores=typeof args[0]==='string'?[args[0]]:Array.from(args[0]);if(args[1]==='readwrite'&&stores.includes(store))throw new DOMException('Запись временно недоступна','QuotaExceededError');return original.apply(this,args)}},store);
}
async function restoreWrites(page:Page){await page.evaluate(()=>(window as any).restoreDialogWrites())}

test('block catalog keeps close visible and reusable after adding and undoing',async({page},info)=>{
 await fixture(page);const before=await savedDocument(page);await page.locator('#add-widget').click();const dialog=page.getByRole('dialog',{name:'Добавить блок',exact:true});
 await geometry(page,dialog,'blocks',info.project.name);await expect(dialog.locator('#templates')).toBeHidden();await expect(dialog.locator('#catalog-theme-field')).toBeHidden();await page.keyboard.press('Escape');await expect(page.locator('#add-widget')).toBeFocused();
 await page.locator('#add-widget').click();await dialog.locator('[data-add=calendar]').click();await expect(dialog).not.toBeVisible();expect((await savedDocument(page)).pages[0].widgets).toHaveLength(before.pages[0].widgets.length+1);
 await page.locator('#undo').click();expect((await savedDocument(page)).pages[0]).toEqual(before.pages[0]);await page.locator('#add-widget').click();await expect(dialog.locator('[data-add=calendar]')).toHaveCount(1);await dialog.locator('#close-catalog').click();await expect(page.locator('#add-widget')).toBeFocused();
});

test('section catalog preserves its selected theme and adds exactly one section with undo',async({page},info)=>{
 await fixture(page);const before=await savedDocument(page);await page.locator('#end-add button').click();const dialog=page.getByRole('dialog',{name:'Добавить секцию',exact:true});
 await geometry(page,dialog,'sections',info.project.name);await expect(dialog.locator('#palette')).toBeHidden();await chooseOption(dialog.getByRole('combobox',{name:'Оформление композиции',exact:true}),'accent');await dialog.locator('[data-template=blank]').click();
 await expect(dialog).not.toBeVisible();const after=await savedDocument(page);expect(after.pages).toHaveLength(before.pages.length+1);expect(after.pages.at(-1).appearance.theme).toBe('accent');await page.locator('#undo').click();expect((await savedDocument(page)).pages).toEqual(before.pages);
 await page.locator('#end-add button').click();await chooseOption(dialog.getByRole('combobox',{name:'Оформление композиции',exact:true}),'contrast');await dialog.locator('#close-catalog').click();await expect(page.locator('#end-add button')).toBeFocused();
});

test('private section name restores outline focus and resets without changing published data',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);const before=await savedDocument(page);let dialog=await openName(page);await geometry(page,dialog,'section-name',info.project.name);
 await page.keyboard.press('Escape');await expect(page.locator('.outline-row').first().locator('summary')).toBeFocused();dialog=await openName(page);const input=dialog.getByRole('textbox',{name:'Название в структуре',exact:true});await input.fill('Рабочая подпись автора');await input.press('Enter');await expect(dialog).toHaveCount(0);await expect(page.locator('.outline-select').first()).toContainText('Рабочая подпись автора');await expect(page.locator('.outline-row').first().locator('summary')).toBeFocused();expect((await savedDocument(page)).pages).toEqual(before.pages);
 await page.reload();await page.locator('.outline-toggle').click();await expect(page.locator('.outline-select').first()).toContainText('Рабочая подпись автора');dialog=await openName(page);await dialog.getByRole('textbox').fill('');await dialog.getByRole('textbox').press('Enter');await expect(dialog).toHaveCount(0);await expect(page.locator('.outline-select').first()).toContainText('Раздел А');expect((await savedDocument(page)).pages).toEqual(before.pages);
});

test('failed private name save retains its input and can retry safely',async({page})=>{
 await fixture(page);const before=await savedDocument(page),dialog=await openName(page);await dialog.getByRole('textbox').fill('Название после повтора');await failWrites(page,'settings');await dialog.getByRole('button',{name:'Сохранить название',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('Запись временно недоступна');await expect(dialog.getByRole('textbox')).toHaveValue('Название после повтора');await expect(dialog.getByRole('button',{name:'Сохранить название',exact:true})).toBeEnabled();await expect(page.locator('.outline-select').first()).toContainText('Раздел А');
 await restoreWrites(page);await dialog.getByRole('textbox').press('Enter');await expect(dialog).toHaveCount(0);await expect(page.locator('.outline-select').first()).toContainText('Название после повтора');expect((await savedDocument(page)).pages).toEqual(before.pages);
});

test('conflict keeps the local draft downloadable and gives a long-title copy a visible suffix',async({page,context},info)=>{
 const {other,editable,dialog,original}=await conflict(page,context);await geometry(other,dialog,'conflict',info.project.name);
 await other.setViewportSize({width:844,height:360});const body=dialog.getByRole('region',{name:'Содержимое окна: Конфликт сохранения',exact:true});await dialog.getByRole('button',{name:'Закрыть',exact:true}).focus();await other.keyboard.press('Tab');await expect(body).toBeFocused();await body.press('Home');await expect.poll(()=>body.evaluate(n=>n.scrollTop)).toBe(0);await body.press('PageDown');await expect.poll(()=>body.evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 await dialog.getByRole('button',{name:'Продолжить редактирование',exact:true}).click();await expect(editable).toBeFocused();await expect(editable).toHaveText('Несохранённый текст вкладки B');
 const event=other.waitForEvent('download');await other.keyboard.press('Control+s');const download=await event,portable=JSON.parse(await readFile((await download.path())!,'utf8'));expect(portable.document.pages[0].widgets[0].content[0].text).toBe('Несохранённый текст вкладки B');expect((await storedProject(page)).document).toEqual(original.document);
 await editable.fill('Текст вкладки B для копии');await expect(dialog).toBeVisible();const originalURL=other.url();await dialog.getByRole('button',{name:'Сохранить мою копию',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(other).not.toHaveURL(originalURL);await expect(other.locator('#project-name')).toHaveValue(longTitle.slice(0,192)+' — копия');
 const copy=await storedProject(other);expect(copy.document.pages[0].widgets[0].content[0].text).toBe('Текст вкладки B для копии');expect((await storedProject(page)).document).toEqual(original.document);await other.reload();await expect(other.locator('#project-name')).toHaveValue(copy.document.title);await expect(other.locator('#canvas')).toContainText('Текст вкладки B для копии');await other.close();
});

test('opening the saved conflict version reads the latest completed write',async({page,context})=>{
 const {other,dialog}=await conflict(page,context);await page.locator('#canvas [data-widget-id=audit-text-a]').getByRole('textbox',{name:'Текст на странице',exact:true}).first().fill('Более новая правка вкладки A');await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');const latest=await storedProject(page);
 await dialog.getByRole('button',{name:'Открыть сохранённую версию',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(other.locator('#project-name')).toHaveValue('Версия вкладки A');await expect(other.locator('#canvas')).toContainText('Более новая правка вкладки A');expect((await storedProject(other)).document).toEqual(latest.document);await other.reload();await expect(other.locator('#canvas')).toContainText('Более новая правка вкладки A');await other.close();
});

test('a failed conflict copy leaves both versions intact and the action can be retried',async({page,context})=>{
 const {other,editable,dialog,original}=await conflict(page,context);await failWrites(other,'projects');await dialog.getByRole('button',{name:'Сохранить мою копию',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Запись временно недоступна');await expect(dialog.getByRole('button',{name:'Сохранить мою копию',exact:true})).toBeEnabled();await expect(other.locator('#project-name')).toHaveValue(longTitle);await expect(editable).toHaveText('Несохранённый текст вкладки B');expect((await storedProject(page)).document).toEqual(original.document);
 await restoreWrites(other);await dialog.getByRole('button',{name:'Сохранить мою копию',exact:true}).click();await expect(dialog).toHaveCount(0);expect((await storedProject(other)).document.title.endsWith(' — копия')).toBe(true);expect((await storedProject(page)).document).toEqual(original.document);await other.close();
});
