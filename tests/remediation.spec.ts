import {chooseOption} from './choose-option';
import {test,expect} from '@playwright/test';
import {openEditor} from './open-editor';
import {savedDocument} from './project-helper';
import axe from 'axe-core';

test('quick exit creates a deduplicated recovery point and save status is live',async({page})=>{
 await openEditor(page);const id=page.url().split('/edit/')[1];await expect(page.locator('#save-state')).toHaveAttribute('aria-live','polite');await page.locator('#project-name').fill('Короткий сеанс');await page.locator('#project-name').blur();await savedDocument(page);await page.getByRole('button',{name:'← Проекты',exact:true}).click();await expect(page.locator('.library-tools')).toBeVisible();
 const titles=await page.evaluate(async id=>{const s=await import('/apps/editor/src/storage.ts' as string);return (await s.listRevisions(id)).map((r:any)=>r.document.title)},id);expect(titles).toContain('Короткий сеанс');
 await page.getByRole('button',{name:'Редактировать',exact:true}).click();await page.getByRole('button',{name:'← Проекты',exact:true}).click();expect(await page.evaluate(async id=>{const s=await import('/apps/editor/src/storage.ts' as string);return (await s.listRevisions(id)).length},id)).toBe(titles.length);
});

test('preview restores the eighth slide and returns to it',async({page})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-deck').click();await chooseOption(page.locator('#pages'),'7');const id=(await savedDocument(page)).pages[7].id;await page.locator('#preview').click();await expect(page.frameLocator('.project-preview iframe').locator('.af-slide--active')).toHaveAttribute('data-section-id',id);await page.getByRole('button',{name:'Редактировать',exact:true}).click();await expect(page.locator('#pages')).toHaveValue('7');
});

test('material failure leaves upload available and retry, local descriptions and search work',async({page})=>{
 await openEditor(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));let requests=0;await page.route('**/assets/brand/manifest.json',r=>++requests===1?r.fulfill({status:503,body:'Unavailable'}):r.continue());
 await page.evaluate(async()=>{const s=await import('/apps/editor/src/storage.ts' as string),a=await import('/apps/editor/src/assets.ts' as string);const canvas=document.createElement('canvas');await s.addAsset(canvas.toDataURL(),'Синий фон для отчёта');void a.chooseAsset(()=>{})});
 const dialog=page.getByRole('dialog',{name:'Библиотека материалов'});await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Загрузить свой материал')).toBeVisible();await expect(dialog.getByRole('button',{name:'Повторить загрузку',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Повторить загрузку',exact:true}).click();await expect(dialog.getByRole('button',{name:'Повторить загрузку',exact:true})).toBeHidden();await chooseOption(dialog.getByLabel('Категория материалов'),'local');await dialog.getByLabel('Поиск материалов').fill('для отчёта');await expect(dialog.locator('.asset-card')).toHaveCount(1);await expect(dialog.locator('.asset-card')).toContainText('Синий фон');await dialog.getByLabel('Поиск материалов').fill('Несуществующее');await expect(dialog.locator('.asset-card')).toHaveCount(0);await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();expect(errors).toEqual([]);
});

test('private section labels are consistent and do not alter published content',async({page})=>{
 await openEditor(page);const before=await savedDocument(page);await page.locator('.outline-row').first().locator('.outline-menu summary').click();await page.locator('.outline-row').first().locator('[data-action=rename]').click();await page.getByRole('textbox',{name:'Название в структуре',exact:true}).fill('Вступление для команды');await page.getByRole('button',{name:'Сохранить название',exact:true}).click();await expect(page.locator('.outline-select').first()).toContainText('Вступление для команды');await expect(page.locator('#pages option').first()).toContainText('Вступление для команды');expect((await savedDocument(page)).pages[0]).toEqual(before.pages[0]);await page.reload();await expect(page.locator('.outline-select').first()).toContainText('Вступление для команды');
});

