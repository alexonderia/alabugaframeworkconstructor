import { frameworkGrid } from './framework-grid-adapter';
import type { Grid } from '@alabuga/document-core';
import { validateDocument, type AFDocument, type Section } from '@alabuga/framework/schema';
import { planGridChange } from './grid-change';
import { editTemplateInfo, frameworkDocument, templateInfo } from './template-metadata';

export const hasSectionGrid = (document: AFDocument, id: string) =>
  templateInfo(document)?.gridOverrides?.includes(id) ?? false;

export function documentGrid(document: AFDocument): Grid {
  return structuredClone(templateInfo(document)?.documentGrid ?? document.pages[0].grid);
}

export function validatedGrid(document: AFDocument, value: unknown): Grid {
  try {
    return frameworkGrid(value, document.kind);
  } catch (error) {
    throw new Error('Некорректная сетка документа: ' + (error as Error).message);
  }
}

/** New instances inherit explicitly; validation and loading never reflow saved sections. */
export function inheritSectionGrid(document: AFDocument, section: Section): Section {
  return plannedSection(document, section, documentGrid(document));
}

function plannedSection(document: AFDocument, section: Section, grid: Section['grid']) {
  if (JSON.stringify(section.grid) === JSON.stringify(grid)) return structuredClone(section);
  try {
    return planGridChange(section, grid, document.kind);
  } catch (error) {
    throw new Error(
      `Раздел «${section.title || section.composition || section.id}»: ${(error as Error).message}`,
    );
  }
}

/** Materialize inheritance for the public renderer and export, then commit atomically. */
export function applyDocumentGrid(document: AFDocument, requested: Section['grid']) {
  const grid = planGridChange({ ...document.pages[0], widgets: [] }, requested, document.kind).grid,
    candidate = structuredClone(document);
  candidate.pages = candidate.pages.map((section) =>
    hasSectionGrid(candidate, section.id) ? section : plannedSection(candidate, section, grid),
  );
  editTemplateInfo(candidate).documentGrid = structuredClone(grid);
  const valid = validateDocument(frameworkDocument(candidate));
  if (!valid.success) throw new Error(valid.issues.map((issue) => issue.message).join('; '));
  document.pages = candidate.pages;
  Object.assign(editTemplateInfo(document), templateInfo(candidate));
}

export function applyInheritedGrid(
  document: AFDocument,
  index: number,
  requested: Section['grid'],
) {
  if (!hasSectionGrid(document, document.pages[index].id)) {
    applyDocumentGrid(document, requested);
    return;
  }
  const candidate = structuredClone(document);
  candidate.pages[index] = plannedSection(candidate, candidate.pages[index], requested);
  const valid = validateDocument(frameworkDocument(candidate));
  if (!valid.success) throw new Error(valid.issues.map((issue) => issue.message).join('; '));
  document.pages[index] = candidate.pages[index];
}

export function setSectionGrid(document: AFDocument, id: string, local: boolean) {
  const index = document.pages.findIndex((section) => section.id === id);
  if (index < 0) throw new Error('Раздел уже удалён.');
  const candidate = structuredClone(document),
    info = editTemplateInfo(candidate);
  info.documentGrid ??= documentGrid(candidate);
  const overrides = new Set(info.gridOverrides ?? []);
  if (local) overrides.add(id);
  else {
    overrides.delete(id);
    candidate.pages[index] = plannedSection(candidate, candidate.pages[index], info.documentGrid);
  }
  if (overrides.size) info.gridOverrides = [...overrides];
  else delete info.gridOverrides;
  const valid = validateDocument(frameworkDocument(candidate));
  if (!valid.success) throw new Error(valid.issues.map((issue) => issue.message).join('; '));
  document.pages = candidate.pages;
  const target = editTemplateInfo(document);
  delete target.gridOverrides;
  Object.assign(target, info);
}

/** An explicit grid lets a source revision restore its geometry without migrating again. */
export function preserveGridSettings(input: AFDocument) {
  const document = structuredClone(input),
    info = editTemplateInfo(document),
    base = info.documentGrid ?? document.pages[0].grid,
    overrides = new Set(info.gridOverrides ?? []);
  info.documentGrid = structuredClone(base);
  for (const section of document.pages)
    if (JSON.stringify(section.grid) !== JSON.stringify(base)) overrides.add(section.id);
  if (overrides.size) info.gridOverrides = [...overrides];
  return document;
}

/** Record existing differences as overrides without changing persisted geometry. */
export function prepareDocumentGrid(input: AFDocument): AFDocument {
  return preserveGridSettings(input);
}
