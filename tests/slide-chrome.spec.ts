import {test,expect} from '@playwright/test';
import {openEditor} from './open-editor';
import {savedDocument} from './project-helper';
import {chooseOption} from './choose-option';
import type {Widget} from '@alabuga/framework/schema';

test('slide header geometry stays consistent across plain, themed and fitted slides',async({page})=>{
 await openEditor(page);
 const result=await page.evaluate(async()=>{
  const {renderDocument}=await import('/apps/editor/src/framework-adapter.ts' as string),{slideFitFixtures}=await import('/tests/slide-fit-fixtures.ts' as string);
  const blank={id:'plain-slide',title:'Plain',grid:{columns:12,rowHeight:64,gap:16},widgets:[]};
  const themed=structuredClone(slideFitFixtures()[0]);themed.id='themed-slide';
  const fitted=structuredClone(themed);fitted.id='fitted-slide';fitted.widgets.forEach((w:Widget)=>w.id+='-fitted');fitted.appearance={...fitted.appearance,fitted:true,backgroundPlacement:'left-third'};
  const host=document.createElement('div');host.style.width='1600px';document.body.append(host);
  const controller=renderDocument(host,{schemaVersion:3,kind:'presentation',title:'Новая презентация',pages:[blank,themed,fitted]},{editing:true});
  const geometry=[...host.querySelectorAll<HTMLElement>('.af-slide')].map(slide=>{const n=slide.querySelector<HTMLElement>('.af-eyebrow')!,style=getComputedStyle(n);return {left:n.offsetLeft,top:n.offsetTop,fontSize:style.fontSize,lineHeight:style.lineHeight}});
  const numbers=[...host.querySelectorAll('.af-slide__number')].map(n=>n.textContent);controller.destroy();host.remove();return {geometry,numbers};
 });
 expect(result.geometry[0]).toEqual(result.geometry[1]);expect(result.geometry[1]).toEqual(result.geometry[2]);expect(result.geometry[0].fontSize).toBe('24px');expect(result.numbers).toEqual(['01','02','03']);
});

test('annotation controls persist, undo and export without losing custom text',async({page})=>{
 await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#new-deck').click();await page.locator('#page-settings-open').click();await page.getByRole('tab',{name:'Оформление',exact:true}).click();
 await page.getByLabel('Текст подписи',{exact:true}).fill('АЛАБУГА / Проект <2026>');await page.getByLabel('Текст подписи',{exact:true}).press('Tab');
 await page.getByLabel('Номер страницы',{exact:true}).fill('A-07');await page.getByLabel('Номер страницы',{exact:true}).press('Tab');
 await chooseOption(page.getByLabel('Положение номера',{exact:true}),'center');
 const number=page.locator('#canvas .af-slide--active>.af-slide__number');await expect(number).toHaveText('A-07');await expect(number).toHaveAttribute('data-position','center');
 await chooseOption(page.getByLabel('Фон номера страницы',{exact:true}),'blue');
 await chooseOption(page.getByLabel('Цвет текста номера страницы',{exact:true}),'white');await expect(number).toHaveCSS('background-color','rgb(12, 111, 241)');await expect(number).toHaveCSS('color','rgb(255, 255, 255)');
 await chooseOption(page.getByLabel('Фон номера страницы',{exact:true}),'transparent');await expect(number).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(number).toHaveCSS('padding','0px');await expect(number).toHaveCSS('color','rgb(255, 255, 255)');
 await chooseOption(page.getByLabel('Цвет текста номера страницы',{exact:true}),'inherit');await expect(number).toHaveAttribute('data-number-color','inherit');
 await chooseOption(page.getByLabel('Фон номера страницы',{exact:true}),'white');await chooseOption(page.getByLabel('Цвет текста номера страницы',{exact:true}),'ink');await expect(number).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(number).toHaveCSS('color','rgb(0, 13, 60)');
 await page.getByLabel('Показывать номер страницы',{exact:true}).uncheck();await expect(number).toHaveCount(0);
 await page.locator('#undo').click();await expect(number).toHaveText('A-07');
 const saved=await savedDocument(page);expect(saved.schemaVersion).toBe(5);expect(saved.pages[0].chrome).toMatchObject({header:{text:'АЛАБУГА / Проект <2026>'},number:{value:'A-07',position:'center',background:'white',color:'ink'}});
 await page.reload();await expect(page.locator('#canvas .af-slide--active>.af-eyebrow')).toHaveText('АЛАБУГА / Проект <2026>');await expect(number).toHaveText('A-07');
 const html=await page.evaluate(async doc=>{const {exportHTML}=await import('/apps/editor/src/export.ts' as string);return exportHTML(doc)},saved);
 await page.route('**/*',route=>route.abort());await page.setContent(html);await expect(page.locator('.af-slide--active>.af-eyebrow')).toHaveText('АЛАБУГА / Проект <2026>');await expect(page.locator('.af-slide--active>.af-slide__number')).toHaveText('A-07');await expect(page.locator('.af-slide--active>.af-slide__number')).toHaveAttribute('data-position','center');
 await expect(page.locator('.af-slide--active>.af-slide__number')).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(page.locator('.af-slide--active>.af-slide__number')).toHaveCSS('color','rgb(0, 13, 60)');
});

test('outline keeps automatic numbers and title in sync after reorder and rename',async({page})=>{
 await openEditor(page);
 const result=await page.evaluate(async()=>{
  const {createOutline}=await import('/apps/editor/src/outline.ts' as string);
  const host=document.createElement('div');document.body.append(host);
  const doc={schemaVersion:3,kind:'presentation',title:'Исходное название',pages:['first','second','third'].map(id=>({id,title:id,grid:{columns:12,rowHeight:64,gap:16},widgets:[],chrome:{number:{format:'total'}}}))};
  const outline=createOutline(host,()=>{},()=>{},()=>{});outline(doc,0);
  const numbers=()=>[...host.querySelectorAll('.af-slide__number')].map(n=>n.textContent);
  const before=numbers();doc.pages.reverse();doc.title='Новое название';outline(doc,0);
  const after=numbers(),ids=[...host.querySelectorAll('.af-slide')].map(n=>(n as HTMLElement).dataset.sectionId),headers=[...host.querySelectorAll('.af-eyebrow')].map(n=>n.textContent);
  outline.destroy();host.remove();return {before,after,ids,headers};
 });
 expect(result.before).toEqual(['1 / 3','2 / 3','3 / 3']);expect(result.after).toEqual(result.before);expect(result.ids).toEqual(['third','second','first']);expect(result.headers).toEqual(Array(3).fill('АЛАБУГА / Новое название'));
});

test('fitting keeps annotations while checking content on every fixture',async({page})=>{
 test.setTimeout(180000);await openEditor(page);
 const result=await page.evaluate(async()=>{
  const {fitSlide}=await import('/apps/editor/src/framework-adapter.ts' as string),{slideFitFixtures}=await import('/tests/slide-fit-fixtures.ts' as string);
  const failures=[];
  for(const [index,slide] of slideFitFixtures().entries()){
   slide.chrome={header:{visible:false,text:'АЛАБУГА / Проверка'},number:{value:'A-07',position:'center',background:'white',color:'ink'}};
   const fitted=await fitSlide(slide,{index});
   if(!fitted.success||JSON.stringify(fitted.slide.chrome)!==JSON.stringify(slide.chrome))failures.push({index,issues:fitted.issues});
  }
  return failures;
 });
 expect(result).toEqual([]);
});
