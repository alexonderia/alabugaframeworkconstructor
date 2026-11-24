import type { AFDocument, Section } from '@alabuga/framework/schema';
import { alabugaGrid } from './framework-grid-adapter';
import { applyInheritedGrid, hasSectionGrid, setSectionGrid } from './document-grid';
import { el, button } from './ui';
import { inputField, checkboxField } from './ui-fields';

export function applyStandardGrid(document: AFDocument, index: number) {
  applyInheritedGrid(document, index, alabugaGrid());
}

export function gridScopeControl(
  host: HTMLElement,
  document: AFDocument,
  index: number,
  commit: (edit: (doc: AFDocument) => void, local: boolean) => boolean,
) {
  const id = document.pages[index].id,
    note = el('p', 'af-help');
  const scope = el('fieldset', 'settings-scope');
  scope.append(el('legend', '', 'Где применяется сетка'));
  host.append(scope);
  let local = hasSectionGrid(document, id);
  const describe = () =>
    (note.textContent = local
      ? 'Параметры применяются только к этому разделу. Снимите флажок, чтобы наследовать общую сетку.'
      : 'Общая сетка документа. Изменения применятся ко всем разделам без собственной сетки, в том числе к новым.');
  const field = checkboxField(
    scope,
    document.kind === 'page' ? 'Своя сетка для этой секции' : 'Своя сетка для этого слайда',
    local,
    (value) => {
      if (commit((doc) => setSectionGrid(doc, id, value), value)) local = value;
      else field.checked = local;
      describe();
    },
  );
  describe();
  scope.append(note);
}

/** Optional frame fields share the existing grid form, draft and undo transaction. */
export function gridFrameFields(
  host: HTMLElement,
  draft: Section['grid'],
  kind: AFDocument['kind'],
) {
  if (!draft.frame) return;
  const margins = el('fieldset', 'settings-subsection settings-pair');
  margins.append(el('legend', '', 'Поля холста'));
  host.append(margins);
  margins.append(
    el('p', 'af-help', `${draft.frame.width}×${draft.frame.height} · поля сетки в пикселях`),
  );
  for (const [key, label] of [
    ['left', 'Поле слева, px'],
    ['right', 'Поле справа, px'],
    ['top', 'Поле сверху, px'],
    ['bottom', 'Поле снизу, px'],
  ] as const) {
    const field = inputField(
      margins,
      label,
      draft.frame[key],
      (value) => {
        draft.frame![key] = Number(value);
      },
      'number',
    );
    field.min = '0';
    field.max = '2000';
    field.required = true;
  }
  if (kind === 'page' && draft.responsive) {
    const responsive = el('fieldset', 'settings-subsection settings-pair');
    responsive.append(el('legend', '', 'Планшет и телефон'));
    host.append(responsive);
    for (const [key, label] of [
      ['tabletColumns', 'Колонки на планшете'],
      ['mobileColumns', 'Колонки на телефоне'],
    ] as const) {
      const field = inputField(
        responsive,
        label,
        draft.responsive[key],
        (value) => {
          draft.responsive![key] = Number(value);
        },
        'number',
      );
      field.min = '1';
      field.max = '24';
      field.required = true;
    }
  }
}

export function standardGridButton(apply: () => void) {
  return button('Применить стандартную сетку', apply, 'af-btn af-btn--secondary af-btn--sm');
}
