import {
  validateDocument,
  widgetRegistry,
  type AFDocument,
  type Section,
  type Widget,
} from '@alabuga/framework/schema';
import { gridRows, remapSectionGrid } from '@alabuga/framework/grid';
import { frameworkDocument } from './template-metadata';

type Position = Widget['position'];
const overlaps = (a: Position, b: Position) =>
  a.col < b.col + b.width &&
  a.col + a.width > b.col &&
  a.row < b.row + b.height &&
  a.row + a.height > b.row;

function nearestPosition(
  wanted: Position,
  columns: number,
  rows: number,
  placed: Position[],
): Position | undefined {
  const col = Math.max(1, Math.min(columns - wanted.width + 1, wanted.col)),
    row = Math.max(1, Math.min(rows - wanted.height + 1, wanted.row));
  for (let distance = 0; distance <= rows + columns; distance++) {
    for (
      let y = Math.max(1, row - distance);
      y <= Math.min(rows - wanted.height + 1, row + distance);
      y++
    ) {
      const dx = distance - Math.abs(y - row);
      if (dx > columns) continue;
      for (const x of dx ? [col - dx, col + dx] : [col]) {
        if (x < 1 || x + wanted.width - 1 > columns) continue;
        const p = { ...wanted, col: x, row: y };
        if (!placed.some((other) => overlaps(p, other))) return p;
      }
    }
  }
}

/** Plan a grid change without mutating the source or losing widget data. */
export function planGridChange(
  source: Section,
  requested: Section['grid'],
  kind: AFDocument['kind'],
): Section {
  const grid = structuredClone(requested),
    frame = grid.frame;
  if (frame && frame.left + frame.right >= frame.width)
    throw new Error(
      `Сумма полей слева и справа должна быть меньше ширины холста (${frame.width} px).`,
    );
  if (frame && frame.top + frame.bottom >= frame.height)
    throw new Error(
      `Сумма полей сверху и снизу должна быть меньше высоты холста (${frame.height} px).`,
    );
  const valid = validateDocument({
    schemaVersion: 6,
    kind,
    title: 'Сетка',
    pages: [{ ...source, grid, widgets: [] }],
  });
  if (!valid.success)
    throw new Error(
      'Проверьте параметры сетки: ' + valid.issues.map((issue) => issue.message).join('; '),
    );
  if (grid.responsive) {
    grid.responsive.tabletColumns = Math.min(grid.columns, grid.responsive.tabletColumns);
    grid.responsive.mobileColumns = Math.min(
      grid.responsive.tabletColumns,
      grid.responsive.mobileColumns,
    );
  }
  const rows = kind === 'presentation' ? gridRows(grid) : 1000;
  for (const widget of source.widgets) {
    if (widget.position.free) continue;
    const min = widgetRegistry[widget.type],
      name = widget.title || min.title;
    if (min.minWidth > grid.columns)
      throw new Error(
        `Для блока «${name}» нужно минимум ${min.minWidth} колонки. Увеличьте число колонок сетки.`,
      );
    if (min.minHeight > rows)
      throw new Error(
        `Для блока «${name}» нужно минимум ${min.minHeight} строки. Уменьшите высоту строки, промежутки или поля.`,
      );
  }
  const mapped = remapSectionGrid(source, grid, kind);
  // Keep the mapped sizes whenever possible; compact only if the slide cannot fit them.
  for (const factor of kind === 'presentation' ? [1, 0.85, 0.65, 0.45, 0] : [1]) {
    const result = structuredClone(mapped),
      placed: Position[] = [];
    let fits = true;
    for (const widget of result.widgets) {
      if (widget.position.free) continue;
      const min = widgetRegistry[widget.type],
        desired = widget.position;
      const position = nearestPosition(
        {
          ...desired,
          width: Math.min(grid.columns, Math.max(min.minWidth, Math.floor(desired.width * factor))),
          height: Math.min(rows, Math.max(min.minHeight, Math.floor(desired.height * factor))),
        },
        grid.columns,
        rows,
        placed,
      );
      if (!position) {
        fits = false;
        break;
      }
      widget.position = position;
      placed.push(position);
    }
    if (fits) return result;
  }
  throw new Error(
    'Не удалось разместить все блоки в этой сетке. Увеличьте число колонок или высоту доступной области; можно уменьшить поля, высоту строки или промежутки.',
  );
}

export function applyGridChange(document: AFDocument, index: number, grid: Section['grid']) {
  const section = planGridChange(document.pages[index], grid, document.kind);
  const candidate = structuredClone(document);
  candidate.pages[index] = section;
  const result = validateDocument(frameworkDocument(candidate));
  if (!result.success) throw new Error(result.issues.map((issue) => issue.message).join('; '));
  document.pages[index] = section;
}
