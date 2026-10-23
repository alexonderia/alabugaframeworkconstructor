import {test,expect,type Locator,type Page} from '@playwright/test';
import {openEditor} from './open-editor';
import {savedDocument} from './project-helper';
import axe from 'axe-core';
import {mkdir} from 'node:fs/promises';

// An isolated document loads only the public Framework stylesheet. Comparing
// computed states catches local overrides even when all classes/tokens exist.
async function frameworkReference(page:Page,control:Locator){
 const spec=await control.evaluate(n=>({tag:n.tagName,classes:[...n.classList].filter(c=>c.startsWith('af-')).join(' '),type:n.getAttribute('type'),role:n.getAttribute('role'),checked:n instanceof HTMLInputElement?n.checked:false,check:!!n.closest('.af-check'),box:n.closest('.af-select-box')?.className,field:!!n.closest('.af-field'),fieldControl:n.classList.contains('af-label')?n.closest('.af-field')?.querySelector('input,select,textarea')?.className:null,text:n.textContent}));
 await page.evaluate(()=>{document.querySelector('#framework-reference')?.remove();const frame=document.createElement('iframe');frame.id='framework-reference';frame.src='/tests/framework-primitives.html';frame.title='Framework reference';Object.assign(frame.style,{position:'fixed',bottom:'0',right:'0',width:'260px',height:'100px',zIndex:'9999'});document.body.append(frame)});
 const frame=page.frameLocator('#framework-reference');await expect(frame.locator('body')).toHaveClass('af');
 await frame.locator('body').evaluate((body,spec)=>{const n=document.createElement(spec.tag);n.id='reference';n.className=spec.classes;if(spec.type)n.setAttribute('type',spec.type);if(spec.role)n.setAttribute('role',spec.role);if(n instanceof HTMLInputElement)n.checked=spec.checked;n.textContent=spec.text;let wrapped:HTMLElement=n;if(spec.box){const box=document.createElement('span');box.className=spec.box;box.append(n);wrapped=box}if(spec.check){const check=document.createElement('label');check.className='af-check';check.append(wrapped);wrapped=check}if(spec.field){const field=document.createElement('label');field.className='af-field';field.append(wrapped);if(spec.fieldControl){const input=document.createElement('input');input.className=spec.fieldControl;field.append(input)}body.append(field)}else body.append(wrapped)},spec);
 return frame.locator('#reference');
}
async function expectSameVisuals(actual:Locator,reference:Locator,properties=['font-family','font-size','font-weight','line-height','border-radius','border-width','border-color','background-color','color','box-shadow','opacity']){
 const read=(node:Element,keys:string[])=>Object.fromEntries(keys.map(key=>[key,getComputedStyle(node).getPropertyValue(key)]));
 await expect(async()=>expect(await actual.evaluate(read,properties)).toEqual(await reference.evaluate(read,properties))).toPass({timeout:5000});
}

test('menu buttons keep Framework hover, disabled, busy and keyboard focus states',async({page})=>{
 await openEditor(page);await page.locator('.project-menu>summary').click();const control=page.locator('#save'),reference=await frameworkReference(page,control);
 await page.mouse.move(1,1);await expectSameVisuals(control,reference);
 await control.hover();await control.evaluate(async n=>{await Promise.all(n.getAnimations().map(a=>a.finished))});const hovered=await control.evaluate(n=>({background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderColor}));
 await reference.hover();await expect.poll(()=>reference.evaluate(n=>({background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderColor}))).toEqual(hovered);
 await page.mouse.move(1,1);
 for(const state of ['disabled','aria-busy','aria-pressed']){
  for(const target of [control,reference])await target.evaluate((n,state)=>n.setAttribute(state,'true'),state);
  await expectSameVisuals(control,reference);
  for(const target of [control,reference])await target.evaluate((n,state)=>n.removeAttribute(state),state);
 }
 const focus=async(target:Locator)=>{
  await target.evaluate(n=>{const start=document.createElement('button');start.textContent='Focus start';n.before(start);start.focus()});
  await target.locator('..').getByRole('button',{name:'Focus start',exact:true}).click();
  await page.keyboard.press('Tab');await expect(target).toBeFocused();
  await expect.poll(()=>target.evaluate(n=>n.matches(':focus-visible'))).toBe(true);
  return target.evaluate(n=>({visible:n.matches(':focus-visible'),outline:getComputedStyle(n).outline,offset:getComputedStyle(n).outlineOffset}));
 };
 expect(await focus(control)).toEqual(await focus(reference));
});

