import { test, expect, type Page } from '@playwright/test';
import { savedDocument } from './project-helper';

async function setup(page: Page) {
  await page.goto('/builder/');
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'shortcuts.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 6,
        kind: 'presentation',
        title: 'Клавиатура',
        pages: [
          {
            id: 'keys',
            title: '',
            grid: {
              columns: 24,
              rowHeight: 64,
              gap: 8,
              frame: { width: 1920, height: 1080, left: 100, right: 100, top: 176, bottom: 48 },
            },
            widgets: [
              {
                id: 'object',
                type: 'text',
                title: '',
                position: { col: 2, row: 2, width: 4, height: 2 },
                content: [{ type: 'paragraph', text: 'Редактируемый текст', dropCap: false }],
              },
            ],
          },
        ],
      }),
    ),
  });
  await expect(page.locator('#project-name')).toHaveValue('Клавиатура');
  const box = page.locator('#canvas [data-widget-id=object]');
  await box.click({ position: { x: 4, y: 4 } });
  await expect(box).toBeFocused();
  return box;
}
const count = async (page: Page) => (await savedDocument(page)).pages[0].widgets.length;
async function clipboard(page: Page, type: 'copy' | 'cut' | 'paste', text = '') {
  return page.evaluate(
    ({ type, text }) => {
      const transfer = new DataTransfer();
      if (text) transfer.setData('text/plain', text);
      const event = new ClipboardEvent(type, {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer,
      });
      // Firefox ignores constructor-supplied paste data for untrusted events.
      // Keep the test payload on the synthetic event; real OS copy/paste is tested separately.
      if (type === 'paste' && event.clipboardData?.getData('text/plain') !== text)
        Object.defineProperty(event, 'clipboardData', { value: transfer });
      (document.activeElement ?? document.body).dispatchEvent(event);
      return {
        text: event.clipboardData?.getData('text/plain') ?? '',
        prevented: event.defaultPrevented,
      };
    },
    { type, text },
  );
}

test('arrows move, Shift accelerates, Alt resizes, undo/redo and Delete share history', async ({
  page,
}) => {
  const box = await setup(page);
  await box.press('ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(3);
  await box.press('Shift+ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(13);
  await box.press('Alt+ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.width)
    .toBe(5);
  await box.press('Control+z');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.width)
    .toBe(4);
  await page.keyboard.press('Control+y');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.width)
    .toBe(5);
  await box.focus();
  await box.press('Delete');
  await expect.poll(() => count(page)).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(() => count(page)).toBe(1);
  await box.focus();
  await box.press('Shift+ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(20);
});

test('native clipboard events copy and cut blocks, paste repeatedly and reject malformed data atomically', async ({
  page,
}) => {
  const box = await setup(page);
  const copied = await clipboard(page, 'copy');
  expect(copied.prevented).toBe(true);
  expect(JSON.parse(copied.text).widget.id).toBe('object');
  await clipboard(page, 'paste', copied.text);
  await expect.poll(() => count(page)).toBe(2);
  await clipboard(page, 'paste', copied.text);
  await expect.poll(() => count(page)).toBe(3);
  const document = await savedDocument(page);
  expect(new Set(document.pages[0].widgets.map((widget: any) => widget.id)).size).toBe(3);
  await clipboard(page, 'cut');
  await expect.poll(() => count(page)).toBe(2);
  await page.keyboard.press('Control+z');
  await expect.poll(() => count(page)).toBe(3);
  await box.focus();
  const malformed = JSON.parse(copied.text);
  malformed.widget.type = 'not-a-widget';
  await clipboard(page, 'paste', JSON.stringify(malformed));
  expect(await count(page)).toBe(3);
  await expect(page.locator('#status')).toContainText('Неизвестный тип блока');
  expect((await clipboard(page, 'paste', 'Обычный текст')).prevented).toBe(false);
});

test('real Ctrl+C, Ctrl+V and Ctrl+X use the system clipboard', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Clipboard permissions are exposed by Chromium.');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await setup(page);
  await page.keyboard.press('Control+c');
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('alabuga/constructor-block');
  await page.keyboard.press('Control+v');
  await expect.poll(() => count(page)).toBe(2);
  const other = await page.context().newPage();
  await setup(other);
  await other.keyboard.press('Control+v');
  await expect.poll(() => count(other)).toBe(2);
  expect(await count(page)).toBe(2);
  await other.close();
  await page.keyboard.press('Control+x');
  await expect.poll(() => count(page)).toBe(1);
  await page.keyboard.press('Control+v');
  await expect.poll(() => count(page)).toBe(2);
});

test('shortcuts support Russian keyboard layout and Cmd and duplicate without browser actions', async ({
  page,
}) => {
  await setup(page);
  expect(
    await page.evaluate(
      () =>
        !window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'в',
            code: 'KeyD',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
    ),
  ).toBe(true);
  await expect.poll(() => count(page)).toBe(2);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => count(page)).toBe(1);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => count(page)).toBe(2);
});

