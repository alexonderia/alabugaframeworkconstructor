import {settledProperties,openGeometry,widgetTools} from './property-helper';
import {openEditor} from './open-editor';
import {savedDocument} from './project-helper';
import {test,expect} from '@playwright/test';
import axe from 'axe-core';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const draft=savedDocument;
async function newDocument(page:any,id='new-page'){await page.locator('.project-menu summary').click();await page.locator('#'+id).click()}
async function add(page:any,type:string,settings=true){await page.locator('#add-widget').click();await page.locator('[data-add="'+type+'"]').click();if(settings&&!(await page.locator('#inspector').isVisible())){await page.locator('.is-selected').hover();await page.locator('.canvas-widget-tools>.widget-tools:not([hidden])').getByRole('button',{name:'Настройки блока',exact:true}).click()}}
test.beforeEach(async({page})=>{await openEditor(page);await newDocument(page)});
test('add, edit, reject overlap, undo, duplicate, delete and restore draft',async({page})=>{
  await add(page,'text');await page.getByLabel('Название блока',{exact:true}).fill('Мой текст');await page.getByRole('textbox',{name:'Текст',exact:true}).fill('Текст проекта');await settledProperties(page);
  await expect(page.locator('#canvas')).toContainText('Текст проекта');await openGeometry(page);await page.getByLabel('Ширина',{exact:true}).fill('2');await settledProperties(page);expect((await draft(page)).pages[0].widgets[0].position.width).toBe(2);
  await add(page,'metric');await openGeometry(page);await page.getByLabel('Колонка',{exact:true}).fill('1');await settledProperties(page);await expect(page.locator('#status')).toContainText('Пересечение');expect((await draft(page)).pages[0].widgets[1].position.col).toBe(3);
  await page.locator('#undo').click();await expect(page.locator('#canvas .af-widget')).toHaveCount(1);await page.locator('#redo').click();await expect(page.locator('#canvas .af-widget')).toHaveCount(2);
  await page.locator('#close-inspector').click();await page.locator('#canvas .af-widget').first().click({position:{x:4,y:4}});await (await widgetTools(page,page.locator('#canvas .af-widget').first())).getByRole('button',{name:'Настройки блока',exact:true}).click();await page.getByRole('button',{name:'Дублировать',exact:true}).click();await expect(page.locator('#canvas .af-widget')).toHaveCount(3);await page.getByRole('button',{name:'Удалить блок',exact:true}).click();await expect(page.locator('#canvas .af-widget')).toHaveCount(2);
  await page.reload();await expect(page.locator('#canvas')).toContainText('Текст проекта');await expect(page.locator('#canvas .af-widget')).toHaveCount(2);
});
test('pointer and keyboard placement snap to grid',async({page})=>{
  await add(page,'metric',false);let handle=page.getByRole('button',{name:'Переместить блок',exact:true});await handle.focus();await page.keyboard.press('ArrowRight');expect((await draft(page)).pages[0].widgets[0].position.col).toBe(2);
  const panel=page.locator('#canvas .af-panel'),rect=await panel.boundingBox(),start=await handle.boundingBox();const step=(rect!.width+16)/12;
  await page.mouse.move(start!.x+13,start!.y+13);await page.mouse.down();await page.mouse.move(start!.x+13+step,start!.y+13+80,{steps:8});await page.mouse.up();
  expect((await draft(page)).pages[0].widgets[0].position).toMatchObject({col:3,row:2});
  await page.getByRole('button',{name:'Изменить размер блока',exact:true}).focus();await page.keyboard.press('ArrowDown');expect((await draft(page)).pages[0].widgets[0].position.height).toBe(3);
});
test('project roundtrip and invalid import retain document',async({page},info)=>{
  await add(page,'calendar');const event=page.waitForEvent('download');await page.locator('.project-menu summary').click();await page.locator('#save').click();const file=await event;const path=info.outputPath('project.json');await file.saveAs(path);
  await page.locator('#new-page').click();await expect(page.locator('#canvas .af-widget')).toHaveCount(0);await page.locator('#open').setInputFiles(path);await expect(page.locator('#canvas .af-widget--calendar')).toHaveCount(1);
  await page.locator('#open').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":999}')});await expect(page.locator('#status')).toContainText('Не удалось открыть');await expect(page.locator('#canvas .af-widget--calendar')).toHaveCount(1);
});
test('image upload and HTML export open offline, without executable user content',async({page},info)=>{
  await add(page,'text');await page.getByRole('textbox',{name:'Текст',exact:true}).fill('<script>window.pwned=true</script>');await settledProperties(page);await add(page,'image');
  const pixel=Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;canvas.getContext('2d')!.fillRect(0,0,1,1);return canvas.toDataURL('image/png').split(',')[1]}),'base64');
  await page.getByLabel('Загрузить изображение',{exact:true}).setInputFiles({name:'pixel.png',mimeType:'image/png',buffer:pixel});await expect(page.locator('#properties')).toContainText('Изображение встроено');await settledProperties(page);
  const event=page.waitForEvent('download');await page.locator('#export').click();const file=await event;const path=info.outputPath('export.html');await file.saveAs(path);const html=await readFile(path,'utf8');expect(html).toContain('data:image/png;base64,');
  await page.route(/^https?:\/\//,route=>route.abort());await page.goto(pathToFileURL(path).href);await expect(page.locator('.af-widget')).toHaveCount(2);await expect(page.locator('main')).toContainText('<script>window.pwned=true</script>');expect(await page.evaluate(()=>(window as any).pwned)).toBeUndefined();await expect(page.locator('img')).toHaveJSProperty('naturalWidth',1);
});
test('slides, preview and accessible editor',async({page},info)=>{
  await newDocument(page,'new-deck');await add(page,'metric');await page.locator('#add-slide').click();await page.locator('[data-template="blank"]').click();await add(page,'text');await page.locator('.outline-row').last().locator('.outline-menu summary').click();await page.locator('.outline-row').last().locator('[data-action=copy]').click();await expect(page.locator('#pages option')).toHaveCount(3);await page.locator('.outline-row').last().locator('.outline-menu summary').click();await page.locator('.outline-row').last().locator('[data-action=delete]').click();await expect(page.locator('#pages option')).toHaveCount(2);
  await page.locator('#preview').click();await expect(page.frameLocator('.project-preview iframe').locator('.af-slide')).toHaveCount(2);await expect(page.locator('.editor-inspector')).not.toBeVisible();await page.locator('.preview-toolbar .af-btn:not(.af-btn--ghost)').first().click();await expect(page.locator('.editor-inspector')).not.toBeVisible();
  await page.evaluate(axe.source);const issues=await page.evaluate(async()=> (await (window as any).axe.run()).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>n.target)})));expect(issues).toEqual([]);
  await page.screenshot({path:info.outputPath('editor.png'),fullPage:true});
});
