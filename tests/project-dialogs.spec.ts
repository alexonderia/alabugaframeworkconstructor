import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {makeComposition} from '@alabuga/framework/compositions';
import axe from 'axe-core';
import {savedDocument} from './project-helper';

test.use({reducedMotion:'reduce',screenshot:'only-on-failure'});test.setTimeout(60000);
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const messages:string[]=[];errors.set(page,messages);page.on('pageerror',e=>messages.push(e.message))});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
const title='ДлинноеНазваниеПроектаБезПробелов'.repeat(6).slice(0,200);
async function project(page:Page,semantic=false){
 const doc=semantic?{schemaVersion:3,kind:'page',title,pages:[makeComposition('hero','page')]}:JSON.parse(await readFile(new URL('./fixtures/audit-links.json',import.meta.url),'utf8'));doc.title=title;
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();
 await page.locator('.product-header input[type=file]').setInputFiles({name:'project-dialogs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 await expect(page.locator('#project-name')).toHaveValue(title);
}
async function gallery(page:Page){await project(page);await page.getByRole('button',{name:'← Проекты',exact:true}).click();await expect(page.locator('.project-card')).toHaveCount(1)}
async function hit(control:Locator){
 await expect(control).toBeInViewport();expect(await control.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true);
}
async function layout(page:Page,dialog:Locator,name:string,engine:string){
 const directory=`artifacts/dialogs/projects/verified/${engine}`;await mkdir(directory,{recursive:true});
 for(const [width,height]of [[1536,1000],[390,844],[320,568],[844,390]]){
  await page.setViewportSize({width,height});
  for(const spaced of [false,true]){
   if(spaced&&width!==320&&width!==844)continue;
   const style=spaced?await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'}):undefined;
   const body=dialog.locator('.library-dialog-body');let initialY=0;
   for(const end of [false,true]){
    await body.evaluate((n,end)=>n.scrollTop=end?n.scrollHeight:0,end);
    const sample=await dialog.evaluate(n=>{
     const body=n.querySelector<HTMLElement>('.library-dialog-body')!,header=n.querySelector('header')!,actions=n.querySelector('.library-dialog-actions');
     const controls=[...header.querySelectorAll('button'),...actions?.querySelectorAll('button')??[]];
     return {dialog:n.getBoundingClientRect().toJSON(),header:header.getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON(),actions:actions?.getBoundingClientRect().toJSON(),overflow:Math.max(n.scrollWidth-n.clientWidth,body.scrollWidth-body.clientWidth),labelsFit:[...n.querySelectorAll('button')].every(button=>button.scrollWidth<=button.clientWidth+1),hittable:controls.every(button=>{const r=button.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight&&button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})};
    });
    if(!end)initialY=sample.header.y;
    expect(sample.header.y).toBeCloseTo(initialY,0);expect(sample.header.y).toBeGreaterThanOrEqual(sample.dialog.y);expect(sample.header.bottom).toBeLessThanOrEqual(sample.body.y+1);expect(sample.body.height).toBeGreaterThan(30);
    expect(sample.overflow,`${name} ${width}x${height} spaced=${spaced}`).toBeLessThanOrEqual(1);expect(sample.hittable).toBe(true);
    expect(sample.labelsFit,`${name} ${width}x${height} spaced=${spaced}`).toBe(true);
    if(sample.actions)expect(sample.actions.y).toBeGreaterThanOrEqual(sample.body.bottom-1);
   }
   if(!spaced)await page.screenshot({path:`${directory}/${name}-${width}x${height}.png`});
   if(style)await style.evaluate(n=>(n as Element).remove());
  }
 }
 await page.evaluate(axe.source);expect(await dialog.evaluate(async n=>(await (window as any).axe.run(n)).violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)})))).toEqual([]);
}

test('creation keeps its actions visible and submits both project formats with Enter',async({page},info)=>{
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();
 for(const [kind,label]of [['page','Создать сайт'],['presentation','Создать презентацию']]){
  const opener=page.getByRole('button',{name:label,exact:false});await opener.click();const dialog=page.getByRole('dialog',{name:label,exact:true});
  await layout(page,dialog,'create-'+kind,info.project.name);await page.keyboard.press('Escape');await expect(opener).toBeFocused();
  await opener.press('Enter');const name=page.getByRole('dialog').getByRole('textbox',{name:'Название проекта',exact:true});await name.fill('Создано с клавиатуры '+kind);await name.press('Enter');
  await expect(page.locator('#project-name')).toHaveValue('Создано с клавиатуры '+kind);expect((await savedDocument(page)).kind).toBe(kind);
  await page.getByRole('button',{name:'← Проекты',exact:true}).click();
 }
 await expect(page.locator('.project-card')).toHaveCount(2);
});

