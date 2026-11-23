import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { savedDocument } from './project-helper';

async function openStorage(page: Page) {
  const menu = page.locator('.project-menu');
  if (!(await menu.evaluate((node) => (node as HTMLDetailsElement).open)))
    await menu.locator('summary').click();
  await page.getByRole('button', { name: 'Хранилище и материалы', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Хранилище и материалы', exact: true });
  await expect(dialog.getByRole('status')).toContainText(/Занято|Материалов:/);
  return dialog;
}

test('failed material upload leaves storage empty and retry saves one complete library entry', async ({
  page,
}) => {
  await page.route('**/api/ai/readiness', (route) =>
    route.fulfill({ json: { ready: false, stage: 'unavailable', message: 'Нет модели' } }),
  );
  await page.goto('/builder/');
  await page
    .locator('.product-header input[type=file]')
    .setInputFiles({
      name: 'storage-ui.json',
      mimeType: 'application/json',
      buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
    });
  await expect(page.locator('#project-name')).toBeVisible();
  const before = await savedDocument(page),
    payload = {
      name: 'rollback.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        await page.evaluate(() => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 2;
          canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
          return canvas.toDataURL().split(',')[1];
        }),
        'base64',
      ),
    };
  await page.getByRole('button', { name: 'Создать с ИИ', exact: true }).click();
  const ai = page.locator('.ai-dialog');
  await ai.locator('summary').click();
  await expect(ai.locator('input[type=file]')).toBeEnabled();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).storagePutForTest = original;
    IDBObjectStore.prototype.put = function (value, ...rest) {
      if (this.name === 'settings' && String(value.id).startsWith('asset-description:'))
        throw new DOMException('Описание не записано', 'QuotaExceededError');
      return original.call(this, value, ...rest);
    };
  });
  try {
    await ai.locator('input[type=file]').setInputFiles(payload);
    await expect(ai.locator('.ai-progress')).toContainText('Описание не записано');
    await expect(ai.locator('.ai-material [data-material^="asset:"]')).toHaveCount(0);
  } finally {
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = (window as any).storagePutForTest;
      delete (window as any).storagePutForTest;
    });
  }
  await ai.getByRole('button', { name: 'Закрыть', exact: true }).click();
  let storage = await openStorage(page);
  await expect(storage.getByRole('checkbox')).toHaveCount(0);
  await storage.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.locator('.project-menu[open] > summary').click();
  await page.getByRole('button', { name: 'Создать с ИИ', exact: true }).click();
  await ai.locator('summary').click();
  await ai.locator('input[type=file]').setInputFiles(payload);
  await expect(ai.locator('.ai-material [data-material^="asset:"]')).toHaveCount(1);
  await ai.getByRole('button', { name: 'Закрыть', exact: true }).click();
  storage = await openStorage(page);
  const check = storage.getByRole('checkbox', { name: 'Удалить rollback.png', exact: true });
  await expect(storage.getByRole('checkbox')).toHaveCount(1);
  await expect(check).toBeEnabled();
  await check.check();
  await storage.getByRole('button', { name: 'Удалить выбранные', exact: true }).click();
  await expect(storage.getByRole('checkbox')).toHaveCount(0);
  await storage.getByRole('button', { name: 'Закрыть', exact: true }).click();
  expect(await savedDocument(page)).toEqual(before);
});
