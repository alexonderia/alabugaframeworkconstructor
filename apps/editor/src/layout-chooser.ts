import { showDialog, libraryDialog, el, button } from './ui';
import { layoutVariants, type LayoutVariant } from '@alabuga/framework/layout-variants';
import { sectionVariant } from './layout/placement';
import { compositionPreview } from './composition-preview';

import type { AFDocument, Section } from '@alabuga/framework/schema';
export function layoutChooser(
  host: HTMLElement,
  page: Section,
  kind: AFDocument['kind'],
  apply: (variant: LayoutVariant) => boolean,
  signal: AbortSignal,
) {
  host.append(
    button(
      'Изменить компоновку',
      () => {
        const { dialog, body } = libraryDialog('Компоновка текущего содержания', 'asset-library'),
          grid = el('div', 'variant-grid'),
          controllers: ReturnType<typeof compositionPreview>[] = [];
        let closed = false;
        body.append(
          el('p', '', 'Содержание и действия сохранятся. Выберите расположение элементов.'),
          grid,
        );
        for (const [variant, title] of layoutVariants) {
          const card = el('article', 'af-card af-card--inner variant-card'),
            visual = el('div', 'composition-thumbnail'),
            status = el('p', 'af-help');
          card.append(visual, el('h3', '', title), status);
          grid.append(card);
          try {
            const next = sectionVariant(kind, page, variant),
              isolated = structuredClone(next);
            isolated.widgets.forEach((w) => {
              if (w.type === 'button') w.action = { type: 'link', href: '#' };
            });
            const c = compositionPreview(visual, {
              schemaVersion: 3,
              kind,
              title: 'Предпросмотр',
              pages: [isolated],
            });
            controllers.push(c);
            const b = button(
              'Применить: ' + title,
              () => {
                if (apply(variant)) dialog.close();
                else status.textContent = 'Компоновку не удалось применить к текущему содержимому.';
              },
              'af-btn af-btn--secondary',
            );
            b.disabled = true;
            card.append(b);
            status.textContent = 'Проверяем содержание…';
            void Promise.all([
              document.fonts.ready,
              ...Array.from(visual.querySelectorAll('img'), (i) => i.decode().catch(() => {})),
            ]).then(() => {
              if (closed) return;
              const problems = c.checkOverflow();
              b.disabled = !!problems.length;
              status.textContent = problems.length
                ? 'Содержание не помещается. Выберите другой вариант или измените текст.'
                : 'Все элементы сохранены.';
            });
          } catch (e) {
            status.textContent = (e as Error).message;
          }
        }
        const abort = () => dialog.close();
        signal.addEventListener('abort', abort, { once: true });
        dialog.addEventListener('close', () => {
          signal.removeEventListener('abort', abort);
          closed = true;
          controllers.forEach((c) => c.destroy());
          dialog.remove();
        });
        document.body.append(dialog);
        showDialog(dialog);
      },
      'af-btn af-btn--secondary',
    ),
  );
}
