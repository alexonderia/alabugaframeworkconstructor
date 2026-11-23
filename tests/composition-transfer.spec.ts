import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openEditor } from './open-editor';
import { savedDocument } from './project-helper';

test('saving a section with navigation and modal actions clears only its catalog copy', async ({
  page,
}) => {
  await openEditor(page);
  const source = await page.evaluate(async () => {
    const { createDocumentFromTemplate } = await import('/apps/editor/src/templates.ts' as string);
    return createDocumentFromTemplate('page', 'document/page/showcase');
  });
  await page
    .locator('#open')
    .setInputFiles({
      name: 'links.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(source)),
    });
  await expect(page.locator('#status')).toContainText('Проект открыт');
  const before = await savedDocument(page);
  await page.locator('#page-settings-open').click();
  await page.getByRole('button', { name: 'Сохранить как композицию', exact: true }).click();
  await page.getByLabel('Название композиции', { exact: true }).fill('Шапка без адресов');
  await page.getByRole('button', { name: 'Сохранить в каталог', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Сохранить композицию' })).toBeHidden();
  const entries = await page.evaluate(async () => {
    const { listSavedCompositions } = await import(
      '/apps/editor/src/storage/compositions.ts' as string
    );
    return listSavedCompositions();
  });
  const links = entries[0].section.widgets.flatMap((widget: any) =>
    widget.type === 'text' ? widget.content.filter((block: any) => block.type === 'link') : [],
  );
  expect(links).toHaveLength(3);
  expect(links.every((link: any) => link.href === '')).toBe(true);
  expect(await savedDocument(page)).toEqual(before);
});

test('a collection carries an image into a fresh browser and keeps existing entries on repeated import', async ({
  page,
  browser,
}) => {
  test.slow();
  await openEditor(page);
  await page.locator('#page-settings-open').click();
  await page.getByRole('button', { name: 'Сохранить как композицию', exact: true }).click();
  await page.getByLabel('Название композиции', { exact: true }).fill('Команда для переноса');
  await page.getByRole('button', { name: 'Сохранить в каталог', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Сохранить композицию' })).toBeHidden();
  await page.locator('#close-inspector').click();
  await page.locator('#end-add button').click();
  await page.getByRole('button', { name: 'Перенос моих композиций', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать мои композиции', exact: true }).click();
  const buffer = await readFile((await (await pending).path())!);
  const context = await browser.newContext();
  try {
    const fresh = await context.newPage();
    await openEditor(fresh);
    const original = await savedDocument(fresh);
    await fresh.locator('#end-add button').click();
    await fresh.getByRole('button', { name: 'Перенос моих композиций', exact: true }).click();
    const manager = fresh.getByRole('dialog', { name: 'Перенос моих композиций', exact: true });
    const input = manager.getByLabel('Импорт коллекции композиций', { exact: true });
    await input.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });
    await expect(manager.getByRole('status')).toContainText('Некорректный файл');
    const file = { name: 'compositions.json', mimeType: 'application/json', buffer };
    await input.setInputFiles(file);
    await expect(manager.getByRole('status')).toContainText('Композиций добавлено: 1');
    await input.setInputFiles(file);
    await expect(manager.getByRole('status')).toContainText('Композиций добавлено: 1');
    await manager.getByRole('button', { name: 'Закрыть', exact: true }).click();
    const cards = fresh
      .locator('#templates .template-card')
      .filter({ hasText: 'Команда для переноса' });
    await expect(cards).toHaveCount(2);
    await cards.first().click();
    await expect
      .poll(async () => (await savedDocument(fresh)).pages.length)
      .toBe(original.pages.length + 1);
    const image = fresh.locator('#canvas [data-section-id]').last().locator('img');
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await fresh.reload();
    await expect(fresh.locator('#canvas [data-section-id]').last().locator('img')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('one reserved image is placed in the existing section and follows undo redo and reload', async ({
  page,
}) => {
  await openEditor(page);
  const document = await page.evaluate(async () => {
    const { emptyDocument } = await import('/apps/editor/src/model.ts' as string);
    const { getSectionTemplate } = await import('/apps/editor/src/templates.ts' as string);
    const { replaceComposition } = await import('/apps/editor/src/sections.ts' as string);
    const doc = emptyDocument();
    doc.pages = [getSectionTemplate('page', 'split').create()];
    replaceComposition(doc, doc.pages[0].id, getSectionTemplate('page', 'text'), true);
    return doc;
  });
  await page.locator('#open').setInputFiles({
    name: 'reserve.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(document)),
  });
  await expect(page.locator('#status')).toContainText('Проект открыт');
  await page.locator('#page-settings-open').click();
  await page
    .locator('[data-unplaced-widget]')
    .getByRole('button', { name: 'Разместить блок', exact: true })
    .click();
  await expect.poll(async () => (await savedDocument(page)).pages[0].widgets.length).toBe(2);
  expect((await savedDocument(page)).pages).toHaveLength(1);
  await page.locator('#undo').click();
  await expect(page.locator('[data-unplaced-widget]')).toHaveCount(1);
  await page.locator('#redo').click();
  await expect(page.locator('[data-unplaced-widget]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#canvas .af-widget')).toHaveCount(2);
  expect((await savedDocument(page)).templateInfo.unplaced).toBeUndefined();
});
