import { test, expect, type Page } from '@playwright/test';
import { makeComposition } from '@alabuga/framework/compositions';

async function open(page: Page) {
  const pages = Array.from({ length: 12 }, (_, index) => {
    const section = makeComposition('split', 'page');
    section.id = `panel-${index}`;
    section.title = `Раздел ${index + 1}: описание проекта и возможностей для автора`;
    section.widgets.forEach((widget, i) => {
      widget.id = `panel-${index}-widget-${i}`;
    });
    return section;
  });
  await page.goto('/builder/');
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'panels.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ schemaVersion: 3, kind: 'page', title: 'Панели редактора', pages }),
    ),
  });
  await expect(page.locator('#project-name')).toHaveValue('Панели редактора');
}

for (const width of [1536, 390]) {
  test(`outline keeps its header visible and scrolls without a scrollbar at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const panel = page.locator('.editor-outline'),
      body = panel.locator('.outline-body');
    if (width === 390) await page.getByRole('button', { name: 'Структура', exact: true }).click();
    await expect(panel).toBeVisible();
    await expect(panel.locator('.outline-count')).toHaveText('12');
    await expect(body).toHaveCSS('scrollbar-width', 'none');
    expect(
      await body.evaluate((node) => (node as HTMLElement).offsetWidth - node.clientWidth),
    ).toBe(0);
    const header = panel.locator('.outline-header');
    const top = (await header.boundingBox())!.y;
    await body.hover();
    await page.mouse.wheel(0, 650);
    await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
    expect(Math.abs((await header.boundingBox())!.y - top)).toBeLessThanOrEqual(1);
    await body.evaluate((node) => (node.scrollTop = 0));
    await body.focus();
    await body.press('PageDown');
    await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
    await panel.locator('.outline-select').last().click();
    await expect(page.locator('#pages')).toHaveValue('11');
    await expect(panel.locator('.outline-row.is-current .outline-select')).toHaveAttribute(
      'data-outline-index',
      '11',
    );
    if (width === 390) {
      await expect(panel).toBeHidden();
      await page.getByRole('button', { name: 'Структура', exact: true }).click();
    }
    await expect(header).toBeInViewport({ ratio: 1 });
    const info = panel.getByRole('button', { name: 'О структуре документа', exact: true });
    await info.click();
    await expect(panel.getByRole('tooltip')).toContainText('Alt');
    await page.keyboard.press('Escape');
    await expect(panel.getByRole('tooltip')).toBeHidden();
    await expect(panel).toBeVisible();
    if (width === 390) {
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(page.getByRole('button', { name: 'Структура', exact: true })).toBeFocused();
    }
  });
}

test('inspector fields scroll beneath the header without nested fieldset frames', async ({
  page,
}) => {
  await open(page);
  await page.locator('#canvas .af-widget--text').first().press('Enter');
  const panel = page.locator('#inspector'),
    body = panel.locator('.inspector-body');
  await expect(body).toHaveCSS('scrollbar-width', 'none');
  expect(await body.evaluate((node) => (node as HTMLElement).offsetWidth - node.clientWidth)).toBe(
    0,
  );
  const style = panel.locator('#properties details[data-setting=style]');
  await style.locator('summary').click();
  await expect(style.locator('.block-editor').first()).toHaveCSS('border-left-width', '0px');
  await expect(style.locator('.block-editor').first()).toHaveCSS('border-top-width', '0px');
  const header = panel.locator('.drawer-header');
  const top = (await header.boundingBox())!.y;
  await body.hover();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
  expect(Math.abs((await header.boundingBox())!.y - top)).toBeLessThanOrEqual(1);
  await expect(panel.locator('#close-inspector')).toBeInViewport({ ratio: 1 });
});
