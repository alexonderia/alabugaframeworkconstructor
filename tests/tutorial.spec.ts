import {chooseNewProject} from './new-project-helper';
import { test, expect, type Page } from '@playwright/test';
import { chooseOption } from './choose-option';
import { openEditor } from './open-editor';
import { savedDocument } from './project-helper';

const panel = (page: Page) => page.locator('.author-tutorial');
const next = (page: Page) => panel(page).getByRole('button', { name: 'Далее', exact: true });
async function floatingInstruction(page: Page, target?: ReturnType<Page['locator']>) {
  await expect(page.locator('.tutorial-overlay')).toHaveAttribute('popover', 'manual');
  await expect(panel(page)).toBeInViewport();
  await expect(panel(page).getByRole('button', { name: 'Выйти из режима', exact: true })).toBeInViewport();
  if (target) {
    await expect(target).toBeInViewport();
    await expect.poll(async () => {
      const card = (await panel(page).boundingBox())!, field = (await target.boundingBox())!;
      return card.x + card.width <= field.x || card.x >= field.x + field.width ||
        card.y + card.height <= field.y || card.y >= field.y + field.height;
    }).toBe(true);
  }
}
async function start(page: Page) {
  await page.locator('.project-menu > summary').click();
  await page.locator('.editor-help > summary').click(); await page.locator('.editor-help').getByRole('button', { name: 'Режим знакомства', exact: true }).click();
  await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 1 из 5');
}
async function sample(page: Page, kind: 'page' | 'presentation') {
  await page.goto('/builder/');
  await expect(page.locator('.library-tools')).toBeVisible();
  const id = await page.evaluate(async (kind) => {
    const s = await import('/apps/editor/src/storage.ts' as string);
    const { emptyDocument } = await import('/apps/editor/src/model.ts' as string);
    const { makeComposition } = await import('/tests/framework/compositions.ts' as string);
    const doc = emptyDocument(kind);
    doc.title = 'Учебный проект';
    doc.pages = [makeComposition('split', kind)];
    const id = crypto.randomUUID();
    await s.saveProject(id, doc);
    return id;
  }, kind);
  await page.evaluate((id) => location.hash = '/edit/' + id, id);
  await expect(page.locator('#project-name')).toBeVisible();
}
async function imageFile(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    canvas.getContext('2d')!.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'lesson.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
}

