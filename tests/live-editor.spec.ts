import {openGeometry} from './property-helper';
import {openEditor} from './open-editor';
import {savedDocument} from './project-helper';
import {test,expect} from '@playwright/test';
import axe from 'axe-core';
import {pathToFileURL} from 'node:url';
const data=savedDocument;
async function newPage(page:any){await page.locator('.project-menu summary').click();await page.locator('#new-page').click()}
async function add(page:any,type:string){await page.locator('#add-widget').click();await page.locator('[data-add="'+type+'"]').click()}
test.beforeEach(async({page})=>{await openEditor(page);await newPage(page)});
test('edit directly without focus loss and undo a whole typing session',async({page})=>{
  await add(page,'text');const text=page.getByRole('textbox',{name:'Текст на странице',exact:true});await text.fill('Новая история');await text.press('End');await text.pressSequentially(' команды');await expect(text).toBeFocused();expect((await data(page)).pages[0].widgets[0].content[0].text).toBe('Новая история команды');
  await text.blur();await page.locator('#undo').click();await expect(page.getByRole('textbox',{name:'Текст на странице',exact:true})).toContainText('Добавьте свой текст');await page.locator('#redo').click();await expect(page.locator('#canvas')).toContainText('Новая история команды');await expect.poll(async()=>(await data(page)).pages[0].widgets[0].content[0].text).toBe('Новая история команды');await page.reload();await expect(page.locator('#canvas')).toContainText('Новая история команды');
  await page.getByRole('textbox',{name:'Текст на странице',exact:true}).fill('Первая строка\nВторая строка');expect((await data(page)).pages[0].widgets[0].content[0].text).toBe('Первая строка\nВторая строка');
});
test('insert, reorder, copy and remove sections; preview and export keep their content',async({page},info)=>{
  await page.locator('#end-add .insert-button').click();await page.locator('[data-template="split"]').click();await expect(page.locator('#canvas .af-page')).toHaveCount(2);
  await page.getByRole('textbox',{name:'Заголовок на странице',exact:true}).fill('Наши возможности');await page.getByRole('textbox',{name:'Заголовок на странице',exact:true}).blur();
  const section=page.locator('#canvas .af-page').nth(1);await section.hover();await section.getByRole('button',{name:'Поднять секцию',exact:true}).click();expect((await data(page)).pages[0].widgets[0].content[0].text).toBe('Наши возможности');
  await page.locator('#canvas .af-page').first().hover();await page.locator('#canvas .af-page').first().getByRole('button',{name:'Копия секции',exact:true}).click();await expect(page.locator('#canvas .af-page')).toHaveCount(3);
  await page.locator('#canvas .af-page').last().hover();await page.locator('#canvas .af-page').last().getByRole('button',{name:'Удалить секцию',exact:true}).click();await expect(page.locator('#canvas .af-page')).toHaveCount(2);
  await page.locator('#preview').click();await expect(page.frameLocator('.project-preview iframe').locator('[contenteditable]')).toHaveCount(0);await expect(page.frameLocator('.project-preview iframe').locator('.af-page')).toHaveCount(2);await expect(page.frameLocator('.project-preview iframe').locator('body')).toContainText('Наши возможности');
  await page.locator('.preview-toolbar .af-btn:not(.af-btn--ghost)').first().click();const download=page.waitForEvent('download');await page.locator('#export').click();const file=await download;const path=info.outputPath('sections.html');await file.saveAs(path);await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(path).href);await expect(page.locator('.af-page')).toHaveCount(2);await expect(page.locator('.af-title').first()).toHaveText('Наши возможности');await expect(page.locator('img').first()).toHaveJSProperty('complete',true);expect(await page.locator('img').first().evaluate(n=>(n as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});
test('floating settings update immediately and reject invalid geometry',async({page})=>{
  await add(page,'text');await page.locator('.is-selected').hover();await page.locator('.is-selected .widget-tools').getByRole('button',{name:'Настройки блока',exact:true}).click();await openGeometry(page);await page.getByLabel('Ширина',{exact:true}).fill('2');await expect.poll(async()=>(await data(page)).pages[0].widgets[0].position.width).toBe(2);
  await page.getByRole('textbox',{name:'Текст',exact:true}).fill('Изменяется сразу');await expect(page.locator('#canvas')).toContainText('Изменяется сразу');await page.locator('#close-inspector').click();await add(page,'metric');await page.locator('.is-selected').hover();await page.locator('.is-selected .widget-tools').getByRole('button',{name:'Настройки блока',exact:true}).click();await openGeometry(page);await page.getByLabel('Колонка',{exact:true}).fill('1');await expect(page.locator('#status')).toContainText('Пересечение');expect((await data(page)).pages[0].widgets[1].position.col).toBe(3);
});
test('plain-text paste cannot insert markup; section page is accessible',async({page},info)=>{
  await add(page,'text');const text=page.getByRole('textbox',{name:'Текст на странице',exact:true});await text.fill('<img src=x onerror="window.injected=true">');await text.blur();expect(await page.locator('#canvas img').count()).toBe(0);expect(await page.evaluate(()=>(window as any).injected)).toBeUndefined();
  await page.evaluate(axe.source);expect(await page.evaluate(async()=>(await (window as any).axe.run()).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>n.target)})))).toEqual([]);await page.screenshot({path:info.outputPath('live-editor.png'),fullPage:true});
});
