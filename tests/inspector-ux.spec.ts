import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { chooseOption } from './choose-option';

test('basic section and text settings are visible and expanded controls survive an update', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
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
  await expect(style).toHaveAttribute('open');
  await expect(page.locator('.advanced-grid')).not.toHaveAttribute('open');
  await chooseOption(page.getByLabel('Фирменная тема', { exact: true }), 'contrast');
  await expect(page.locator('#canvas .af-page').first()).toHaveClass(/af-theme--contrast/);
  await expect(style).toHaveAttribute('open');
  await expect(title).toHaveValue('Раздел А');
  await page.locator('.inspector-body').evaluate((node) => (node.scrollTop = 0));
  await page.screenshot({ path: info.outputPath('section-settings-desktop.png') });

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
  await expect(style.getByLabel('Текст подписи', { exact: true })).toBeHidden();
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

test('site text formatting and link spacing survive reload, preview, and HTML export', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  const source = JSON.parse(
    await readFile(new URL('./fixtures/audit-links.json', import.meta.url), 'utf8'),
  );
  const text = source.pages[0].widgets.find(
    (widget: { id: string }) => widget.id === 'audit-text-a',
  );
  text.content[0].text = 'Проектируйте и испытывайте прототипы в инженерной лаборатории.';
  text.content.push({ type: 'link', text: 'Как поступить', href: '#audit-b' });
  text.position.height = 5;
  text.position.width = 5;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/builder/');
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'typography.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  });
  const block = page.locator('#canvas [data-widget-id=audit-text-a]');
  await block.press('Enter');
  const properties = page.locator('#properties');
  await properties.locator('details[data-setting=content] > summary').click();
  await properties.locator('details[data-setting=style] > summary').click();
  await page.evaluate(() => {
    window.addEventListener('click', (event) => {
      if ((event.target as Element).closest('.af-select-list [role="option"]'))
        document.body.dataset.selectOptionDefaultPrevented = String(event.defaultPrevented);
    });
  });
  const font = properties.getByRole('combobox', { name: 'Шрифт', exact: true });
  await chooseOption(font, 'georgia');
  await expect(page.locator('body')).toHaveAttribute(
    'data-select-option-default-prevented',
    'true',
  );
  await expect(font).toHaveAttribute('aria-expanded', 'false');
  await expect(font).toBeFocused();
  await properties.getByLabel('Размер, px', { exact: true }).fill('22');
  await properties.getByLabel('Цвет, HEX', { exact: true }).fill('#243857');
  await chooseOption(
    properties.getByRole('combobox', { name: 'Начертание', exact: true }),
    'italic',
  );
  await properties.getByLabel('Межстрочный интервал', { exact: true }).fill('1.5');
  await properties.getByLabel('Межбуквенный интервал, px', { exact: true }).fill('1');
  await chooseOption(
    properties.getByRole('combobox', { name: 'Выравнивание текста', exact: true }),
    'center',
  );

  const verify = async (target: typeof block) => {
    const paragraph = target.locator('.af-prose > p');
    await expect(paragraph).toHaveCSS('font-family', /Georgia/);
    await expect(paragraph).toHaveCSS('font-size', '22px');
    await expect(paragraph).toHaveCSS('color', 'rgb(36, 56, 87)');
    await expect(paragraph).toHaveCSS('font-style', 'italic');
    await expect(paragraph).toHaveCSS('line-height', '33px');
    await expect(paragraph).toHaveCSS('letter-spacing', '1px');
    await expect(paragraph).toHaveCSS('text-align', 'center');
    const links = target.locator('.af-prose > .af-link--inline');
    await expect(links).toHaveCount(2);
    await expect(links.last()).toHaveCSS('display', 'block');
    await expect(links.last()).toHaveCSS('margin-block-start', '8px');
  };
  await verify(block);
  await page.screenshot({ path: info.outputPath('typography-desktop.png') });
  await page.reload();
  await verify(block);
  await page.locator('#preview').click();
  await verify(
    page.frameLocator('.project-preview iframe').locator('[data-widget-id=audit-text-a]'),
  );
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await expect(block).toBeVisible();
  const download = page.waitForEvent('download', { timeout: 10000 });
  await page.locator('#export').click();
  await expect(page.locator('#status')).toContainText('HTML скачан.');
  const exported = info.outputPath('typography.html');
  await (await download).saveAs(exported);
  await page.goto(pathToFileURL(exported).href);
  await verify(page.locator('[data-widget-id=audit-text-a]'));
  expect(errors).toEqual([]);
});

test('inserting a site section reveals the insertion control and keeps the toolbar visible', async ({
  page,
}, info) => {
  await page.goto('/builder/');
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'section.json',
    mimeType: 'application/json',
    buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
  });
  await page.locator('#page-settings-open').click();
  const add = page.locator('#end-add').getByRole('button', { name: 'Добавить секцию' });
  await expect(add).toHaveClass(/\baf-btn--icon\b/);
  await expect(add).toHaveClass(/\baf-btn--round\b/);
  await expect(add).toHaveText('');
  await add.click();
  await page.locator('#catalog [data-template=blank]').click();
  const section = page.locator('#canvas .af-page').last();
  const insertion = section.locator('xpath=preceding-sibling::*[1]');
  await expect(page.locator('#canvas .af-page')).toHaveCount(3);
  await expect(insertion.getByRole('button', { name: 'Добавить секцию' })).toBeInViewport({
    ratio: 1,
  });
  await expect(page.locator('#page-settings-open')).toBeInViewport({ ratio: 1 });
  await expect
    .poll(
      async () =>
        (await insertion.boundingBox())!.y -
        ((await page.locator('.canvas-toolbar').boundingBox())!.y +
          (await page.locator('.canvas-toolbar').boundingBox())!.height),
    )
    .toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: info.outputPath('inserted-section-desktop.png') });
});
