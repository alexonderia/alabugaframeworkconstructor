import {test,expect} from '@playwright/test';

test('presentation sizing stays stable through inspector and viewport changes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();
 await page.getByRole('button',{name:'Создать презентацию',exact:false}).click();
 await page.locator('.product-dialog [value=example]').check();
 await page.locator('.product-dialog').getByRole('button',{name:'Продолжить'}).click();
 const deck=page.locator('#canvas .af-deck');
 for(let i=0;i<3;i++){
  await page.locator('#page-settings-open').click();await expect(page.locator('#inspector')).toBeVisible();
  await expect.poll(async()=>{const b=(await deck.boundingBox())!;return Math.abs(b.width/b.height-16/9)}).toBeLessThan(.01);
  await page.locator('#close-inspector').click();await expect(page.locator('#inspector')).toBeHidden();
 }
 await page.locator('#page-settings-open').click();
 for(const width of [1100,768,390,1920]){
  await page.setViewportSize({width,height:1000});
  await expect.poll(async()=>{const b=(await deck.boundingBox())!;return Math.abs(b.width/b.height-16/9)}).toBeLessThan(.01);
 }
 await page.locator('#close-inspector').click();
 await page.locator('#preview').click();await expect(page.locator('.project-preview iframe')).toBeVisible();
 await page.evaluate(()=>location.hash='/projects');await expect(page.locator('.library-tools')).toBeVisible();
 // Let native ResizeObserver errors reach the window after the route transition.
 await page.waitForTimeout(300);expect(errors).toEqual([]);
});