test('inspector fields use unmodified Framework type, size and invalid state',async({page})=>{
 await openEditor(page);const widget=page.locator('#canvas .af-widget').first();await widget.focus();await widget.press('Enter');
 for(const selector of ['#properties .af-input:not([type=range]):not([type=file])','#properties .af-select__control','#properties .af-textarea','#properties .af-label']){
  const control=page.locator(selector).first();await expect(control).toBeVisible();const reference=await frameworkReference(page,control);
  await control.blur();await page.mouse.move(1,1);await expectSameVisuals(control,reference);
  if(selector.includes('.af-label'))continue;
  await expectSameVisuals(control,reference,['height','min-height','padding-top','padding-right','padding-bottom','padding-left']);
  for(const state of ['aria-invalid','disabled']){
   for(const target of [control,reference])await target.evaluate((n,state)=>n.setAttribute(state,'true'),state);
   await expectSameVisuals(control,reference);
   for(const target of [control,reference])await target.evaluate((n,state)=>n.removeAttribute(state),state);
  }
 }
});

test('creation dialog and radios inherit Framework visuals; cancellation preserves the project',async({page})=>{
 await page.goto('/builder/');await page.getByRole('button',{name:'Создать сайт',exact:false}).click();
 const dialog=page.getByRole('dialog',{name:'Создать сайт',exact:true});
 for(const control of [dialog,dialog.locator('.af-dialog__title'),dialog.locator('.af-radio').first()]){
  const reference=await frameworkReference(page,control);await expectSameVisuals(control,reference);
 }
 await page.locator('#framework-reference').evaluate(n=>n.remove());await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();
 await expect(page.locator('.project-card')).toHaveCount(0);
});

test('creation dialogs use Framework visuals and an accessible title',async({page})=>{
 await page.goto('/builder/');await page.getByRole('button',{name:'Создать сайт',exact:false}).click();
 const dialog=page.getByRole('dialog',{name:'Создать сайт',exact:true});await expect(dialog).toHaveClass(/af-dialog/);await expect(dialog).toHaveAttribute('aria-labelledby',/dialog-title-/);
 await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.getByRole('button',{name:'Создать сайт',exact:false})).toBeFocused();
});

test('project commands and view controls have separate owners',async({page})=>{
 await openEditor(page);await expect(page.locator('.canvas-toolbar .document-settings-open')).toHaveCount(0);await expect(page.locator('.canvas-toolbar .quality-open')).toHaveCount(0);
 await expect(page.locator('#play-motion,.replay-current')).toHaveCount(0);await expect(page.locator('#preview')).toHaveCount(1);
 await expect(page.locator('.editor-more-body #device')).toBeVisible();await page.locator('#page-settings-open').click();
 await expect(page.getByRole('button',{name:'Обновить секцию',exact:true})).toHaveCount(0);
 await page.getByLabel('Заголовок секции',{exact:true}).fill('Автоматическое применение');await page.getByLabel('Заголовок секции',{exact:true}).blur();
 await expect.poll(async()=>(await savedDocument(page)).pages[0].title).toBe('Автоматическое применение');
});

test('inspector returns focus to its actual block trigger',async({page})=>{
 await openEditor(page);const widget=page.locator('#canvas .af-widget').first();await widget.focus();await widget.press('Enter');
 await expect(page.locator('#inspector')).toBeVisible();await page.locator('#close-inspector').click();await expect(widget).toBeFocused();
});

