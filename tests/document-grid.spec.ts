import { test, expect, type Page } from '@playwright/test';
import { savedDocument } from './project-helper';

async function setup(page: Page, kind: 'page' | 'presentation') {
  await page.goto('/builder/');
  const id = await page.evaluate(async (kind) => {
    const { createDocumentFromTemplate } = await import('/apps/editor/src/templates.ts' as string);
    const { planGridChange } = await import('/apps/editor/src/grid-change.ts' as string);
    const { saveProject } = await import('/apps/editor/src/storage.ts' as string);
    const doc = createDocumentFromTemplate(kind, `document/${kind}/corporate`);
    delete doc.templateInfo;
    doc.pages[0] = planGridChange(doc.pages[0], { ...doc.pages[0].grid, columns: 20 }, kind);
    // Reproduce a project where only the header was previously changed.
    doc.pages[1] = planGridChange(doc.pages[1], { columns: 12, rowHeight: 64, gap: 16 }, kind);
    const id = crypto.randomUUID();
    await saveProject(id, doc);
    return id;
  }, kind);
  await page.evaluate((id) => (location.hash = '/edit/' + id), id);
  await expect(page.locator('#project-name')).toBeVisible();
  await page.locator('.block-controls summary').click();
  await page.getByLabel('Показывать сетку', { exact: true }).check();
  await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
  // Compare logical insets at actual size; fractional zoom rounds offsets in WebKit.
  await page.getByRole('button', { name: 'Масштаб 100%', exact: true }).click();
  return page.locator(kind === 'page' ? '.advanced-grid' : '.slide-grid');
}

async function renderedGrids(page: Page) {
  return page.locator('#canvas .af-layout-grid > .af-panel').evaluateAll((panels) =>
    panels.map((panel) => {
      const style = getComputedStyle(panel);
      return {
        columns: style.gridTemplateColumns.split(' ').length,
        width: (panel as HTMLElement).offsetWidth,
        left: (panel as HTMLElement).offsetLeft,
      };
    }),
  );
}

for (const kind of ['page', 'presentation'] as const) {
  test(`${kind}: common grid unifies existing sections, local override can be removed and persists on reload`, async ({
    page,
  }) => {
    const grid = await setup(page, kind),
      count = kind === 'page' ? 6 : 4;
    await expect(grid.getByLabel('Колонки', { exact: true })).toHaveValue('20');
    await expect
      .poll(() => renderedGrids(page))
      .toEqual(Array(count).fill({ columns: 20, width: 1720, left: 100 }));
    await grid.getByLabel('Колонки', { exact: true }).fill('16');
    await grid.getByLabel('Поле слева, px', { exact: true }).fill('120');
    await grid.getByRole('button', { name: 'Применить сетку', exact: true }).click();
    await expect
      .poll(async () =>
        (await savedDocument(page)).pages.map((section: any) => section.grid.columns),
      )
      .toEqual(Array(count).fill(16));
    await expect
      .poll(() => renderedGrids(page))
      .toEqual(Array(count).fill({ columns: 16, width: 1700, left: 120 }));
    const before = await savedDocument(page);
    await page.locator('#close-inspector').click();
    await page.locator('.outline-select[data-outline-index="1"]').click();
    await page.locator('.block-controls summary').click();
    await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
    const own = grid.getByLabel(
      kind === 'page' ? 'Своя сетка для этой секции' : 'Своя сетка для этого слайда',
      { exact: true },
    );
    // Keep the numeric draft when turning on an exception.
    await grid.getByLabel('Колонки', { exact: true }).fill('12');
    await own.check();
    await expect(grid.getByLabel('Колонки', { exact: true })).toHaveValue('12');
    await grid.getByRole('button', { name: 'Применить сетку', exact: true }).click();
    await expect.poll(async () => (await savedDocument(page)).pages[1].grid.columns).toBe(12);
    const local = await savedDocument(page);
    expect(local.templateInfo.documentGrid).toEqual(before.templateInfo.documentGrid);
    expect(local.templateInfo.gridOverrides).toEqual([local.pages[1].id]);
    expect(
      local.pages
        .filter((_: any, index: number) => index !== 1)
        .map((section: any) => section.grid.columns),
    ).toEqual(Array(count - 1).fill(16));
    await page.reload();
    await expect(page.locator('#project-name')).toBeVisible();
    await page.getByRole('button', { name: 'Масштаб 100%', exact: true }).click();
    expect((await savedDocument(page)).templateInfo).toEqual(local.templateInfo);
    await page.locator('.outline-select[data-outline-index="1"]').click();
    await page.locator('.block-controls summary').click();
    await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
    await expect(own).toBeChecked();
    await own.uncheck();
    await expect
      .poll(async () =>
        (await savedDocument(page)).pages.map((section: any) => section.grid.columns),
      )
      .toEqual(Array(count).fill(16));
    await expect(grid.getByLabel('Колонки', { exact: true })).toHaveValue('16');
    await grid.getByRole('button', { name: 'Применить стандартную сетку', exact: true }).click();
    await expect
      .poll(async () =>
        (await savedDocument(page)).pages.map((section: any) => section.grid.columns),
      )
      .toEqual(Array(count).fill(24));
    await expect
      .poll(() => renderedGrids(page))
      .toEqual(Array(count).fill({ columns: 24, width: 1720, left: 100 }));
  });
}
