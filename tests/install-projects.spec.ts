import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('report collection preserves all 24 fitted slides and has an adaptive site',async({page})=>{
 const fixtures=JSON.parse(await readFile('tests/fixtures/slide-fit-reference.json','utf8'));
 await page.goto('/builder/?projects=slide-fit-report');await expect(page.locator('.project-card')).toHaveCount(2);
 const docs=await page.evaluate(async()=>{const s=await import('/apps/editor/src/storage.ts' as string);return Promise.all(['alabuga-report-presentation-v1','alabuga-report-site-v1'].map(async id=>(await s.getProject(id)).document))});
 expect(docs[0].pages.map((p:any)=>({id:p.id,grid:p.grid,widgets:p.widgets.map((w:any)=>({id:w.id,position:w.position,typography:w.typography})),placement:p.appearance.backgroundPlacement}))).toEqual(fixtures.after.map((p:any)=>({id:p.id,grid:p.grid,widgets:p.widgets.map((w:any)=>({id:w.id,position:w.position,typography:w.typography})),placement:p.appearance.backgroundPlacement})));
 expect(docs[1].pages).toHaveLength(24);expect(docs[1].pages.every((p:any)=>p.appearance.layout==='flow')).toBe(true);
 await page.goto('/builder/#/view/alabuga-report-site-v1');await page.setViewportSize({width:390,height:844});await expect(page.frameLocator('.project-preview iframe').locator('.af-page')).toHaveCount(24);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test('explicit link installs the existing AI documents once and preserves edits and trash',async({page})=>{
 await page.goto('/builder/?projects=ai-showcase');await expect(page.locator('.project-card')).toHaveCount(2);
 await expect(page.locator('.project-section').first().locator('.project-meta')).toContainText('5 секц.');await expect(page.locator('.project-section').last().locator('.project-meta')).toContainText('6 слайд.');
 await page.evaluate(async()=>{const s=await import('/apps/editor/src/storage.ts' as string);await s.renameProject('alabuga-ai-landing-20261005','Авторская версия');await s.trashProject('alabuga-ai-presentation-20261005');await s.deleteProject('alabuga-ai-presentation-20261005')});
 await page.goto('/builder/?projects=ai-showcase');await expect(page.locator('.project-card')).toHaveCount(1);await expect(page.getByRole('heading',{name:'Авторская версия'})).toBeVisible();
 await page.getByRole('button',{name:'Редактировать',exact:true}).click();await expect(page.locator('#canvas .af-page')).toHaveCount(5);
});
