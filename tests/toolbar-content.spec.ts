import {chooseNewProject} from './new-project-helper';
import { test, expect } from '@playwright/test';
import { chooseOption } from './choose-option';

test('section list fits its labels and fit uses an icon in the fixed toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/builder/');
  await page
    .locator('.product-header input[type=file]')
    .setInputFiles('tests/fixtures/audit-links.json');
  await page.locator('.project-menu summary').click();
  await chooseNewProject(page, 'demo-page');
  await expect(page.locator('#save-state')).toHaveText('Сохранено');
  await page.locator('#page-settings-open').click();
  const toolbar = page.locator('.canvas-toolbar');
  await expect(toolbar.locator('#add-widget')).toBeHidden();
  const fit = toolbar.getByRole('button', { name: 'Вписать', exact: true });
  await expect(fit).toHaveText('');
  await expect(fit.locator('svg')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.section-toolbar .page-picker')
        .evaluate((n) => n.getBoundingClientRect().width),
    )
    .toBeGreaterThan(200);
  await page.getByRole('combobox', { name: 'Выбрать секцию или слайд', exact: true }).click();
  const options = page.locator('.section-toolbar .af-select-option');
  await expect(options).toHaveCount(10);
  expect(
    await options.evaluateAll((nodes) => nodes.every((n) => n.scrollWidth <= n.clientWidth)),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await chooseOption(page.locator('#pages'), '1');
  await expect(page.locator('#pages')).toHaveValue('1');
  expect(await toolbar.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
  await fit.click();
  await expect(toolbar.locator('.canvas-zoom button').nth(1)).toContainText('%');
});

test('save status follows unsent input, completed writes and storage failure recovery', async ({
  page,
}) => {
  await page.goto('/builder/');
  await page
    .locator('.product-header input[type=file]')
    .setInputFiles('tests/fixtures/audit-links.json');
  const state = page.locator('#save-state'),
    title = page.locator('#project-name');
  await expect(state).toHaveText('Сохранено');
  await expect(state.locator('.af-icon--success')).toBeVisible();
  await title.fill('Изменённый проект');
  await expect(state).toHaveText('Есть несохранённые изменения');
  await expect(state.locator('svg.save-state-icon')).toBeVisible();
  const icon = (await state.locator('.save-state-icon').boundingBox())!;
  expect(icon.width).toBe(16);
  expect(icon.height).toBe(16);
  await title.blur();
  await expect(state).toHaveText('Сохранено');
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    (window as any).restoreSaveTransaction = () => (IDBDatabase.prototype.transaction = original);
    IDBDatabase.prototype.transaction = function (...args: any[]) {
      if (args[1] === 'readwrite') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.apply(this, args as any);
    };
  });
  await title.fill('Несохранённая версия');
  await title.blur();
  await expect(page.locator('#builder')).toHaveClass(/save-failed/);
  await expect(state).toHaveText('Есть несохранённые изменения');
  await page.evaluate(() => (window as any).restoreSaveTransaction());
  await page.getByRole('button', { name: 'Повторить сохранение', exact: true }).click();
  await expect(state).toHaveText('Сохранено');
  await expect(state.locator('.af-icon--success')).toBeVisible();
});
