import { test, expect, type Page } from '@playwright/test';
import { openEditor } from './open-editor';
import { savedDocument } from './project-helper';

const fixture = {
  schemaVersion: 3,
  kind: 'presentation',
  title: 'Геометрия',
  pages: [
    {
      id: 'geometry',
      title: '',
      grid: { columns: 12, rowHeight: 64, gap: 16 },
      widgets: [
        {
          id: 'object',
          type: 'text',
          title: '',
          position: { col: 3, row: 3, width: 4, height: 3 },
          content: [{ type: 'paragraph', text: 'Объект', dropCap: false }],
        },
      ],
    },
  ],
};
async function setup(page: Page) {
  await openEditor(page);
  await page.locator('#open').setInputFiles({
    name: 'geometry.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.locator('#status')).toContainText('Проект открыт');
  const box = page.locator('#canvas [data-widget-id=object]');
  await box.click({ position: { x: 4, y: 4 } });
  return box;
}

test('corner and edge handles resize both axes with anchored opposite edges and one undo action', async ({
  page,
}) => {
  const box = await setup(page);
  await expect(box.locator('.edge-handle')).toHaveCount(7);
  await expect(box.locator('.move-handle')).toHaveCount(0);
  await expect(box).toHaveCSS('outline-offset', '-2px');
  await expect(box).toHaveCSS('cursor', /data:image\/svg\+xml,.*16 16, move$/);
  for (const [direction, fallback] of [
    ['n', 'ns-resize'],
    ['e', 'ew-resize'],
    ['nw', 'nwse-resize'],
    ['ne', 'nesw-resize'],
  ]) {
    await expect(box.locator(`[data-resize-direction=${direction}]`)).toHaveCSS(
      'cursor',
      new RegExp(`data:image/svg\\+xml,.*16 16, ${fallback}$`),
    );
  }
  const cursorSizes = await box.evaluate(async (element) =>
    Promise.all(
      ['move', 'ns', 'ew', 'nwse', 'nesw'].map(async (name) => {
        const value = getComputedStyle(element).getPropertyValue(`--block-cursor-${name}`);
        const src = /url\("([^"]+)"\)/.exec(value)![1];
        const image = new Image();
        image.src = src;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }),
    ),
  );
  expect(cursorSizes).toEqual(Array.from({ length: 5 }, () => [32, 32]));
  await expect(box.locator('[data-resize-direction=n]')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  for (const edge of await box.locator('.boundary-handle').all()) {
    await expect(edge).toHaveCSS('min-height', '0px');
    expect(
      await edge.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element
        );
      }),
    ).toBe(true);
  }
  const panel = box.locator('..');
  const step = await panel.evaluate((element) => {
    const scale = element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth;
    return { x: (((element as HTMLElement).clientWidth + 16) / 12) * scale, y: 80 * scale };
  });
  const handle = box.locator('[data-resize-direction=nw]');
  await handle.hover();
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect(page.locator('html')).toHaveAttribute('data-block-cursor');
  await expect(page.locator('#project-name')).toHaveCSS('cursor', /16 16, nwse-resize$/);
  await page.mouse.move(
    bounds.x + bounds.width / 2 - step.x,
    bounds.y + bounds.height / 2 - step.y,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.locator('html')).not.toHaveAttribute('data-block-cursor');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position)
    .toEqual({ col: 2, row: 2, width: 5, height: 4 });
  await page.locator('#undo').click();
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position)
    .toEqual(fixture.pages[0].widgets[0].position);
  await page.locator('#redo').click();
  await box.locator('[data-resize-direction=e]').press('ArrowRight');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position)
    .toEqual({ col: 2, row: 2, width: 6, height: 4 });
});

