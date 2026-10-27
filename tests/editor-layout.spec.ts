import {test,expect,type Page} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';

// A case traverses several viewports and public project downloads.
test.setTimeout(60000);
test.use({reducedMotion:'reduce'});

async function openFixture(page:Page){
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();
 await page.locator('.product-header input[type=file]').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:await readFile(new URL('./fixtures/audit-links.json',import.meta.url))});
 await expect(page.locator('#project-name')).toBeVisible();
}
async function capture(page:Page,state:string,engine:string){
 const directory=`artifacts/editor/layout/verified/${engine}`;await mkdir(directory,{recursive:true});await page.screenshot({path:`${directory}/${state}.png`});
}
async function usableHandles(page:Page){
 const result=await page.locator('#canvas .is-selected>.widget-handle').evaluateAll(nodes=>nodes.map(node=>{
  const rect=node.getBoundingClientRect(),style=getComputedStyle(node),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
  return {visible:style.display!=='none'&&Number(style.opacity)>0,width:rect.width,height:rect.height,hit:hit===node||!!hit&&node.contains(hit)};
 }));
 expect(result).toHaveLength(2);for(const handle of result){expect(handle.visible).toBe(true);expect(handle.width).toBeGreaterThanOrEqual(39);expect(handle.height).toBeGreaterThanOrEqual(39);expect(handle.hit,JSON.stringify(result)).toBe(true)}
}
async function portable(page:Page){
 await expect(page.locator('#save-state')).not.toContainText(/Проверяем|Сохраняем/);
 const downloaded=page.waitForEvent('download');await page.keyboard.press('Control+s');const file=await downloaded;return JSON.parse(await readFile((await file.path())!,'utf8')).document;
}

test('toolbar groups share Framework sizes and have space between controls',async({page},info)=>{
 await openFixture(page);
 for(const width of [1536,1220,1024,768,390]){
  await page.setViewportSize({width,height:900});
  const compact=width<768;
  await expect.poll(()=>page.locator('#project-name').evaluate(n=>n.getBoundingClientRect().height)).toBe(compact?32:40);
  const rows=await page.locator('.editor-header>.af-btn,.editor-history .af-btn,.project-menu>summary,.editor-file-actions>.af-btn,.canvas-toolbar .af-btn,.canvas-toolbar .af-select__control').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.closest('details:not([open]) > :not(summary)')).map(n=>({id:n.id||n.getAttribute('aria-label')||n.textContent,height:n.getBoundingClientRect().height})));
  for(const row of rows)expect(row.height,row.id??'control').toBe(compact?32:40);
  for(const group of ['.editor-history','.section-toolbar','.canvas-zoom']){
   const children=await page.locator(group).evaluate(n=>[...n.children].filter((n):n is HTMLElement=>n instanceof HTMLElement&&!!n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom}}));
   for(let i=1;i<children.length;i++)if(children[i].y<children[i-1].bottom-1)expect(children[i].x-children[i-1].right,group).toBeGreaterThanOrEqual(7);
  }
  await page.locator('.project-menu>summary').click();const trigger=await page.locator('.project-menu>summary').boundingBox(),menu=await page.locator('.command-menu').boundingBox();expect(menu!.y-trigger!.y-trigger!.height).toBeGreaterThanOrEqual(7);await page.locator('.project-menu>summary').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 }
 await page.setViewportSize({width:1536,height:900});await capture(page,'toolbar',info.project.name);
});

