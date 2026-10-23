import {chooseOption} from './choose-option';
import {settledProperties,openGeometry} from './property-helper';
import {openEditor} from './open-editor';
import {savedDocument} from './project-helper';
import {test,expect} from '@playwright/test';
const doc=savedDocument;
test.beforeEach(async({page})=>{await openEditor(page);await page.locator('.project-menu summary').click();await page.locator('#new-page').click();await page.locator('#add-widget').click();await page.locator('[data-add=text]').click();await page.locator('#canvas .af-widget').hover();await page.getByRole('button',{name:'Настройки блока',exact:true}).click()});
test('autosave finishes after blur, unchanged events and apply',async({page})=>{
 const title=page.getByLabel('Название блока',{exact:true});await title.fill('Автосохранение');await expect.poll(async()=>(await doc(page)).pages[0].widgets[0].title).toBe('Автосохранение');await title.blur();await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');
 await chooseOption(page.getByLabel('Новый фрагмент',{exact:true}),'heading');await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');await settledProperties(page);await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');await page.locator('#close-inspector').click();await expect(page.locator('#inspector')).not.toBeVisible();
});
test('invalid native input ends pending and can be corrected or discarded',async({page})=>{
 await openGeometry(page);const width=page.getByLabel('Ширина',{exact:true});await width.fill('0');await expect(page.locator('#save-state')).toContainText('Изменения не применены');await expect(page.locator('#status')).toContainText('Ширина');expect((await doc(page)).pages[0].widgets[0].position.width).toBe(4);
 await settledProperties(page);await expect(page.locator('#save-state')).not.toContainText('Проверяем');await width.fill('3');await expect.poll(async()=>(await doc(page)).pages[0].widgets[0].position.width).toBe(3);await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');
 await width.fill('');await expect(page.locator('#save-state')).toContainText('Изменения не применены');await page.getByRole('button',{name:'Сбросить неприменённые изменения',exact:true}).click();await expect(width).toHaveValue('3');await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');await page.locator('#close-inspector').click();await expect(page.locator('#inspector')).not.toBeVisible();
});
test('schema rejection ends pending and reverting to saved value clears error',async({page})=>{
 await openGeometry(page);const width=page.getByLabel('Ширина',{exact:true});await width.fill('13');await expect(page.locator('#save-state')).toContainText('Изменения не применены');await expect(page.locator('#status')).toContainText('границы');expect((await doc(page)).pages[0].widgets[0].position.width).toBe(4);
 await width.fill('4');await width.blur();await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');await expect(page.locator('#status')).toHaveText('Сохранено.');
});