test('dragging selected text moves its block and double click retains text editing', async ({
  page,
}) => {
  const box = await setup(page);
  const field = box.locator('[contenteditable]').last();
  const rect = (await field.boundingBox())!;
  const step = await box.locator('..').evaluate((element) => {
    const scale = element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth;
    return { x: (((element as HTMLElement).clientWidth + 16) / 12) * scale, y: 80 * scale };
  });
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + step.x, rect.y + rect.height / 2 + step.y, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position)
    .toEqual({ col: 4, row: 4, width: 4, height: 3 });
  await page.locator('#undo').click();
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position)
    .toEqual(fixture.pages[0].widgets[0].position);
  await field.dblclick();
  await expect(box).toHaveAttribute('data-text-editing', 'true');
  await expect(field).toHaveCSS('cursor', 'text');
  await field.press('End');
  await field.pressSequentially('!');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].content[0].text)
    .toBe('Объект!');
  expect((await savedDocument(page)).pages[0].widgets[0].position).toEqual(
    fixture.pages[0].widgets[0].position,
  );
  await field.press('Escape');
  await expect(box).not.toHaveAttribute('data-text-editing');
  await page.locator('#page-settings-open').click();
  await page.locator('#close-inspector').click();
  await expect(box).not.toHaveClass(/is-selected/);
  await field.dblclick();
  await expect(box).toHaveAttribute('data-text-editing', 'true');
});

test('grid steps affect keyboard and pointer movement and remain editing preferences', async ({
  page,
}) => {
  const box = await setup(page);
  await page.locator('.block-controls summary').click();
  await page.getByLabel('Шаг по горизонтали, колонок', { exact: true }).fill('2');
  await page.getByLabel('Шаг по горизонтали, колонок', { exact: true }).press('Tab');
  await page.getByLabel('Шаг по вертикали, строк', { exact: true }).fill('2');
  await page.getByLabel('Шаг по вертикали, строк', { exact: true }).press('Tab');
  await page.getByLabel('Показывать сетку', { exact: true }).check();
  await page.locator('.block-controls summary').click();
  await box.press('ArrowRight');
  await box.press('ArrowDown');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position)
    .toEqual({ col: 5, row: 5, width: 4, height: 3 });
  await page.locator('#undo').click();
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position.row)
    .toBe(3);
  await page.reload();
  await expect(page.locator('#canvas')).toHaveAttribute('data-show-grid');
  await page.locator('.block-controls summary').click();
  await expect(page.getByLabel('Шаг по горизонтали, колонок', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('Шаг по вертикали, строк', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
  const grid = page.locator('.slide-grid');
  await expect(grid).toHaveAttribute('open');
  await grid.getByLabel('Колонки', { exact: true }).fill('16');
  await grid.getByRole('button', { name: 'Применить сетку', exact: true }).click();
  await expect.poll(async () => (await savedDocument(page)).pages[0].grid.columns).toBe(16);
  expect((await savedDocument(page)).pages[0].widgets[0].position).toEqual({
    col: 6,
    row: 3,
    width: 6,
    height: 3,
  });
});

test('shift constrains dragging to one axis at reduced zoom and escape cancels edge resizing', async ({
  page,
}) => {
  const box = await setup(page);
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Уменьшить масштаб', exact: true }).click();
  const panel = box.locator('..');
  const step = await panel.evaluate((element) => {
    const scale = element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth;
    return { x: (((element as HTMLElement).clientWidth + 16) / 12) * scale, y: 80 * scale };
  });
  const move = (await box.boundingBox())!;
  await page.mouse.move(move.x + move.width / 2, move.y + move.height / 2);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(move.x + move.width / 2 + step.x * 2, move.y + move.height / 2 + step.y, {
    steps: 5,
  });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect
    .poll(async () => (await savedDocument(page)).pages[0].widgets[0].position)
    .toEqual({ col: 5, row: 3, width: 4, height: 3 });
  const edge = (await box.locator('[data-resize-direction=n]').boundingBox())!;
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
  await page.mouse.down();
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2 - step.y, { steps: 5 });
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveAttribute('data-block-cursor');
  await page.mouse.up();
  expect((await savedDocument(page)).pages[0].widgets[0].position).toEqual({
    col: 5,
    row: 3,
    width: 4,
    height: 3,
  });
});
