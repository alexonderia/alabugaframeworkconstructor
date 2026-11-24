import { validateDocument, type AFDocument, type Section } from '@alabuga/framework/schema';
import { planGridChange as corePlanGridChange } from '@alabuga/document-core';
import { frameworkGrid, frameworkWidgetMinimum } from './framework-grid-adapter';
import { frameworkDocument } from './template-metadata';

export function planGridChange(
  source: Section,
  requested: Section['grid'],
  kind: AFDocument['kind'],
): Section {
  return corePlanGridChange(source, frameworkGrid(requested, kind), kind, frameworkWidgetMinimum);
}

export function applyGridChange(document: AFDocument, index: number, grid: Section['grid']) {
  const section = planGridChange(document.pages[index], grid, document.kind);
  const candidate = structuredClone(document);
  candidate.pages[index] = section;
  const result = validateDocument(frameworkDocument(candidate));
  if (!result.success) throw new Error(result.issues.map((issue) => issue.message).join('; '));
  document.pages[index] = section;
}
