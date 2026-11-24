import { standardGrid } from '@alabuga/framework/grid';
import { validateDocument, widgetRegistry, type Widget } from '@alabuga/framework/schema';
import {
  parseGrid,
  type DocumentKind,
  type Grid,
  type WidgetMinimum,
} from '@alabuga/document-core';

/** Brand defaults belong to the selected renderer, never to the document core. */
export const alabugaGrid = (): Grid => structuredClone(standardGrid());

export function frameworkWidgetMinimum(type: string): WidgetMinimum {
  const minimum = widgetRegistry[type as Widget['type']];
  if (!minimum) throw new Error(`Неизвестный тип блока: ${type}`);
  return minimum;
}

/** Fail explicitly for unsupported geometry instead of silently substituting a preset. */
export function frameworkGrid(value: unknown, kind: DocumentKind): Grid {
  const grid = parseGrid(value);
  const result = validateDocument({
    schemaVersion: 6,
    kind,
    title: 'Сетка',
    pages: [{ id: 'grid-check', title: '', grid, widgets: [] }],
  });
  if (!result.success)
    throw new Error(
      'Framework не поддерживает параметры сетки: ' +
        result.issues.map((issue) => issue.message).join('; '),
    );
  return grid;
}
