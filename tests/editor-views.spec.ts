import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { savedDocument } from './project-helper';
import { openGeometry, widgetTools } from './property-helper';

async function fixture(page: Page) {
  await page.goto('/builder/');
  await page
    .locator('.product-header input[type=file]')
    .setInputFiles({
      name: 'views.json',
      mimeType: 'application/json',
      buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
    });
  await expect(page.locator('#project-name')).toBeVisible();
}

test('invalid inspector geometry survives blocked close, section selection and preview until corrected', async ({
  page,
}) => {
  await fixture(page);
  const before = await savedDocument(page),
    box = page.locator('#canvas [data-widget-id=audit-text-a]');
  await box.focus();
  await box.press('Enter');
  await openGeometry(page);
  const width = page.getByLabel('Ширина', { exact: true });
  await width.fill('0');
  await width.blur();
  await expect(page.locator('#save-state')).toContainText('Есть несохранённые изменения');
  await page.locator('.outline-select').nth(1).click();
  await expect(page.locator('#pages')).toHaveValue('0');
  await expect(width).toHaveValue('0');
  await page.locator('#close-inspector').click();
  await expect(page.locator('#inspector')).toBeVisible();
  await page.locator('#preview').click();
  await expect(page.locator('.project-preview')).toHaveCount(0);
  expect(await savedDocument(page)).toEqual(before);
  await width.fill(String(before.pages[0].widgets[0].position.width));
  await width.blur();
  await expect(page.locator('#save-state')).toHaveText('Сохранено');
  await page.locator('#close-inspector').click();
  await expect(page.locator('#inspector')).toBeHidden();
  await page.locator('.outline-select').nth(1).click();
  await expect(page.locator('#pages')).toHaveValue('1');
  expect(await savedDocument(page)).toEqual(before);
});

test('repeated preview remounts keep one canvas tool layer and one copy/undo operation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await fixture(page);
  const before = await savedDocument(page);
  for (let round = 0; round < 3; round++) {
    const editable = page
      .locator('#canvas [data-widget-id=audit-text-a] [contenteditable]')
      .first();
    await editable.fill('Перемонтирование ' + round);
    await page.locator('#preview').click();
    await expect(
      page.frameLocator('.project-preview iframe').locator('[data-widget-id=audit-text-a]'),
    ).toContainText('Перемонтирование ' + round);
    await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await expect(page.locator('.canvas-widget-tools')).toHaveCount(1);
    await expect(page.locator('#canvas [data-widget-id=audit-text-a]>.move-handle')).toHaveCount(0);
    await expect(page.locator('#canvas [data-widget-id=audit-text-a]>.resize-handle')).toHaveCount(
      1,
    );
  }
  const current = await savedDocument(page),
    box = page.locator('#canvas [data-widget-id=audit-text-a]');
  await box.focus();
  await box.press('Enter');
  await page.locator('#close-inspector').click();
  await (await widgetTools(page, box)).getByRole('button', { name: 'Копия', exact: true }).click();
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets.length)
    .toBe(before.pages[0].widgets.length + 1);
  await page.locator('#undo').click();
  await expect.poll(() => savedDocument(page)).toEqual(current);
  expect(errors).toEqual([]);
});
