import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/builder/');
  await page
    .locator('.product-header input[type=file]')
    .setInputFiles('tests/fixtures/audit-links.json');
  await expect(page.locator('#project-name')).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`file, creation, recovery and help commands stay separate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page);
    const file = page.locator('.project-menu > summary');
    await expect(file).toHaveText('Файл');
    await file.focus();
    await file.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'Создать проект…', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(file).toBeFocused();
    await file.click();
    const menu = page.locator('.project-menu .command-menu');
    await expect(menu.getByRole('button', { name: 'Мои проекты', exact: true })).toHaveCount(0);
    expect(await menu.evaluate((n) => n.scrollHeight <= n.clientHeight)).toBe(true);
    await menu.getByRole('button', { name: 'Настройки проекта…', exact: true }).click();
    await expect(page.locator('#inspector-title')).toHaveText('Настройки документа');
    for (const name of ['Мои проекты', 'История версий', 'Скачать копию (.json)'])
      await expect(
        page.locator('#inspector').getByRole('button', { name, exact: true }),
      ).toHaveCount(0);
    await page.locator('#close-inspector').click();
    await file.click();
    await page.getByRole('button', { name: 'Создать проект…', exact: true }).click();
    const creation = page.getByRole('dialog', { name: 'Создать проект', exact: true });
    await expect(creation.getByRole('button', { name: 'Новый сайт', exact: true })).toBeVisible();
    await creation.getByRole('button', { name: 'Новая презентация', exact: true }).click();
    await expect(creation).toBeHidden();
    await expect(page.locator('#canvas .af-slide--active')).toHaveCount(1);
    await expect(page.locator('#save-state')).toHaveText('Сохранено');
    const savedTitle = await page.locator('#project-name').inputValue();
    await page.locator('.editor-history .history-open').click();
    let history = page.getByRole('dialog', { name: 'История версий', exact: true });
    await history.getByRole('button', { name: 'Создать версию', exact: true }).click();
    await expect(history.getByRole('status')).toHaveText('Точка восстановления создана.');
    await expect(history.locator('.version-history-entry')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.locator('#project-name').fill('Изменённая презентация');
    await page.locator('#project-name').blur();
    await expect(page.locator('#save-state')).toHaveText('Сохранено');
    await page.locator('.history-open').click();
    history = page.getByRole('dialog', { name: 'История версий', exact: true });
    await history
      .getByRole('button', { name: 'Восстановить эту версию', exact: true })
      .first()
      .click();
    await expect(page.locator('#project-name')).toHaveValue(savedTitle);
    const help = page.locator('.editor-help > summary');
    await help.click();
    await page
      .locator('.editor-help')
      .getByRole('button', { name: 'Горячие клавиши', exact: true })
      .click();
    await expect(page.getByRole('dialog', { name: 'Горячие клавиши', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeFocused();
    const downloaded = page.waitForEvent('download');
    if (width < 768) await file.click();
    await page.locator('#save').click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.json$/);
    if (width < 768) await file.click();
    await page.getByRole('button', { name: 'Проверка качества', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Проверка качества', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('#open').setInputFiles('tests/fixtures/audit-links.json');
    await expect(page.locator('#project-name')).toHaveValue('Аудит связей и данных');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(errors).toEqual([]);
  });

  test(`materials can be uploaded and added from the left tab at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const before = await page.locator('#canvas .af-widget--image').count();
    if (width < 768) await page.locator('.mobile-editor-actions .outline-toggle').click();
    await page.getByRole('tab', { name: 'Материалы', exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: 'Материалы', exact: true });
    await expect(
      panel.getByRole('searchbox', { name: 'Поиск материалов', exact: true }),
    ).toBeVisible();
    const buffer = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 2;
        canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
        return canvas.toDataURL().split(',')[1];
      }),
      'base64',
    );
    await panel
      .locator('input[type=file]')
      .setInputFiles({ name: 'navigation.png', mimeType: 'image/png', buffer });
    const add = panel.getByRole('button', { name: 'Добавить на холст', exact: true });
    await expect(add).toBeEnabled();
    await add.click();
    await expect(page.locator('#canvas .af-widget--image')).toHaveCount(before + 1);
    if (width < 768) {
      await expect(page.locator('.editor-outline')).toBeHidden();
      await page.locator('.mobile-editor-actions .outline-toggle').click();
    }
    await page.getByRole('tab', { name: 'Материалы', exact: true }).click();
    await panel.getByRole('button', { name: 'Хранилище и материалы', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Хранилище и материалы', exact: true }),
    ).toBeVisible();
  });
}