for (const kind of ['page', 'presentation'] as const) {
  test(`guided mode verifies all five actions and survives preview: ${kind}`, async ({ page }, info) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(15000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await sample(page, kind);
    await start(page);
    await expect(panel(page).getByRole('checkbox')).toHaveCount(0);
    await expect(next(page)).toBeDisabled();
    await expect(page.locator('textarea.tutorial-target')).toBeFocused();
    await page.getByLabel('Название блока', { exact: true }).fill('Новое имя блока');
    await savedDocument(page);
    await expect(next(page)).toBeDisabled();
    await page.locator('textarea.tutorial-target').fill('Новый заголовок');
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 2 из 5');
    await expect(next(page)).toBeDisabled();
    await page.getByRole('button', { name: 'Изменить компоновку', exact: true }).click();
    await floatingInstruction(page, page.getByRole('button', { name: 'Применить: Асимметрия / справа', exact: true }));
    await page.getByRole('button', { name: 'Применить: Асимметрия / справа', exact: true }).click();
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 3 из 5');
    await page.getByLabel('Подпись', { exact: true }).fill('Новая подпись');
    await savedDocument(page);
    await expect(next(page)).toBeDisabled();
    await page.getByRole('button', { name: 'Выбрать изображение', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Библиотека материалов', exact: true })).toBeVisible();
    await floatingInstruction(page, page.locator('.asset-grid .asset-card').first());
    await page.locator('.asset-grid .asset-card').first().click();
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 4 из 5');
    await expect(page.locator('#properties details[data-setting=style]')).toHaveAttribute('open', '');
    await chooseOption(page.getByLabel('Цвет текста', { exact: true }), 'blue');
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    const finish = panel(page).getByRole('button', { name: 'Завершить знакомство', exact: true });
    await expect(finish).toBeDisabled();
    await panel(page).getByRole('button', { name: 'Открыть предпросмотр', exact: true }).click();
    await expect(page.locator('.project-preview iframe')).toBeVisible();
    await expect(page.getByText('Загружаем предпросмотр…', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 5 из 5');
    await expect(panel(page).locator('.tutorial-feedback')).toContainText('Предпросмотр проверен.');
    await expect(finish).toBeDisabled();
    const download = page.waitForEvent('download', { timeout: 15000 });
    await panel(page).getByRole('button', { name: 'Скачать HTML', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.html$/);
    await expect(finish).toBeEnabled();
    await finish.click();
    await expect(panel(page)).toContainText('Выполнено заданий: 5 из 5.');
    await page.screenshot({ path: `artifacts/editor/tutorial/${info.project.name}-${kind}.png` });
    await panel(page).getByRole('button', { name: 'Вернуться к работе', exact: true }).click();
    await expect(page.locator('#builder')).not.toHaveClass(/is-learning/);
    expect(errors).toEqual([]);
  });
}

test('only the targeted heading counts; undo, reload, pause and resume preserve the task', async ({ page }) => {
  await openEditor(page);
  // Include a paragraph before the heading to catch the original first-text shortcut.
  const id = page.url().split('/edit/')[1];
  await page.evaluate(async (id) => {
    const s = await import('/apps/editor/src/storage.ts' as string);
    const project = await s.getProject(id);
    project.document.pages[0].widgets[0].content.unshift({ type: 'paragraph', text: 'Вводный текст', dropCap: false });
    await s.saveProject(id, project.document);
  }, id);
  await page.reload();
  await start(page);
  await expect(page.locator('textarea.tutorial-target')).toHaveValue('Расскажите о главном');
  await page.getByLabel('Текст', { exact: true }).first().fill('Меняем абзац');
  await savedDocument(page);
  await expect(next(page)).toBeDisabled();
  await page.locator('textarea.tutorial-target').fill('Изменённый заголовок');
  await expect(next(page)).toBeEnabled();
  await panel(page).getByRole('button', { name: /Показать, где изменить|Изменить ещё/ }).focus();
  await page.keyboard.press('Control+z');
  await expect(next(page)).toBeDisabled();
  await page.keyboard.press('Control+Shift+z');
  await expect(next(page)).toBeEnabled();
  expect((await savedDocument(page)).pages[0].widgets[0].content[1].text).toBe('Изменённый заголовок');
  await page.reload();
  await expect(next(page)).toBeEnabled();
  await next(page).click();
  if (await page.locator('#catalog').isVisible()) await page.locator('#close-catalog').click();
  await panel(page).getByRole('button', { name: 'Выйти из режима', exact: true }).click();
  await expect(panel(page)).toBeHidden();
  await page.reload();
  await expect(panel(page)).toBeHidden();
  await page.locator('#close-inspector').isVisible().then(async (visible) => { if (visible) await page.locator('#close-inspector').click(); });
  await page.locator('.project-menu > summary').click();
  await page.locator('.editor-help > summary').click(); await page.locator('.editor-help').getByRole('button', { name: 'Режим знакомства', exact: true }).click();
  await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 2 из 5');
  await expect(next(page)).toBeDisabled();
});

test('missing blocks can be added, and insertion alone does not complete a task', async ({ page }) => {
  await page.goto('/builder/');
  await page.getByRole('button', { name: 'Создать сайт', exact: false }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('#project-name')).toBeVisible();
  await start(page);
  await expect(page.locator('#catalog')).toBeVisible();
  await page.locator('#catalog [data-add=text]').click();
  await expect(page.locator('textarea.tutorial-target')).toBeVisible();
  await expect(next(page)).toBeDisabled();
  await page.locator('textarea.tutorial-target').fill('Мой первый текст');
  await expect(next(page)).toBeEnabled();
  await next(page).click();
  if (await page.locator('#catalog').isVisible()) await page.locator('#close-catalog').click();
  await panel(page).getByRole('button', { name: 'Пропустить шаг', exact: true }).click();
  await expect(page.locator('#catalog')).toBeVisible();
  await page.locator('#catalog [data-add=image]').click();
  await expect(page.getByLabel('Загрузить изображение', { exact: true })).toBeAttached();
  await expect(next(page)).toBeDisabled();
  await page.getByLabel('Загрузить изображение', { exact: true }).setInputFiles(await imageFile(page));
  await expect(next(page)).toBeEnabled();
});

test('floating guidance stays beside the mobile target and follows viewport changes', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page, 'page');
  await start(page);
  await floatingInstruction(page, page.locator('textarea.tutorial-target'));
  await expect(panel(page).getByRole('button', { name: 'Выйти из режима', exact: true })).toBeEnabled();
  await page.locator('textarea.tutorial-target').fill('Заголовок на телефоне');
  await expect(next(page)).toBeEnabled();
  await next(page).click();
  if (await page.locator('#catalog').isVisible()) await page.locator('#close-catalog').click();
  await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 2 из 5');
  await page.setViewportSize({ width: 1280, height: 900 });
  await floatingInstruction(page, page.getByRole('button', { name: 'Изменить компоновку', exact: true }));
  await page.setViewportSize({ width: 390, height: 844 });
  await floatingInstruction(page, page.getByRole('button', { name: 'Изменить компоновку', exact: true }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: `artifacts/editor/tutorial/${info.project.name}-mobile.png` });
  await panel(page).getByRole('button', { name: 'Выйти из режима', exact: true }).click();
  await expect(page.locator('#builder')).not.toHaveClass(/is-learning/);
});

test('new projects get independent progress and old checklist marks are not imported as completion', async ({ page }) => {
  await openEditor(page);
  const id = page.url().split('/edit/')[1];
  await page.evaluate(async (id) => {
    const s = await import('/apps/editor/src/storage.ts' as string);
    await s.writeSetting('tutorial:' + id, { enabled: true, section: 0, done: [0, 1, 2, 3, 4] });
  }, id);
  await page.reload();
  await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 1 из 5');
  await expect(next(page)).toBeDisabled();
  await panel(page).getByRole('button', { name: 'Пропустить шаг', exact: true }).click();
  if (await page.locator('#catalog').isVisible()) await page.locator('#close-catalog').click();
  await panel(page).getByRole('button', { name: 'Выйти из режима', exact: true }).click();
  await page.locator('.project-menu > summary').click();
  await chooseNewProject(page, 'new-page');
  await expect(page.locator('#project-name')).toHaveValue('Новый сайт');
  await expect(page.locator('#builder')).not.toHaveClass(/is-learning/);
  await page.locator('.tutorial-launch').click();
  await panel(page).getByRole('button', { name: 'Начать знакомство', exact: true }).click();
  await page.locator('#close-catalog').click();
  await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 1 из 5');
  const stored = await page.evaluate(async (id) => {
    const s = await import('/apps/editor/src/storage.ts' as string);
    return (await s.readSetting('tutorial:' + id)).value;
  }, id);
  expect(stored.current).toBe(1);
});

test('a free grid is guided to a compatible template before changing layout', async ({ page }) => {
  await openEditor(page);
  await start(page);
  await panel(page).getByRole('button', { name: 'Пропустить шаг', exact: true }).click();
  await expect(page.locator('#catalog')).toBeVisible();
  await expect(page.locator('#catalog-description')).toContainText('Для задания выберите шаблон');
  await page.locator('#catalog [data-template=text]').click();
  await expect(panel(page).locator('.tutorial-progress')).toHaveText('Шаг 2 из 5');
  await expect(next(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Изменить компоновку', exact: true }).click();
  await page.getByRole('button', { name: 'Применить: Асимметрия / справа', exact: true }).click();
  await expect(next(page)).toBeEnabled();
});

test('failed export stays incomplete and shows recovery in the current task', async ({ page }) => {
  await sample(page, 'page');
  const id = page.url().split('/edit/')[1];
  await page.route('https://tutorial.invalid/missing.png', (route) => route.fulfill({ status: 404, body: '' }));
  await page.evaluate(async (id) => {
    const s = await import('/apps/editor/src/storage.ts' as string);
    const { initialTutorial } = await import('/apps/editor/src/tutorial-progress.ts' as string);
    const project = await s.getProject(id);
    project.document.pages[0].widgets.find((widget: any) => widget.type === 'image').src = 'https://tutorial.invalid/missing.png';
    await s.saveProject(id, project.document);
    await s.writeSetting('tutorial:' + id, initialTutorial({ version: 2, enabled: true, current: 4, previewed: true }));
  }, id);
  await page.reload();
  await panel(page).getByRole('button', { name: 'Скачать HTML', exact: true }).click();
  await expect(panel(page).locator('.tutorial-feedback')).toContainText('HTML не скачан.');
  await expect(panel(page).getByRole('button', { name: 'Завершить знакомство', exact: true })).toBeDisabled();
  await panel(page).getByRole('button', { name: 'Проверить проект', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Проверка качества', exact: true })).toBeVisible();
  const stored = await page.evaluate(async (id) => {
    const s = await import('/apps/editor/src/storage.ts' as string);
    return (await s.readSetting('tutorial:' + id)).value;
  }, id);
  expect(stored.exported).toBe(false);
});

test('a preview that fails to render is not marked as checked', async ({ page }) => {
  await sample(page, 'page');
  const id = page.url().split('/edit/')[1];
  await page.evaluate(async (id) => {
    const s = await import('/apps/editor/src/storage.ts' as string);
    const { initialTutorial } = await import('/apps/editor/src/tutorial-progress.ts' as string);
    await s.writeSetting('tutorial:' + id, initialTutorial({ version: 2, enabled: true, current: 4 }));
  }, id);
  await page.reload();
  await page.route(/alabuga\.iife\.js(?:\?|$)/, (route) => route.abort());
  await panel(page).getByRole('button', { name: 'Открыть предпросмотр', exact: true }).click();
  await expect(page.getByText(/^Не удалось открыть предпросмотр:/)).toBeVisible();
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await expect(panel(page).locator('.tutorial-feedback')).toContainText('Откройте предпросмотр.');
  await expect(panel(page).getByRole('button', { name: 'Завершить знакомство', exact: true })).toBeDisabled();
});

test('deep sections keep instruction visible while unrelated controls are blocked', async ({ page }, info) => {
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Урок по настройке блока', exact: true }).click();
  const field = page.getByRole('combobox', { name: 'Цвет текста', exact: true });
  await floatingInstruction(page, field);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await expect(panel(page)).toBeInViewport();
  await expect(panel(page).getByRole('button', { name: 'Выйти из режима', exact: true })).toBeInViewport();
  await page.locator('#project-name').click();
  await expect(page.locator('#project-name')).not.toBeFocused();
  await panel(page).getByRole('button', { name: 'Показать, где изменить', exact: true }).click();
  await floatingInstruction(page, field);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('.author-tutorial') || document.activeElement?.getAttribute('aria-label') === 'Цвет текста')).toBe(true);
  await page.screenshot({ path: `artifacts/editor/tutorial/${info.project.name}-deep-overlay.png` });
  await panel(page).getByRole('button', { name: 'Выйти из режима', exact: true }).click();
  await page.locator('#project-name').click();
  await expect(page.locator('#project-name')).toBeFocused();
});

for (const method of ['button', 'Escape'] as const) {
  test(`exit is available over a native dialog: ${method}`, async ({ page }) => {
    await sample(page, 'page');
    await start(page);
    await panel(page).getByRole('button', { name: 'Пропустить шаг', exact: true }).click();
    await page.getByRole('button', { name: 'Изменить компоновку', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Компоновка текущего содержания', exact: true })).toBeVisible();
    await floatingInstruction(page);
    if (method === 'button') await panel(page).getByRole('button', { name: 'Выйти из режима', exact: true }).click();
    else await page.keyboard.press('Escape');
    await expect(page.locator('#builder')).not.toHaveClass(/is-learning/);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('.tutorial-overlay:popover-open')).toHaveCount(0);
    await page.locator('#project-name').click();
    await expect(page.locator('#project-name')).toBeFocused();
  });
}

test('exit does not require a valid pending field', async ({ page }) => {
  await sample(page, 'page');
  await start(page);
  await page.locator('textarea.tutorial-target').evaluate((node) => (node as HTMLTextAreaElement).setCustomValidity('Проверьте значение'));
  await panel(page).getByRole('button', { name: 'Выйти из режима', exact: true }).click();
  await expect(page.locator('#builder')).not.toHaveClass(/is-learning/);
  await expect(page.locator('.tutorial-overlay:popover-open')).toHaveCount(0);
});

test('exit also closes the highlighted select menu and restores normal interaction', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Урок по настройке блока', exact: true }).click();
  const field = page.getByRole('combobox', { name: 'Цвет текста', exact: true });
  await field.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await floatingInstruction(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tutorial-overlay:popover-open')).toHaveCount(0);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await field.click();
  await expect(page.getByRole('option', { name: 'Фирменный синий', exact: true })).toBeVisible();
});

for (const kind of ['page', 'presentation'] as const) {
  for (const width of [1440, 390]) {
  test(`applying a guided layout reveals the edited third section: ${kind} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto('/builder/');
    await expect(page.locator('.library-tools')).toBeVisible();
    const fixture = await page.evaluate(async (kind) => {
      const s = await import('/apps/editor/src/storage.ts' as string);
      const { emptyDocument } = await import('/apps/editor/src/model.ts' as string);
      const { makeComposition } = await import('/tests/framework/compositions.ts' as string);
      const { inheritSectionGrid } = await import('/apps/editor/src/document-grid.ts' as string);
      const { initialTutorial } = await import('/apps/editor/src/tutorial-progress.ts' as string);
      const doc = emptyDocument(kind);
      doc.pages = Array.from({ length: 4 }, (_, index) => {
        const section = makeComposition('split', kind);
        section.title = 'Раздел ' + (index + 1);
        return inheritSectionGrid(doc, section);
      });
      const id = crypto.randomUUID();
      await s.saveProject(id, doc);
      await s.writeSetting('tutorial:' + id, initialTutorial({ version: 2, enabled: true, section: 2, current: 1 }));
      return { id, sectionId: doc.pages[2].id };
    }, kind);
    await page.evaluate((id) => location.hash = '/edit/' + id, fixture.id);
    await expect(page.locator('#pages')).toHaveValue('2');
    const before = await savedDocument(page);
    await page.getByRole('button', { name: 'Изменить компоновку', exact: true }).click();
    await page.getByRole('button', { name: 'Применить: Асимметрия / справа', exact: true }).click();
    await expect(next(page)).toBeEnabled();
    const edited = page.locator(`#canvas [data-section-id="${fixture.sectionId}"]`);
    if (kind === 'presentation')
      await expect(page.locator('#canvas .af-slide--active')).toHaveAttribute('data-section-id', fixture.sectionId);
    await expect(edited).toBeInViewport();
    await expect(page.locator('#inspector')).toBeHidden();
    await expect(panel(page).locator('.tutorial-description')).toContainText(kind === 'presentation' ? 'слайд 3' : 'секция 3');
    await floatingInstruction(page, kind === 'page' ? edited.locator(':scope > .af-panel') : edited);
    await expect(next(page)).toBeInViewport();
    await page.screenshot({ path: `artifacts/editor/tutorial/${info.project.name}-result-${kind}-${width}.png` });
    const after = await savedDocument(page);
    expect(after.pages[2].layoutVariant).toBe('asymmetric');
    expect(after.pages.filter((_: unknown, index: number) => index !== 2)).toEqual(before.pages.filter((_: unknown, index: number) => index !== 2));
    await panel(page).getByRole('button', { name: 'Изменить ещё', exact: true }).click();
    await expect(page.locator('#inspector')).toBeVisible();
    await expect(page.locator('#pages')).toHaveValue('2');
    await floatingInstruction(page, page.getByRole('button', { name: 'Изменить компоновку', exact: true }));
  });
  }
}
