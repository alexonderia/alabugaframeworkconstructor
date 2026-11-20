import { expect, test } from '@playwright/test';

test('the first visit separates examples from creation and shows both project formats', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/');
  const editor = page.getByRole('link', { name: 'Открыть редактор', exact: true });
  const examples = page.getByRole('link', { name: 'Посмотреть образцы', exact: true });
  await expect(editor).toBeInViewport();
  await expect(examples).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Справочник Framework' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('demo-mobile.png') });
  await examples.click();
  await expect(page.getByRole('heading', { name: 'Готовые образцы' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Редактировать образец сайта' })).toBeVisible();
  await editor.click();

  const actions = page.getByRole('group', { name: 'Создать первый проект' });
  const site = actions.getByRole('button', { name: 'Создать сайт', exact: true });
  const presentation = actions.getByRole('button', { name: 'Создать презентацию', exact: true });
  await expect(site).toBeInViewport();
  await expect(presentation).toBeInViewport();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.locator('.project-section, .project-card')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('first-project-mobile.png') });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(site).toBeInViewport();
  await expect(presentation).toBeInViewport();
  await page.screenshot({ path: info.outputPath('first-project-desktop.png') });
  await presentation.click();
  const dialog = page.getByRole('dialog', { name: 'Создать презентацию' });
  await expect(dialog.getByRole('radio', { name: /С нуля/ })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: /Из образца/ })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: /С помощью ИИ/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.locator('#project-name')).toHaveValue('Новая презентация');
  await page.getByRole('button', { name: '← Проекты', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Поиск проектов' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Новая презентация', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Посмотреть образцы', exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/#examples$/);
  await expect(page.getByRole('heading', { name: 'Готовые образцы' })).toBeInViewport();
});
