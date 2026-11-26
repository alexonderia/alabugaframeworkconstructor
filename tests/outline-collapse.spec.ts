import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { savedDocument } from './project-helper';

async function open(page: Page, collapsed = false) {
  await page.goto('/builder/');
  await page.evaluate(
    (value) => localStorage.setItem('alabuga:outline-collapsed', String(value)),
    collapsed,
  );
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'collapse.json',
    mimeType: 'application/json',
    buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
  });
  await expect(page.locator('#project-name')).toBeVisible();
}

test('collapse frees canvas space, preserves the document and survives reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  const panel = page.locator('.editor-outline'),
    body = panel.locator('.outline-body');
  const before = await savedDocument(page);
  const originalWidth = (await page.locator('.editor-workspace').boundingBox())!.width;
  const collapse = page.getByRole('button', { name: 'Свернуть секции', exact: true });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await expect(collapse).toHaveCSS('position', 'fixed');
  await page.mouse.move(1000, 30);
  await expect(collapse).toHaveCSS('opacity', '0');
  await expect(collapse).toHaveCSS('pointer-events', 'none');
  await panel.hover();
  await expect(collapse).toHaveCSS('opacity', '1');
  await collapse.hover();
  await expect(collapse).toHaveCSS('opacity', '1');
  await page.mouse.move(1000, 30);
  await expect(collapse).toHaveCSS('opacity', '0');
  await panel.hover();
  await expect(collapse).toHaveCSS('opacity', '1');
  const floatingPosition = () =>
    collapse.evaluate((node) => {
      const button = node.getBoundingClientRect();
      const outline = document.querySelector('.editor-outline')!.getBoundingClientRect();
      return {
        verticalGap: Math.abs(button.top + button.height / 2 - (outline.top + outline.height / 2)),
        horizontalGap: Math.abs(button.left + button.width / 2 - outline.right),
        clickable: node.contains(
          document.elementFromPoint(button.left + button.width / 2, button.top + button.height / 2),
        ),
      };
    });
  await expect.poll(async () => (await floatingPosition()).verticalGap).toBeLessThanOrEqual(1);
  await expect.poll(async () => (await floatingPosition()).horizontalGap).toBeLessThanOrEqual(1);
  expect((await floatingPosition()).clickable).toBe(true);
  await collapse.click();
  const expand = page.getByRole('button', { name: 'Развернуть секции', exact: true });
  await expect(expand).toBeFocused();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await page.mouse.move(1000, 30);
  await expect(expand).toHaveCSS('opacity', '1');
  await expect(body).toBeHidden();
  await expect(panel.locator('.outline-header h2')).toBeHidden();
  await expect(panel.locator('.outline-add')).toBeHidden();
  expect(
    (await page.locator('.editor-workspace').boundingBox())!.width - originalWidth,
  ).toBeGreaterThan(150);
  expect((await page.locator('.editor-workspace').boundingBox())!.x).toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      expand.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return Math.abs(r.x + r.width / 2 - 24);
      }),
    )
    .toBeLessThanOrEqual(1);
  await page.locator('#page-settings-open').click();
  await expect(page.locator('#close-inspector')).toBeVisible();
  await expect(
    page.locator('#inspector').getByRole('img', { name: 'О настройках', exact: true }),
  ).toBeVisible();
  await expect(expand).toBeVisible();
  expect(await savedDocument(page)).toEqual(before);
  await page.reload();
  await expect(page.locator('#project-name')).toBeVisible();
  await expect(body).toBeHidden();
  await expand.press('Enter');
  await expect(body).toBeVisible();
  await expect(panel.locator('.outline-row')).toHaveCount(2);
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await expect(collapse).toBeFocused();
  await expect(collapse).toHaveCSS('opacity', '1');
  expect(await savedDocument(page)).toEqual(before);
});

test('desktop collapse preference never hides the mobile section list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, true);
  await page.getByRole('button', { name: 'Структура', exact: true }).click();
  const panel = page.locator('.editor-outline');
  await expect(panel.locator('.outline-body')).toBeVisible();
  await expect(page.locator('.outline-collapse')).toBeHidden();
  await expect(panel.locator('.outline-row')).toHaveCount(2);
  await expect(panel.locator('.outline-close')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Структура', exact: true }).click();
  await panel.locator('.outline-body').focus();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('button', { name: 'Развернуть секции', exact: true })).toBeVisible();
  await expect(panel.locator('.outline-body')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Развернуть секции', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Развернуть секции', exact: true }).click();
  await expect(panel.locator('.outline-body')).toBeVisible();
});
