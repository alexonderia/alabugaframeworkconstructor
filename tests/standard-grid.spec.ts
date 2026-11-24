import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { savedDocument } from './project-helper';
import { chooseOption } from './choose-option';

async function setup(page: Page, kind: 'page' | 'presentation', bottom = false) {
  await page.goto('/builder/');
  const id = await page.evaluate(
    async ({ kind, bottom }) => {
      const { emptyDocument } = await import('/apps/editor/src/model.ts' as string);
      const { saveProject } = await import('/apps/editor/src/storage.ts' as string);
      const doc = emptyDocument(kind);
      doc.title = 'Standard grid';
      doc.pages[0].title = '';
      doc.pages[0].widgets = [
        {
          id: 'object',
          type: 'text',
          title: '',
          position: { col: 1, row: 1, width: 4, height: 2 },
          content: [{ type: 'paragraph', text: 'Grid', dropCap: false }],
        },
      ];
      if (bottom)
        doc.pages[0].widgets.push({
          id: 'bottom',
          type: 'text',
          title: '',
          position: { col: 24, row: kind === 'page' ? 20 : 12, width: 1, height: 1 },
          content: [{ type: 'paragraph', text: 'X', dropCap: false }],
        });
      const id = crypto.randomUUID();
      await saveProject(id, doc);
      return id;
    },
    { kind, bottom },
  );
  await page.evaluate((id) => (location.hash = '/edit/' + id), id);
  await expect(page.locator('#project-name')).toHaveValue('Standard grid');
  return page.locator('#canvas [data-widget-id=object]');
}

async function gridGeometry(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const panel = element.querySelector<HTMLElement>('.af-panel')!;
    const style = getComputedStyle(panel),
      shellStyle = getComputedStyle(element);
    return {
      width: Math.round(parseFloat(shellStyle.width)),
      height: Math.round(parseFloat(shellStyle.height)),
      left: Math.round(
        parseFloat(style.position === 'absolute' ? style.left : shellStyle.paddingLeft),
      ),
      top: Math.round(
        parseFloat(style.position === 'absolute' ? style.top : shellStyle.paddingTop),
      ),
      panelWidth: Math.round(parseFloat(style.width)),
      panelHeight: Math.round(parseFloat(style.height)),
      gap: style.gap,
      columns: style.gridTemplateColumns.split(' ').map((value) => Math.round(parseFloat(value))),
      rowHeight: parseFloat(style.gridAutoRows),
    };
  });
}