test('Framework DatePicker survives reopening and ordinary properties autosave without Apply',async({page})=>{
 await openEditor(page);await page.locator('#add-widget').click();await page.locator('[data-add=calendar]').click();await page.locator('#canvas .is-selected').press('Enter');await expect(page.getByRole('button',{name:'Применить',exact:true})).toHaveCount(0);let date=page.locator('[data-af-datepicker-proxy]');await expect(date).toHaveCount(1);await date.fill('25.12.2026');await date.blur();await expect.poll(async()=>(await savedDocument(page)).pages.flatMap((p:any)=>p.widgets).find((w:any)=>w.type==='calendar')?.date).toBe('2026-12-25');await page.locator('#close-inspector').click();await page.locator('#canvas .af-widget--calendar').press('Enter');date=page.locator('[data-af-datepicker-proxy]');await expect(date).toHaveCount(1);await expect(date).toHaveValue('25.12.2026');
});

test('Ctrl+S inside an input downloads a named portable project',async({page})=>{
 await openEditor(page);await page.locator('#project-name').fill('Отчёт команды');const event=page.waitForEvent('download');await page.keyboard.press('Control+s');const download=await event;expect(download.suggestedFilename()).toBe('Отчёт команды.json');expect((await savedDocument(page)).title).toBe('Отчёт команды');
});

