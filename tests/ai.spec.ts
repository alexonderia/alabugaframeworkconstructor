import {openTools} from './property-helper';
import {} from './property-helper';
import {openEditor} from './open-editor';
import {test,expect,type Page} from '@playwright/test';
import {fixtureCommands} from './ai-fixtures';
import {savedDocument} from './project-helper';
async function mockAI(page:Page,delay=0){
 await page.route('**/api/ai/readiness',route=>route.fulfill({json:{ready:true}}));
 await page.route('**/api/ai/status',route=>route.fulfill({json:{model:'qwen3.5:2b',version:'test-double',digest:'fixture-only',context:4096}}));
 await page.route('**/api/ai/generate',async route=>{
  if(delay)await new Promise(r=>setTimeout(r,delay));
  const body=route.request().postDataJSON();let data;
  if(body.format.properties.sections){const count=body.format.properties.sections.minItems;const names=['text','features','split','steps','comparison','thesis'];data={title:'История конструктора',sections:Array.from({length:count},(_,i)=>({composition:names[i],title:'Раздел '+(i+1),purpose:body.format.properties.sections.items.properties.purpose.enum?.[0]??'Показать возможности'}))}}
  else{const fields=body.format.properties.content?.properties??body.format.properties.commands.properties,composition=body.format.properties.composition?.const??fields.create.properties.composition.const;data=fixtureCommands(composition,['thesis','divider','final'].includes(composition)?'presentation':'page');for(const command of data.commands){if(command.tool==='setImage')command.asset=fields['slot'+command.slot].properties.asset.enum?.[0]??fields['slot'+command.slot].properties.asset.const;if(command.tool==='setGallery')command.items.forEach(i=>i.asset=fields['slot'+command.slot].properties.items.items.properties.asset.enum?.[0]??fields['slot'+command.slot].properties.items.items.properties.asset.const)}}
  if(data.commands&&body.format.properties.content){data={composition:body.format.properties.composition.const,content:Object.fromEntries(data.commands.filter((c:any)=>c.tool!=='createSection').map(({tool,slot,...value}:any)=>['slot'+slot,value]))}}
  if(data.commands)data={commands:Object.fromEntries(data.commands.map((c:any)=>[c.tool==='createSection'?'create':'slot'+c.slot,c]))};
  await route.fulfill({json:{data}});
 });
}
async function open(page:Page){await openEditor(page);await openTools(page);await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();await expect(page.locator('.ai-dialog')).toBeVisible()}
test('source-backed outline retains long facts in an editable multiline field',async({page})=>{
 await mockAI(page);await open(page);await page.getByLabel('Результат',{exact:true}).selectOption('page');await page.getByLabel('Количество',{exact:true}).fill('1');await page.getByLabel('Запрос',{exact:true}).fill('Создай страницу об инструментах');
 const source='Автор выбирает композицию и редактирует содержание на холсте, меняет расположение элементов в сетке, загружает изображения, проверяет результат в предпросмотре, сохраняет проект и экспортирует готовый документ в HTML';
 await page.getByLabel('Исходные сведения',{exact:true}).fill(source);await page.getByRole('button',{name:'Создать черновик',exact:true}).click();const field=page.getByLabel('purpose 1',{exact:true});await expect(field).toHaveValue(source);expect(await field.evaluate(n=>n.tagName)).toBe('TEXTAREA');await field.fill(source+' без изменения оригинала');await field.blur();await page.locator('[data-resume]').click();await expect(page.locator('.ai-progress')).toContainText('Черновик готов');
});
async function generate(page:Page,target='section',count=1){await page.getByLabel('Результат',{exact:true}).selectOption(target);if(count>1)await page.getByLabel('Количество',{exact:true}).fill(String(count));await page.getByLabel('Запрос',{exact:true}).fill('Расскажи о визуальном конструкторе сайтов и презентаций');await page.getByRole('button',{name:'Создать черновик',exact:true}).click();if(count>1){await expect(page.locator('.ai-outline')).toBeVisible();await page.locator('[data-resume]').click();}await expect(page.locator('.ai-progress')).toContainText('Черновик готов',{timeout:30000});}
test('AI draft is isolated, editable, restored, applied once and undone',async({page},info)=>{
 await mockAI(page);await open(page);const before=await savedDocument(page);await generate(page);expect(await savedDocument(page)).toEqual(before);
 const heading=page.locator('.ai-preview [contenteditable]').first();await heading.fill('Новая история');await heading.blur();await expect(page.locator('.ai-save')).toHaveText('Черновик сохранён в браузере');
 await page.reload();await page.getByRole('button',{name:'Создать с ИИ',exact:true}).click();await expect(page.locator('.ai-preview')).toContainText('Новая история');
 await page.getByLabel('Экран черновика',{exact:true}).selectOption('390');await expect(page.locator('.ai-preview')).toHaveCSS('max-width','390px');
 await info.attach('ai-draft.png',{body:await page.screenshot(),contentType:'image/png'});
 await page.getByLabel('Содержание и замечания проверены').check();await page.getByRole('button',{name:'Применить черновик',exact:true}).click();await expect(page.locator('.ai-dialog')).toHaveCount(0);
 await expect.poll(async()=>(await savedDocument(page)).pages.length).toBe(before.pages.length+1);await page.locator('#undo').click();await expect.poll(async()=>(await savedDocument(page)).pages.length).toBe(before.pages.length);
});
test('full page creates a separate project and keeps prior project',async({page})=>{
 await mockAI(page);await open(page);const before=await savedDocument(page);await generate(page,'page',5);await page.getByLabel('Содержание и замечания проверены').check();await page.getByRole('button',{name:'Применить черновик',exact:true}).click();await expect(page.locator('.ai-dialog')).toHaveCount(0);await expect.poll(async()=>(await savedDocument(page)).pages.length).toBe(5);
 const titles=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('alabuga-workspace');r.onsuccess=()=>resolve(r.result)});return new Promise<string[]>(resolve=>{const r=db.transaction('projects').objectStore('projects').getAll();r.onsuccess=()=>{resolve(r.result.map(p=>p.title));db.close()}})});expect(titles).toContain(before.title);expect(titles).toContain('История конструктора');
});
test('six slide draft, repeat and standalone HTML export',async({page})=>{
 await mockAI(page);await open(page);await generate(page,'presentation',6);await page.getByLabel('Секция черновика',{exact:true}).selectOption('2');await page.getByRole('button',{name:'Повторить секцию',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('Черновик готов',{timeout:30000});await page.getByLabel('Содержание и замечания проверены').check();await page.getByRole('button',{name:'Применить черновик',exact:true}).click();await expect(page.locator('.ai-dialog')).toHaveCount(0);await expect(page.locator('#canvas .af-slide')).toHaveCount(6);
 const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toBe('История конструктора.html');
});
test('unavailable model and invalid commands leave project untouched',async({page})=>{
 await mockAI(page);await page.route('**/api/ai/status',r=>r.fulfill({status:503,json:{error:'Модель отсутствует. Выполните npm run ai:setup.'}}));await open(page);const before=await savedDocument(page);await page.getByLabel('Запрос',{exact:true}).fill('Создай слайд');await page.getByRole('button',{name:'Создать черновик',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('Модель отсутствует');expect(await savedDocument(page)).toEqual(before);await expect(page.locator('[data-apply]')).toBeDisabled();
 await page.unroute('**/api/ai/status');await mockAI(page);await page.route('**/api/ai/generate',r=>r.fulfill({json:{data:{commands:[{tool:'eval',code:'alert(1)'}]}}}));await page.getByRole('button',{name:'Создать черновик',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('некорректную структуру');expect(await savedDocument(page)).toEqual(before);
});
test('cancel during request recovers controls and saves resumable state',async({page})=>{
 await mockAI(page,1000);await open(page);await page.getByLabel('Запрос',{exact:true}).fill('Создай секцию');await page.getByRole('button',{name:'Создать черновик',exact:true}).click();await expect(page.getByRole('button',{name:'Остановить',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('отменена');await expect(page.getByRole('button',{name:'Продолжить',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Продолжить',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('Черновик готов');
});
test('narrow viewport and reduced motion retain keyboard access',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await mockAI(page);await open(page);await generate(page);await page.getByLabel('Содержание и замечания проверены').check();const apply=page.getByRole('button',{name:'Применить черновик',exact:true});await apply.focus();await page.keyboard.press('Enter');await expect(page.locator('.ai-dialog')).toHaveCount(0);
});
test('placeholder text requires repair or an explicit manual correction',async({page})=>{
 await mockAI(page);await page.route('**/api/ai/generate',async route=>{
  const body=route.request().postDataJSON();if(body.format.properties.sections){await route.fallback();return}
  const commands=fixtureCommands('text','page','Короткий заголовок').commands;
  await route.fulfill({json:{data:{composition:'text',content:Object.fromEntries(commands.filter(c=>c.tool!=='createSection').map(({tool,slot,...value}:any)=>['slot'+slot,value]))}}});
 });
 await open(page);await page.getByLabel('Запрос',{exact:true}).fill('Создай текстовую секцию');await page.getByRole('button',{name:'Создать черновик',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('требуют исправления');await expect(page.locator('[data-apply]')).toBeDisabled();
 const heading=page.locator('.ai-preview [contenteditable]').first();await heading.fill('Проекты в браузере');await heading.blur();await page.getByRole('button',{name:'Проверить черновик',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('Проверка пройдена');await page.getByLabel('Содержание и замечания проверены').check();await expect(page.locator('[data-apply]')).toBeEnabled();
});
test('checking an edited draft cannot clear a missing command or an unsupported numerical claim',async({page})=>{
 await mockAI(page);await page.route('**/api/ai/generate',async route=>{
  const body=route.request().postDataJSON();if(body.format.properties.sections){await route.fallback();return}
  await route.fulfill({json:{data:{composition:'text',content:{slot0:{heading:'Просмотр',sourceId:'F1'}}}}});
 });
 await open(page);await page.getByLabel('Запрос',{exact:true}).fill('Создай текстовую секцию: как просмотреть сайт?');await page.getByLabel('Исходные сведения',{exact:true}).fill('Чтобы просмотреть сайт, нажмите «Предпросмотр» и выберите «Телефон».');
 await page.getByRole('button',{name:'Создать черновик',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('Черновик готов');
 const paragraph=page.locator('.ai-preview [contenteditable]').nth(1);await paragraph.fill('Нажмите «Предпросмотр»: доступно 99 экранов.');await paragraph.blur();
 await page.getByRole('button',{name:'Проверить черновик',exact:true}).click();await expect(page.locator('.ai-issues')).toContainText('Телефон');await expect(page.locator('.ai-issues')).toContainText('99');await page.getByLabel('Содержание и замечания проверены').check();await expect(page.locator('[data-apply]')).toBeDisabled();
 await paragraph.fill('Нажмите «Предпросмотр» и выберите «Телефон».');await paragraph.blur();await page.getByRole('button',{name:'Проверить черновик',exact:true}).click();await expect(page.locator('.ai-progress')).toContainText('Проверка пройдена');await page.getByLabel('Содержание и замечания проверены').check();await expect(page.locator('[data-apply]')).toBeEnabled();
});
test('overflow after a manual heading edit is visible and draft fitting preserves the edit',async({page})=>{
 await mockAI(page);await page.route('**/api/ai/generate',async route=>{
  const body=route.request().postDataJSON();if(!body.format.properties.sections){await route.fallback();return}
  await route.fulfill({json:{data:{title:'Возможности',sections:[{composition:'features',title:'Возможности',purpose:'Описание функций'}]}}});
 });
 await open(page);const before=await savedDocument(page);await generate(page,'slide');
 const text='Изображения, проекты и экспорт в одном визуальном конструкторе';await page.locator('.ai-preview [contenteditable]').first().fill(text);await page.locator('.ai-preview [contenteditable]').first().blur();
 await page.locator('.ai-dialog [data-check]').click();await expect(page.locator('.ai-progress')).toContainText('Исправьте замечания');await expect(page.getByRole('region',{name:'Замечания к черновику'})).toBeFocused();await expect(page.locator('[data-apply]')).toBeDisabled();
 await page.locator('.ai-dialog [data-fit]').click();await expect(page.locator('.ai-progress')).toContainText('Оформление подобрано',{timeout:30000});await expect(page.locator('.ai-preview')).toContainText(text);expect(await savedDocument(page)).toEqual(before);
 await page.getByLabel('Содержание и замечания проверены').check();await expect(page.locator('[data-apply]')).toBeEnabled();
});
