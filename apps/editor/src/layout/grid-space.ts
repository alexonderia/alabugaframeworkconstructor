import type { Section, Widget } from '@alabuga/framework/schema';

export function gridSpace(
  page: Section,
  width: number,
  height: number,
  rows: number,
): Widget['position'] | undefined {
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
