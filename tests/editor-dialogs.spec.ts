import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {mockAI} from './ai-helper';
import {chooseOption} from './choose-option';

test.use({reducedMotion:'reduce'});test.setTimeout(60000);
async function aiDraft(page:Page){
 await mockAI(page);await page.goto('/demo/');await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();
 await page.getByLabel('Запрос',{exact:true}).fill('Создай текстовую секцию');await page.getByRole('button',{name:'Создать черновик',exact:true}).click();
 await expect(page.locator('.ai-progress')).toContainText('Черновик готов');
}
async function editor(page:Page){await page.goto('/demo/');await page.getByRole('button',{name:'Настроить элементы',exact:true}).click();await expect(page.locator('#project-name')).toBeVisible()}
async function capture(page:Page,name:string,engine:string){const directory=`artifacts/dialogs/editor/verified/${engine}`;await mkdir(directory,{recursive:true});await page.screenshot({path:`${directory}/${name}.png`})}
async function hittable(control:Locator){
 await expect(control).toBeInViewport();expect(await control.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===node||!!hit&&node.contains(hit)})).toBe(true);
}

test('AI property changes and duplication retain the latest canvas content after reload',async({page})=>{
 await page.setViewportSize({width:1536,height:1000});await aiDraft(page);await page.locator('.ai-elements button').first().click();
 const heading=page.locator('.ai-preview').getByRole('textbox',{name:'Заголовок на странице',exact:true});await heading.first().fill('Сохранённый заголовок');await heading.first().blur();
 await page.getByLabel('Название блока',{exact:true}).fill('Новое имя');await page.getByLabel('Название блока',{exact:true}).blur();await expect(page.locator('.ai-preview')).toContainText('Новое имя');await expect(heading.first()).toHaveText('Сохранённый заголовок');
 await heading.first().fill('Заголовок для копии');await heading.first().blur();await page.getByRole('button',{name:'Дублировать',exact:true}).click();
 await expect(heading).toHaveCount(2);await expect(heading).toHaveText(['Заголовок для копии','Заголовок для копии']);await expect(page.locator('.ai-save')).toHaveText('Черновик сохранён в браузере');
 await page.reload();await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();await expect(heading).toHaveText(['Заголовок для копии','Заголовок для копии']);
});

test('AI compact layout keeps result navigation below the header and actions after properties',async({page},info)=>{
 await page.setViewportSize({width:1536,height:1000});await aiDraft(page);await page.locator('.ai-elements button').first().click();
 for(const [width,height]of [[767,900],[390,844],[844,390],[1440,450]]){
  await page.setViewportSize({width,height});const dialog=page.locator('.ai-dialog');await dialog.evaluate(n=>n.scrollTop=0);
  expect(await page.locator('.ai-workspace').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length)).toBe(1);
  await page.getByRole('button',{name:'К результату и замечаниям',exact:true}).click();await expect(page.locator('.ai-progress')).toBeFocused();
  const header=(await page.locator('.ai-header').boundingBox())!,status=(await page.locator('.ai-progress').boundingBox())!;expect(status.y).toBeGreaterThanOrEqual(header.y+header.height);
  const order=await page.locator('.ai-result').evaluate(n=>({properties:n.querySelector('.ai-properties')!.getBoundingClientRect().bottom,actions:n.querySelector('footer')!.getBoundingClientRect().top}));expect(order.actions-order.properties).toBeGreaterThanOrEqual(15);
  expect(await dialog.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);await capture(page,`ai-${width}x${height}`,info.project.name);
  await page.getByRole('button',{name:'Применить черновик',exact:true}).scrollIntoViewIfNeeded();await hittable(page.getByRole('button',{name:'Применить черновик',exact:true}));await hittable(page.locator('[data-close]'));
 }
});

