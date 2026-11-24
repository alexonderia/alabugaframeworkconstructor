import { test, expect, type Page } from '@playwright/test';
import { standardGrid } from '@alabuga/framework/grid';
import type { Section } from '@alabuga/framework/schema';
import { savedDocument } from './project-helper';
import { pathToFileURL } from 'node:url';

async function open(page: Page, kind: 'page' | 'presentation', legacy = false) {
  await page.goto('/builder/');
  const doc = {
    schemaVersion: 6,
    kind,
    title: 'Единая сетка',
    pages: Array.from({ length: 2 }, (_, index) => ({
      id: 'grid-' + index,
      title: '',
      grid: legacy ? { columns: 12, rowHeight: 64, gap: 16 } : standardGrid(),
      ...(kind === 'page' ? { appearance: { layout: 'flow' } } : {}),
      widgets: [
        {
          id: 'object-' + index,
          type: 'text',
          title: '',
          content: [{ type: 'paragraph', text: 'Общий принцип сетки', dropCap: false }],
          position: { col: 3, row: 3, width: 4, height: 3 },
        },
      ],
    })),
  };
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'presentation-grid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.locator('#project-name')).toHaveValue(doc.title);
}

async function grid(page: Page) {
  return page.locator('#canvas [data-section-id=grid-0]').evaluate((shell) => {
    const panel = shell.querySelector<HTMLElement>('.af-panel')!,
      style = getComputedStyle(panel),
      shellStyle = getComputedStyle(shell);
    const canvas = shell.closest<HTMLElement>('#canvas')!;
    return {
      width: Math.round(parseFloat(shellStyle.width)),
      columns: style.gridTemplateColumns.split(' ').length,
      columnWidth: Math.round(parseFloat(style.gridTemplateColumns)),
      rowHeight: parseFloat(style.gridAutoRows.replace('minmax(', '')),
      gap: parseFloat(style.gap),
      panelWidth: Math.round(parseFloat(style.width)),
      left: Math.round(
        parseFloat(style.position === 'absolute' ? style.left : shellStyle.paddingLeft),
      ),
      top: Math.round(
        parseFloat(style.position === 'absolute' ? style.top : shellStyle.paddingTop),
      ),
      scale: panel.getBoundingClientRect().width / parseFloat(style.width),
      zoom: parseFloat(getComputedStyle(canvas).zoom),
    };
  });
}

