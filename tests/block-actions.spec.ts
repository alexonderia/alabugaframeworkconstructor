import {widgetTools} from './property-helper';
import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.use({reducedMotion:'reduce',screenshot:'only-on-failure'});
async function fixture(page:Page){await page.goto('/builder/');await page.locator('.product-header input[type=file]').setInputFiles({name:'block-actions.json',mimeType:'application/json',buffer:await readFile(new URL('./fixtures/audit-links.json',import.meta.url))});await expect(page.locator('#project-name')).toBeVisible()}
async function travel(page:Page,box:Locator,button:Locator){
 await box.scrollIntoViewIfNeeded();const b=(await box.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+10);await expect((await widgetTools(page,box))).toBeVisible();
 // Zoom/scroll settle on animation frames before a person starts aiming at a button.
 await expect(async()=>{const before=await button.boundingBox();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));expect(await button.boundingBox()).toEqual(before)}).toPass();
 const r=(await button.boundingBox())!;await page.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:40});
 // Locator.click jumps directly to a target and misses the hover gap a user crosses.
 await expect((await widgetTools(page,box))).toBeVisible();expect(await button.evaluate((n,p)=>n.contains(document.elementFromPoint(p.x,p.y)),{x:r.x+r.width/2,y:r.y+r.height/2})).toBe(true);
 return r;
}
for(const action of ['Настройки блока','Копия','Удалить'])test(`block action ${action} accepts a pointer arriving from the block`,async({page},info)=>{
 await fixture(page);const box=page.locator('#canvas [data-widget-id=audit-text-a]'),button=(await widgetTools(page,box)).getByRole('button',{name:action,exact:true}),count=await page.locator('#canvas .af-widget').count();
 const r=await travel(page,box,button);await expect(button).toHaveAttribute('title',action);await expect(button.locator('.af-btn__icon')).toHaveAttribute('aria-hidden','true');await page.screenshot({path:info.outputPath('pointer-on-action.png')});await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
 if(action==='Настройки блока'){await expect(page.locator('#inspector')).toBeVisible();await expect(page.getByLabel('Название блока',{exact:true})).toHaveValue('Текст А');await page.locator('#close-inspector').click()}
 else if(action==='Копия'){await expect(page.locator('#canvas .af-widget')).toHaveCount(count+1);await expect(page.locator('#canvas .af-widget.is-selected')).not.toHaveAttribute('data-widget-id','audit-text-a');await page.locator('#undo').click();await expect(page.locator('#canvas .af-widget')).toHaveCount(count)}
 else{await expect(box).toHaveCount(0);await expect(page.locator('#canvas .af-widget')).toHaveCount(count-1);await page.locator('#undo').click();await expect(box).toBeVisible();await expect(page.locator('#canvas .af-widget')).toHaveCount(count)}
});

test('selected block actions remain available away from hover and across canvas zoom',async({page})=>{
 await fixture(page);const box=page.locator('#canvas [data-widget-id=audit-text-a]');await box.scrollIntoViewIfNeeded();await box.click({position:{x:4,y:4}});await page.mouse.move(1,1);await expect((await widgetTools(page,box))).toBeVisible();
 for(const [label,clicks]of [['Уменьшить масштаб',4],['Увеличить масштаб',8]] as const){
  for(let i=0;i<clicks;i++)await page.getByRole('button',{name:label,exact:true}).click();
  const button=(await widgetTools(page,box)).getByRole('button',{name:'Настройки блока',exact:true}),r=await travel(page,box,button);await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await expect(page.locator('#inspector')).toBeVisible();await page.locator('#close-inspector').click();await page.mouse.move(1,1);await expect((await widgetTools(page,box))).toBeVisible();
 }
});
