import { widgetRegistry, type AFDocument, type Widget } from '@alabuga/framework/schema';
import { checked } from './document-validation';
import type { EditorDocument } from './template-metadata';
import { sectionPlacement } from './layout/placement';
import { standardGrid, gridRows } from '@alabuga/framework/grid';
export { checked } from './document-validation';
export function emptyDocument(kind: AFDocument['kind'] = 'page'): EditorDocument {
  return {
    schemaVersion: 6,
    kind,
    title: kind === 'page' ? 'Новый сайт' : 'Новая презентация',
    templateInfo: { documentGrid: standardGrid() },
    pages: [
      {
        id: uid('page'),
        title: 'Начните с главного',
        grid: standardGrid(),
        ...(kind === 'page'
          ? {
              appearance: {
                theme: 'light' as const,
                spacing: 'normal' as const,
                width: 'wide' as const,
                layout: 'flow' as const,
                decoration: 'none' as const,
                focal: 'center' as const,
                shade: 'strong' as const,
              },
            }
          : {}),
        widgets: [],
      },
    ],
  };
}
export function uid(prefix = 'widget') {
  return prefix + '-' + crypto.randomUUID();
}
export function copySection(source: AFDocument['pages'][number]) {
  const copy = structuredClone(source);
  retargetSection(copy, uid('page'));
  for (const widget of copy.widgets) widget.id = uid();
  return copy;
}
export function retargetSection(section: AFDocument['pages'][number], id: string) {
  const original = section.id;
  section.id = id;
  for (const w of section.widgets) {
    if (w.type === 'button' && w.action.type === 'link' && w.action.href === '#' + original)
      w.action.href = '#' + id;
    if (
      w.type === 'button' &&
      'target' in w.action &&
      w.action.type !== 'modal' &&
      w.action.target === original
    )
      w.action.target = id;
    if (w.type === 'text')
      for (const block of w.content)
        if (block.type === 'link' && block.href === '#' + original) block.href = '#' + id;
  }
}
export class EditorModel {
  private value: EditorDocument;
  private past: string[] = [];
  private future: string[] = [];
  private group: string | undefined;
  private serialized: string;
  private pastBytes = 0;
  constructor(input: unknown) {
    this.value = checked(input);
    this.serialized = JSON.stringify(this.value);
  }
  get document() {
    return structuredClone(this.value);
  }
  get canUndo() {
    return !!this.past.length;
  }
  get canRedo() {
    return !!this.future.length;
  }
  replace(input: unknown, group?: string) {
    const next = checked(input),
      serialized = JSON.stringify(next);
    if (serialized === this.serialized) return false;
    if (!group || group !== this.group) {
      this.past.push(this.serialized);
      this.pastBytes += this.serialized.length;
    }
    this.group = group;
    while (this.past.length > 30 || (this.past.length > 1 && this.pastBytes > 10000000))
      this.pastBytes -= this.past.shift()!.length;
    this.future = [];
    this.value = next;
    this.serialized = serialized;
    return true;
  }
  change(edit: (draft: AFDocument) => void, group?: string) {
    const next = this.document;
    edit(next);
    return this.replace(next, group);
  }
  undo() {
    this.group = undefined;
    const prev = this.past.pop();
    if (!prev) return false;
    this.pastBytes -= prev.length;
    this.future.push(this.serialized);
    this.serialized = prev;
    this.value = JSON.parse(prev);
    return true;
  }
  redo() {
    this.group = undefined;
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.serialized);
    this.pastBytes += this.serialized.length;
    this.serialized = next;
    this.value = JSON.parse(next);
    return true;
  }
}
export function findSpace(
  doc: AFDocument,
  pageIndex: number,
  width: number,
  height: number,
): Widget['position'] {
  return sectionPlacement(doc.kind, doc.pages[pageIndex], width, height);
}
export function createWidget(type: Widget['type'], doc: AFDocument, pageIndex: number): Widget {
  const sizes: Record<Widget['type'], [number, number]> = {
    text: [4, 3],
    metric: [3, 2],
    image: [4, 4],
    calendar: [4, 4],
    table: [6, 4],
    button: [4, 1],
    quote: [6, 3],
    cards: [12, 4],
    gallery: [12, 4],
  };
  const grid = doc.pages[pageIndex].grid,
    [baseWidth, baseHeight] = sizes[type],
    wanted = Math.round(baseWidth * (grid.frame ? grid.columns / 12 : 1)),
    height = Math.max(
      widgetRegistry[type].minHeight,
      Math.round(baseHeight * (grid.frame && doc.kind === 'presentation' ? gridRows(grid) / 8 : 1)),
    ),
    width = Math.min(wanted, grid.columns);
  if (width < widgetRegistry[type].minWidth)
    throw new Error('В сетке недостаточно колонок для этого виджета.');
  const base = {
    id: uid(),
    title: widgetRegistry[type].title,
    position: findSpace(doc, pageIndex, width, height),
  };
  switch (type) {
    case 'button':
      return {
        ...base,
        type,
        label: 'Подробнее',
        variant: 'primary',
        action: { type: 'link', href: 'https://example.com' },
      };
    case 'quote':
      return { ...base, type, text: 'Сильная идея заслуживает ясной формы.', author: 'Автор' };
    case 'cards':
      return {
        ...base,
        type,
        items: [
          { title: 'Первый аргумент', text: 'Расскажите о преимуществе.' },
          { title: 'Второй аргумент', text: 'Добавьте подробности.' },
        ],
      };
    case 'gallery':
      return {
        ...base,
        type,
        items: [
          {
            src: '../assets/brand-landscape.svg',
            alt: 'Фирменная графика',
            caption: 'Описание изображения',
          },
        ],
      };
    case 'text':
      return {
        ...base,
        type,
        content: [
          {
            type: 'paragraph',
            text: 'Добавьте свой текст. Выберите блок, чтобы изменить содержимое и оформление.',
            dropCap: false,
          },
        ],
      };
    case 'metric':
      return { ...base, type, value: '24', note: 'Ключевой показатель' };
    case 'calendar':
      return { ...base, type, date: new Date().toLocaleDateString('sv-SE') };
    case 'image':
      return {
        ...base,
        type,
        src: '../assets/brand-landscape.svg',
        alt: 'Геометрическая композиция',
        fit: 'cover',
        caption: '',
      };
    case 'table':
      return {
        ...base,
        type,
        variant: 'corporate',
        columns: [
          { key: 'name', label: 'Название' },
          { key: 'status', label: 'Статус' },
        ],
        rows: [
          { name: 'Первый пункт', status: 'В работе' },
          { name: 'Второй пункт', status: 'Готово' },
        ],
        pageSize: 5,
      };
  }
}
