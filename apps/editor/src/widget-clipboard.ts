import type { AFDocument, Widget } from '@alabuga/framework/schema';
import { parseGrid } from '@alabuga/document-core';
import { z } from 'zod';
import { checked } from './document-validation';
import { findSpace, uid } from './model';
import { planGridChange } from './grid-change';

const format = 'alabuga/constructor-block';
const envelope = z.strictObject({
  format: z.literal(format),
  version: z.literal(1),
  kind: z.enum(['page', 'presentation']),
  sectionId: z.string(),
  grid: z.unknown(),
  widget: z.record(z.string(), z.unknown()),
  modal: z.unknown().optional(),
});
const position = z.strictObject({
  col: z.number().finite(),
  row: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  free: z.literal(true).optional(),
});

/** Plain text also carries the envelope so blocks can travel between editor tabs. */
export function copyWidget(document: AFDocument, index: number, id: string) {
  const section = document.pages[index],
    widget = section?.widgets.find((widget) => widget.id === id);
  if (!widget) return;
  const action = widget.type === 'button' ? widget.action : undefined;
  const modal =
    action?.type === 'modal'
      ? document.modals?.find((modal) => modal.id === action.target)
      : undefined;
  return JSON.stringify({
    format,
    version: 1,
    kind: document.kind,
    sectionId: section.id,
    grid: section.grid,
    widget,
    ...(modal ? { modal } : {}),
  });
}

/** Build and validate a complete candidate before the caller changes history or selection. */
export function pasteWidget(document: AFDocument, index: number, text: string) {
  if (!text || text.length > 32 * 1024 * 1024) return;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return;
  }
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== format)
    return;
  const parsed = envelope.safeParse(value);
  if (!parsed.success) throw new Error('Не удалось прочитать блок из буфера обмена.');
  const data = parsed.data,
    grid = parseGrid(data.grid),
    target = document.pages[index];
  if (!target) throw new Error('Выберите секцию для вставки блока.');
  if (!position.safeParse(data.widget.position).success)
    throw new Error('В буфере обмена некорректные координаты блока.');
  const candidate = structuredClone(document),
    widget = planGridChange(
      { ...target, grid, widgets: [structuredClone(data.widget) as unknown as Widget] },
      target.grid,
      document.kind,
    ).widgets[0];
  widget.id = uid();
  const free = widget.position.free;
  // Reuse the editor's collision-free placement and respect the slide's finite bounds.
  const width = Math.min(target.grid.columns, Math.max(1, Math.ceil(widget.position.width))),
    height = Math.max(1, Math.ceil(widget.position.height));
  const space = findSpace(candidate, index, width, height);
  widget.position = {
    ...space,
    ...(free
      ? { width: widget.position.width, height: widget.position.height, free: true as const }
      : {}),
  };
  if (widget.type === 'button' && 'target' in widget.action) {
    if (widget.action.type === 'modal' && data.modal) {
      const modal = {
        ...(data.modal as NonNullable<AFDocument['modals']>[number]),
        id: uid('modal'),
      };
      (candidate.modals ??= []).push(modal);
      widget.action.target = modal.id;
    } else if (widget.action.target === data.sectionId) widget.action.target = target.id;
  }
  candidate.pages[index].widgets.push(widget);
  return { document: checked(candidate), id: widget.id };
}
