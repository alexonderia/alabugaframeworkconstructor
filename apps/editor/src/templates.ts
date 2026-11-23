import { compositionCatalog, makeComposition, showcase } from '@alabuga/framework/compositions';
import { demoDocument } from '@alabuga/framework/demo-documents';
import { layoutVariants, type LayoutVariant } from '@alabuga/framework/layout-variants';
import type { AFDocument, Section, Widget } from '@alabuga/framework/schema';
import { standardGrid, remapSectionGrid } from '@alabuga/framework/grid';
import { planGridChange } from './grid-change';
import { sectionVariant } from './layout/placement';
import { copySection, emptyDocument } from './model';
import { editTemplateInfo, sectionTemplateRef, type TemplateRef } from './template-metadata';

type Kind = AFDocument['kind'];
type Theme = NonNullable<Section['appearance']>['theme'];
export type Preset = { id: 'default' | Theme; title: string; theme?: Theme };
export const stylePresets = [
  { id: 'default', title: 'Авторский вариант' },
  { id: 'light', title: 'Светлая', theme: 'light' },
  { id: 'contrast', title: 'Контрастная', theme: 'contrast' },
  { id: 'accent', title: 'Акцентная', theme: 'accent' },
  { id: 'image', title: 'С изображением', theme: 'image' },
] as const satisfies readonly Preset[];

export const templateCategories = {
  introduction: 'Вступление',
  content: 'Содержание',
  navigation: 'Навигация и действие',
  blank: 'Свободная композиция',
  custom: 'Мои композиции',
};

export type SemanticField =
  | 'Заголовок'
  | 'Подзаголовок'
  | 'Основной текст'
  | 'Навигация'
  | 'Контакты'
  | 'Изображение'
  | 'Логотип'
  | 'Подпись'
  | 'Показатель'
  | 'Описание показателя'
  | 'Действие'
  | 'Цитата'
  | 'Автор'
  | 'Карточки'
  | 'Галерея'
  | 'Таблица'
  | 'Дата';

export type SemanticSlot = { role: string; type: Widget['type']; fields: readonly SemanticField[] };
type BaseTemplate = TemplateRef & { kind: Kind; title: string; description: string };
export type Composition = {
  preview: Section;
  slots: readonly SemanticSlot[];
  variants: readonly LayoutVariant[];
};
export type SectionTemplate = BaseTemplate & {
  key: string;
  category: keyof typeof templateCategories;
  composition: Composition;
  presets: readonly Preset[];
  editing: { exactLayout: 'advanced' | 'standard' };
  create: () => Section;
};
type DocumentTemplate = BaseTemplate & {
  key: 'blank' | 'corporate' | 'example' | 'showcase';
  category: 'blank' | 'corporate' | 'example';
  create: () => AFDocument;
};

const roles: Record<Widget['type'], SemanticSlot['fields']> = {
  text: ['Заголовок', 'Основной текст'],
  image: ['Изображение', 'Подпись'],
  metric: ['Показатель', 'Описание показателя'],
  button: ['Действие'],
  quote: ['Цитата', 'Автор'],
  cards: ['Карточки'],
  gallery: ['Галерея', 'Подпись'],
  table: ['Таблица'],
  calendar: ['Дата'],
};
export function sectionSlots(section: Section): SemanticSlot[] {
  const counts = new Map<Widget['type'], number>();
  return section.widgets.map((widget) => {
    const { type } = widget;
    const index = counts.get(type) ?? 0;
    counts.set(type, index + 1);
    let role = `${type}-${index}`;
    let fields = roles[type];
    if (widget.type === 'text' && (section.role === 'header' || section.role === 'footer')) {
      if (index === 0) fields = ['Заголовок', 'Подзаголовок'];
      if (index === 1) [role, fields] = ['navigation', ['Навигация']];
      if (index === 2) [role, fields] = ['contacts', ['Контакты']];
    }
    if (widget.type === 'text' && section.composition === 'final' && index === 1)
      [role, fields] = ['contacts', ['Контакты']];
    if (widget.type === 'image' && section.composition === 'brand-cover')
      [role, fields] = ['logo', ['Логотип']];
    if (widget.slot && widget.slot !== `${type}-${index}`) role = widget.slot;
    return { role, fields, type };
  });
}

function compositionDetails(preview: Section, kind: Kind): Composition {
  const variants = layoutVariants.flatMap(([variant]) => {
    try {
      sectionVariant(kind, preview, variant);
      return [variant];
    } catch {
      return [];
    }
  });
  return { preview, slots: sectionSlots(preview), variants };
}

function category(key: string): SectionTemplate['category'] {
  if (key === 'blank') return 'blank';
  if (['hero', 'brand-cover', 'divider', 'thesis'].includes(key)) return 'introduction';
  if (['header', 'footer', 'cta', 'final'].includes(key)) return 'navigation';
  return 'content';
}

const kinds = ['page', 'presentation'] as const;
const sections: readonly SectionTemplate[] = kinds.flatMap((kind) =>
  compositionCatalog(kind).map(([key, title, description]): SectionTemplate => {
    const create = () => remapSectionGrid(makeComposition(key, kind), standardGrid(), kind);
    return {
      id: `section/${kind}/${key}`,
      key,
      version: 2,
      kind,
      title,
      description,
      category: category(key),
      editing: { exactLayout: key === 'blank' ? 'standard' : 'advanced' },
      presets: stylePresets,
      composition: compositionDetails(create(), kind),
      create,
    };
  }),
);