test('new presentations use the exact Figma frame and last row in editor, export and print', async ({
  page,
}, info) => {
  await setup(page, 'presentation', true);
  const expected = {
    width: 1920,
    height: 1080,
    left: 100,
    top: 176,
    panelWidth: 1720,
    panelHeight: 856,
    gap: '8px',
    columns: Array(24).fill(64),
    rowHeight: 64,
  };
  await expect.poll(() => gridGeometry(page, '#canvas .af-slide')).toEqual(expected);
  await page.locator('.block-controls summary').click();
  await page.getByLabel('Показывать сетку', { exact: true }).check();
  await page.locator('.block-controls summary').click();
  const guides = await page.locator('.canvas-grid-guides').evaluate((element) =>
    Array.from(element.children, (node) => {
      const e = node as HTMLElement;
      const size = /^(.*) ([^ ]+)$/.exec(getComputedStyle(e).backgroundSize)!;
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;width:${size[1]};height:${size[2]}`;
      e.append(probe);
      const step = [getComputedStyle(probe).width, getComputedStyle(probe).height].map((value) =>
        Math.round(parseFloat(value)),
      );
      probe.remove();
      const style = getComputedStyle(e);
      return {
        left: Math.round(parseFloat(style.left)),
        top: Math.round(parseFloat(style.top)),
        width: Math.round(parseFloat(style.width)),
        height: Math.round(parseFloat(style.height)),
        step,
      };
    }),
  );
  expect(guides).toEqual([
    { left: 100, top: 0, width: 1720, height: 1080, step: [72, 1080] },
    { left: 0, top: 176, width: 1920, height: 856, step: [1920, 72] },
  ]);
  expect((await savedDocument(page)).pages[0].grid).toMatchObject({
    columns: 24,
    rowHeight: 64,
    gap: 8,
  });
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const output = info.outputPath('grid.html');
  await (await download).saveAs(output);
  await page.goto(pathToFileURL(output).href);
  await expect.poll(() => gridGeometry(page, '.af-slide')).toEqual(expected);
  const last = page.locator('[data-widget-id=bottom]');
  await expect(last).toHaveCSS('grid-row-start', '12');
  await page.emulateMedia({ media: 'print' });
  await expect.poll(() => gridGeometry(page, '.af-slide')).toEqual(expected);
  expect(await page.locator('style').allTextContents()).toEqual(
    expect.arrayContaining([expect.stringContaining('size:1920px 1080px')]),
  );
});

test('site height grows and responsive columns work in editor and offline HTML', async ({
  page,
}, info) => {
  const box = await setup(page, 'page', true);
  const position = (await savedDocument(page)).pages[0].widgets[0].position;
  const columns = () =>
    page
      .locator('.af-panel')
      .first()
      .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  await expect.poll(columns).toBe(24);
  await chooseOption(page.locator('#device'), 'tablet');
  await expect.poll(columns).toBe(12);
  await expect(box).toHaveAttribute('data-editor-layout', 'tablet');
  await chooseOption(page.locator('#device'), 'mobile');
  await expect.poll(columns).toBe(4);
  await expect(box).toHaveAttribute('data-editor-layout', 'stack');
  expect((await savedDocument(page)).pages[0].widgets[0].position).toEqual(position);
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const output = info.outputPath('site.html');
  await (await download).saveAs(output);
  await page.goto(pathToFileURL(output).href);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(columns).toBe(24);
  const geometry = await gridGeometry(page, '.af-page');
  expect(geometry.left).toBe(100);
  expect(geometry.top).toBe(176);
  expect(geometry.height).toBeGreaterThan(1080);
  expect(geometry.columns).toEqual(Array(24).fill(64));
  await page.setViewportSize({ width: 768, height: 1080 });
  await expect.poll(columns).toBe(12);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(columns).toBe(4);
  await expect(page.locator('[data-widget-id=bottom]')).toContainText('X');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('frame and responsive counts can be edited, saved, reset and undone', async ({ page }) => {
  await setup(page, 'page');
  await page.locator('.block-controls summary').click();
  await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
  const top = page.getByLabel('Поле сверху, px', { exact: true });
  await top.fill('160');
  await top.press('Tab');
  await page.getByRole('button', { name: 'Применить сетку', exact: true }).click();
  await expect.poll(async () => (await savedDocument(page)).pages[0].grid.frame.top).toBe(160);
  const mobile = page.getByLabel('Колонки на телефоне', { exact: true });
  await mobile.fill('6');
  await mobile.press('Tab');
  await page.getByRole('button', { name: 'Применить сетку', exact: true }).click();
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].grid.responsive.mobileColumns)
    .toBe(6);
  await page.getByRole('button', { name: 'Применить стандартную сетку', exact: true }).click();
  await expect.poll(async () => (await savedDocument(page)).pages[0].grid.frame.top).toBe(176);
  await page.locator('#undo').click();
  await expect.poll(async () => (await savedDocument(page)).pages[0].grid.frame.top).toBe(160);
  expect((await savedDocument(page)).pages[0].grid.responsive.mobileColumns).toBe(6);
  await page.reload();
  await page.locator('.block-controls summary').click();
  await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
  await expect(page.getByLabel('Поле сверху, px', { exact: true })).toHaveValue('160');
  await expect(page.getByLabel('Колонки на телефоне', { exact: true })).toHaveValue('6');
});
