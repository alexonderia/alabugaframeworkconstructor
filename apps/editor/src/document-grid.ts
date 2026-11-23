import { standardGrid } from '@alabuga/framework/grid';
import { validateDocument, type AFDocument, type Section } from '@alabuga/framework/schema';
import { planGridChange } from './grid-change';
import { editTemplateInfo, frameworkDocument, templateInfo } from './template-metadata';

export const hasSectionGrid = (document: AFDocument, id: string) =>
  templateInfo(document)?.gridOverrides?.includes(id) ?? false;

export function documentGrid(document: AFDocument): Section['grid'] {
  return structuredClone(
    templateInfo(document)?.documentGrid ??
      document.pages.find((page) => page.grid.frame)?.grid ??
      standardGrid(),
  );
}

export function validatedGrid(document: AFDocument, value: unknown): Section['grid'] {
  const result = validateDocument({
    schemaVersion: 6,
    kind: document.kind,
    title: 'Сетка документа',
    pages: [{ ...document.pages[0], grid: value, widgets: [] }],
  });
  if (!result.success)
    throw new Error(
      'Некорректная сетка документа: ' + result.issues.map((issue) => issue.message).join('; '),
    );
  return result.data.pages[0].grid;
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

/** Adopt the existing framed grid as the common grid; leave legacy unframed files readable. */
export function prepareDocumentGrid(input: AFDocument): AFDocument {
  const document = structuredClone(input);
  if (templateInfo(document)?.documentGrid || document.pages.some((section) => section.grid.frame))
    applyDocumentGrid(document, documentGrid(document));
  return document;
}
