import {test,expect,type Locator} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {chooseOption} from './choose-option';

test.use({reducedMotion:'reduce'});
async function headingGap(disclosure:Locator){
 const edges=await disclosure.evaluate(n=>{const heading=n.querySelector(':scope > summary')!.getBoundingClientRect(),field=n.querySelector('.af-field')!,label=field.querySelector('.af-label')!,control=field.querySelector('.af-select__control,input:not([type=hidden]),textarea')!;return {heading:heading.bottom,field:field.getBoundingClientRect().top,label:label.getBoundingClientRect().top,labelBottom:label.getBoundingClientRect().bottom,control:control.getBoundingClientRect().top}});
 expect(edges.field-edges.heading).toBeGreaterThanOrEqual(15);expect(edges.label-edges.heading).toBeGreaterThanOrEqual(15);expect(edges.control-edges.labelBottom).toBeGreaterThanOrEqual(7);
}

for(const spaced of [false,true])test(`disclosure spacing includes field captions${spaced?' with expanded text spacing':''}`,async({page},info)=>{
 await page.goto('/builder/');await page.locator('.product-header input[type=file]').setInputFiles({name:'spacing.json',mimeType:'application/json',buffer:await readFile(new URL('./fixtures/audit-links.json',import.meta.url))});await expect(page.locator('#project-name')).toBeVisible();
 const box=page.locator('#canvas [data-widget-id=audit-text-a]');await box.focus();await box.press('Enter');
 if(spaced)await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'});
 const summary=page.locator('#inspector summary').filter({hasText:'Дополнительно: движение'}),disclosure=summary.locator('..');
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await summary.click();await expect(disclosure).toHaveAttribute('open');await headingGap(disclosure);
  const gaps=await disclosure.locator('.af-field').evaluateAll(fields=>fields.slice(1).map((n,i)=>n.getBoundingClientRect().top-fields[i].getBoundingClientRect().bottom));for(const gap of gaps)expect(gap).toBeGreaterThanOrEqual(15);
  await summary.scrollIntoViewIfNeeded();await page.locator('#inspector').screenshot({path:info.outputPath(`motion-${width}.png`)});
  await summary.click();await expect(disclosure.locator('.af-field').first()).toBeHidden();
  expect(await disclosure.evaluate(n=>Math.abs(n.getBoundingClientRect().height-n.querySelector('summary')!.getBoundingClientRect().height))).toBeLessThanOrEqual(1);
 }
 await page.locator('#close-inspector').click();await page.setViewportSize({width:1440,height:1000});await page.locator('.project-menu summary').click();await page.locator('#demo-deck').click();await page.locator('#page-settings-open').click();
 await page.getByRole('tab',{name:'Структура',exact:true}).click();const grid=page.locator('.slide-grid');await grid.locator('summary').click();await headingGap(grid);
 await page.getByRole('tab',{name:'Поведение',exact:true}).click();const advanced=page.locator('.slide-settings-panel details').filter({has:page.locator('summary',{hasText:'Дополнительно: шаги и эффекты'})});await advanced.locator('summary').click();await headingGap(advanced);
 await advanced.getByRole('combobox').first().scrollIntoViewIfNeeded();await chooseOption(advanced.getByRole('combobox').first(),'fade');await expect(advanced.locator('select').first()).toHaveValue('fade');
});
