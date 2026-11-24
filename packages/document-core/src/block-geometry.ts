import type { Grid, Position, WidgetMinimum } from './types';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type SnapStep = { x: number; y: number };
export const snapDelta = (value: number, step: number) => Math.round(value / step) * step;

/** Keep the opposite edge anchored and clamp within the public grid constraints. */
export function resizePosition(
  initial: Position,
  minimum: WidgetMinimum,
  grid: Grid,
  direction: ResizeDirection,
  dx: number,
  dy: number,
  maxRow = 1000,
): Position {
  const result = { ...initial };
  const right = initial.col + initial.width,
    bottom = initial.row + initial.height;
  if (direction.includes('w')) {
    result.col = Math.max(1, Math.min(right - minimum.minWidth, initial.col + dx));
    result.width = right - result.col;
  }
  if (direction.includes('e'))
    result.width = Math.max(
      minimum.minWidth,
      Math.min(grid.columns - initial.col + 1, initial.width + dx),
    );
  if (direction.includes('n')) {
    result.row = Math.max(1, bottom - 100, Math.min(bottom - minimum.minHeight, initial.row + dy));
    result.height = bottom - result.row;
  }
  if (direction.includes('s'))
    result.height = Math.max(
      minimum.minHeight,
      Math.min(100, maxRow - initial.row + 1, initial.height + dy),
    );
  return result;
}
