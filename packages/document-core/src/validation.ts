import type { Grid } from './types';

function record(value: unknown, keys: string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${path}: expected an object`);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key)))
    throw new Error(`${path}: unknown property`);
  return result;
}

function integer(value: unknown, path: string, minimum = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${path}: expected a safe integer >= ${minimum}`);
  return value;
}

/** Validate the format, without imposing a particular renderer's supported ranges. */
export function parseGrid(value: unknown): Grid {
  const source = record(value, ['columns', 'rowHeight', 'gap', 'frame', 'responsive'], 'grid');
  const grid: Grid = {
    columns: integer(source.columns, 'grid.columns'),
    rowHeight: integer(source.rowHeight, 'grid.rowHeight'),
    gap: integer(source.gap, 'grid.gap', 0),
  };
  if (source.frame !== undefined) {
    const f = record(
      source.frame,
      ['width', 'height', 'left', 'right', 'top', 'bottom'],
      'grid.frame',
    );
    grid.frame = {
      width: integer(f.width, 'grid.frame.width'),
      height: integer(f.height, 'grid.frame.height'),
      left: integer(f.left, 'grid.frame.left', 0),
      right: integer(f.right, 'grid.frame.right', 0),
      top: integer(f.top, 'grid.frame.top', 0),
      bottom: integer(f.bottom, 'grid.frame.bottom', 0),
    };
    if (grid.frame.left + grid.frame.right >= grid.frame.width)
      throw new Error(
        `Сумма полей слева и справа должна быть меньше ширины холста (${grid.frame.width} px).`,
      );
    if (grid.frame.top + grid.frame.bottom >= grid.frame.height)
      throw new Error(
        `Сумма полей сверху и снизу должна быть меньше высоты холста (${grid.frame.height} px).`,
      );
  }
  if (source.responsive !== undefined) {
    const r = record(source.responsive, ['tabletColumns', 'mobileColumns'], 'grid.responsive');
    grid.responsive = {
      tabletColumns: integer(r.tabletColumns, 'grid.responsive.tabletColumns'),
      mobileColumns: integer(r.mobileColumns, 'grid.responsive.mobileColumns'),
    };
  }
  return grid;
}
