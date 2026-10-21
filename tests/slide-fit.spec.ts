import {openEditor} from './open-editor';
import {test,expect} from '@playwright/test';
import {savedDocument} from './project-helper';
test('fit preserves content, measures 24 cases and rejects overflow',async({page},info)=>{
 test.setTimeout(180000);await openEditor(page);
 const report=await page.evaluate(async()=>{
  const {makeComposition}=await import('/tests/framework/compositions.ts' as string),{fitSlide,measureSlide}=await import('/tests/framework/slide-fit.ts' as string);
  const {slideFitFixtures}=await import('/tests/slide-fit-fixtures.ts' as string);const results=[];
  for(const [i,slide]of slideFitFixtures().entries()){
   const before=JSON.stringify(slide),fit=await fitSlide(slide,{index:i}),copy=structuredClone(fit.slide);
   for(const w of copy.widgets){delete w.typography;w.position=slide.widgets.find((n:any)=>n.id===w.id).position;if(w.type==='table')w.pageSize=slide.widgets.find((n:any)=>n.id===w.id).pageSize}copy.grid=slide.grid;copy.appearance=slide.appearance;
   results.push({i,name:slide.composition,success:fit.success,issues:fit.issues,unchanged:JSON.stringify(slide)===before,content:JSON.stringify(copy)===before,measured:fit.success?await measureSlide(fit.slide):[]});
  }
  const overflow=makeComposition('text','presentation');overflow.widgets[0].content=[{type:'paragraph',dropCap:false,text:'Очень длинный текст. '.repeat(500)}];const rejected=await fitSlide(overflow);
  return {results,rejected:!rejected.success,preserved:JSON.stringify(rejected.slide)===JSON.stringify(overflow)};
 });
 await info.attach('fit-report',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 expect(report.results.filter(r=>!r.success)).toEqual([]);expect(report.results.every(r=>r.unchanged&&r.content&&!r.measured.length)).toBe(true);expect(report.rejected&&report.preserved).toBe(true);
});

test('fitting is deterministic, respects locks, custom grids and cancellation',async({page})=>{
 test.setTimeout(60000);await openEditor(page);
 const r=await page.evaluate(async()=>{
  const {slideFitFixtures}=await import('/tests/slide-fit-fixtures.ts' as string),{fitSlide,slideBackgrounds}=await import('/tests/framework/slide-fit.ts' as string);
  const p=slideFitFixtures()[0],a=await fitSlide(p),b=await fitSlide(p);if(!a.success)return {error:a.issues};
  const locked=await fitSlide(a.slide,{keepLayout:true,keepBackground:true,keepTypography:true});
  const custom=structuredClone(a.slide);custom.composition='user-grid';const fittedCustom=await fitSlide(custom);
  const placements=[];for(const placement of ['none','full','left-quarter','right-quarter','left-third','right-third']){const f=await fitSlide(p,{placement});placements.push({placement,ok:f.success,actual:f.slide.appearance.backgroundPlacement})}
  const repeated=await fitSlide(p,{placement:'full',previousBackgrounds:[a.slide.appearance.backgroundId,a.slide.appearance.backgroundId]});
  const stop=new AbortController();stop.abort();let cancelled=false;try{await fitSlide(p,{signal:stop.signal})}catch{cancelled=true}
  const dark=slideBackgrounds.find((b:any)=>b.overlay==='strong'&&b.automatic);const unsafe=structuredClone(p);unsafe.appearance={...unsafe.appearance,theme:'image',background:dark.src,shade:'medium',backgroundPlacement:'full'};const rejected=await fitSlide(unsafe,{keepBackground:true});
  return {unsafeRejected:!rejected.success,deterministic:JSON.stringify(a.slide)===JSON.stringify(b.slide),locked:locked.success&&JSON.stringify(a.slide)===JSON.stringify(locked.slide),custom:fittedCustom.success&&JSON.stringify(custom.widgets.map((w:any)=>w.position))===JSON.stringify(fittedCustom.slide.widgets.map((w:any)=>w.position)),placements,cancelled,hosts:document.querySelectorAll('[style*="-20000px"]').length,backgrounds:slideBackgrounds.length,repeated:repeated.success&&repeated.slide.appearance.backgroundId!==a.slide.appearance.backgroundId};
 });
 expect(r).toMatchObject({unsafeRejected:true,deterministic:true,locked:true,custom:true,cancelled:true,hosts:0,backgrounds:20,repeated:true});expect(r.placements?.every(p=>p.ok&&p.placement===p.actual)).toBe(true);
});

test('preview applies once, rejects stale edits and survives storage and export',async({page})=>{
 test.setTimeout(60000);await openEditor(page);
 await page.evaluate(async()=>{
  const {slideFitFixtures}=await import('/tests/slide-fit-fixtures.ts' as string),{openSlideFit}=await import('/apps/editor/src/slide-fit.ts' as string),{EditorModel}=await import('/apps/editor/src/model.ts' as string);
  const model=new EditorModel({schemaVersion:3,kind:'presentation',title:'Проверка',pages:[slideFitFixtures()[0]]});(window as any).fitModel=model;(window as any).fitOriginal=model.document;
  (window as any).openFit=()=>openSlideFit(()=>({id:'test',document:model.document}),0,(d:any)=>{model.change((doc:any)=>doc.pages=d.pages);return true});(window as any).openFit();
 });
 await expect(page.getByRole('button',{name:'Применить оформление',exact:true})).toBeEnabled({timeout:20000});
 await page.evaluate(()=>{(window as any).fitModel.change((d:any)=>d.title='Новое название')});
 await page.getByRole('button',{name:'Применить оформление',exact:true}).click();await expect(page.locator('.fit-dialog > [role=status]')).toContainText('Проект изменился');await page.locator('.fit-dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.evaluate(()=>{(window as any).fitModel.undo();(window as any).openFit()});await expect(page.getByRole('button',{name:'Применить оформление',exact:true})).toBeEnabled({timeout:20000});await page.getByRole('button',{name:'Применить оформление',exact:true}).click();
 const r=await page.evaluate(async()=>{
  const model=(window as any).fitModel,formatted=model.document;model.undo();const undo=JSON.stringify(model.document)===JSON.stringify((window as any).fitOriginal);model.redo();
  const {portableProject,importProject,saveProject,hydrate}=await import('/apps/editor/src/storage.ts' as string);const stored=await saveProject('fit-test',formatted),hydrated=await hydrate(stored),portable=await portableProject(formatted),loaded=importProject(portable);
  const {exportHTML}=await import('/apps/editor/src/export.ts' as string);const html=await exportHTML(loaded);return {undo,redo:JSON.stringify(model.document)===JSON.stringify(formatted),type:loaded.pages[0].widgets[0].typography,persisted:hydrated.pages[0].widgets[0].typography,html};
 });
 expect(r.undo&&r.redo).toBe(true);expect(r.persisted).toEqual(r.type);
 await page.route('**/*',route=>route.abort());await page.setContent(r.html);await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.af-slide-fitted')).toBeVisible();expect(await page.locator('.af-title').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBe(r.type.heading);
});

test('typing only suggests fitting, preserving text, geometry and focus',async({page})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-deck').click();const before=await savedDocument(page);
 const heading=page.locator('#canvas .af-slide--active .af-title [contenteditable]').first();await heading.fill('Длинный заголовок '.repeat(100));
 await expect(page.getByRole('button',{name:'Текст не помещается — подобрать оформление',exact:true})).toBeVisible();await expect(heading).toBeFocused();
 const after=await savedDocument(page);expect(after.pages[0].widgets.map((w:any)=>({position:w.position,typography:w.typography}))).toEqual(before.pages[0].widgets.map((w:any)=>({position:w.position,typography:w.typography})));
 expect(after.pages[0].widgets.some((w:any)=>w.type==='text'&&w.content.some((b:any)=>b.text==='Длинный заголовок '.repeat(100)))).toBe(true);
});

test('whole deck previews and applies atomically, while cancel keeps original',async({page})=>{
 test.setTimeout(60000);await openEditor(page);await page.evaluate(async()=>{
  const {slideFitFixtures}=await import('/tests/slide-fit-fixtures.ts' as string),{openSlideFit}=await import('/apps/editor/src/slide-fit.ts' as string),{EditorModel}=await import('/apps/editor/src/model.ts' as string);
  const model=new EditorModel({schemaVersion:3,kind:'presentation',title:'Проверка',pages:slideFitFixtures().slice(0,3)});(window as any).fitModel=model;(window as any).fitOriginal=model.document;(window as any).openFit=()=>openSlideFit(()=>({id:'deck',document:model.document}),0,(d:any)=>{model.change((doc:any)=>doc.pages=d.pages);return true},true);(window as any).openFit();
 });await page.getByRole('button',{name:'Отменить расчёт',exact:true}).click();await expect(page.locator('.fit-dialog > [role=status]')).toContainText('отменён');expect(await page.evaluate(()=>JSON.stringify((window as any).fitModel.document)===JSON.stringify((window as any).fitOriginal))).toBe(true);
 await page.getByRole('button',{name:'Рассчитать оформление',exact:true}).click();await expect(page.getByRole('button',{name:'Применить оформление',exact:true})).toBeEnabled({timeout:30000});await page.getByRole('button',{name:'Применить оформление',exact:true}).click();
 expect(await page.evaluate(()=>{const model=(window as any).fitModel,all=model.document.pages.every((p:any)=>p.appearance.fitted);model.undo();return all&&JSON.stringify(model.document)===JSON.stringify((window as any).fitOriginal)})).toBe(true);
});