test('rename returns focus after cancellation validation errors and successful refresh',async({page},info)=>{
 await gallery(page);let menu=page.locator('.card-menu>summary');await menu.click();await page.getByRole('button',{name:'Переименовать',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Переименовать проект',exact:true});await layout(page,dialog,'rename',info.project.name);
 await page.keyboard.press('Escape');await expect(menu).toBeFocused();await menu.press('Enter');await page.getByRole('button',{name:'Переименовать',exact:true}).click();
 dialog=page.getByRole('dialog',{name:'Переименовать проект',exact:true});const name=dialog.getByRole('textbox',{name:'Название проекта',exact:true});
 await name.fill('   ');await name.press('Enter');await expect(dialog.getByRole('alert')).toContainText('Название должно содержать');await expect(page.locator('.project-card h3')).toHaveText(title);
 await name.fill('Новое название');await name.press('Enter');await expect(dialog).toHaveCount(0);await expect(page.locator('.project-card h3')).toHaveText('Новое название');
 menu=page.locator('.card-menu>summary');await expect(menu).toBeFocused();await page.reload();await expect(page.locator('.project-card h3')).toHaveText('Новое название');
});

test('workspace help scrolls without clipping its heading or losing keyboard focus',async({page},info)=>{
 await page.goto('/builder/');const opener=page.getByRole('button',{name:'Помощь',exact:true});await opener.click();const dialog=page.getByRole('dialog',{name:'Ваше рабочее пространство',exact:true});
 await layout(page,dialog,'help',info.project.name);await dialog.getByRole('link',{name:'Документация',exact:true}).scrollIntoViewIfNeeded();await hit(dialog.getByRole('link',{name:'Документация',exact:true}));
 await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(opener).toBeFocused();
});

test('deletion keeps both choices visible and cancel preserves the project',async({page},info)=>{
 await gallery(page);await page.locator('.card-menu>summary').click();await page.getByRole('button',{name:'В корзину',exact:true}).click();await page.getByRole('button',{name:'Корзина',exact:true}).click();
 const opener=page.getByRole('button',{name:'Удалить навсегда',exact:true});await opener.click();const dialog=page.getByRole('dialog',{name:'Удалить проект?',exact:true});
 await layout(page,dialog,'delete',info.project.name);await expect(dialog).toContainText(title);await dialog.getByRole('button',{name:'Отмена',exact:true}).click();await expect(page.locator('.project-card')).toHaveCount(1);await expect(opener).toBeFocused();
 await opener.click();await page.getByRole('dialog').getByRole('button',{name:'Удалить навсегда',exact:true}).click();await expect(page.locator('.project-card')).toHaveCount(0);
});

test('startup errors remain visible while gallery undo notices never carry into the editor',async({page})=>{
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('alabuga.builder.document.v1','{'));await page.reload();await expect(page.locator('.library-tools')).toBeVisible();
 await expect(page.locator('.product-toast')).toContainText('Не удалось загрузить сохранённые проекты');await page.evaluate(()=>localStorage.removeItem('alabuga.builder.document.v1'));
 await page.setViewportSize({width:844,height:390});await gallery(page);await page.locator('.card-menu>summary').click();await page.getByRole('button',{name:'В корзину',exact:true}).click();await expect(page.locator('.product-toast')).toContainText('перемещён в корзину');
 await page.getByRole('button',{name:'Корзина',exact:true}).click();await expect(page.locator('.project-card')).toHaveCount(1);await expect(page.locator('.product-toast')).toHaveCount(0);
 await page.getByRole('button',{name:'Восстановить',exact:true}).click();await page.getByRole('button',{name:'← Все проекты',exact:true}).click();await page.getByRole('button',{name:'Редактировать',exact:true}).click();
 await expect(page.locator('#project-name')).toHaveValue(title);await expect(page.locator('.product-toast')).toHaveCount(0);await hit(page.locator('#page-settings-open'));await page.locator('#page-settings-open').click();await expect(page.locator('#inspector')).toBeVisible();
});

test('composition chooser keeps closing accessible and applies a compatible change with undo',async({page},info)=>{
 await project(page,true);const before=await savedDocument(page);await page.locator('#page-settings-open').click();const opener=page.getByRole('button',{name:'Выбрать композицию визуально',exact:true});await opener.click();
 const dialog=page.getByRole('dialog',{name:'Композиции и совместимость',exact:true});await layout(page,dialog,'compositions',info.project.name);
 await expect(dialog.getByRole('button',{name:'Шапка',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Призыв к действию',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
 const after=await savedDocument(page);expect(after.pages[0].composition).toBe('cta');expect(after.pages[0].widgets.map((w:any)=>w.id)).toEqual(before.pages[0].widgets.map((w:any)=>w.id));
 await page.locator('#close-inspector').click();await page.locator('#undo').click();expect((await savedDocument(page)).pages[0]).toEqual(before.pages[0]);
});

test('layout chooser scrolls below its heading and preserves content when applying a layout',async({page},info)=>{
 await project(page,true);const before=await savedDocument(page);await page.locator('#page-settings-open').click();const opener=page.getByRole('button',{name:'Изменить компоновку',exact:true});await opener.click();
 const dialog=page.getByRole('dialog',{name:'Компоновка текущего содержания',exact:true});await layout(page,dialog,'layout',info.project.name);
 const apply=dialog.getByRole('button',{name:'Применить: Вертикально / сверху',exact:true});await expect(apply).toBeEnabled();await apply.click();await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
 const after=await savedDocument(page);expect(after.pages[0].layoutVariant).toBe('stacked');expect(after.pages[0].widgets.map((w:any)=>w.id)).toEqual(before.pages[0].widgets.map((w:any)=>w.id));
 expect(after.pages[0].widgets[0].content).toEqual(before.pages[0].widgets[0].content);await page.locator('#close-inspector').click();await page.locator('#undo').click();expect((await savedDocument(page)).pages[0]).toEqual(before.pages[0]);
});