test('first tutorial can be declined and the mobile toolbar retains usable space',async({page})=>{
 await page.setViewportSize({width:390,height:844});await openEditor(page);await expect(page.locator('.author-tutorial')).toBeVisible();await expect(page.locator('.editor-more')).not.toHaveAttribute('open');await expect(page.locator('#pages')).toBeHidden();await expect(page.locator('.mobile-editor-actions>button')).toHaveCount(4);const before=await page.locator('.canvas-scroll').boundingBox();expect(before!.y).toBeLessThan(240);await page.locator('.author-tutorial summary').click();await page.getByRole('button',{name:'Скрыть подсказки',exact:true}).click();await page.reload();await expect(page.locator('.author-tutorial')).toBeHidden();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

test('AI readiness errors are visible before generating and can recover',async({page})=>{
 await openEditor(page);let ready=false;await page.route('**/api/ai/readiness',r=>r.fulfill({json:ready?{ready:true}:{ready:false,error:'Модель недоступна. Выполните npm run ai:setup.'}}));await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();await expect(page.locator('.ai-readiness')).toContainText('ИИ недоступен');await expect(page.getByRole('button',{name:'Создать черновик',exact:true})).toBeDisabled();await expect(page.locator('.ai-toolbar')).toBeHidden();await expect(page.locator('.ai-readiness')).not.toContainText('npm run');ready=true;await page.getByRole('button',{name:'Повторить проверку',exact:true}).click();await expect(page.locator('.ai-readiness')).toContainText('ИИ готов');await expect(page.getByRole('button',{name:'Создать черновик',exact:true})).toBeEnabled();
});

test('AI fields wait for materials and draft initialization before accepting changes',async({page})=>{
 await openEditor(page);let release!:()=>void;const gate=new Promise<void>(r=>release=r);await page.route('**/api/ai/readiness',r=>r.fulfill({json:{ready:true}}));await page.route('**/assets/brand/manifest.json',async r=>{await gate;await r.continue()});await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();await expect(page.locator('.ai-readiness')).toContainText('ИИ готов');await expect(page.getByRole('combobox',{name:'Результат',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Создать черновик',exact:true})).toBeDisabled();release();await expect(page.getByRole('combobox',{name:'Результат',exact:true})).toBeEnabled();await chooseOption(page.getByLabel('Результат',{exact:true}),'presentation');await page.getByLabel('Количество',{exact:true}).fill('6');await expect(page.locator('.ai-dialog select[name=target]')).toHaveValue('presentation');await expect(page.getByLabel('Количество',{exact:true})).toHaveValue('6');
});

test('leaving waits for writes with editing suspended and preserves the final title',async({page})=>{
 await openEditor(page);await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction,descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete')!;IDBDatabase.prototype.transaction=function(...args:any[]){const tx=original.apply(this,args as any);if(args[1]==='readwrite')Object.defineProperty(tx,'oncomplete',{set(handler){descriptor.set!.call(tx,(event:Event)=>setTimeout(()=>handler?.call(tx,event),300))}});return tx}});await page.locator('#project-name').fill('Последнее название');await page.locator('#project-name').blur();await page.getByRole('button',{name:'← Проекты',exact:true}).click();await expect(page.locator('#builder')).toHaveAttribute('inert');await expect(page.locator('.library-tools')).toBeVisible();await expect(page.getByRole('heading',{name:'Последнее название',exact:true})).toBeVisible();
});

test('asset cleanup protects projects, trash, history and AI drafts and rejects dangling references',async({page})=>{
 await openEditor(page);const result=await page.evaluate(async()=>{
  const s=await import('/apps/editor/src/storage.ts' as string),m=await import('/apps/editor/src/model.ts' as string),canvas=document.createElement('canvas'),doc=m.emptyDocument();doc.pages[0].widgets=[{...m.createWidget('image',doc,0),src:canvas.toDataURL()}];const stored=await s.saveProject('cleanup',doc);const id=stored.pages[0].widgets[0].src.slice(6);await s.saveRevision('cleanup',stored);const active=await s.removeUnusedAssets([id]);doc.pages[0].widgets=[];await s.saveProject('cleanup',doc);const history=await s.removeUnusedAssets([id]);await s.trashProject('cleanup');const trash=await s.removeUnusedAssets([id]);await s.deleteProject('cleanup');
  await s.writeSetting('ai-draft',{sections:stored.pages});const draft=await s.removeUnusedAssets([id]);await s.writeSetting('ai-draft',{sections:[]});const removed=await s.removeUnusedAssets([id]);let rejected=false;try{await s.saveProject('dangling',stored)}catch{rejected=true}return {active,history,trash,draft,removed,rejected,dangling:(await s.listProjectSummaries()).some((p:any)=>p.id==='dangling')};
 });expect(result).toEqual({active:0,history:0,trash:0,draft:0,removed:1,rejected:true,dangling:false});
});

test('large example has unique landmarks and mobile drawer contains focus',async({page})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-page').click();await expect(page.locator('#canvas .af-page')).toHaveCount(10);await expect(page.locator('#builder')).not.toHaveAttribute('inert');await page.evaluate(axe.source);expect(await page.evaluate(async()=>(await (window as any).axe.run()).violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)})))).toEqual([]);
 for(const width of [320,390,640,768]){await page.setViewportSize({width,height:844});await page.locator('#page-settings-open').click();await expect(page.locator('#close-inspector')).toBeVisible();if(width<768){await expect(page.locator('#inspector')).toHaveAttribute('aria-modal','true');await page.locator('#close-inspector').focus();await page.keyboard.press('Tab');expect(await page.locator('#inspector').evaluate(n=>n.contains(document.activeElement))).toBe(true)}await page.locator('#close-inspector').click();await expect(page.locator('#page-settings-open')).toBeFocused()}
});

test('Escape closes the active asset dialog and preserves the underlying properties panel',async({page})=>{
 await openEditor(page);await page.locator('#page-settings-open').click();await page.evaluate(async()=>{const {chooseAsset}=await import('/apps/editor/src/assets.ts' as string);void chooseAsset(()=>{})});await expect(page.getByRole('dialog',{name:'Библиотека материалов'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Библиотека материалов'})).toHaveCount(0);await expect(page.locator('#inspector')).toBeVisible();await page.locator('#close-inspector').click();await expect(page.locator('#inspector')).toBeHidden();
});
