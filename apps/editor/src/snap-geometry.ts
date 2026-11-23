import type { Section, Widget } from '@alabuga/framework/schema';
import type { ResizeDirection } from './block-geometry';

export type SnapMode = 'strict' | 'off' | 'mixed';
export type Rect = { x: number; y: number; width: number; height: number };
export type SnapPreferences = { x: number; y: number; mode: SnapMode };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round = (n: number) =>
  Math.abs(n - Math.round(n)) < 0.001 ? Math.round(n) : Math.round(n * 1e6) / 1e6;

/** Both sides of every track, including the two sides of gutters. */
export function trackLines(starts: number[], gap: number, stride = 1) {
  return [
    ...new Set(
      starts.flatMap((start, i) => [
        ...(i < starts.length - 1 && i % stride === 0 ? [start] : []),
        ...(i > 0 && i % stride === 0 ? [start - gap] : []),
      ]),
    ),
  ].sort((a, b) => a - b);
}

export function positionFromRect(
  rect: Rect,
  grid: Section['grid'],
  width: number,
  precise = true,
): Widget['position'] {
  const sx = (width + grid.gap) / grid.columns,
    sy = grid.rowHeight + grid.gap;
  const p = {
    col: round(1 + rect.x / sx),
    row: round(1 + rect.y / sy),
    width: round((rect.width + grid.gap) / sx),
    height: round((rect.height + grid.gap) / sy),
  };
  if (precise || !Object.values(p).every(Number.isInteger)) return { ...p, free: true };
  return p;
}

/** Compute from the original pointer position each time, so magnets release without drift. */
export function manipulateRect(
  initial: Rect,
  dx: number,
  dy: number,
  direction: ResizeDirection | 'move',
  bounds: Rect,
  minimum: { width: number; height: number },
  lines: { x: number[]; y: number[] },
  mode: SnapMode,
  tolerance: number,
  axis?: 'x' | 'y',
) {
  let left = initial.x,
    right = left + initial.width,
    top = initial.y,
    bottom = top + initial.height;
  const maxX = bounds.x + bounds.width,
    maxY = bounds.y + bounds.height;
  if (direction === 'move') {
    left = clamp(left + (axis === 'y' ? 0 : dx), bounds.x, maxX - initial.width);
    top = clamp(top + (axis === 'x' ? 0 : dy), bounds.y, maxY - initial.height);
    right = left + initial.width;
    bottom = top + initial.height;
  } else {
    if (direction.includes('w')) left = clamp(left + dx, bounds.x, right - minimum.width);
    if (direction.includes('e')) right = clamp(right + dx, left + minimum.width, maxX);
    if (direction.includes('n')) top = clamp(top + dy, bounds.y, bottom - minimum.height);
    if (direction.includes('s')) bottom = clamp(bottom + dy, top + minimum.height, maxY);
  }
  const guides: { x?: number; y?: number } = {};
  function snap(edges: number[], targets: number[], valid: (delta: number) => boolean) {
    if (mode === 'off') return;
    let best: { delta: number; line: number } | undefined;
    for (const edge of edges)
      for (const line of targets) {
        const delta = line - edge;
        if (
          (mode === 'strict' || Math.abs(delta) <= tolerance) &&
          valid(delta) &&
          (!best || Math.abs(delta) < Math.abs(best.delta))
        )
          best = { delta, line };
      }
    return best;
  }
  const moving = direction === 'move';
  const x =
    axis === 'y'
      ? undefined
      : snap(
          moving
            ? [left, right]
            : direction.includes('w')
              ? [left]
              : direction.includes('e')
                ? [right]
                : [],
          lines.x,
          (d) =>
            moving
              ? left + d >= bounds.x && right + d <= maxX
              : direction.includes('w')
                ? left + d >= bounds.x && right - left - d >= minimum.width
                : right + d <= maxX && right + d - left >= minimum.width,
        );
  if (x) {
    guides.x = x.line;
    if (moving || direction.includes('w')) left += x.delta;
    if (moving || direction.includes('e')) right += x.delta;
  }
  const y =
    axis === 'x'
      ? undefined
      : snap(
          moving
            ? [top, bottom]
            : direction.includes('n')
              ? [top]
              : direction.includes('s')
                ? [bottom]
                : [],
          lines.y,
          (d) =>
            moving
              ? top + d >= bounds.y && bottom + d <= maxY
              : direction.includes('n')
                ? top + d >= bounds.y && bottom - top - d >= minimum.height
                : bottom + d <= maxY && bottom + d - top >= minimum.height,
        );
  if (y) {
    guides.y = y.line;
    if (moving || direction.includes('n')) top += y.delta;
    if (moving || direction.includes('s')) bottom += y.delta;
  }
  return { rect: { x: left, y: top, width: right - left, height: bottom - top }, guides };
}
