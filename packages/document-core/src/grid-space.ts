import type { LayoutSection, Position } from './types';

export function gridSpace(
  page: LayoutSection,
  width: number,
  height: number,
  rows: number,
): Position | undefined {
  for (let row = 1; row <= rows - height + 1; row++)
    for (let col = 1; col <= page.grid.columns - width + 1; col++)
      if (
        !page.widgets.some(
          ({ position: p }) =>
            col < p.col + p.width &&
            col + width > p.col &&
            row < p.row + p.height &&
            row + height > p.row,
        )
      )
        return { col, row, width, height };
}
