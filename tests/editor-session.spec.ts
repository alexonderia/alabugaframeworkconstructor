import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockAI } from './ai-helper';
import { savedDocument } from './project-helper';

test('a prepared draft persists through the session, undoes once and stays undone after reopening', async ({
  page,
}) => {
  await mockAI(page);
  await page.goto('/builder/');
  await page
    .locator('.product-header input[type=file]')
    .setInputFiles({
      name: 'session.json',
      mimeType: 'application/json',
      buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
    });
  await expect(page.locator('#project-name')).toBeVisible();
  const before = await savedDocument(page);
  await page.getByRole('button', { name: 'Создать с ИИ', exact: true }).click();
  await page
    .getByLabel('Запрос', { exact: true })
    .fill('Расскажи о визуальном конструкторе сайтов и презентаций');
  await page.getByRole('button', { name: 'Создать черновик', exact: true }).click();
  await expect(page.locator('.ai-progress')).toContainText('Черновик готов', { timeout: 30000 });
  await page.getByLabel('Содержание и замечания проверены').check();
  await page.getByRole('button', { name: 'Применить черновик', exact: true }).click();
  await expect(page.locator('.ai-dialog')).toHaveCount(0);
  await expect
    .poll(async () => (await savedDocument(page)).pages.length)
    .toBe(before.pages.length + 1);
  await page.locator('#undo').click();
  await expect.poll(() => savedDocument(page)).toEqual(before);
  await page.reload();
  await expect(page.locator('#project-name')).toHaveValue(before.title);
  expect(await savedDocument(page)).toEqual(before);
});
