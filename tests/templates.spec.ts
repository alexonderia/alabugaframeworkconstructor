import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { chooseOption } from './choose-option';
import { savedDocument } from './project-helper';

async function corporateProject(page: Page, kind: 'page' | 'presentation') {
  await page.goto('/builder/#/projects');
  await page
    .getByRole('button', {
      name: kind === 'page' ? 'Создать сайт' : 'Создать презентацию',
      exact: true,
    })
    .click();
  await page
    .getByRole('radio', {
      name: kind === 'page' ? /Корпоративный сайт/ : /Корпоративная презентация/,
    })
    .check();
  await expect(page.locator('dialog[open] .composition-thumbnail .af-document')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('#project-name')).toBeVisible();
  await expect(page.locator('#builder')).toHaveAttribute('data-editor-mode', 'standard');
}

test('corporate website safely replaces a composition and recovers data from a portable copy', async ({
  page,
}) => {
  test.slow();
  await corporateProject(page, 'page');
  const before = await savedDocument(page);
  const index = before.pages.findIndex((p: { composition: string }) => p.composition === 'split');
  const editable = page
    .locator('#canvas [data-composition=split]')
    .getByRole('textbox', { name: 'Заголовок на странице', exact: true });
  await editable.fill('История корпоративной команды');
  await editable.blur();
  const original = await savedDocument(page);
  const source = original.pages[index];
  const heading = source.widgets[0],
    picture = source.widgets[1];
  await page.locator(`.outline-select[data-outline-index="${index}"]`).click();
  await page.locator('#page-settings-open').click();
  const grid = page.getByText('Дополнительно: сетка', { exact: true });
  await expect(grid).toBeHidden();
  await chooseOption(page.getByLabel('Режим редактора', { exact: true }), 'advanced');
  await grid.click();
  await expect(page.locator('#columns')).toBeVisible();
  await chooseOption(page.getByLabel('Режим редактора', { exact: true }), 'standard');
  await expect(grid).toBeHidden();
  await chooseOption(page.getByLabel('Режим редактора', { exact: true }), 'advanced');
  await expect(page.locator('#columns')).toBeVisible();
  await chooseOption(page.getByLabel('Режим редактора', { exact: true }), 'standard');
  expect(await savedDocument(page)).toEqual(original);
  await page.getByRole('button', { name: 'Посмотреть шаблоны', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: 'Шаблоны и совместимость' });
  const text = gallery.getByRole('button', { name: 'Текст', exact: true });
  const warning = page.getByRole('dialog', { name: 'Смена композиции' });
  await text.click();
  await warning.getByRole('button', { name: 'Оставить текущую композицию' }).click();
  await expect(warning).toBeHidden();
  expect(await savedDocument(page)).toEqual(original);
  await text.click();
  await warning.getByRole('button', { name: 'Применить и отложить блоки' }).click();
  await expect(gallery).toBeHidden();
  const changed = await savedDocument(page);
  expect(changed.pages[index].widgets[0].id).toBe(heading.id);
  expect(changed.pages[index].widgets[0].content).toEqual(heading.content);
  expect(changed.templateInfo.unplaced[0].widgets[0]).toEqual(picture);
  await page.locator('#undo').click();
  await expect.poll(async () => (await savedDocument(page)).pages[index].composition).toBe('split');
  await page.locator('#redo').click();
  await expect.poll(async () => (await savedDocument(page)).templateInfo.unplaced).toHaveLength(1);
  await page.reload();
  await expect(page.locator('#project-name')).toBeVisible();
  expect((await savedDocument(page)).templateInfo).toEqual(changed.templateInfo);

  const pendingJson = page.waitForEvent('download');
  await page.locator('#save').click();
  const json = await pendingJson;
  const payload = await readFile((await json.path())!);
  await page
    .locator('#open')
    .setInputFiles({ name: 'corporate.json', mimeType: 'application/json', buffer: payload });
  await expect(page.locator('#status')).toContainText('Проект открыт');
  await expect
    .poll(async () => (await savedDocument(page)).templateInfo.unplaced[0].widgets[0].id)
    .toBe(picture.id);
  const pendingHtml = page.waitForEvent('download');
  await page.locator('#export').click();
  const html = await readFile((await (await pendingHtml).path())!, 'utf8');
  expect(html).toContain('<!doctype html>');
  expect(html).not.toContain(picture.id);
  expect(html).not.toContain('templateInfo');
  await page.locator('#page-settings-open').click();
  await page.getByRole('button', { name: 'Разместить в новой секции', exact: true }).click();
  await expect(page.locator(`#canvas [data-widget-id="${picture.id}"]`)).toBeAttached();
  expect((await savedDocument(page)).templateInfo.unplaced).toBeUndefined();
  await page.locator('#close-inspector').click();
  await chooseOption(page.locator('#device'), 'mobile');
  await expect(page.locator('#canvas')).toHaveCSS('width', '390px');
  await page.locator('#add-widget').click();
  await page.locator('#catalog').getByRole('button', { name: 'Материалы', exact: true }).click();
  const assets = page.locator('#catalog');
  await assets.locator('.asset-card').first().click();
  await assets.getByRole('button', { name: 'Добавить изображение', exact: true }).click();
  await expect(assets).toBeHidden();
  await expect(page.locator('#canvas .is-selected img')).toBeVisible();
});

test('presentation keeps slide geometry and can insert a locally saved composition', async ({
  page,
}) => {
  await corporateProject(page, 'presentation');
  const before = await savedDocument(page);
  await page.locator('#page-settings-open').click();
  await expect(page.locator('details.slide-grid')).toBeHidden();
  await page.getByRole('button', { name: 'Сохранить как композицию', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Название композиции', exact: true })
    .fill('Обложка команды');
  await page.getByRole('button', { name: 'Сохранить в каталог', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Сохранить композицию' })).toBeHidden();
  await page.locator('#close-inspector').click();
  await page.locator('#add-slide').click();
  const catalog = page.locator('#catalog');
  await expect(catalog.getByRole('button', { name: 'Материалы', exact: true })).toBeVisible();
  await catalog.getByRole('button', { name: 'Компоненты', exact: true }).click();
  await expect(catalog.locator('[data-add=metric]')).toBeVisible();
  await catalog.getByRole('button', { name: 'Шаблоны и композиции', exact: true }).click();
  await catalog
    .getByRole('searchbox', { name: 'Поиск по каталогу', exact: true })
    .fill('Обложка команды');
  await catalog.getByRole('button', { name: /Обложка команды/ }).click();
  await expect
    .poll(async () => (await savedDocument(page)).pages.length)
    .toBe(before.pages.length + 1);
  const after = await savedDocument(page);
  const clone = after.pages[1];
  expect(clone.id).not.toBe(before.pages[0].id);
  expect(clone.widgets.map((w: { position: unknown }) => w.position)).toEqual(
    before.pages[0].widgets.map((w: { position: unknown }) => w.position),
  );
  expect(after.templateInfo.sections[clone.id].id).toMatch(/^custom\//);
  await page.locator(`.outline-row:has([data-outline-index="1"]) summary`).click();
  await page.locator(`.outline-row:has([data-outline-index="1"]) [data-action=copy]`).click();
  await expect
    .poll(async () => (await savedDocument(page)).pages.length)
    .toBe(before.pages.length + 2);
  const duplicated = await savedDocument(page);
  expect(duplicated.templateInfo.sections[duplicated.pages[2].id]).toEqual(
    after.templateInfo.sections[clone.id],
  );
});
