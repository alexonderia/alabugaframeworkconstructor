import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { chooseOption } from './choose-option';

test('basic section and text settings are visible and expanded controls survive an update', async ({
  page,
}, info) => {
  await page.goto('/builder/');
  await expect(page.locator('.library-tools')).toBeVisible();
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'section.json',
    mimeType: 'application/json',
    buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
  });
  await expect(page.locator('#project-name')).toBeVisible();
  await page.locator('#page-settings-open').click();

  const title = page.getByLabel('Заголовок секции', { exact: true });
  const style = page.locator('#design-settings details[data-setting=style]');
  await expect(title).toHaveValue('Раздел А');
  await expect(
    page.getByRole('combobox', { name: 'Расстояния между элементами', exact: true }),
  ).toBeVisible();
  await expect(style).not.toHaveAttribute('open');
  await expect(page.locator('#design-settings details[data-setting=behavior]')).not.toHaveAttribute(
    'open',
  );
  await style.locator('summary').click();
  await chooseOption(page.getByLabel('Фирменная тема', { exact: true }), 'contrast');
  await expect(page.locator('#canvas .af-page').first()).toHaveClass(/af-theme--contrast/);
  await expect(style).toHaveAttribute('open');
  await expect(title).toHaveValue('Раздел А');

  await page.locator('#canvas [data-widget-id=audit-text-a]').press('Enter');
  const properties = page.locator('#properties');
  await expect(properties.locator('details[data-setting=content]')).toHaveAttribute('open');
  await expect(
    properties.getByRole('textbox', { name: 'Текст', exact: true }).first(),
  ).toBeVisible();
  for (const setting of ['style', 'behavior', 'geometry']) {
    await expect(properties.locator(`details[data-setting=${setting}]`)).not.toHaveAttribute(
      'open',
    );
  }
  await expect(properties.getByLabel('Буквица', { exact: true }).first()).toBeHidden();
  await page.screenshot({ path: info.outputPath('text-settings-desktop.png') });
  await properties.getByText('Параметры абзаца', { exact: true }).first().click();
  await expect(properties.getByLabel('Буквица', { exact: true }).first()).toBeVisible();
});

test('the slide inspector distinguishes fitting this slide from fitting the whole deck', async ({
  page,
}, info) => {
  await page.goto('/builder/');
  await page.getByRole('button', { name: 'Создать презентацию', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Создать презентацию' });
  await create.getByRole('radio', { name: /Из образца/ }).check();
  await create.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('#project-name')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 740 });
  const slide = page.locator('#canvas .af-slide--active');
  async function slideBottom() {
    const bounds = await slide.boundingBox();
    return bounds ? bounds.y + bounds.height : Infinity;
  }
  await page.getByRole('button', { name: 'Вписать', exact: true }).click();
  await expect.poll(slideBottom).toBeLessThan(740);
  await page.locator('#backup-tip').evaluate((tip) => ((tip as HTMLElement).hidden = false));
  await expect.poll(slideBottom).toBeLessThan(740);
  await page.getByRole('button', { name: 'Понятно', exact: true }).click();
  await page.getByRole('button', { name: 'Масштаб 100%', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#page-settings-open').click();
  const structure = page.getByRole('tabpanel', { name: 'Структура', exact: true });
  await expect(structure.getByLabel('Заголовок слайда', { exact: true })).toBeVisible();
  await expect(structure.getByRole('button', { name: 'Посмотреть шаблоны' })).toBeVisible();
  await expect(structure.getByRole('button', { name: 'Изменить компоновку' })).toBeVisible();
  await expect(structure.getByRole('button', { name: /Подобрать/ })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Оформление', exact: true }).click();
  const style = page.getByRole('tabpanel', { name: 'Оформление', exact: true });
  const single = style
    .getByRole('group', { name: 'Этот слайд', exact: true })
    .getByRole('button', { name: 'Подобрать фон и размещение' });
  const all = style
    .getByRole('group', { name: 'Все слайды', exact: true })
    .getByRole('button', { name: 'Подобрать оформление всей презентации' });
  await expect(single).toBeInViewport();
  await expect(all).toBeInViewport();
  await expect(style.getByLabel('Текст подписи')).toBeHidden();
  await page.screenshot({ path: info.outputPath('slide-settings-mobile.png') });

  await single.click();
  await expect(
    page.getByRole('dialog', { name: 'Подобрать оформление', exact: true }),
  ).toBeVisible();
  await page.locator('.fit-dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(single).toBeFocused();
  await all.click();
  await expect(
    page.getByRole('dialog', { name: 'Оформить презентацию', exact: true }),
  ).toBeVisible();
});