test('Framework token changes propagate to shell controls and the document runtime',async({page})=>{
 await openEditor(page);
 await page.evaluate(()=>document.documentElement.style.setProperty('--af-action-primary-bg-default','rgb(81, 37, 163)'));
 await expect(page.locator('#export')).toHaveCSS('background-color','rgb(81, 37, 163)');
 await page.locator('#add-widget').click();await page.locator('[data-add=button]').click();await page.locator('#preview').click();
 const frame=page.frameLocator('.project-preview iframe');await expect(frame.locator('.af-widget--button .af-btn').first()).toBeVisible();
 await frame.locator('html').evaluate(n=>(n as HTMLElement).style.setProperty('--af-action-primary-bg-default','rgb(81, 37, 163)'));
 await expect(frame.locator('.af-widget--button .af-btn').first()).toHaveCSS('background-color','rgb(81, 37, 163)');
});

test('mobile toolbar preserves canvas space and structure contains focus',async({page})=>{
 await openEditor(page);await page.setViewportSize({width:390,height:844});await expect(page.locator('#page-settings-open')).toHaveText('Свойства');await expect(page.locator('#preview')).toHaveText('Просмотр');
 const controls=page.locator('.mobile-editor-actions>.af-btn');await expect(controls).toHaveCount(4);
 for(const control of await controls.all())expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(48);
 expect((await page.locator('.canvas-scroll').boundingBox())!.y).toBeLessThan(240);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.getByRole('button',{name:'Структура',exact:true}).click();await expect(page.locator('.editor-outline')).toHaveAttribute('aria-modal','true');
 await page.locator('.outline-close').focus();await page.keyboard.press('Tab');expect(await page.locator('.editor-outline').evaluate(n=>n.contains(document.activeElement))).toBe(true);
 await page.locator('.outline-menu:not([hidden])>summary').click();await page.locator('.outline-menu[open] [data-action=copy]').focus();await page.keyboard.press('Escape');await expect(page.locator('.editor-outline')).toBeVisible();await expect(page.locator('.outline-menu[open]')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Структура',exact:true})).toBeFocused();await expect(page.locator('.editor-outline')).toBeHidden();
});

test('documentation uses Framework fonts and token changes on both locales',async({page})=>{
 for(const language of ['ru','en']){
  await page.goto(`/docs/${language}/start.html`);await expect(page.locator('link[href="../assets/alabuga.css"]')).toHaveCount(1);
  await expect(page.locator('body')).toHaveCSS('font-family',/Alabuga Sans/);
  await page.evaluate(()=>document.documentElement.style.setProperty('--af-color-brand-deep','rgb(81, 37, 163)'));
  await expect(page.locator('header')).toHaveCSS('background-color','rgb(81, 37, 163)');
 }
});

test('capture the migrated editor, mobile workspace, demo and documentation',async({page},info)=>{
 if(info.project.name!=='chromium')test.skip();
 const output='artifacts/ui-ux-implementation-2026-10-23';await mkdir(output,{recursive:true});await openEditor(page);
 await page.locator('#page-settings-open').click();await page.screenshot({path:`${output}/desktop-inspector.png`});await page.locator('#close-inspector').click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/mobile-workspace.png`});
 await page.getByRole('button',{name:'Структура',exact:true}).click();await page.screenshot({path:`${output}/mobile-structure.png`});await page.keyboard.press('Escape');
 await page.evaluate(axe.source);const violations=await page.evaluate(async()=>(await (window as any).axe.run()).violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)})));expect(violations).toEqual([]);
 await page.goto('/demo/');await page.screenshot({path:`${output}/mobile-demo.png`});await page.goto('/docs/ru/start.html');await page.screenshot({path:`${output}/mobile-docs.png`});
});
