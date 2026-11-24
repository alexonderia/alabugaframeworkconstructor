import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { savedDocument } from './project-helper';
import { chooseOption } from './choose-option';

async function settledScroll(page: Page) {
  await expect(page.locator('#builder')).not.toHaveAttribute('aria-busy');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  return page.evaluate(() => scrollY);
}

async function open(page: Page, kind = 'page') {
  const doc = JSON.parse(
    await readFile(new URL('./fixtures/audit-links.json', import.meta.url), 'utf8'),
  );
  doc.kind = kind;
  doc.pages = Array.from({ length: 8 }, (_, index) => {
    const section = structuredClone(doc.pages[0]);
    section.id = 'scroll-section-' + index;
    section.title = 'Секция ' + (index + 1);
    section.widgets = section.widgets.slice(0, 1);
    section.widgets[0].id += '-' + index;
    return section;
  });
  await page.goto('/builder/');
  await page.locator('.product-header input[type=file]').setInputFiles({
    name: 'navigation-scroll.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.locator('#project-name')).toBeVisible();
  return new URL(page.url()).hash.slice('#/edit/'.length);
}

for (const width of [1440, 390]) {
  test(`opening a project starts at the top; only returning from its preview restores work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const id = await open(page),
      before = await savedDocument(page);
    if (width === 1440) await chooseOption(page.locator('#device'), 'tablet');
    if (width === 390) await page.getByRole('button', { name: 'Структура', exact: true }).click();
    await page.locator('.outline-select').nth(4).click();
    await expect(page.locator('#pages')).toHaveValue('4');
    await page.evaluate(() => scrollTo({ top: 700, behavior: 'instant' }));
    expect(await page.evaluate(() => scrollY)).toBe(700);
    await page.locator('#preview').evaluate((node) => (node as HTMLButtonElement).click());
    await expect(
      page.frameLocator('.project-preview iframe').locator('.af-document'),
    ).toBeVisible();
    await expect(page.getByText('Загружаем предпросмотр…', { exact: true })).toHaveCount(0);
    expect(await settledScroll(page)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await expect(page.locator('#pages')).toHaveValue('4');
    expect(await settledScroll(page)).toBe(700);
    await page.getByRole('button', { name: '← Проекты', exact: true }).click();
    await expect(page.locator('.library-tools')).toBeVisible();
    expect(await settledScroll(page)).toBe(0);
    await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await expect(page.locator('#pages')).toHaveValue('0');
    await expect(page.locator('#device')).toHaveValue(width === 1440 ? 'tablet' : 'desktop');
    expect(await settledScroll(page)).toBe(0);
    expect(await savedDocument(page)).toEqual(before);
    await page.goBack();
    await expect(page.locator('.library-tools')).toBeVisible();
    await page.evaluate((id) => (location.hash = '/view/' + id), id);
    await expect(
      page.frameLocator('.project-preview iframe').locator('.af-document'),
    ).toBeVisible();
    await expect(page.getByText('Загружаем предпросмотр…', { exact: true })).toHaveCount(0);
    expect(await settledScroll(page)).toBe(0);
    if (width === 1440)
      expect(
        await page
          .frameLocator('.project-preview iframe')
          .locator('html')
          .evaluate((node) => node.ownerDocument.defaultView!.innerWidth),
      ).toBe(768);
  });
}

test('browser history and reload do not restore a different page scroll', async ({ page }) => {
  await open(page);
  await page.evaluate(() => scrollTo({ top: 700, behavior: 'instant' }));
  expect(await page.evaluate(() => scrollY)).toBe(700);
  await page.evaluate(() => (location.hash = '/projects'));
  await expect(page.locator('.library-tools')).toBeVisible();
  expect(await settledScroll(page)).toBe(0);
  await page.goBack();
  await expect(page.locator('#project-name')).toBeVisible();
  expect(await settledScroll(page)).toBe(0);
  await page.evaluate(() => scrollTo({ top: 500, behavior: 'instant' }));
  await page.goForward();
  await expect(page.locator('.library-tools')).toBeVisible();
  expect(await settledScroll(page)).toBe(0);
  await page.goBack();
  await expect(page.locator('#project-name')).toBeVisible();
  await page.evaluate(() => scrollTo({ top: 600, behavior: 'instant' }));
  await page.reload();
  await expect(page.locator('#project-name')).toBeVisible();
  expect(await settledScroll(page)).toBe(0);
});

test('a presentation opens at its first slide from the gallery and retains the chosen slide in an editor preview', async ({
  page,
}) => {
  await open(page, 'presentation');
  await page.locator('.outline-select').nth(4).click();
  await expect(page.locator('#pages')).toHaveValue('4');
  await page.locator('#preview').click();
  const slide = page.frameLocator('.project-preview iframe').locator('.af-slide--active');
  await expect(slide).toHaveAttribute('data-section-id', 'scroll-section-4');
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await expect(page.locator('#pages')).toHaveValue('4');
  await page.getByRole('button', { name: '← Проекты', exact: true }).click();
  await page.locator('.project-thumbnail').click();
  await expect(slide).toHaveAttribute('data-section-id', 'scroll-section-0');
  expect(await settledScroll(page)).toBe(0);
});
