import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { savedDocument } from './project-helper';
import { chooseOption } from './choose-option';

for (const width of [1440, 390]) {
  test(`block settings edit fragments first and keep direct settings groups at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/builder/');
    await page.locator('.product-header input[type=file]').setInputFiles({
      name: 'block.json',
      mimeType: 'application/json',
      buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
    });
    await page.locator('#canvas [data-widget-id=audit-text-a]').press('Enter');
    const panel = page.locator('#inspector'),
      form = panel.locator('.property-form');
    await expect(panel).toHaveAttribute('data-inspector-view', 'block');
    await expect(form.locator('.block-settings-type')).toHaveText('Текст');
    const content = form.locator(':scope > details[data-setting=content]');
    await expect(content).toBeVisible();
    for (const setting of ['style', 'geometry', 'behavior'])
      await expect(form.locator(`:scope > details[data-setting=${setting}]`)).toHaveCount(1);
    await expect(form.locator('details[data-setting=advanced]')).toHaveCount(0);
    const fragments = content.locator('.block-fragment');
    await expect(fragments).toHaveCount(2);
    await expect(content.locator('.af-field').first().locator('textarea')).toHaveAttribute(
      'aria-label',
      'Текст',
    );
    await fragments
      .first()
      .getByRole('textbox', { name: 'Текст', exact: true })
      .fill('Новая редакция');
    await expect
      .poll(async () => (await savedDocument(page)).pages[0].widgets[0].content[0].text)
      .toBe('Новая редакция');
    await fragments.last().getByRole('button', { name: 'Поднять фрагмент', exact: true }).click();
    await expect
      .poll(async () => (await savedDocument(page)).pages[0].widgets[0].content[0].type)
      .toBe('link');
    await expect(fragments.last().getByRole('textbox', { name: 'Текст', exact: true })).toHaveValue(
      'Новая редакция',
    );
    await chooseOption(
      content.getByRole('combobox', { name: 'Новый фрагмент', exact: true }),
      'heading',
    );
    await content.getByRole('button', { name: 'Добавить фрагмент', exact: true }).click();
    await expect(fragments).toHaveCount(3);
    await expect
      .poll(async () => (await savedDocument(page)).pages[0].widgets[0].content.length)
      .toBe(3);
    await fragments.last().getByRole('button', { name: 'Удалить фрагмент', exact: true }).click();
    await expect(fragments).toHaveCount(2);
    await expect
      .poll(async () => (await savedDocument(page)).pages[0].widgets[0].content.length)
      .toBe(2);
    const style = form.locator(':scope > details[data-setting=style]');
    await style.locator('summary').click();
    await expect(
      style.getByRole('combobox', { name: 'Выравнивание содержимого', exact: true }),
    ).toBeVisible();
    await content.locator(':scope > summary').click();
    await panel.locator('.inspector-body').evaluate((node) => (node.scrollTop = 0));
    await panel.screenshot({ path: info.outputPath(`block-settings-${width}.png`) });
    await expect(form.getByRole('region', { name: 'Действия с блоком', exact: true })).toHaveCount(
      1,
    );
    expect(
      await panel
        .locator('.inspector-body')
        .evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    await panel.locator('#close-inspector').click();
    await page.reload();
    await expect(page.locator('#project-name')).toBeVisible();
    expect((await savedDocument(page)).pages[0].widgets[0].content[1].text).toBe('Новая редакция');
  });
}
