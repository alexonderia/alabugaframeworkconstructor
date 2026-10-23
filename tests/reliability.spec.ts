import {test,expect} from '@playwright/test';
import axe from 'axe-core';
import {savedDocument} from './project-helper';
import {pathToFileURL} from 'node:url';

test('material probes time out, support cancellation and release temporary URLs',async({page})=>{
 await page.goto('/demo/');
 await page.route('**/probe-hang.webp',()=>{});
 await page.route('**/probe-missing.webp',r=>r.fulfill({status:404,body:'missing'}));
 await page.route('**/probe-broken.webp',r=>r.fulfill({status:200,contentType:'image/webp',body:'broken'}));
 const result=await page.evaluate(async()=>{
  const {checkMaterial}=await import('/apps/editor/demo/material-check.ts' as string);
  const original=AbortSignal.timeout.bind(AbortSignal);AbortSignal.timeout=ms=>original(ms===8000?100:ms);
  const urls=new Set<string>(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{const url=create(blob);urls.add(url);return url};URL.revokeObjectURL=url=>{urls.delete(url);revoke(url)};
  const controller=new AbortController(),timeout=await checkMaterial('/probe-hang.webp',controller.signal);
  AbortSignal.timeout=original; // Only the intentional hang uses a short deadline.
  const missing=await checkMaterial('/probe-missing.webp',controller.signal),broken=await checkMaterial('/probe-broken.webp',controller.signal);
  const cancel=new AbortController(),timer=setTimeout(()=>cancel.abort(),20);let cancelled=false;
  try{await checkMaterial('/probe-hang.webp',cancel.signal)}catch(e){cancelled=(e as Error).name==='AbortError'}finally{clearTimeout(timer)}
  return {timeout,missing,broken,cancelled,temporaryURLs:urls.size};
 });
 expect(result.timeout.available).toBe(false);expect(result.timeout.error).toContain('8 секунд');expect(result.missing.error).toContain('404');expect(result.broken.error).toContain('декодировать');expect(result.cancelled).toBe(true);expect(result.temporaryURLs).toBe(0);
});

test('a stalled status request times out and the user can retry',async({page})=>{
 await page.addInitScript(()=>{const original=AbortSignal.timeout.bind(AbortSignal);let shortened=false;AbortSignal.timeout=ms=>{if(ms===8000&&!shortened){shortened=true;return original(150)}return original(ms)}});
 let calls=0;
 await page.route('**/api/ai/status',r=>{if(++calls===1)return;return r.fulfill({json:{model:'qwen3.5:2b',version:'test',digest:'test',loaded:[]}})});
 await page.route('**/api/ai/diagnostics',r=>r.fulfill({json:{gpu:[]}}));
 await page.goto('/demo/');await page.getByRole('button',{name:'Готовность к показу',exact:true}).click();
 await expect(page.locator('.demo-diagnostics > [role=status]')).toContainText('8 секунд');
 const retry=page.getByRole('button',{name:'Проверить подключение',exact:true});await expect(retry).toBeEnabled();await retry.click();
 await expect(page.locator('.demo-checks')).toContainText('Локальный сервис доступен');
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('.demo-diagnostics')).toHaveCount(0);
});

test('button labels are editable without nested controls and export retains actions',async({page},info)=>{
 await page.goto('/demo/');await page.getByRole('button',{name:'Настроить элементы',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();
 const initial=await savedDocument(page),widget=initial.pages.flatMap((p:any)=>p.widgets).find((w:any)=>w.type==='button'&&w.action.type==='section');
 const box=page.locator(`[data-widget-id="${widget.id}"]`).filter({has:page.locator('.inline-editable')});
 const label=box.getByRole('textbox',{name:'Кнопка на странице',exact:true});await label.fill('Посмотреть возможности');await label.press('Enter');
 await expect.poll(async()=>(await savedDocument(page)).pages.flatMap((p:any)=>p.widgets).find((w:any)=>w.id===widget.id).label).toBe('Посмотреть возможности');
 await page.evaluate(axe.source);expect(await page.evaluate(async()=>(await (window as any).axe.run(document,{runOnly:{type:'rule',values:['nested-interactive']}})).violations)).toEqual([]);
 const downloading=page.waitForEvent('download');await page.locator('#export').click();const file=info.outputPath('buttons.html');await(await downloading).saveAs(file);await page.goto(pathToFileURL(file).href);
 const action=page.locator(`[data-action-id="${widget.id}"]`);await expect(action).toHaveText('Посмотреть возможности');await expect(action).toHaveJSProperty('tagName','BUTTON');await expect(action.locator('[contenteditable]')).toHaveCount(0);
 await action.click();await expect.poll(async()=>page.locator(`[data-section-id="${widget.action.target}"]`).evaluate(n=>Math.round(n.getBoundingClientRect().top))).toBeLessThan(150);
});

test('diagnostics rejects an HTML fallback returned for an image',async({page})=>{
 await page.route('**/api/ai/status',r=>r.fulfill({json:{model:'qwen3.5:2b',version:'test',digest:'test',loaded:[]}}));
 await page.route('**/api/ai/diagnostics',r=>r.fulfill({json:{gpu:[]}}));
 await page.goto('/demo/');
 await page.route('**/assets/brand/*',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Missing asset fallback</title>'}));
 await page.getByRole('button',{name:'Готовность к показу',exact:true}).click();
 await expect(page.locator('.demo-checks')).toContainText('Некоторые материалы недоступны');
});

test('diagnostics rejects a damaged image with a successful HTTP status',async({page})=>{
 await page.route('**/api/ai/status',r=>r.fulfill({json:{model:'qwen3.5:2b',version:'test',digest:'test',loaded:[]}}));
 await page.route('**/api/ai/diagnostics',r=>r.fulfill({json:{gpu:[]}}));
 await page.goto('/demo/');await page.route('**/assets/brand/*',r=>r.fulfill({status:200,contentType:'image/webp',body:'broken image'}));
 await page.getByRole('button',{name:'Готовность к показу',exact:true}).click();
 await expect(page.locator('.demo-checks')).toContainText('Некоторые материалы недоступны');
});
