import { validateDocument } from '@alabuga/framework/schema';
import { z } from 'zod';
import { frameworkDocument, type EditorDocument, type TemplateInfo } from './template-metadata';
import { applyDocumentGrid, validatedGrid } from './document-grid';

const ref = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]*(\/[a-z0-9-]+)+$/)
    .max(160),
  version: z.number().int().positive(),
});
const metadataSchema = z.strictObject({
  document: ref.optional(),
  sections: z.record(z.string().regex(/^[a-zA-Z][\w-]{0,63}$/), ref).optional(),
  unplaced: z.array(z.unknown()).max(100).optional(),
  documentGrid: z.unknown().optional(),
  gridOverrides: z
    .array(z.string().regex(/^[a-zA-Z][\w-]{0,63}$/))
    .max(100)
    .optional(),
});

function checkedFramework(input: unknown) {
  const r = validateDocument(input);
  if (!r.success) throw new Error(r.issues.map((i) => i.message).join('; '));
  return r.data;
}

export function checked(input: unknown): EditorDocument {
  if (!input || typeof input !== 'object' || !Object.hasOwn(input, 'templateInfo'))
    return checkedFramework(input);

  const source = input as EditorDocument;
  const parsed = metadataSchema.safeParse(source.templateInfo);
  if (!parsed.success) throw new Error('Некорректные сведения о шаблонах проекта.');
  const document = checkedFramework(frameworkDocument(source));
  const { document: origin, sections, unplaced, documentGrid, gridOverrides } = parsed.data;
  const info: TemplateInfo = {};
  if (origin) info.document = origin;
  if (sections) {
    const entries = document.pages.flatMap(({ id }) =>
      Object.hasOwn(sections, id) ? [[id, sections[id]] as const] : [],
    );
    if (entries.length) info.sections = Object.fromEntries(entries);
  }
  if (unplaced?.length)
    info.unplaced = checkedFramework({
      ...document,
      pages: [...document.pages, ...unplaced],
    }).pages.slice(document.pages.length);
  if (documentGrid !== undefined) info.documentGrid = validatedGrid(document, documentGrid);
  if (gridOverrides?.length) {
    const ids = new Set(document.pages.map((section) => section.id));
    const overrides = [...new Set(gridOverrides)].filter((id) => ids.has(id));
    if (overrides.length) info.gridOverrides = overrides;
  }
  const result = Object.keys(info).length ? { ...document, templateInfo: info } : document;
  if (info.documentGrid) applyDocumentGrid(result, info.documentGrid);
  return result;
}
