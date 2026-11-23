import type { AFDocument, Section } from '@alabuga/framework/schema';
import { checked } from './document-validation';
import { copySection, findSpace, retargetSection, uid } from './model';
import { editTemplateInfo, sectionTemplateRef, templateInfo } from './template-metadata';
import { sectionSlots, setSectionTemplate, type SectionTemplate } from './templates';
import { hasSectionGrid } from './document-grid';
import { planGridChange } from './grid-change';
import { standardGrid } from '@alabuga/framework/grid';

export function planComposition(
  source: Section,
  template: SectionTemplate,
): { section: Section; unplaced: Section['widgets'] } {
  const target = template.create();
  retargetSection(target, source.id);
  const sourceSlots = sectionSlots(source);
  const remaining = new Set(source.widgets);
  const widgets = sectionSlots(target).map(({ role, type }, index) => {
    const incoming = target.widgets[index];
    const compatible = source.widgets.find(
      (widget, i) => remaining.has(widget) && sourceSlots[i].role === role && widget.type === type,
    );
    if (!compatible) return incoming;
    remaining.delete(compatible);
    return { ...structuredClone(compatible), position: incoming.position };
  });
  return {
    section: {
      ...target,
      title: source.title,
      appearance: source.appearance ?? target.appearance,
      transition: source.transition ?? target.transition,
      ...(source.chrome ? { chrome: source.chrome } : {}),
      widgets,
    },
    unplaced: [...remaining],
  };
}

export function replaceComposition(
  document: AFDocument,
  sectionId: string,
  template: SectionTemplate,
  saveUnplaced = false,
) {
  if (document.kind !== template.kind) throw new Error('Шаблон недоступен для этого документа.');
  const index = document.pages.findIndex(({ id }) => id === sectionId);
  const source = document.pages[index];
  if (!source) throw new Error('Раздел уже удалён.');
  const { section, unplaced } = planComposition(source, template);
  if (unplaced.length && !saveUnplaced)
    throw new Error('В этой композиции другие места для содержимого.');

  document.pages[index] = hasSectionGrid(document, source.id)
    ? planGridChange(section, source.grid, document.kind)
    : section;
  setSectionTemplate(document, sectionId, template);
  if (unplaced.length) {
    const info = editTemplateInfo(document);
    (info.unplaced ??= []).push({
      id: uid('unplaced'),
      title:
        'Неразмещённые блоки' +
        (source.title.trim() ? ': ' + source.title.trim().slice(0, 175) : ''),
      grid: structuredClone(source.grid),
      ...(source.appearance ? { appearance: structuredClone(source.appearance) } : {}),
      widgets: structuredClone(unplaced),
    });
  }
}

export function restoreUnplaced(document: AFDocument, id: string, after: string) {
  const list = templateInfo(document)?.unplaced;
  const index = list?.findIndex((section) => section.id === id) ?? -1;
  if (index < 0 || !list) throw new Error('Неразмещённые блоки уже восстановлены.');
  const [section] = list.splice(index, 1);
  const anchor = document.pages.findIndex((page) => page.id === after);
  document.pages.splice(anchor < 0 ? document.pages.length : anchor + 1, 0, section);
}

export function placeUnplacedWidget(
  document: AFDocument,
  groupId: string,
  widgetId: string,
  targetId: string,
) {
  const groups = templateInfo(document)?.unplaced;
  const group = groups?.find(({ id }) => id === groupId);
  const widgetIndex = group?.widgets.findIndex(({ id }) => id === widgetId) ?? -1;
  const targetIndex = document.pages.findIndex(({ id }) => id === targetId);
  if (!group || widgetIndex < 0) throw new Error('Блок уже размещён.');
  if (targetIndex < 0) throw new Error('Выбранный раздел уже удалён.');
  const widget = structuredClone(group.widgets[widgetIndex]);
  widget.position = findSpace(document, targetIndex, widget.position.width, widget.position.height);
  document.pages[targetIndex].widgets.push(widget);
  group.widgets.splice(widgetIndex, 1);
  if (!group.widgets.length) groups!.splice(groups!.indexOf(group), 1);
}

export function duplicateSection(document: AFDocument, index: number) {
  const source = document.pages[index];
  const copy = copySection(source);
  const origin = sectionTemplateRef(document, source.id);
  if (origin) setSectionTemplate(document, copy.id, origin);
  document.pages.splice(index + 1, 0, copy);
  if (hasSectionGrid(document, source.id)) editTemplateInfo(document).gridOverrides!.push(copy.id);
}

export function reusableSection(kind: AFDocument['kind'], section: Section): Section {
  const copy = planGridChange(section, standardGrid(), kind);
  for (const widget of copy.widgets) {
    if (widget.type === 'button') widget.action = { type: 'link', href: '#' };
    if (widget.type === 'text')
      for (const block of widget.content) if (block.type === 'link') block.href = '#';
  }
  const result = checked({ schemaVersion: 3, kind, title: 'Композиция', pages: [copy] }).pages[0];
  // The catalog stores empty targets. Framework instances use its supported placeholder.
  for (const widget of result.widgets) {
    if (widget.type === 'button') widget.action = { type: 'link', href: '' };
    if (widget.type === 'text')
      for (const block of widget.content) if (block.type === 'link') block.href = '';
  }
  return result;
}
