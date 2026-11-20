import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('backup commands travel with HTML and a downloaded project opens in a clean browser context', async ({
  page,
  browser,
}, info) => {
  await page.goto('/builder/');
  await expect(page.locator('.library-tools')).toBeVisible();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 4;
    canvas.getContext('2d')!.fillRect(0, 0, 4, 4);
    return canvas.toDataURL('image/png');
  });
  const fixture = {
    schemaVersion: 3,
    kind: 'page',
    title: 'Проект с изображением',
    pages: [
      {
        id: 'page',
        title: 'Название секции',
        grid: { columns: 12, rowHeight: 64, gap: 16 },
        widgets: [
          {
            id: 'photo',
            type: 'image',
            title: '',
            alt: 'Изображение из копии',
            src: image,
            position: { col: 1, row: 1, width: 6, height: 5 },
          },
        ],
      },
    ],
  };
  const upload = page.locator('.product-header input[type=file]');
  await upload.setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  const title = page.locator('#project-name');
  await expect(title).toHaveValue(fixture.title);
  const hint = page.locator('#backup-tip');
  await expect(hint).toBeHidden();
  await title.fill('Моя резервная копия');
  await title.blur();
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('в другом браузере');

  const desktopActions = page.locator('.editor-file-actions');
  await expect(desktopActions.locator('#save + #export')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Скачать копию (.json)', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('backup-desktop.png') });
  await hint.getByRole('button', { name: 'Понятно' }).click();
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(title).toHaveValue('Моя резервная копия');
  await page.setViewportSize({ width: 390, height: 844 });
  await title.fill('Копия с телефона');
  await title.blur();
  await expect(page.locator('#save-state')).toHaveText('Сохранено в браузере');
  await expect(hint).toBeHidden();

  const menu = page.locator('.project-menu');
  await menu.locator('summary').click();
  await expect(menu.locator('#save')).toBeInViewport({ ratio: 1 });
  await expect(menu.locator('#save + #export')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.mobile-editor-actions > .af-btn')).toHaveCount(4);
  await page.screenshot({ path: info.outputPath('backup-mobile.png') });
  const downloaded = page.waitForEvent('download');
  await menu.getByRole('button', { name: 'Скачать копию (.json)', exact: true }).click();
  const backup = await downloaded;
  expect(backup.suggestedFilename()).toBe('Копия с телефона.json');
  const buffer = await readFile((await backup.path())!);
  const portable = JSON.parse(buffer.toString());
  expect(portable).toMatchObject({
    format: 'alabuga-project',
    version: 3,
    document: { title: 'Копия с телефона' },
  });
  expect(portable.assets).toHaveLength(1);
  expect(portable.document.pages[0].widgets[0].src).toBe('asset:' + portable.assets[0].id);

  const restored = await browser.newPage();
  try {
    await restored.goto(new URL('/builder/', page.url()).href);
    await expect(restored.getByRole('group', { name: 'Создать первый проект' })).toBeVisible();
    await restored.locator('.product-header input[type=file]').setInputFiles({
      name: backup.suggestedFilename(),
      mimeType: 'application/json',
      buffer,
    });
    await expect(restored.locator('#project-name')).toHaveValue('Копия с телефона');
    const photo = restored.locator('#canvas').getByAltText('Изображение из копии');
    await expect
      .poll(() => photo.evaluate((node) => (node as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await restored.locator('#page-settings-open').click();
    await expect(restored.getByLabel('Заголовок секции', { exact: true })).toHaveValue(
      'Название секции',
    );
  } finally {
    await restored.close();
  }
});