test('presentation draft reserves its preview size before confirmation is clicked',async({page},info)=>{
 await page.setViewportSize({width:1536,height:1000});await mockAI(page);await page.goto('/demo/');await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();
 await chooseOption(page.getByLabel('Результат',{exact:true}),'presentation');await page.getByLabel('Количество',{exact:true}).fill('6');await page.getByLabel('Исходные сведения',{exact:true}).fill('');await page.getByLabel('Запрос',{exact:true}).fill('Презентация о визуальном конструкторе');await page.getByRole('button',{name:'Создать черновик',exact:true}).click();
 await expect(page.locator('.ai-outline')).toBeVisible();await page.locator('[data-resume]').click();await expect(page.locator('.ai-progress')).toContainText('Черновик готов',{timeout:30000});
 await chooseOption(page.getByLabel('Секция черновика',{exact:true}),'2');await page.getByRole('button',{name:'Повторить секцию',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('Черновик готов',{timeout:30000});
 await page.getByLabel('Содержание и замечания проверены').check();await expect(page.locator('[data-ack]')).toBeChecked();await expect(page.locator('[data-apply]')).toBeEnabled();
 const rect=(await page.locator('.ai-preview').boundingBox())!;expect(Math.abs(rect.height-rect.width*9/16)).toBeLessThan(1);await capture(page,'presentation-confirmation',info.project.name);
 await page.locator('[data-apply]').click();await expect(page.locator('#project-name')).toBeVisible();await expect(page.locator('#canvas .af-slide')).toHaveCount(6);
});

test('slide fitting keeps settings scrollable and full size actions visible in compact windows',async({page},info)=>{
 await page.setViewportSize({width:1536,height:1000});await editor(page);await page.locator('.project-menu summary').click();await page.locator('#demo-deck').click();await page.locator('#page-settings-open').click();await page.getByRole('button',{name:'Подобрать оформление',exact:true}).click();
 const dialog=page.locator('.fit-dialog'),accept=dialog.getByRole('button',{name:'Применить оформление',exact:true});await expect(accept).toBeEnabled({timeout:30000});
 for(const [width,height]of [[1536,1000],[390,844],[844,390]]){
  await page.setViewportSize({width,height});await expect(dialog.locator('.fit-body')).toBeVisible();await dialog.locator('.fit-body').evaluate(n=>n.scrollTop=n.scrollHeight);
  const actions=dialog.locator('.fit-actions');await hittable(accept);await hittable(dialog.getByRole('button',{name:'Рассчитать оформление',exact:true}));await hittable(dialog.getByRole('button',{name:'Закрыть',exact:true}));
  const edges=await dialog.evaluate(n=>({header:n.querySelector('header')!.getBoundingClientRect().bottom,body:n.querySelector('.fit-body')!.getBoundingClientRect().toJSON(),actions:n.querySelector('.fit-actions')!.getBoundingClientRect().top}));expect(edges.body.top).toBeGreaterThanOrEqual(edges.header);expect(edges.actions).toBeGreaterThanOrEqual(edges.body.bottom);
  const heights=await actions.locator('.af-btn:visible').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));expect(Math.min(...heights)).toBeGreaterThanOrEqual(40);expect(Math.max(...heights)-Math.min(...heights)).toBeLessThan(1);expect(await dialog.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);await capture(page,`slide-fit-${width}`,info.project.name);
 }
 await accept.click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Подобрать оформление',exact:true})).toBeFocused();
});

test('layout chooser uses the shared heading and close row on desktop and phone',async({page},info)=>{
 await editor(page);await page.locator('#page-settings-open').click();await page.getByRole('button',{name:'Изменить компоновку',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Компоновка текущего содержания',exact:true});
 for(const [width,height]of [[1536,1000],[390,844],[844,390]]){
  await page.setViewportSize({width,height});await dialog.evaluate(n=>n.scrollTop=0);const header=dialog.locator('.af-dialog__header'),title=header.locator('h2'),close=header.getByRole('button',{name:'Закрыть',exact:true});await hittable(close);
  const t=(await title.boundingBox())!,c=(await close.boundingBox())!;expect(Math.abs(t.y+t.height/2-c.y-c.height/2)).toBeLessThan(1);expect(t.x+t.width).toBeLessThan(c.x);await capture(page,`layout-${width}`,info.project.name);
 }
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
