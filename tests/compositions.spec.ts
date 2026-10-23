import {openEditor} from './open-editor';
import {savedDocument} from './project-helper';
import {test,expect} from '@playwright/test';
import axe from 'axe-core';
import {pathToFileURL} from 'node:url';
const stored=savedDocument;
test('catalog theme matches insertion and navigation links use a section picker',async({page})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#new-page').click();await page.locator('#end-add button').click();await page.getByLabel('Оформление композиции',{exact:true}).selectOption('contrast');await expect(page.locator('[data-template=header] .af-composition')).toHaveClass(/af-theme--contrast/);await page.locator('[data-template=header]').click();await expect(page.locator('#canvas header.af-page')).toHaveClass(/af-theme--contrast/);
 const nav=page.locator('#canvas header.af-page .af-widget').last();await nav.hover();await nav.getByRole('button',{name:'Настройки блока',exact:true}).click();const id=(await stored(page)).pages[0].id;await page.getByLabel('Переход к секции',{exact:true}).first().selectOption(id);await expect.poll(async()=>(await stored(page)).pages[1].widgets[1].content[0].href).toBe('#'+id);
 await page.locator('#close-inspector').click();await page.locator('.project-menu summary').click();await page.locator('#demo-page').click();expect(await page.locator('.canvas-scroll').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
});
test('builder edits compositions motion modal actions and exports offline',async({page},info)=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-page').click();await expect(page.locator('#canvas .af-page')).toHaveCount(10);
 const quote=page.getByRole('textbox',{name:'Цитата на странице',exact:true});await quote.fill('Новая сильная мысль.');await quote.blur();
 const box=page.locator('#canvas .af-widget--quote');await box.hover();await box.getByRole('button',{name:'Настройки блока',exact:true}).click();await page.locator('#properties details').getByText('Дополнительно: движение',{exact:true}).click();await page.getByLabel('Эффект',{exact:true}).selectOption('scale');await expect.poll(async()=>(await stored(page)).pages[7].widgets[0].motion.effect).toBe('scale');await page.locator('#close-inspector').click();
 await page.locator('#device').selectOption('mobile');await expect(page.locator('#canvas')).toHaveCSS('max-width','390px');await page.locator('#preview').click();await page.frameLocator('.project-preview iframe').locator('[data-action-id]').first().click();await expect(page.frameLocator('.project-preview iframe').locator('dialog[open]')).toBeVisible();await page.keyboard.press('Escape');
 await page.locator('.preview-toolbar .af-btn:not(.af-btn--ghost)').first().click();const event=page.waitForEvent('download');await page.locator('#export').click();const file=await event,path=info.outputPath('landing.html');await file.saveAs(path);await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(path).href);await expect(page.locator('.af-quote')).toContainText('Новая сильная мысль.');expect(await page.locator('img').evaluateAll(nodes=>nodes.every(n=>(n as HTMLImageElement).complete&&(n as HTMLImageElement).naturalWidth>0))).toBe(true);await page.locator('[data-action-id]').first().click();await expect(page.locator('dialog[open]')).toBeVisible();
});
test('section settings preserve content and reject incompatible composition',async({page})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-page').click();await page.locator('#pages').selectOption('3');await page.locator('#page-settings-open').click();const before=(await stored(page)).pages[3].widgets;
 await page.getByLabel('Композиция',{exact:true}).selectOption('steps');await expect.poll(async()=>(await stored(page)).pages[3].composition).toBe('steps');expect((await stored(page)).pages[3].widgets).toEqual(before);
 await page.getByLabel('Композиция',{exact:true}).selectOption('gallery');await expect(page.locator('#status')).toContainText('другие места');expect((await stored(page)).pages[3].composition).toBe('steps');await page.getByLabel('Фирменная тема',{exact:true}).selectOption('contrast');await expect(page.locator('#canvas .af-page').nth(3)).toHaveClass(/af-theme--contrast/);
});