const corporateSections = {
  page: ['header', 'hero', 'split', 'features', 'cta', 'footer'],
  presentation: ['brand-cover', 'thesis', 'metrics', 'final'],
};
function standardDocument(doc: AFDocument) {
  doc.pages = doc.pages.map((section) => planGridChange(section, standardGrid(), doc.kind));
  editTemplateInfo(doc).documentGrid = standardGrid();
  return doc;
}
const documents: readonly DocumentTemplate[] = kinds.flatMap(
  (kind) =>
    [
      {
        id: `document/${kind}/blank`,
        version: 2,
        kind,
        key: 'blank',
        category: 'blank',
        title: 'С нуля',
        description: kind === 'page' ? 'Пустой сайт' : 'Пустая презентация',
        create: () => emptyDocument(kind),
      },
      {
        id: `document/${kind}/corporate`,
        version: 2,
        kind,
        key: 'corporate',
        category: 'corporate',
        title: kind === 'page' ? 'Корпоративный сайт' : 'Корпоративная презентация',
        description:
          kind === 'page'
            ? 'Обложка, информация о компании и призыв к действию'
            : 'Обложка, ключевой тезис, показатели и финал',
        create: () => ({
          ...emptyDocument(kind),
          pages: corporateSections[kind].map((key) => getSectionTemplate(kind, key).create()),
        }),
      },
      {
        id: `document/${kind}/example`,
        version: 2,
        kind,
        key: 'example',
        category: 'example',
        title: 'Из образца',
        description: 'Редактируемая копия готового проекта',
        create: () => standardDocument(demoDocument(kind)),
      },
      {
        id: `document/${kind}/showcase`,
        version: 2,
        kind,
        key: 'showcase',
        category: 'example',
        title: kind === 'page' ? 'Эталонный лендинг' : 'Эталонная презентация',
        description: 'Фирменные композиции с навигацией и анимацией',
        create: () => standardDocument(showcase(kind)),
      },
    ] as const,
);

export const templateRegistry = { sections, documents };
export const sectionTemplates = (kind: Kind) => sections.filter((entry) => entry.kind === kind);
export const documentTemplates = (kind: Kind) => documents.filter((entry) => entry.kind === kind);
export function getSectionTemplate(kind: Kind, key: string) {
  const template = sections.find((entry) => entry.kind === kind && entry.key === key);
  if (!template) throw new Error('Шаблон недоступен для этого типа документа.');
  return template;
}
export const templateRef = ({ id, version }: TemplateRef): TemplateRef => ({ id, version });

export function createDocumentFromTemplate(kind: Kind, id: string): AFDocument {
  const template = documents.find((entry) => entry.kind === kind && entry.id === id);
  if (!template) throw new Error('Шаблон недоступен для этого типа документа.');
  const doc = standardDocument(template.create());
  editTemplateInfo(doc).document = templateRef(template);
  for (const section of doc.pages) {
    const entry = sections.find((item) => item.kind === kind && item.key === section.composition);
    if (entry) setSectionTemplate(doc, section.id, entry);
  }
  return doc;
}

export function setSectionTemplate(doc: AFDocument, sectionId: string, template: TemplateRef) {
  const info = editTemplateInfo(doc);
  (info.sections ??= {})[sectionId] = templateRef(template);
}

export function geometryLocked(doc: AFDocument, sectionId: string) {
  const origin = sectionTemplateRef(doc, sectionId);
  return (
    origin &&
    sections.some((entry) => entry.id === origin.id && entry.editing.exactLayout === 'advanced')
  );
}

export function instantiateSection(template: SectionTemplate, presetId: string = 'default') {
  const preset = template.presets.find(({ id }) => id === presetId);
  if (!preset) throw new Error('Оформление недоступно для этого шаблона.');
  const section = template.create();
  if (preset.theme) {
    section.appearance ??= makeComposition('blank', template.kind).appearance!;
    section.appearance.theme = preset.theme;
    if (preset.theme === 'image' && !section.appearance.background)
      section.appearance.background = '../assets/brand-landscape.svg';
    if (section.appearance.backgroundPlacement)
      section.appearance.backgroundPlacement = preset.theme === 'image' ? 'full' : 'none';
  }
  return section;
}

export type SavedComposition = Pick<BaseTemplate, 'id' | 'version' | 'kind' | 'title'> & {
  section: Section;
};
export function customTemplate(saved: SavedComposition): SectionTemplate {
  const create = () => {
    const copy = copySection(saved.section);
    for (const widget of copy.widgets) {
      if (widget.type === 'button' && widget.action.type === 'link' && !widget.action.href)
        widget.action.href = '#';
      if (widget.type === 'text')
        for (const block of widget.content)
          if (block.type === 'link' && !block.href) block.href = '#';
    }
    return planGridChange(copy, standardGrid(), saved.kind);
  };
  return {
    ...templateRef(saved),
    kind: saved.kind,
    key: saved.id,
    title: saved.title,
    description: 'Сохранённые блоки и оформление',
    category: 'custom',
    composition: compositionDetails(create(), saved.kind),
    presets: stylePresets,
    editing: { exactLayout: 'standard' },
    create,
  };
}
