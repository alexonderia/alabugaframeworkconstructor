import {test,expect,type Page} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {chooseOption} from './choose-option';

async function openProject(page:Page){
 await page.goto('/builder/');await expect(page.locator('.library-tools')).toBeVisible();
 await page.locator('.product-header input[type=file]').setInputFiles({name:'framework-ui.json',mimeType:'application/json',buffer:await readFile(new URL('./fixtures/audit-links.json',import.meta.url))});
 await expect(page.locator('#project-name')).toBeVisible();
}
async function expectFrameworkControls(page:Page){
 const missing=await page.evaluate(()=>[...document.querySelectorAll('button,input,select,textarea,summary,dialog')].filter(node=>{
  if(node.closest('.af-document--page,.af-document--presentation'))return false;
  const classes=node.classList;
  if(node instanceof HTMLInputElement)return !classes.contains(node.type==='checkbox'?'af-checkbox':node.type==='radio'?'af-radio':'af-input');
  if(node instanceof HTMLSelectElement)return !classes.contains('af-select')||!classes.contains('af-select--enhanced');
  if(node instanceof HTMLTextAreaElement)return !classes.contains('af-textarea');
  if(node instanceof HTMLDialogElement)return !classes.contains('af-dialog');
  return !classes.contains('af-btn')&&!classes.contains('af-select__control');
 }).map(node=>node.outerHTML.slice(0,240)));
 expect(missing).toEqual([]);
}
async function capture(page:Page,name:string,engine:string){
 const directory=`artifacts/framework-components-2026-10-23/${engine}`;await mkdir(directory,{recursive:true});await page.screenshot({path:`${directory}/${name}.png`});
}

test('project cards, menus, badges and creation choices use public components',async({page},info)=>{
 await openProject(page);await page.getByRole('button',{name:'← Проекты',exact:true}).click();
 const card=page.locator('.project-card');await expect(card).toHaveClass(/af-card af-card--inner/);
 await expect(page.locator('.section-count').first()).toHaveClass(/af-badge/);
 await page.evaluate(()=>document.documentElement.style.setProperty('--af-space-16','18px'));
 await expect(card).toHaveCSS('padding-top','18px');
 await chooseOption(page.getByRole('combobox',{name:'Сортировка проектов'}),'title');
 await page.locator('.card-menu>summary').click();await expect(page.locator('.card-menu>div')).toHaveClass(/af-card/);await expectFrameworkControls(page);
 await page.locator('.card-menu>summary').click();await capture(page,'gallery',info.project.name);
 await page.getByRole('button',{name:'Создать сайт',exact:false}).click();
 const choices=page.locator('.creation-methods');await expect(choices.locator('.af-check>.af-radio')).toHaveCount(3);
 await choices.getByRole('radio').first().focus();await page.keyboard.press('ArrowDown');await expect(choices.locator('[value=example]')).toBeChecked();
 await expectFrameworkControls(page);await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
 await expect(card).toHaveCount(1);
});

test('editor disclosures, dynamic select options and tutorial keep Framework styles',async({page},info)=>{
 await openProject(page);
 const picker=page.getByRole('combobox',{name:'Выбрать секцию или слайд',exact:true});await picker.focus();await page.keyboard.press('End');await page.keyboard.press('Enter');
 await expect(page.locator('#pages')).toHaveValue('1');
 await page.locator('#page-settings-open').click();await expectFrameworkControls(page);
 const group=page.locator('#inspector summary').first();await expect(group).toHaveClass(/af-btn/);await expect(group).toHaveCSS('font-size','14px');
 await page.locator('#close-inspector').click();await page.locator('.project-menu>summary').click();await page.getByRole('button',{name:'Пять действий для знакомства',exact:true}).click();
 const tutorial=page.locator('.author-tutorial');await expect(tutorial).toHaveAttribute('open','');await expect(tutorial.locator(':scope>.af-card')).toBeVisible();
 const check=tutorial.getByRole('checkbox').first();await expect(check).toHaveClass(/af-checkbox/);await expect(check).toHaveCSS('appearance','none');await check.check();
 await page.reload();await expect(page.locator('.author-tutorial').getByRole('checkbox').first()).toBeChecked();
 await expectFrameworkControls(page);await capture(page,'tutorial',info.project.name);
});

test('AI upload, material selection and storage cleanup share Framework fields and checks',async({page},info)=>{
 await page.route('**/api/ai/readiness',route=>route.fulfill({json:{ready:false,stage:'unavailable',message:'Нет модели'}}));
 await openProject(page);await page.locator('.project-menu>summary').click();await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();
 const dialog=page.locator('.ai-dialog');await dialog.locator('summary').click();await expect(dialog.locator('input[type=file]')).toHaveClass(/af-input/);
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;canvas.getContext('2d')!.fillRect(0,0,2,2);return canvas.toDataURL('image/png').split(',')[1]});
 const upload=dialog.locator('input[type=file]');await expect(upload).toBeEnabled();await upload.setInputFiles({name:'framework-check.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 const material=dialog.locator('.ai-material [data-material^="asset:"]');await expect(material).toBeVisible();await material.check();await expect(material).toBeChecked();await material.uncheck();await expect(material).toHaveCSS('appearance','none');
 await expectFrameworkControls(page);await capture(page,'ai-materials',info.project.name);await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();
 if(!await page.locator('.project-menu').evaluate(n=>(n as HTMLDetailsElement).open))await page.locator('.project-menu>summary').click();
 await page.getByRole('button',{name:'Хранилище и материалы',exact:true}).click();const storage=page.getByRole('dialog',{name:'Хранилище и материалы',exact:true}),check=storage.getByRole('checkbox');
 await expect(check).toHaveCount(1);await expect(check).toHaveClass(/af-checkbox/);await expect(check.locator('..')).toHaveClass(/af-check/);
 await expectFrameworkControls(page);await check.check();await storage.getByRole('button',{name:'Удалить выбранные',exact:true}).click();await expect(check).toHaveCount(0);
});

test('presentation fitting options use Framework checkboxes and disclosures',async({page},info)=>{
 await page.goto('/builder/');await page.getByRole('button',{name:'Создать презентацию',exact:false}).click();
 await page.getByRole('radio',{name:'Из образца',exact:false}).check();await page.getByRole('dialog').getByRole('button',{name:'Продолжить',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible();
 await page.locator('#page-settings-open').click();await page.getByRole('button',{name:'Подобрать оформление',exact:true}).click();
 const dialog=page.locator('.fit-dialog');await expect(dialog.locator('.af-check>.af-checkbox')).toHaveCount(3);await expectFrameworkControls(page);
 await dialog.getByRole('checkbox',{name:'Сохранить фон',exact:true}).check();await expect(dialog.getByRole('status')).toHaveText('Настройки изменены. Запустите подбор.');
 await capture(page,'slide-fitting',info.project.name);await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(dialog).toHaveCount(0);
});
