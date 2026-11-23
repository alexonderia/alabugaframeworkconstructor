import { test, expect, type Locator, type Page } from '@playwright/test';
import { standardGrid } from '@alabuga/framework/grid';
import { pathToFileURL } from 'node:url';
import { chooseOption } from './choose-option';
import { savedDocument } from './project-helper';

async function geometry(box: Locator) {
  return box.evaluate((element) => {
    const panel = element.parentElement!,
      p = panel.getBoundingClientRect(),
      b = element.getBoundingClientRect(),
      scale = p.width / (panel as HTMLElement).offsetWidth;
    return {
      x: Math.round((b.left - p.left) / scale),
      y: Math.round((b.top - p.top) / scale),
      width: Math.round(b.width / scale),
      height: Math.round(b.height / scale),
    };
  });
}
async function drag(
  page: Page,
  handle: Locator,
  dx: number,
  dy: number,
  during?: () => Promise<void>,
) {
  await handle.scrollIntoViewIfNeeded();
  const { scale } = await handle.evaluate((element) => {
    const p = element.closest('.af-panel')!;
    return { scale: p.getBoundingClientRect().width / (p as HTMLElement).offsetWidth };
  });
  const b = (await handle.boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx * scale, y + dy * scale, { steps: 5 });
  await during?.();
  await page.mouse.up();
}
async function mode(page: Page, value: string) {
  await page.locator('.block-controls summary').click();
  await chooseOption(page.getByLabel('Режим привязки', { exact: true }), value);
  await page.locator('.block-controls summary').click();
}
async function setup(page: Page, kind: 'page' | 'presentation') {
  await page.goto('/builder/');
  const doc = {
    schemaVersion: 6,
    kind,
    title: 'Точная привязка',
    pages: [
      {
        id: 'section',
        title: '',
        grid: standardGrid(),
        widgets: [
          {
            id: 'object',
            type: 'text',
            title: '',
            content: [{ type: 'paragraph', text: 'X', dropCap: false }],
            position: { col: 3, row: 3, width: 4, height: 3 },
          },
        ],
      },
    ],
  };
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'snap.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.locator('#project-name')).toHaveValue(doc.title);
  await page.getByRole('button', { name: 'Масштаб 100%', exact: true }).click();
  const box = page.locator('#canvas [data-widget-id=object]');
  await box.click({ position: { x: 10, y: 10 } });
  return box;
}

for (const kind of ['page', 'presentation'] as const) {
  test(`${kind}: off and mixed preserve exact geometry through resize, undo, reload and standalone export`, async ({
    page,
  }, info) => {
    const box = await setup(page, kind);
    await mode(page, 'off');
    await drag(page, box, 13, 19);
    await expect.poll(() => geometry(box)).toEqual({ x: 157, y: 163, width: 280, height: 208 });
    expect((await savedDocument(page)).pages[0].widgets[0].position.free).toBe(true);
    await mode(page, 'mixed');
    await drag(page, box, 48, 43, async () => {
      await expect(page.locator('.canvas-snap-line')).toHaveCount(2);
      await expect.poll(() => geometry(box)).toEqual({ x: 208, y: 208, width: 280, height: 208 });
    });
    await expect(page.locator('.canvas-snap-line')).toHaveCount(0);
    await drag(page, box, 32, 32, async () => {
      await expect(page.locator('.canvas-snap-line')).toHaveCount(0);
    });
    await expect.poll(() => geometry(box)).toEqual({ x: 240, y: 240, width: 280, height: 208 });
    await mode(page, 'off');
    await drag(page, box.locator('[data-resize-direction=nw]'), -13, -17);
    const exact = { x: 227, y: 223, width: 293, height: 225 };
    await expect.poll(() => geometry(box)).toEqual(exact);
    await page.locator('#undo').click();
    await expect.poll(() => geometry(box)).toEqual({ x: 240, y: 240, width: 280, height: 208 });
    await page.locator('#redo').click();
    await expect.poll(() => geometry(box)).toEqual(exact);
    await page.reload();
    await expect(page.locator('#project-name')).toHaveValue('Точная привязка');
    await page.getByRole('button', { name: 'Масштаб 100%', exact: true }).click();
    await expect(page.locator('#canvas')).toHaveAttribute('data-snap-mode', 'off');
    await expect.poll(() => geometry(box)).toEqual(exact);
    await box.focus();
    await box.press('ArrowRight');
    await expect.poll(() => geometry(box)).toEqual({ ...exact, x: 228 });
    await box.press('ArrowLeft');
    await mode(page, 'strict');
    await box.focus();
    await box.press('ArrowRight');
    const snapped = await geometry(box);
    expect(snapped.y).toBe(exact.y);
    expect([0, 64]).toContain(((snapped.x % 72) + 72) % 72);
    await page.locator('#undo').click();
    await mode(page, 'off');
    // Opening the inspector must not make fractional positions invalid numeric drafts.
    await box.focus();
    await box.press('Enter');
    expect(Number(await page.getByLabel('X, px', { exact: true }).inputValue())).toBeCloseTo(
      227,
      0,
    );
    await page.locator('#close-inspector').click();
    const pending = page.waitForEvent('download');
    await page.locator('#export').click();
    const file = info.outputPath('precise.html');
    await (await pending).saveAs(file);
    await page.goto(pathToFileURL(file).href);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(() => geometry(page.locator('[data-widget-id=object]'))).toEqual(exact);
    if (kind === 'presentation') {
      await page.emulateMedia({ media: 'print' });
      await expect.poll(() => geometry(page.locator('[data-widget-id=object]'))).toEqual(exact);
    }
  });
}
