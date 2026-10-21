import {openEditor} from './open-editor';
import {test,expect} from '@playwright/test';
import {savedDocument} from './project-helper';

test('zoom changes physical slide size and Fit restores the canvas',async({page,browserName})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-deck').click();const slide=page.locator('#canvas .af-slide--active'),before=await slide.boundingBox();await page.locator('.canvas-zoom').getByRole('button',{name:'+',exact:true}).click();await expect.poll(async()=>(await slide.boundingBox())!.width).toBeGreaterThan(before!.width*1.08);await page.locator('.canvas-zoom').getByRole('button',{name:'Вписать',exact:true}).click();await expect.poll(async()=>Math.abs((await slide.boundingBox())!.width-before!.width)).toBeLessThan(2);
 if(browserName==='chromium'){await page.locator('#preview').click();await page.getByRole('button',{name:'На весь экран',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);const bounds=await page.locator('.project-preview .af-slide--active').boundingBox();expect(bounds!.width/bounds!.height).toBeCloseTo(16/9,2);await page.evaluate(()=>document.exitFullscreen())}
});

test('document properties edit the title and switch to section and element context',async({page})=>{
 await openEditor(page);await page.getByRole('button',{name:'Документ',exact:true}).click();await expect(page.locator('#inspector-title')).toHaveText('Настройки документа');await page.getByLabel('Название документа',{exact:true}).fill('Мой фирменный проект');await page.getByLabel('Название документа',{exact:true}).blur();await expect(page.locator('#project-name')).toHaveValue('Мой фирменный проект');await page.locator('#page-settings-open').click();await expect(page.locator('#inspector-title')).toHaveText('Настройки секции');
 const inline=page.locator('#canvas .af-widget--text [contenteditable]').first();await inline.click();await expect(page.locator('#inspector-title')).toHaveText('Настройки блока');await expect(inline).toBeFocused();
});

test('v1 legacy is retained, v3 assets deduplicate and revisions are bounded',async({page})=>{
 await openEditor(page);await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');
 const result=await page.evaluate(async()=>{
  // @ts-ignore browser module
  const s=await import('/apps/editor/src/storage.ts' as string);
  // @ts-ignore browser module
  const {makeComposition}=await import('/tests/framework/compositions.ts' as string);
  const section=makeComposition('split','page'),source=section.widgets.find((w:any)=>w.type==='image').src;
  const second=structuredClone(section);second.id='second';second.widgets.forEach((w:any,i:number)=>w.id='second-'+i);
  const doc={schemaVersion:1,kind:'page',title:'Migration',pages:[section,second]};localStorage.setItem('alabuga.builder.document.v1',JSON.stringify(doc));
  const stored=await s.saveProject('migration-test',doc);const a=stored.pages[0].widgets.find((w:any)=>w.type==='image').src,b=stored.pages[1].widgets.find((w:any)=>w.type==='image').src;
  for(let i=0;i<23;i++){const revision={...stored,title:'Revision '+i};await s.saveRevision('migration-test',revision)}
  const revisions=await s.listRevisions('migration-test');const portable=await s.portableProject(stored);const imported=s.importProject(portable);const hydrated=await s.hydrate(stored);
  return {a,b,count:revisions.length,portableCount:portable.assets.length,imported:imported.pages[0].widgets.find((w:any)=>w.type==='image').src.startsWith('data:'),hydrated:hydrated.pages[1].widgets.find((w:any)=>w.type==='image').src.startsWith('data:'),legacy:!!localStorage.getItem('alabuga.builder.document.v1'),source};
 });
 expect(result.a).toMatch(/^asset:[a-f0-9]{64}$/);expect(result.a).toBe(result.b);expect(result.count).toBe(20);expect(result.portableCount).toBe(1);expect(result.imported&&result.hydrated&&result.legacy).toBe(true);
 await page.goto('/builder/#/edit/migration-test');await expect(page.locator('#project-name')).toHaveValue('Migration');expect((await savedDocument(page)).schemaVersion).toBe(3);
});

test('properties leave canvas interactive and editing preserves other element identity',async({page})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-page').click();await page.locator('#pages').selectOption('2');await page.locator('#page-settings-open').click();expect(await page.locator('#canvas').evaluate(n=>(n as HTMLElement).inert)).toBe(false);
 await page.getByLabel('Фирменная тема',{exact:true}).selectOption('contrast');const text=page.locator('#canvas [data-composition=split] .af-widget--text');await text.locator('[contenteditable]').first().click();await expect(text.locator('[contenteditable]').first()).toBeFocused();await expect(page.locator('#inspector-title')).toHaveText('Настройки блока');
 const title=page.getByLabel('Название блока',{exact:true});await page.evaluate(()=>{(window as any).unchanged=document.querySelector('#canvas [data-composition=split] .af-widget--image')});await title.fill('New title');await expect.poll(async()=>(await savedDocument(page)).pages[2].widgets[0].title).toBe('New title');await expect(title).toBeFocused();expect(await page.evaluate(()=>(window as any).unchanged===document.querySelector('#canvas [data-composition=split] .af-widget--image'))).toBe(true);

});

test('asset chooser cropping, visual compatibility and motion grouping persist',async({page})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-deck').click();await page.locator('#page-settings-open').click();await page.getByRole('button',{name:'Выбрать композицию визуально',exact:true}).click();await expect(page.locator('.variant-card button:disabled').first()).toBeVisible();await page.locator('.asset-library').getByRole('button',{name:'Закрыть',exact:true}).click();await page.getByRole('tab',{name:'Оформление',exact:true}).click();await page.getByRole('button',{name:'Выбрать из библиотеки',exact:true}).click();await page.locator('.asset-card').first().click();await expect.poll(async()=>(await savedDocument(page)).pages[0].appearance.theme).toBe('image');
 const crop=page.getByRole('slider',{name:'Кадр фона',exact:true});await crop.focus();await page.keyboard.press('ArrowRight');await expect.poll(async()=>(await savedDocument(page)).pages[0].appearance.focalPoint.x).toBe(55);
 await page.getByRole('tab',{name:'Поведение',exact:true}).click();await page.getByRole('button',{name:'Последовательное раскрытие',exact:true}).click();await page.getByRole('button',{name:'Вместе',exact:true}).first().click();const doc=await savedDocument(page);expect(doc.pages[0].widgets[0].motion.step).toBe(doc.pages[0].widgets[1].motion.step);await page.reload();await expect(page.locator('#canvas .af-slide')).toHaveCount(11);
});
