import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import axe from 'axe-core';
import {chooseOption} from './choose-option';
import {savedDocument} from './project-helper';

test.use({reducedMotion:'reduce'});
test.setTimeout(60000);

async function openProject(page:Page){
 const doc=JSON.parse(await readFile(new URL('./fixtures/audit-links.json',import.meta.url),'utf8'));doc.title='Моя страница';
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();
 await page.locator('.product-header input[type=file]').setInputFiles({name:'dialog-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 await expect(page.locator('#project-name')).toHaveValue(doc.title);
}

async function menuAction(page:Page,name:string){
 if(!await page.locator('.project-menu').evaluate(n=>(n as HTMLDetailsElement).open))await page.locator('.project-menu>summary').click();
 await page.getByRole('button',{name,exact:true}).click();
}
async function hittable(control:Locator){
 await expect(control).toBeInViewport();
 expect(await control.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true);
}
async function checkLayout(page:Page,dialog:Locator,name:string,engine:string){
 const directory=`artifacts/library-dialogs-2026-10-26/verified/${engine}`;await mkdir(directory,{recursive:true});
 for(const [width,height]of [[1536,1000],[390,844],[320,568],[844,390]]){
  await page.setViewportSize({width,height});
  const body=dialog.locator('.library-dialog-body'),header=dialog.locator('.af-dialog__header'),close=dialog.getByRole('button',{name:'Закрыть',exact:true});
  const initial=(await header.boundingBox())!;
  for(const end of [false,true]){
   await body.evaluate((n,end)=>n.scrollTop=end?n.scrollHeight:0,end);
   await hittable(close);
   const head=(await header.boundingBox())!,content=(await body.boundingBox())!;
   expect(head.y).toBeCloseTo(initial.y,0);expect(head.y+head.height).toBeLessThanOrEqual(content.y+1);
   expect(content.height).toBeGreaterThan(30);
   for(const region of [dialog,body])expect(await region.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
   const actions=dialog.locator('.library-dialog-actions');
   if(await actions.count()){expect((await actions.boundingBox())!.y).toBeGreaterThanOrEqual(content.y+content.height-1);await hittable(actions.getByRole('button').first())}
  }
  await page.screenshot({path:`${directory}/${name}-${width}x${height}.png`});
 }
 await page.evaluate(axe.source);
 expect(await dialog.evaluate(async n=>(await (window as any).axe.run(n)).violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)})))).toEqual([]);
}
async function seedMaterials(page:Page){
 return page.evaluate(async()=>{
  // Install fixture data without importing development-only modules; Docker uses this suite too.
  const assets:{id:string;data:string;description:string}[]=[];
  for(let i=0;i<24;i++){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
   const ctx=canvas.getContext('2d')!;ctx.fillStyle=`rgb(${i*10},10,20)`;ctx.fillRect(0,0,2,2);
   const data=canvas.toDataURL(),id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),b=>b.toString(16).padStart(2,'0')).join('');
   assets.push({id,data,description:i?'Материал '+i:'ОченьДлинноеНазваниеБезПробелов'.repeat(6)});
  }
  return new Promise<{ids:string[];total:number}>((resolve,reject)=>{
   const request=indexedDB.open('alabuga-workspace',3);request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{const db=request.result,tx=db.transaction(['assets','settings'],'readwrite');
    for(const {id,data,description}of assets){tx.objectStore('assets').put({id,data});tx.objectStore('settings').put({id:'asset-description:'+id,value:description})}
    const count=tx.objectStore('assets').count();tx.oncomplete=()=>{db.close();resolve({ids:assets.map(a=>a.id),total:count.result})};tx.onabort=()=>{db.close();reject(tx.error)};
   };
  });
 });
}

test('storage keeps close and deletion visible with long names and many materials',async({page},info)=>{
 await openProject(page);const {ids,total}=await seedMaterials(page);await menuAction(page,'Хранилище и материалы');
 const dialog=page.getByRole('dialog',{name:'Хранилище и материалы',exact:true});await expect(dialog.locator('.storage-asset')).toHaveCount(total);
 const remove=dialog.getByRole('button',{name:'Удалить выбранные',exact:true});await expect(remove).toBeDisabled();
 await checkLayout(page,dialog,'storage',info.project.name);
 const selected=dialog.locator(`input[value="${ids[0]}"]`);await selected.check();await expect(remove).toBeEnabled();await remove.click();
 await expect(selected).toHaveCount(0);await expect(dialog.getByRole('status')).toContainText('Удалено материалов: 1');await expect(remove).toBeDisabled();
 await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.getByRole('button',{name:'Хранилище и материалы',exact:true})).toBeFocused();
 await menuAction(page,'Хранилище и материалы');await expect(page.locator('.storage-asset')).toHaveCount(total-1);
});

