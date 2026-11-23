import type { AFDocument, Section } from '@alabuga/framework/schema';
import { standardGrid } from '@alabuga/framework/grid';
import { applyInheritedGrid, hasSectionGrid, setSectionGrid } from './document-grid';
import { el, button } from './ui';
import { inputField, checkboxField } from './ui-fields';

export function applyStandardGrid(document: AFDocument, index: number) {
  applyInheritedGrid(document, index, standardGrid());
}

export function gridScopeControl(
  host: HTMLElement,
  document: AFDocument,
  index: number,
  commit: (edit: (doc: AFDocument) => void, local: boolean) => boolean,
) {
  const id = document.pages[index].id,
    note = el('p', 'af-help');
  let local = hasSectionGrid(document, id);
  const describe = () =>
    (note.textContent = local
      ? 'Параметры применяются только к этому разделу. Снимите флажок, чтобы наследовать общую сетку.'
      : 'Общая сетка документа. Изменения применятся ко всем разделам без собственной сетки, в том числе к новым.');
  const field = checkboxField(
    host,
    document.kind === 'page' ? 'Своя сетка для этой секции' : 'Своя сетка для этого слайда',
    local,
    (value) => {
      if (commit((doc) => setSectionGrid(doc, id, value), value)) local = value;
      else field.checked = local;
      describe();
    },
  );
  describe();
  host.append(note);
}

/** Optional frame fields share the existing grid form, draft and undo transaction. */
export function gridFrameFields(
  host: HTMLElement,
  draft: Section['grid'],
  kind: AFDocument['kind'],
) {
  if (!draft.frame) return;
  host.append(
    el('p', 'af-help', `${draft.frame.width}×${draft.frame.height} · поля сетки в пикселях`),
  );
  for (const [key, label] of [
    ['left', 'Поле слева, px'],
    ['right', 'Поле справа, px'],
    ['top', 'Поле сверху, px'],
    ['bottom', 'Поле снизу, px'],
  ] as const) {
    const field = inputField(
      host,
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
    host.append(
      el(
        'p',
        'af-help',
        'При уменьшении основной сетки число колонок планшета и телефона тоже уменьшается. На телефоне колонок не больше, чем на планшете.',
      ),
    );
    for (const [key, label] of [
      ['tabletColumns', 'Колонки на планшете'],
      ['mobileColumns', 'Колонки на телефоне'],
    ] as const) {
      const field = inputField(
        host,
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
