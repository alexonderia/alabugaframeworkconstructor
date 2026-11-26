import type { Widget } from '@alabuga/framework/schema';
import { el, button } from './ui';
import { inputField, selectField } from './ui-fields';

type TextWidget = Extract<Widget, { type: 'text' }>;
type TextStyle = NonNullable<TextWidget['textStyle']>;

export function textTypography(
  host: HTMLElement,
  widget: TextWidget,
  changed: () => void,
  refresh: () => void,
) {
  const group = el('fieldset', 'text-typography');
  group.append(el('legend', '', 'Типографика'));
  host.append(group);

  const set = <Key extends keyof TextStyle>(key: Key, value: TextStyle[Key]) => {
    const style = { ...widget.textStyle };
    if (value === undefined) delete style[key];
    else style[key] = value;
    if (Object.keys(style).length) widget.textStyle = style;
    else delete widget.textStyle;
    changed();
  };
  const number = (
    row: HTMLElement,
    key: 'size' | 'lineHeight' | 'letterSpacing',
    label: string,
    min: number,
    max: number,
    step: number,
  ) => {
    const control = inputField(
      row,
      label,
      widget.textStyle?.[key] ?? '',
      (value) => set(key, value === '' ? undefined : Number(value)),
      'number',
    );
    control.min = String(min);
    control.max = String(max);
    control.step = String(step);
    control.placeholder = 'Авто';
  };
  selectField(
    group,
    'Шрифт',
    widget.textStyle?.family ?? '',
    {
      '': 'Из композиции',
      body: 'Alabuga Sans',
      heading: 'Alabuga Heading',
      arial: 'Arial',
      georgia: 'Georgia',
      monospace: 'Моноширинный',
    },
    (value) => set('family', (value || undefined) as TextStyle['family']),
  );

  const sizeAndColor = el('div', 'settings-pair');
  number(sizeAndColor, 'size', 'Размер, px', 8, 160, 1);
  const colorField = el('div', 'typography-color');
  const swatch = el('input', 'af-input typography-color-swatch');
  swatch.type = 'color';
  swatch.setAttribute('aria-label', 'Выбрать цвет текста');
  swatch.value = widget.textStyle?.color ?? '#111827';
  const color = inputField(colorField, 'Цвет, HEX', widget.textStyle?.color ?? '', (value) => {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) swatch.value = value;
    if (!value) swatch.value = '#111827';
    set('color', value || undefined);
  });
  color.placeholder = 'Из темы';
  color.pattern = '#[0-9a-fA-F]{6}';
  color.maxLength = 7;
  color.title = 'Шестизначный HEX-цвет, например #111827';
  swatch.addEventListener('input', () => {
    color.value = swatch.value;
    set('color', swatch.value);
  });
  colorField.append(swatch);
  sizeAndColor.append(colorField);
  group.append(sizeAndColor);

  selectField(
    group,
    'Начертание',
    widget.textStyle?.face ?? '',
    { '': 'Из композиции', regular: 'Обычный', bold: 'Полужирный', italic: 'Курсив' },
    (value) => set('face', (value || undefined) as TextStyle['face']),
  );

  const spacing = el('div', 'settings-pair');
  number(spacing, 'lineHeight', 'Межстрочный интервал', 0.8, 3, 0.05);
  number(spacing, 'letterSpacing', 'Межбуквенный интервал, px', -4, 20, 0.1);
  group.append(spacing);

  selectField(
    group,
    'Выравнивание текста',
    widget.textStyle?.align ?? widget.align ?? '',
    {
      '': 'Из композиции',
      left: 'По левому краю',
      center: 'По центру',
      right: 'По правому краю',
      justify: 'По ширине',
    },
    (value) => {
      delete widget.align;
      set('align', (value || undefined) as TextStyle['align']);
    },
  );
  group.append(
    button(
      'Вернуть типографику композиции',
      () => {
        delete widget.textStyle;
        delete widget.align;
        refresh();
      },
      'af-btn af-btn--ghost',
    ),
  );
}
