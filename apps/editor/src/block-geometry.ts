import type { Section, Widget } from '@alabuga/framework/schema';

import { resizePosition as coreResizePosition, type ResizeDirection } from '@alabuga/document-core';
import { frameworkWidgetMinimum } from './framework-grid-adapter';
export { snapDelta } from '@alabuga/document-core';
export type { ResizeDirection, SnapStep } from '@alabuga/document-core';

/** Keep the opposite edge anchored and clamp within the public grid constraints. */
export function resizePosition(
  initial: Widget['position'],
  type: Widget['type'],
  grid: Section['grid'],
  direction: ResizeDirection,
  dx: number,
  dy: number,
  maxRow = 1000,
): Widget['position'] {
  return coreResizePosition(initial, frameworkWidgetMinimum(type), grid, direction, dx, dy, maxRow);
}