for (const kind of ['page', 'presentation'] as const)
  test(`${kind}: grid and zoom share a logical canvas through inspector and resizing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page, kind);
    const expected = {
      width: 1920,
      columns: 24,
      columnWidth: 64,
      rowHeight: 64,
      gap: 8,
      panelWidth: 1720,
      left: 100,
      top: 176,
    };
    const stable = async () => {
      const { scale, zoom, ...logical } = await grid(page);
      expect(logical).toEqual(expected);
      expect(Math.abs(scale - zoom)).toBeLessThan(0.002);
    };
    await expect(stable).toPass();
    expect((await grid(page)).zoom).toBeLessThan(1);
    await page.getByRole('button', { name: 'Масштаб 100%', exact: true }).click();
    await expect(stable).toPass();
    expect((await grid(page)).scale).toBeCloseTo(1, 2);
    await page.getByRole('button', { name: 'Уменьшить масштаб', exact: true }).click();
    await expect(stable).toPass();
    expect((await grid(page)).scale).toBeCloseTo(0.9, 2);
    await page.locator('.block-controls summary').click();
    await page.getByLabel('Показывать сетку', { exact: true }).check();
    await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
    const form = page.locator(kind === 'page' ? '.advanced-grid' : '.slide-grid');
    await expect(form.getByLabel('Колонки', { exact: true })).toHaveValue('24');
    await expect(form.getByLabel('Поле сверху, px', { exact: true })).toHaveValue('176');
    await expect(form.locator('.settings-grid')).toHaveCSS('display', 'grid');
    await expect(stable).toPass();
    await page.locator('#close-inspector').click();
    await page.getByRole('button', { name: 'Вписать', exact: true }).click();
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(stable).toPass();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(stable).toPass();
  });

test('legacy presentations use the common grid after opening, retain a source revision and export the new geometry', async ({
  page,
}, info) => {
  await open(page, 'presentation', true);
  const document = await savedDocument(page);
  expect(document.pages).toHaveLength(2);
  for (const section of document.pages) {
    expect(section.grid).toEqual(standardGrid());
    expect(section.widgets[0].content[0].text).toBe('Общий принцип сетки');
  }
  const original = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('alabuga-workspace', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const request = db.transaction('revisions').objectStore('revisions').getAll();
        request.onsuccess = () =>
          resolve(
            request.result.some((revision) =>
              revision.document.pages.every(
                (section: any) => section.grid.columns === 12 && !section.grid.frame,
              ),
            ),
          );
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
  expect(original).toBe(true);
  await page.reload();
  await expect(page.locator('#project-name')).toHaveValue('Единая сетка');
  expect(await savedDocument(page)).toEqual(document);
  const pending = page.waitForEvent('download');
  await page.locator('#export').click();
  const file = info.outputPath('presentation-grid.html');
  await (await pending).saveAs(file);
  await page.goto(pathToFileURL(file).href);
  await expect(page.locator('.af-slide')).toHaveCount(2);
  expect(
    await page
      .locator('.af-slide')
      .first()
      .evaluate((node) => ({
        width: (node as HTMLElement).offsetWidth,
        height: (node as HTMLElement).offsetHeight,
      })),
  ).toEqual({ width: 1920, height: 1080 });
  await expect(page.locator('.canvas-grid-guides')).toHaveCount(0);
});

test('the source revision restores its original grid and keeps that explicit choice after reload', async ({
  page,
}) => {
  await open(page, 'presentation', true);
  await savedDocument(page);
  await page.locator('.project-menu > summary').click();
  await page.getByRole('button', { name: 'История версий', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'История версий', exact: true });
  await dialog
    .getByRole('button', { name: /восстановить/ })
    .last()
    .click();
  await expect(dialog).toBeHidden();
  const original = await savedDocument(page);
  expect(
    original.pages.every((section: Section) => section.grid.columns === 12 && !section.grid.frame),
  ).toBe(true);
  await page.reload();
  await expect(page.locator('#project-name')).toHaveValue('Единая сетка');
  expect(await savedDocument(page)).toEqual(original);
  const frame = await page.locator('#canvas').evaluate((canvas) => {
    const css = getComputedStyle(canvas),
      outer = canvas.getBoundingClientRect();
    const slide = canvas.querySelector('.af-slide--active')!.getBoundingClientRect();
    return {
      width: Math.round(parseFloat(css.width)),
      height: Math.round(parseFloat(css.height)),
      gap: Math.max(Math.abs(outer.width - slide.width), Math.abs(outer.height - slide.height)),
    };
  });
  expect(frame.width).toBe(1600);
  expect(frame.height).toBe(900);
  expect(frame.gap).toBeLessThan(1);
});

test('decorations do not enlarge the slide or leave a backing around its exact frame', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/builder/');
  const first = standardGrid(),
    second = standardGrid();
  Object.assign(second.frame!, { width: 1600, height: 900, top: 100 });
  const doc = {
    schemaVersion: 6,
    kind: 'presentation',
    title: 'Точные границы',
    templateInfo: { documentGrid: first, gridOverrides: ['slide-1'] },
    pages: [first, second].map((grid, index) => ({
      id: 'slide-' + index,
      title: '',
      grid,
      composition: 'thesis',
      appearance: { theme: 'contrast', decoration: 'orbit' },
      widgets: [
        {
          id: 'item-' + index,
          type: 'text',
          title: '',
          position: { col: 1, row: 1, width: 20, height: 3 },
          content: [{ type: 'paragraph', text: 'Слайд без подложки', dropCap: false }],
        },
      ],
    })),
  };
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'slide-bounds.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.locator('#project-name')).toHaveValue(doc.title);
  const check = async (width: number, height: number) => {
    const actual = await page.locator('#canvas-scroll').evaluate((viewport) => {
      const canvas = viewport.querySelector<HTMLElement>('#canvas')!,
        slide = canvas.querySelector<HTMLElement>('.af-slide--active')!;
      const frame = slide.getBoundingClientRect(),
        css = getComputedStyle(canvas);
      const nodes = [
        canvas,
        canvas.querySelector<HTMLElement>('.af-document')!,
        canvas.querySelector<HTMLElement>('.af-deck')!,
        canvas.querySelector<HTMLElement>('.af-deck__stage')!,
      ];
      return {
        width: Math.round(parseFloat(css.width)),
        height: Math.round(parseFloat(css.height)),
        maxGap: Math.max(
          ...nodes.flatMap((node) => {
            const rect = node.getBoundingClientRect();
            return [
              rect.left - frame.left,
              rect.top - frame.top,
              rect.right - frame.right,
              rect.bottom - frame.bottom,
            ].map(Math.abs);
          }),
        ),
        background: css.backgroundColor,
        radius: getComputedStyle(viewport).borderRadius,
        deckBackground: getComputedStyle(nodes[2]).backgroundColor,
      };
    });
    expect(actual.width).toBe(width);
    expect(actual.height).toBe(height);
    expect(actual.maxGap).toBeLessThan(1);
    expect(actual.background).toBe('rgba(0, 0, 0, 0)');
    expect(actual.deckBackground).toBe('rgba(0, 0, 0, 0)');
    expect(actual.radius).toBe('0px');
  };
  await expect(() => check(1920, 1080)).toPass();
  await page.locator('#page-settings-open').click();
  await expect(() => check(1920, 1080)).toPass();
  await page.locator('#close-inspector').click();
  await page.locator('.outline-select').nth(1).click();
  await expect(page.locator('#pages')).toHaveValue('1');
  await expect(() => check(1600, 900)).toPass();
  await page.getByRole('button', { name: 'Масштаб 100%', exact: true }).click();
  await expect(() => check(1600, 900)).toPass();
  await page.getByRole('button', { name: 'Вписать', exact: true }).click();
  await page.setViewportSize({ width: 1100, height: 700 });
  await expect(() => check(1600, 900)).toPass();
});
