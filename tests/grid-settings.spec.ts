import { test, expect, type Page } from '@playwright/test';
import { standardGrid } from '@alabuga/framework/grid';
import { savedDocument } from './project-helper';

async function setup(page: Page, kind: 'page' | 'presentation') {
  await page.goto('/builder/');
  const doc = {
    schemaVersion: 6,
    kind,
    title: 'Grid editing',
    templateInfo: { documentGrid: standardGrid() },
    pages: [
      {
        id: 'grid',
        title: '',
        grid: standardGrid(),
        widgets: [
          {
            id: 'heading',
            type: 'text',
            title: '',
            position: { col: 1, row: 1, width: 24, height: 3 },
            content: [{ type: 'paragraph', text: 'Keep text', dropCap: false }],
          },
          {
            id: 'image',
            type: 'image',
            title: 'Photo',
            position: { col: 1, row: 4, width: 12, height: 9 },
            src: '../assets/brand-landscape.svg',
            alt: 'Keep alt',
            fit: 'contain',
            caption: 'Caption',
          },
          {
            id: 'cards',
            type: 'cards',
            title: 'Cards',
            position: { col: 13, row: 4, width: 12, height: 9 },
            items: [{ title: 'Keep title', text: 'Keep body' }],
          },
        ],
      },
    ],
  };
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'grid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.locator('#project-name')).toHaveValue('Grid editing');
  await page.locator('.block-controls summary').click();
  await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
  return page.locator(kind === 'page' ? '.advanced-grid' : '.slide-grid');
}

for (const kind of ['page', 'presentation'] as const) {
  test(`${kind}: collapsed grid drafts are applied or revealed for correction before closing`, async ({
    page,
  }) => {
    const grid = await setup(page, kind);
    await grid.getByLabel('Колонки', { exact: true }).fill('12');
    await grid.locator(':scope > summary').click();
    await page.locator('#close-inspector').click();
    await expect(page.locator('#inspector')).toBeHidden();
    await expect.poll(async () => (await savedDocument(page)).pages[0].grid.columns).toBe(12);
    await page.locator('.block-controls summary').click();
    await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
    await grid.getByLabel('Колонки', { exact: true }).fill('');
    await grid.locator(':scope > summary').click();
    await page.locator('#close-inspector').click();
    await expect(page.locator('#inspector')).toBeVisible();
    await expect(grid).toHaveAttribute('open');
    await expect(grid.getByLabel('Колонки', { exact: true })).toBeFocused();
    expect((await savedDocument(page)).pages[0].grid.columns).toBe(12);
  });

  test(`${kind}: leaving the inspector applies a valid draft without losing the change`, async ({
    page,
  }) => {
    const grid = await setup(page, kind),
      before = await savedDocument(page);
    await grid.getByLabel('Колонки', { exact: true }).fill('12');
    await page.locator('#close-inspector').click();
    await expect(page.locator('#inspector')).toBeHidden();
    await expect.poll(async () => (await savedDocument(page)).pages[0].grid.columns).toBe(12);
    await page.locator('#undo').click();
    await expect.poll(() => savedDocument(page)).toEqual(before);
  });

  test(`${kind}: grid drafts retain focus and remap occupied blocks on apply with one undo`, async ({
    page,
  }) => {
    const grid = await setup(page, kind),
      before = await savedDocument(page);
    const columns = grid.getByLabel('Колонки', { exact: true }),
      height = grid.getByLabel('Строка, px', { exact: true });
    await columns.fill('12');
    await columns.press('Tab');
    await expect(height).toBeFocused();
    await height.fill('80');
    await grid.getByLabel('Отступ, px', { exact: true }).fill('12');
    expect((await savedDocument(page)).pages[0].grid.columns).toBe(24);
    await grid.getByRole('button', { name: 'Применить сетку', exact: true }).click();
    await expect.poll(async () => (await savedDocument(page)).pages[0].grid.columns).toBe(12);
    const applied = await savedDocument(page);
    expect(applied.pages[0].grid).toMatchObject({ rowHeight: 80, gap: 12 });
    expect(applied.pages[0].widgets.map(({ position, ...rest }: any) => rest)).toEqual(
      before.pages[0].widgets.map(({ position, ...rest }: any) => rest),
    );
    expect(
      applied.pages[0].widgets.every((w: any) => w.position.col + w.position.width - 1 <= 12),
    ).toBe(true);
    await page.locator('#undo').click();
    await expect.poll(() => savedDocument(page)).toEqual(before);
    await page.locator('#redo').click();
    await expect.poll(async () => (await savedDocument(page)).pages[0].grid.columns).toBe(12);
    await page.reload();
    await expect(page.locator('#project-name')).toHaveValue('Grid editing');
    expect((await savedDocument(page)).pages[0].grid).toMatchObject({
      columns: 12,
      rowHeight: 80,
      gap: 12,
    });
  });

  test(`${kind}: invalid changes keep the draft and show a local error, cancel and reset recover`, async ({
    page,
  }) => {
    const grid = await setup(page, kind),
      before = await savedDocument(page),
      columns = grid.getByLabel('Колонки', { exact: true });
    await columns.fill('1');
    await grid.getByRole('button', { name: 'Применить сетку', exact: true }).click();
    await expect(grid.locator('[role=status]')).toContainText('минимум 2 колонки');
    await expect(columns).toHaveValue('1');
    expect(await savedDocument(page)).toEqual(before);
    await page.locator('#close-inspector').click();
    await expect(page.locator('#inspector')).toBeVisible();
    await expect(columns).toHaveValue('1');
    await grid.getByRole('button', { name: 'Отменить изменения сетки', exact: true }).click();
    await expect(columns).toHaveValue('24');
    await grid.getByLabel('Поле слева, px', { exact: true }).fill('1600');
    await grid.getByLabel('Поле справа, px', { exact: true }).fill('400');
    await grid.getByRole('button', { name: 'Применить сетку', exact: true }).click();
    await expect(grid.locator('[role=status]')).toContainText('Сумма полей');
    await columns.fill('');
    await grid.getByRole('button', { name: 'Применить стандартную сетку', exact: true }).click();
    await expect(columns).toHaveValue('24');
    expect(await savedDocument(page)).toEqual(before);
  });
}
