import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { savedDocument } from './project-helper';
import { chooseOption } from './choose-option';

async function open(page: Page) {
  await page.goto('/builder/');
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'materials.json',
    mimeType: 'application/json',
    buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
  });
  await expect(page.locator('#project-name')).toBeVisible();
  await page.locator('#add-widget').click();
  const catalog = page.locator('#catalog');
  await catalog.getByRole('button', { name: 'Материалы', exact: true }).click();
  await expect(catalog.locator('.asset-picker [role=status]')).toHaveText('Материалы загружены.');
  await expect(catalog.getByRole('button', { name: 'Выбрать файл', exact: true })).toHaveCount(1);
  return catalog;
}

for (const width of [1440, 390]) {
  test(`materials stay in the catalog and wait for explicit selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const catalog = await open(page),
      before = await savedDocument(page);
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(page.locator('dialog.asset-library')).toHaveCount(0);
    await expect(catalog.locator('#catalog-materials')).toHaveAttribute('aria-pressed', 'true');
    await expect(catalog.locator('#catalog-components')).toHaveAttribute('aria-pressed', 'false');
    const category = catalog.locator('select[aria-label="Категория материалов"]');
    await expect(category).toHaveValue('');
    const confirm = catalog.getByRole('button', { name: 'Добавить изображение', exact: true });
    await expect(confirm).toBeDisabled();
    await chooseOption(category, 'logo');
    const card = catalog.locator('.asset-card').first();
    await expect(card).toBeVisible();
    const name = await card.locator('strong').textContent();
    await catalog.getByRole('searchbox', { name: 'Поиск материалов', exact: true }).fill(name!);
    if (width === 390) {
      await card.focus();
      await card.press('Enter');
    } else await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(confirm).toBeEnabled();
    await expect(confirm).toBeInViewport({ ratio: 1 });
    expect(await savedDocument(page)).toEqual(before);
    await catalog.getByRole('button', { name: 'Компоненты', exact: true }).click();
    await expect(catalog.locator('#palette')).toBeVisible();
    await catalog.getByRole('button', { name: 'Материалы', exact: true }).click();
    await expect(category).toHaveValue('logo');
    await expect(confirm).toBeEnabled();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(
      await catalog
        .locator('.library-dialog-body')
        .evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    if (width === 390) {
      await confirm.focus();
      await confirm.press('Enter');
    } else await confirm.click();
    await expect(catalog).toBeHidden();
    await expect
      .poll(async () => (await savedDocument(page)).pages[0].widgets.length)
      .toBe(before.pages[0].widgets.length + 1);
    const after = await savedDocument(page);
    expect(after.pages[0].widgets.at(-1).type).toBe('image');
    expect(after.pages[0].appearance).toEqual(before.pages[0].appearance);
    await page.locator('#add-widget').click();
    await catalog.getByRole('button', { name: 'Материалы', exact: true }).click();
    await expect(confirm).toBeDisabled();
    await expect(catalog.getByRole('button', { name: 'Выбрать файл', exact: true })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(catalog).toBeHidden();
    await expect(page.locator('#add-widget')).toBeFocused();
    expect(await savedDocument(page)).toEqual(after);
  });
}

test('uploading a catalog material selects it without inserting until confirmed', async ({
  page,
}) => {
  const catalog = await open(page),
    before = await savedDocument(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
    return canvas.toDataURL().split(',')[1];
  });
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    catalog.getByRole('button', { name: 'Выбрать файл', exact: true }).click(),
  ]);
  await chooser.setFiles({
    name: 'Мой материал.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  const confirm = catalog.getByRole('button', { name: 'Добавить изображение', exact: true });
  await expect(confirm).toBeEnabled();
  await expect(catalog.locator('select[aria-label="Категория материалов"]')).toHaveValue('local');
  await expect(catalog.locator('.asset-picker-confirm')).toContainText('Мой материал.png');
  expect(await savedDocument(page)).toEqual(before);
  await confirm.click();
  await expect(catalog).toBeHidden();
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets.length)
    .toBe(before.pages[0].widgets.length + 1);
});