test('long history scrolls below its heading and restores a revision with undo',async({page},info)=>{
 await openProject(page);const doc=await savedDocument(page);
 await page.evaluate(doc=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('alabuga-workspace',3);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction(['settings','revisions'],'readwrite'),current=tx.objectStore('settings').get('current');
   current.onsuccess=()=>{for(let i=0;i<20;i++)tx.objectStore('revisions').put({id:'dialog-history-'+i,project:current.result.value,created:Date.now()+i,document:{...doc,title:'Версия '+i}})};
   tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>{db.close();reject(tx.error)};
  };
 }),doc);
 await menuAction(page,'История версий');const dialog=page.getByRole('dialog',{name:'История версий',exact:true});
 await expect(dialog.getByRole('button',{name:/восстановить/})).toHaveCount(20);
 await checkLayout(page,dialog,'history',info.project.name);
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'История версий',exact:true})).toBeFocused();
 await menuAction(page,'История версий');await page.getByRole('dialog').getByRole('button',{name:/восстановить/}).first().click();
 await expect(page.locator('#project-name')).toHaveValue('Версия 19');await page.locator('#undo').click();await expect(page.locator('#project-name')).toHaveValue('Моя страница');
});

test('material library fits long descriptions and preserves selection and inspector focus',async({page},info)=>{
 await openProject(page);const {total}=await seedMaterials(page);await page.locator('#page-settings-open').click();
 const trigger=page.getByRole('button',{name:'Выбрать из библиотеки',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Библиотека материалов',exact:true});await expect(dialog.getByRole('status')).toHaveText('Материалы загружены.');
 await chooseOption(dialog.getByLabel('Категория материалов',{exact:true}),'local');await expect(dialog.locator('.asset-card')).toHaveCount(total);
 await checkLayout(page,dialog,'assets',info.project.name);
 const search=dialog.getByRole('searchbox',{name:'Поиск материалов',exact:true});await search.fill('ОченьДлинноеНазвание');await expect(dialog.locator('.asset-card')).toHaveCount(1);
 const description=dialog.getByRole('textbox',{name:/Описание ОченьДлинноеНазвание/});await description.fill('Фон для приёмки');await description.blur();await expect(dialog.getByRole('status')).toHaveText('Описание сохранено.');
 await search.fill('Фон для приёмки');await expect(dialog.locator('.asset-card')).toHaveCount(1);await dialog.locator('.asset-card').click();
 await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();expect((await savedDocument(page)).pages[0].appearance.background).toMatch(/^asset:/);
 await page.reload();await page.locator('#page-settings-open').click();await page.getByRole('button',{name:'Выбрать из библиотеки',exact:true}).click();
 const reopened=page.getByRole('dialog',{name:'Библиотека материалов',exact:true});await chooseOption(reopened.getByLabel('Категория материалов',{exact:true}),'local');await reopened.getByRole('searchbox').fill('Фон для приёмки');await expect(reopened.locator('.asset-card')).toHaveCount(1);
});

test('quality results keep long URLs readable and navigate to the selected problem',async({page},info)=>{
 await page.route('https://missing.invalid/**',route=>route.abort());await openProject(page);
 const doc={schemaVersion:3,kind:'page',title:'Проверка длинного списка',pages:[{id:'quality-list',title:'Проверка',grid:{columns:12,rowHeight:64,gap:16},widgets:Array.from({length:8},(_,i)=>({id:'broken-'+i,type:'image',title:'Изображение '+i,position:{col:1,row:1+i*3,width:6,height:3},src:'https://missing.invalid/'+('image'.repeat(30))+i+'.png',alt:'Материал '+i,fit:'cover',caption:''}))}]};
 await page.locator('#open').setInputFiles({name:'quality.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.locator('#project-name')).toHaveValue(doc.title);
 await menuAction(page,'Проверка качества');const dialog=page.getByRole('dialog',{name:'Проверка качества',exact:true});
 await expect(dialog.getByRole('status')).toContainText('Найдены замечания');await expect(dialog.locator('.quality-issue')).toHaveCount(16);
 await checkLayout(page,dialog,'quality',info.project.name);
 await dialog.locator('.quality-issue').filter({hasText:'Не удалось загрузить изображение'}).last().getByRole('button').click();
 await expect(dialog).toHaveCount(0);await expect(page.locator('#inspector-title')).toHaveText('Настройки блока');await expect(page.locator('#canvas .is-selected')).toHaveAttribute('data-widget-id','broken-7');
});
