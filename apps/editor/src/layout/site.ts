import type { Section } from '@alabuga/framework/schema';
import { applyLayoutVariant, type LayoutVariant } from '@alabuga/framework/layout-variants';
import { gridSpace } from './grid-space';

export const siteViewports = [
  ['Компьютер', 1440],
  ['Планшет', 768],
  ['Телефон', 390],
] as const;

export function sitePlacement(page: Section, width: number, height: number) {
  const space = gridSpace(page, width, height, 1000);
  if (!space) throw new Error('Нет свободного места. Добавьте секцию или измените размеры блоков.');
  return space;
}

export function siteVariant(page: Section, variant: LayoutVariant) {
  return applyLayoutVariant(page, variant, 'page');
}
