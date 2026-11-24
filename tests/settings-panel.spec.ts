import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { chooseOption } from './choose-option';

for (const width of [1440, 390]) {
  test(`settings help closes before the panel, keeps focus and fits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/builder/');
    await page.locator('.product-header input[type=file]').setInputFiles({
      name: 'settings.json',
      mimeType: 'application/json',
      buffer: await readFile(new URL('./fixtures/audit-links.json', import.meta.url)),
    });
    const trigger = page.locator('#page-settings-open');
    await trigger.click();
    const panel = page.locator('#inspector');
    await expect(panel.locator('.setting-description')).toHaveCount(0);
    const titleInfo = panel.getByRole('button', {
      name: 'О настройке «Заголовок секции»',
      exact: true,
    });
    await titleInfo.click();
    await expect(panel.getByRole('tooltip')).toContainText('Название раздела в структуре проекта');
    await expect(
      panel
        .locator('.inspector-body p')
        .filter({ hasText: 'Название раздела в структуре проекта' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    const info = panel.getByRole('button', { name: 'О настройках', exact: true });
    await info.click();
    await expect(info).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByRole('tooltip')).toContainText('Применить сетку');
    await page.keyboard.press('Escape');
    await expect(panel.getByRole('tooltip')).toBeHidden();
    await expect(panel).toBeVisible();
    await expect(info).toBeFocused();
    await panel.getByRole('button', { name: 'О режиме редактора', exact: true }).click();
    await expect(panel.getByRole('tooltip')).toContainText('Переключение не изменяет документ');
    const bounds = await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const close = panel.locator('#close-inspector');
    await expect(close).toBeInViewport();
    await close.click();
    await expect(panel).toBeHidden();
    await expect(page.getByRole('tooltip')).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('tooltip')).toBeHidden();
  });
}

for (const kind of ['page', 'presentation'] as const) {
  test(`${kind}: grid settings explain every field and separate apply, cancel and reset`, async ({
    page,
  }) => {
    await page.goto('/builder/');
    await expect(page.locator('.library-tools')).toBeVisible();
    const id = await page.evaluate(async (kind) => {
      const { createDocumentFromTemplate } = await import(
        '/apps/editor/src/templates.ts' as string
      );
      const { saveProject } = await import('/apps/editor/src/storage.ts' as string);
      const doc = createDocumentFromTemplate(kind, `document/${kind}/corporate`);
      doc.templateInfo = { ...doc.templateInfo, documentGrid: doc.pages[0].grid };
      const id = crypto.randomUUID();
      await saveProject(id, doc);
      return id;
    }, kind);
    await page.evaluate((id) => (location.hash = '/edit/' + id), id);
    await page.locator('#page-settings-open').click();
    await chooseOption(
      page.getByRole('combobox', { name: 'Режим редактора', exact: true }),
      'advanced',
    );
    const grid = page.locator(kind === 'page' ? '.advanced-grid' : '.slide-grid');
    await grid.locator('summary').click();
    // Nested disclosure headings need the same gutters as other buttons,
    // including when their focus border is visible.
    const gridHeading = grid.locator(':scope > summary');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const open of [false, true]) {
        await grid.evaluate((node, open) => ((node as HTMLDetailsElement).open = open), open);
        await gridHeading.focus();
        const gutters = await gridHeading.evaluate((node) => {
          const style = getComputedStyle(node),
            box = node.getBoundingClientRect();
          const text = [...node.childNodes].find(
            (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
          );
          if (!text) throw new Error('Disclosure heading text is missing');
          const range = document.createRange();
          range.selectNode(text);
          return {
            left: parseFloat(style.paddingLeft),
            right: parseFloat(style.paddingRight),
            top: parseFloat(style.paddingTop),
            bottom: parseFloat(style.paddingBottom),
            textInset: range.getBoundingClientRect().left - box.left,
          };
        });
        expect(gutters.left).toBeGreaterThanOrEqual(16);
        expect(gutters.right).toBeGreaterThanOrEqual(16);
        expect(gutters.top).toBeGreaterThanOrEqual(12);
        expect(gutters.bottom).toBeGreaterThanOrEqual(12);
        expect(gutters.textInset).toBeGreaterThanOrEqual(16);
      }
    }
    await expect(grid.locator('.settings-section-description').first()).toBeVisible();
    await expect(grid.locator('.settings-subsection')).toHaveCount(kind === 'page' ? 2 : 1);
    await expect
      .poll(async () =>
        grid
          .locator('label.af-field:not([data-explained]),label.af-check:not([data-explained])')
          .count(),
      )
      .toBe(0);
    const columns = grid.locator('.setting-item[data-setting-name="Колонки"]');
    await columns.getByRole('button', { name: 'О настройке «Колонки»', exact: true }).click();
    await expect(page.getByRole('tooltip')).toContainText(
      'положение и ширина блоков пересчитываются',
    );
    await page.keyboard.press('Escape');
    const actions = grid.locator('.settings-actions');
    const apply = actions.getByRole('button', { name: 'Применить сетку', exact: true });
    await apply.scrollIntoViewIfNeeded();
    const buttons = await actions.locator('button').evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect(),
          s = getComputedStyle(node);
        return {
          top: r.top,
          bottom: r.bottom,
          paddingLeft: parseFloat(s.paddingLeft),
          paddingTop: parseFloat(s.paddingTop),
        };
      }),
    );
    expect(buttons).toHaveLength(3);
    for (let i = 0; i < buttons.length; i++) {
      expect(buttons[i].paddingLeft).toBeGreaterThanOrEqual(12);
      expect(buttons[i].paddingTop).toBeGreaterThanOrEqual(8);
      if (i) expect(buttons[i].top - buttons[i - 1].bottom).toBeGreaterThanOrEqual(8);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await apply.scrollIntoViewIfNeeded();
    await expect(apply).toBeInViewport();
    expect(
      await page.locator('.inspector-body').evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
  });
}
