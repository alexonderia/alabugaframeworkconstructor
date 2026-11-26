import { test, expect } from '@playwright/test';
import { savedDocument } from './project-helper';
import { chooseNewProject } from './new-project-helper';

for (const kind of ['page', 'presentation'] as const) {
  test(`${kind}: a revision can be previewed without editing and restored after inspection`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: kind === 'page' ? 390 : 1440, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/builder/');
    await page
      .locator('.product-header input[type=file]')
      .setInputFiles('tests/fixtures/audit-links.json');
    if (kind === 'presentation') await chooseNewProject(page, 'demo-deck');
    await expect(page.locator('#save-state')).toHaveText('Сохранено');
    await page.locator('.history-open').click();
    let history = page.getByRole('dialog', { name: 'История версий', exact: true });
    await history.getByRole('button', { name: 'Создать версию', exact: true }).click();
    await expect(history.getByRole('status')).toHaveText('Точка восстановления создана.');
    const original = await page.evaluate(async () => {
      const storage = await import('/apps/editor/src/storage.ts' as string);
      const current = await storage.currentProject();
      return (await storage.listRevisions(current.id))[0].document;
    });
    await page.keyboard.press('Escape');
    await page.locator('#project-name').fill('Текущая рабочая версия');
    await page.locator('#project-name').blur();
    await expect(page.locator('#save-state')).toHaveText('Сохранено');
    const working = await savedDocument(page);
    await page.locator('.history-open').click();
    history = page.getByRole('dialog', { name: 'История версий', exact: true });
    const opener = history.getByRole('button', { name: 'Предпросмотр', exact: true }).first();
    await opener.click();
    const preview = page.getByRole('dialog', { name: 'Предпросмотр версии', exact: true });
    const frame = page.frameLocator('.version-preview-dialog iframe');
    await expect(preview.locator('iframe')).toHaveAttribute(
      'title',
      'Предпросмотр: ' + original.title,
    );
    await expect(
      preview.getByRole('button', { name: 'Восстановить эту версию', exact: true }),
    ).toBeEnabled();
    if (kind === 'page') {
      await expect(frame.locator('.af-page')).toHaveCount(original.pages.length);
      await expect(frame.locator('body')).toContainText('Контрольный текст');
    } else {
      await expect(frame.locator('.af-slide--active')).toHaveAttribute(
        'data-section-id',
        original.pages[0].id,
      );
      // Next first reveals the current slide's animation steps, then advances the slide.
      for (let step = 0; step <= original.pages[0].widgets.length + 1; step++) {
        if (
          (await frame.locator('.af-slide--active').getAttribute('data-section-id')) !==
          original.pages[0].id
        )
          break;
        await frame.getByRole('button', { name: 'Далее →', exact: true }).click();
      }
      await expect(frame.locator('.af-slide--active')).toHaveAttribute(
        'data-section-id',
        original.pages[1].id,
      );
    }
    expect(await savedDocument(page)).toEqual(working);
    await page.locator('.version-preview-dialog .af-dialog__header button').click();
    await expect(preview).toHaveCount(0);
    await expect(history).toBeVisible();
    await expect(opener).toBeFocused();
    expect(await savedDocument(page)).toEqual(working);
    await opener.click();
    const restore = preview.getByRole('button', { name: 'Восстановить эту версию', exact: true });
    await expect(restore).toBeEnabled();
    await restore.click();
    await expect(preview).toHaveCount(0);
    await expect(history).toHaveCount(0);
    await expect(page.locator('#project-name')).toHaveValue(original.title);
    await expect(page.locator('#save-state')).toHaveText('Сохранено');
    expect(await savedDocument(page)).toEqual(original);
    await expect(page.locator('.version-preview-dialog iframe')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