test('keyboard and wheel zoom only the canvas, fit and reset preserve document geometry', async ({
  page,
}) => {
  await setup(page);
  const before = await savedDocument(page);
  await page.keyboard.press('Control+0');
  await expect(page.locator('#canvas')).toHaveCSS('zoom', '1');
  await page.keyboard.press('Control+=');
  await expect(page.locator('#canvas')).toHaveCSS('zoom', '1.1');
  await page.keyboard.press('Control+-');
  await expect(page.locator('#canvas')).toHaveCSS('zoom', '1');
  await page.locator('#canvas').dispatchEvent('wheel', { ctrlKey: true, deltaY: -100 });
  await expect(page.locator('#canvas')).toHaveCSS('zoom', '1.1');
  await page.keyboard.press('Shift+Digit1');
  await expect
    .poll(() => page.locator('#canvas').evaluate((canvas) => Number(getComputedStyle(canvas).zoom)))
    .toBeLessThan(1);
  await page.keyboard.press('Control+0');
  expect((await savedDocument(page)).pages).toEqual(before.pages);
  expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe('');
});

test('text fields, inline text, dialogs and composition do not trigger document commands', async ({
  page,
}) => {
  const box = await setup(page);
  const title = page.locator('#project-name');
  await title.focus();
  expect((await clipboard(page, 'copy')).prevented).toBe(false);
  await title.press('Control+d');
  await title.press('Delete');
  expect(await count(page)).toBe(1);
  const field = box.locator('[contenteditable]').first();
  await field.focus();
  expect((await clipboard(page, 'copy')).prevented).toBe(false);
  await field.press('ArrowLeft');
  expect((await savedDocument(page)).pages[0].widgets[0].position.col).toBe(2);
  await box.focus();
  await box.dispatchEvent('keydown', { key: 'Delete', code: 'Delete', isComposing: true });
  expect(await count(page)).toBe(1);
  await page.keyboard.press('F1');
  const dialog = page.getByRole('dialog', { name: 'Горячие клавиши', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Ctrl+C');
  await page.keyboard.press('Control+d');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Delete');
  expect(await count(page)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('inline text keeps native paste while canvas zoom and project download still work', async ({
  page,
}) => {
  const box = await setup(page);
  const field = box.locator('[contenteditable]').first();
  await field.focus();
  await page.keyboard.press('Control+0');
  await page.keyboard.press('Control+=');
  await expect(page.locator('#canvas')).toHaveCSS('zoom', '1.1');
  expect((await clipboard(page, 'paste', 'Текст из буфера')).prevented).toBe(true);
  await expect(field).toContainText('Текст из буфера');
  expect(await count(page)).toBe(1);
  const download = page.waitForEvent('download');
  await field.press('Control+s');
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

test('a single text click selects the block; double click and Tab keep text arrow navigation', async ({
  page,
}) => {
  const box = await setup(page),
    field = box.locator('[contenteditable]').first();
  await page.keyboard.press('Escape');
  await field.click();
  await expect(box).toBeFocused();
  await expect(box).not.toHaveAttribute('data-text-editing');
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(3);
  await field.dblclick();
  await expect(field).toBeFocused();
  await expect(box).toHaveAttribute('data-text-editing', 'true');
  await page.keyboard.press('ArrowRight');
  expect((await savedDocument(page)).pages[0].widgets[0].position.col).toBe(3);
  await page.keyboard.press('Escape');
  await expect(box).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  expect((await savedDocument(page)).pages[0].widgets[0].position.col).toBe(3);
});

test('holding arrows survives lost renderer focus and undoes as one gesture', async ({ page }) => {
  const box = await setup(page);
  for (let i = 0; i < 5; i++) {
    if (i) await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.down('ArrowRight');
  }
  await page.keyboard.up('ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(7);
  await expect(box).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(2);
  await page.keyboard.press('Control+Shift+z');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(7);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(9);
  await page.keyboard.press('Control+z');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.col)
    .toBe(8);
});

test('a held resize handle keeps its operation across renders instead of turning into movement', async ({
  page,
}) => {
  const box = await setup(page),
    handle = box.locator('[data-resize-direction=e]');
  await handle.focus();
  for (let i = 0; i < 3; i++) {
    if (i) await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.down('ArrowRight');
  }
  await page.keyboard.up('ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position)
    .toEqual({ col: 2, row: 2, width: 7, height: 2 });
  await expect(handle).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.width)
    .toBe(4);
});

test('vertical nudging visibly moves a block instead of scrolling the page to cancel its motion', async ({
  page,
}) => {
  await setup(page);
  const document = await savedDocument(page);
  document.kind = 'page';
  document.title = 'Длинный сайт';
  document.pages = Array.from({ length: 3 }, (_, index) => ({
    ...structuredClone(document.pages[0]),
    id: 'page-' + index,
    widgets: document.pages[0].widgets.map((widget: any) => ({ ...widget, id: 'widget-' + index })),
  }));
  await page.locator('#open').setInputFiles({
    name: 'long-page.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(document)),
  });
  await expect(page.locator('#project-name')).toHaveValue(document.title);
  await page.keyboard.press('Control+0');
  const box = page.locator('#canvas [data-widget-id=widget-1]');
  await box.locator('[contenteditable]').first().click();
  await box.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const before = (await box.boundingBox())!,
    scroll = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => (await savedDocument(page)).pages[1].widgets[0].position.row)
    .toBe(3);
  await expect.poll(async () => (await box.boundingBox())!.y - before.y).toBeCloseTo(72, 0);
  expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0);
  await expect(box).toHaveClass(/is-selected/);
});
