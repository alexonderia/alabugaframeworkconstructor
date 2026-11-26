import { test, expect, type Page } from '@playwright/test';
import { chooseOption } from './choose-option';
import { pathToFileURL } from 'node:url';

async function setup(page: Page) {
  await page.goto('/builder/');
  const id = await page.evaluate(async () => {
    const { createDocumentFromTemplate } = await import('/apps/editor/src/templates.ts' as string);
    const { saveProject } = await import('/apps/editor/src/storage.ts' as string);
    const doc = createDocumentFromTemplate('page', 'document/page/corporate');
    doc.pages = doc.pages.slice(0, 1);
    doc.title = 'Настройки привязки';
    doc.templateInfo = { documentGrid: doc.pages[0].grid };
    const id = crypto.randomUUID();
    await saveProject(id, doc);
    return id;
  });
  await page.evaluate((id) => (location.hash = '/edit/' + id), id);
  await expect(page.locator('#project-name')).toHaveValue('Настройки привязки');
  return page.locator('.block-controls summary');
}

test('snap popover exposes state, info and option hints, and closes in layers with Escape', async ({
  page,
}) => {
  const trigger = await setup(page),
    panel = page.getByRole('dialog', { name: 'Настройки привязки', exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect(panel.locator('p')).toHaveCount(0);
  await expect(panel.locator('.block-controls-steps')).toBeVisible();
  const strictHeight = (await panel.boundingBox())!.height;
  await panel.getByRole('img', { name: 'О режиме привязки', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('ближайшей линии');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(panel).toBeVisible();
  const combo = panel.getByRole('combobox', { name: 'Режим привязки', exact: true });
  await combo.click();
  const option = panel.getByRole('option', { name: 'Комбинированная', exact: true });
  await option.hover();
  await expect(page.getByRole('tooltip')).toContainText('6 экранных пикселей');
  await option.click();
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(panel.locator('.block-controls-steps')).toBeHidden();
  expect((await panel.boundingBox())!.height).toBeLessThan(strictHeight);
  await combo.focus();
  await combo.press('ArrowDown');
  await expect(combo).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('tooltip')).toContainText('6 экранных пикселей');
  await page.keyboard.press('Escape');
  await expect(combo).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(panel).toBeVisible();
  await trigger.click();
  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.press('Enter');
  await expect(panel).toBeVisible();
  await expect(combo).toBeFocused();
  await page.locator('#project-name').click();
  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#project-name')).toBeFocused();
});

test('snap popover fits a narrow screen, uses explicit close and opens the grid settings', async ({
  page,
}) => {
  const trigger = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.editor-more > summary').click();
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Настройки привязки', exact: true });
  await expect(panel).toBeVisible();
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(11);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(379);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(833);
  await panel.getByRole('button', { name: 'Закрыть настройки привязки', exact: true }).click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await panel.getByRole('button', { name: 'Настроить сетку раздела', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('.advanced-grid')).toBeVisible();
});

test('resizing a header across the old mobile breakpoint keeps typography through preview and history', async ({
  page,
}, info) => {
  const trigger = await setup(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const box = page.locator('#canvas header .af-widget').first(),
    title = box.locator('.af-title');
  const expectFont = async () =>
    expect
      .poll(async () =>
        Math.round(await title.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))),
      )
      .toBe(24);
  await expectFont();
  await box.click({ position: { x: 8, y: 8 } });
  await trigger.click();
  await chooseOption(page.getByLabel('Режим привязки', { exact: true }), 'off');
  await trigger.click();
  const resize = async (dx: number) => {
    const edge = box.locator('[data-resize-direction=e]');
    await edge.scrollIntoViewIfNeeded();
    const b = (await edge.boundingBox())!,
      scale = await box
        .locator('..')
        .evaluate((e) => e.getBoundingClientRect().width / (e as HTMLElement).offsetWidth);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx * scale, b.y + b.height / 2, { steps: 6 });
    await expectFont();
    await page.mouse.up();
    await expectFont();
  };
  await resize(400);
  await resize(-500);
  await page.locator('#undo').click();
  await expectFont();
  await page.locator('#redo').click();
  await expectFont();
  await page.locator('#preview').click();
  const previewTitle = page
    .frameLocator('.project-preview iframe')
    .locator('header .af-widget')
    .first()
    .locator('.af-title');
  await expect
    .poll(async () =>
      Math.round(await previewTitle.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))),
    )
    .toBe(24);
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await expectFont();
  await page.reload();
  await expect(page.locator('#project-name')).toHaveValue('Настройки привязки');
  await expectFont();
  const pending = page.waitForEvent('download');
  await page.locator('#export').click();
  const file = info.outputPath('header-font.html');
  await (await pending).saveAs(file);
  await page.goto(pathToFileURL(file).href);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect
    .poll(async () =>
      Math.round(
        await page
          .locator('header .af-widget')
          .first()
          .locator('.af-title')
          .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      ),
    )
    .toBe(24);
});
