import { test, expect, type Locator } from '@playwright/test';
import { chooseOption } from './choose-option';
import { savedDocument } from './project-helper';

async function renderedGrid(section: Locator) {
  return section.evaluate((shell) => {
    const panel = shell.querySelector<HTMLElement>('.af-panel')!,
      guide = shell.querySelector<HTMLElement>('.canvas-grid-columns')!,
      style = getComputedStyle(guide),
      size = /^(.*) ([^ ]+)$/.exec(style.backgroundSize)!,
      probe = document.createElement('div');
    probe.style.cssText = `position:absolute;width:${size[1]};height:${size[2]}`;
    guide.append(probe);
    const step = parseFloat(getComputedStyle(probe).width);
    probe.remove();
    return {
      columns: getComputedStyle(panel).gridTemplateColumns.split(' ').length,
      guideColumns: Math.round((guide.clientWidth + 8) / step),
      rootWidth: shell.closest<HTMLElement>('.af-document--page')!.clientWidth,
      mode: panel.querySelector<HTMLElement>('.af-widget')!.dataset.editorLayout,
      firstColumn: getComputedStyle(panel.querySelector('.af-widget')!).gridColumn,
      firstRow: getComputedStyle(panel.querySelector('.af-widget')!).gridRow,
    };
  });
}

test('header grid follows the selected screen through inspector, zoom, fit and window resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/builder/');
  const id = await page.evaluate(async () => {
    const { createDocumentFromTemplate } = await import('/apps/editor/src/templates.ts' as string);
    const { saveProject } = await import('/apps/editor/src/storage.ts' as string);
    const id = crypto.randomUUID();
    await saveProject(id, createDocumentFromTemplate('page', 'document/page/corporate'));
    return id;
  });
  await page.evaluate((id) => (location.hash = '/edit/' + id), id);
  await expect(page.locator('#project-name')).toBeVisible();
  await page.locator('.block-controls summary').click();
  await page.getByLabel('Показывать сетку', { exact: true }).check();
  await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
  const settings = page.locator('.advanced-grid'),
    header = page.locator('#canvas header.af-page');
  await settings.getByLabel('Колонки', { exact: true }).fill('20');
  await settings.getByLabel('Колонки на планшете', { exact: true }).fill('5');
  await settings.getByRole('button', { name: 'Применить сетку', exact: true }).click();
  await expect.poll(async () => (await savedDocument(page)).pages[0].grid.columns).toBe(20);
  const source = await savedDocument(page),
    position = source.pages[0].widgets[0].position;
  const desktop = {
    columns: 20,
    guideColumns: 20,
    rootWidth: 1920,
    mode: 'grid',
    firstColumn: `${position.col} / span ${position.width}`,
    firstRow: `${position.row} / span ${position.height}`,
  };
  await expect.poll(() => renderedGrid(header)).toEqual(desktop);
  await page.locator('#close-inspector').click();
  await expect.poll(() => renderedGrid(header)).toEqual(desktop);
  await chooseOption(page.locator('#device'), 'tablet');
  await expect
    .poll(async () => {
      const m = await renderedGrid(header);
      return [m.columns, m.guideColumns, m.rootWidth, m.mode];
    })
    .toEqual([5, 5, 820, 'tablet']);
  await chooseOption(page.locator('#device'), 'mobile');
  await expect
    .poll(async () => {
      const m = await renderedGrid(header);
      return [m.columns, m.guideColumns, m.rootWidth, m.mode];
    })
    .toEqual([4, 4, 390, 'stack']);
  await chooseOption(page.locator('#device'), 'desktop');
  await expect.poll(() => renderedGrid(header)).toEqual(desktop);
  await page.getByRole('button', { name: 'Масштаб 100%', exact: true }).click();
  await page.locator('#page-settings-open').click();
  await expect.poll(() => renderedGrid(header)).toEqual(desktop);
  await page.locator('#close-inspector').click();
  await page.getByRole('button', { name: 'Уменьшить масштаб', exact: true }).click();
  await expect.poll(() => renderedGrid(header)).toEqual(desktop);
  await page.getByRole('button', { name: 'Вписать', exact: true }).click();
  for (const width of [1280, 1024, 390, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => renderedGrid(header)).toEqual(desktop);
  }
  expect(await savedDocument(page)).toEqual(source);
  await page.locator('#open').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 3,
        kind: 'page',
        title: 'Legacy grid',
        pages: [
          { id: 'legacy', title: '', grid: { columns: 12, rowHeight: 64, gap: 16 }, widgets: [] },
        ],
      }),
    ),
  });
  await expect(page.locator('#project-name')).toHaveValue('Legacy grid');
  await expect(page.locator('#canvas')).toHaveCSS('zoom', '1');
  expect(
    await page.locator('#canvas .af-document--page').evaluate((e) => e.clientWidth),
  ).toBeLessThan(1920);
});
