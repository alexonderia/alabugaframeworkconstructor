import type { DocumentKind, Grid, LayoutSection, Position, WidgetConstraints } from './types';
import { gridRows, remapSectionGrid } from './grid';
import { parseGrid } from './validation';
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
export function planGridChange<T extends LayoutSection>(
  source: T,
  requested: Grid,
  kind: DocumentKind,
  constraints: WidgetConstraints,
): T {
  const grid = parseGrid(requested);
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
    const min = constraints(widget.type),
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
      const min = constraints(widget.type),
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