test('inspector header never covers fields and settings groups have consistent spacing',async({page},info)=>{
 await openFixture(page);
 for(const viewport of [{width:1536,height:900},{width:1024,height:768},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);const box=page.locator('#canvas .af-widget--text').first();await box.focus();await box.press('Enter');
  const body=page.locator('.inspector-body'),header=page.locator('#inspector>.drawer-header');await expect(body).toBeVisible();await expect.poll(()=>page.locator('#inspector').evaluate(n=>n.getBoundingClientRect().bottom)).toBeLessThanOrEqual(viewport.height+1);
  for(const scroll of [0,300,1000]){
   await body.evaluate((n,scroll)=>n.scrollTop=scroll,scroll);
   const panel=await page.locator('#inspector').boundingBox(),head=await header.boundingBox(),content=await body.boundingBox();
   expect(head!.y).toBeGreaterThanOrEqual(panel!.y);expect(head!.y+head!.height).toBeLessThanOrEqual(content!.y+1);expect(panel!.y+panel!.height).toBeLessThanOrEqual(viewport.height+1);
   const hit=await header.getByRole('button',{name:'Закрыть настройки'}).evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});expect(hit).toBe(true);
  }
  await body.evaluate(n=>n.scrollTop=0);
  const gaps=await page.locator('.property-group[open]>.settings-group-body').first().evaluate(n=>[...n.children].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect()).slice(1).map((r,i)=>r.top-n.children[i].getBoundingClientRect().bottom));
  for(const gap of gaps)expect(gap).toBeGreaterThanOrEqual(15);
  await capture(page,`inspector-${viewport.width}x${viewport.height}`,info.project.name);await page.locator('#close-inspector').click();
 }
});

test('selected flow blocks retain usable handles in narrow canvases and at different zooms',async({page},info)=>{
 await page.goto('/demo/');await page.getByRole('button',{name:'Собрать из шаблона',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();
 if(await page.locator('#inspector').isVisible())await page.locator('#close-inspector').click();
 const box=page.locator('#canvas .af-widget--cards').first();
 for(const width of [1536,1366,1024,768,390]){
  await page.setViewportSize({width,height:900});
  if(await page.locator('#inspector').isVisible())await page.locator('#close-inspector').click();
  await box.scrollIntoViewIfNeeded();await box.click({position:{x:4,y:4}});await page.mouse.move(1,1);await expect(async()=>usableHandles(page)).toPass();
  if(width>=768){await box.focus();await box.press('Enter');await page.mouse.move(1,1);await expect(async()=>usableHandles(page)).toPass();await page.locator('#close-inspector').click()}
  if(width===390)await capture(page,'phone-handles',info.project.name);
 }
 await page.setViewportSize({width:1366,height:900});
 for(const steps of [-4,8]){
  const control=page.getByRole('button',{name:steps<0?'Уменьшить масштаб':'Увеличить масштаб',exact:true});
  for(let i=0;i<Math.abs(steps);i++)await control.click();
  await box.scrollIntoViewIfNeeded();await page.mouse.move(1,1);await expect(async()=>usableHandles(page)).toPass();
  const width=await box.locator('.resize-handle').evaluate(n=>n.getBoundingClientRect().width);expect(width).toBeCloseTo(40,0);
 }
 await page.locator('#canvas-scroll').evaluate(n=>n.scrollLeft=n.scrollWidth);await expect(async()=>usableHandles(page)).toPass();await capture(page,'zoomed-handles',info.project.name);

});

test('a visible resize handle changes the document by pointer and keyboard at 60 percent zoom',async({page})=>{
 await page.setViewportSize({width:1024,height:900});await openFixture(page);
 const box=page.locator('#canvas .af-widget--text').first();await box.click({position:{x:4,y:4}});
 for(let i=0;i<4;i++)await page.getByRole('button',{name:'Уменьшить масштаб',exact:true}).click();
 await box.scrollIntoViewIfNeeded();await expect(async()=>usableHandles(page)).toPass();
 const initial=await portable(page),id=await box.getAttribute('data-widget-id'),before=initial.pages[0].widgets.find((w:any)=>w.id===id).position;
 const panel=box.locator('..'),step=await panel.evaluate((n,grid)=>{const scale=n.getBoundingClientRect().width/(n as HTMLElement).offsetWidth;return{x:((n as HTMLElement).clientWidth+grid.gap)/grid.columns*scale,y:(grid.rowHeight+grid.gap)*scale}},initial.pages[0].grid);
 const handle=box.locator('.resize-handle');for(let attempt=1;attempt<=2;attempt++){const rect=(await handle.boundingBox())!;await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+(attempt===1?step.x:0),rect.y+rect.height/2+step.y,{steps:5});await page.mouse.up();
  await expect.poll(async()=>(await portable(page)).pages[0].widgets.find((w:any)=>w.id===id).position).toEqual({...before,width:before.width+1,height:before.height+attempt});}
 await handle.focus();await page.keyboard.press('ArrowDown');const after=await portable(page);expect(after.pages[0].widgets.find((w:any)=>w.id===id).position.height).toBe(before.height+3);
});


