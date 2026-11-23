import type { Section } from '@alabuga/framework/schema';
import { applyLayoutVariant, type LayoutVariant } from '@alabuga/framework/layout-variants';
import { gridSpace } from './grid-space';
import { gridRows } from '@alabuga/framework/grid';

export const slideViewport = ['Слайд', 1600] as const;

export function slidePlacement(page: Section, width: number, height: number) {
  const rows = gridRows(page.grid);
  const space = gridSpace(page, width, height, rows);
  if (!space)
    throw new Error('Нет свободного места для блока. Уменьшите другие блоки или добавьте слайд.');
  return space;
}

export function slideVariant(page: Section, variant: LayoutVariant) {
  return applyLayoutVariant(page, variant, 'presentation');
}
