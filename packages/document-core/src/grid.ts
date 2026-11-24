import type { DocumentKind, Grid, GridFrame, LayoutSection, Position } from './types';

// Geometry of pre-frame project files is part of their persisted format, not a preset.
const legacyFrame: Readonly<GridFrame> = Object.freeze({
  width: 1600,
  height: 900,
  left: 72,
  right: 72,
  top: 164,
  bottom: 48,
});

export function gridFrame(grid: Grid) {
  const frame = grid.frame ?? legacyFrame;
  return { ...frame, contentHeight: frame.height - frame.top - frame.bottom };
}

export function gridRows(grid: Grid) {
  return Math.floor((gridFrame(grid).contentHeight + grid.gap) / (grid.rowHeight + grid.gap));
}

export function positionBounds(grid: Grid, position: Position, width?: number) {
  const f = gridFrame(grid),
    stepX = ((width ?? f.width - f.left - f.right) + grid.gap) / grid.columns,
    stepY = grid.rowHeight + grid.gap;
  return {
    x: (position.col - 1) * stepX,
    y: (position.row - 1) * stepY,
    width: position.width * stepX - grid.gap,
    height: position.height * stepY - grid.gap,
  };
}

/** Explicit conversion only: copying or opening a project never invokes this function. */
export function remapSectionGrid<T extends LayoutSection>(
  section: T,
  target: Grid,
  kind: DocumentKind,
): T {
  const copy = structuredClone(section),
    x = target.columns / section.grid.columns,
    y = kind === 'presentation' ? gridRows(target) / gridRows(section.grid) : 1;
  const line = (value: number, scale: number) => Math.round(value * scale);
  for (const widget of copy.widgets) {
    if (widget.position.free) {
      const old = positionBounds(section.grid, widget.position),
        from = gridFrame(section.grid),
        to = gridFrame(target),
        sx = to.width / from.width,
        sy = kind === 'presentation' ? to.height / from.height : 1,
        stepX = (to.width - to.left - to.right + target.gap) / target.columns,
        stepY = target.rowHeight + target.gap;
      widget.position = {
        col: 1 + ((from.left + old.x) * sx - to.left) / stepX,
        row: 1 + ((from.top + old.y) * sy - to.top) / stepY,
        width: (old.width * sx + target.gap) / stepX,
        height: (old.height * sy + target.gap) / stepY,
        free: true,
      };
      continue;
    }
    const p = widget.position,
      left = line(p.col - 1, x),
      top = line(p.row - 1, y);
    widget.position = {
      col: left + 1,
      row: top + 1,
      width: Math.max(1, line(p.col - 1 + p.width, x) - left),
      height: Math.max(1, line(p.row - 1 + p.height, y) - top),
    };
  }
  copy.grid = structuredClone(target);
  return copy;
}
