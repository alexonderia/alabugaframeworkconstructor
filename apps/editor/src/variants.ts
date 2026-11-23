import { compositionPreview } from './composition-preview';
import { planComposition } from './sections';
import { resourcesReady } from './document-surface';
import { sectionTemplates, type SectionTemplate } from './templates';
import { button, el, libraryDialog, showDialog } from './ui';
import type { AFDocument, Section } from '@alabuga/framework/schema';

type Apply = (template: SectionTemplate, saveUnplaced?: boolean) => boolean;

function trackedDialog(dialog: HTMLDialogElement, signal?: AbortSignal, cleanup?: () => void) {
  const abort = () => dialog.close();
  signal?.addEventListener('abort', abort, { once: true });
  dialog.addEventListener(
    'close',
    () => {
      signal?.removeEventListener('abort', abort);
      cleanup?.();
      dialog.remove();
    },
    { once: true },
  );
  document.body.append(dialog);
  showDialog(dialog);
}

export function requestComposition(
  page: Section,
  template: SectionTemplate,
  apply: Apply,
  warning?: (message: string) => void,
  signal?: AbortSignal,
  cancelled?: () => void,
) {
  const { unplaced } = planComposition(page, template);
  if (!unplaced.length) {
    if (!apply(template)) cancelled?.();
    return;
  }
  const { dialog, body } = libraryDialog('Смена композиции', 'asset-library');
  let applied = false;
  const message = 'В этой композиции другие места для содержимого.';
  warning?.(message);
  body.append(
    el('p', 'af-help', message),
    el(
      'p',
      '',
      `Блоков без подходящего места: ${unplaced.length}. Их можно сохранить в проекте и разместить позже.`,
    ),
    button('Оставить текущую композицию', () => dialog.close(), 'af-btn af-btn--secondary'),
    button('Применить и отложить блоки', () => {
      applied = apply(template, true);
      if (applied) dialog.close();
      else if (!body.querySelector('[role=alert]')) {
        const error = el(
          'p',
          'af-error',
          'Сменить композицию не удалось. Проверьте ограничения проекта.',
        );
        error.setAttribute('role', 'alert');
        body.append(error);
      }
    }),
  );
  trackedDialog(dialog, signal, () => {
    if (!applied && !signal?.aborted) cancelled?.();
  });
}

export function compositionChooser(
  host: HTMLElement,
  page: Section,
  kind: AFDocument['kind'],
  apply: Apply,
  warning?: (message: string) => void,
  signal?: AbortSignal,
) {
  host.append(
    button(
      'Посмотреть шаблоны',
      () => {
        const { dialog, body } = libraryDialog('Шаблоны и совместимость', 'asset-library'),
          grid = el('div', 'variant-grid');
        const controllers: ReturnType<typeof compositionPreview>[] = [];
        const previews = new AbortController();
        body.append(grid);
        for (const template of sectionTemplates(kind)) {
          const { section, unplaced } = planComposition(page, template);
          for (const widget of section.widgets)
            if (widget.type === 'button') widget.action = { type: 'link', href: '#' };
          const card = el('div', 'af-card af-card--inner variant-card'),
            visual = el('div', 'composition-thumbnail');
          const controller = compositionPreview(visual, {
            schemaVersion: 3,
            kind,
            title: template.title,
            pages: [section],
          });
          controllers.push(controller);
          const select = button(
            template.title,
            () =>
              requestComposition(
                page,
                template,
                (entry, park) => {
                  const applied = apply(entry, park);
                  if (applied) dialog.close();
                  return applied;
                },
                warning,
                signal,
              ),
            'af-btn af-btn--secondary',
          );
          card.append(
            visual,
            select,
            el('p', 'af-help', template.description),
            el(
              'p',
              'af-help',
              unplaced.length
                ? `Останется без места: ${unplaced.length}`
                : 'Содержимое сохранится.',
            ),
          );
          grid.append(card);
          if (kind === 'presentation')
            void resourcesReady(visual, previews.signal)
              .then(() => {
                if (dialog.open && controller.checkOverflow().length)
                  card.append(
                    el('p', 'af-help', 'Часть содержимого может не поместиться на слайде.'),
                  );
              })
              .catch(() => {});
        }
        trackedDialog(dialog, signal, () => {
          previews.abort();
          controllers.forEach((controller) => controller.destroy());
        });
      },
      'af-btn af-btn--secondary',
    ),
  );
}
