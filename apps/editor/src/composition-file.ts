import { z } from 'zod';
import { importProject } from './project-file/format';
import { reusableSection } from './sections';
import type { SavedComposition } from './templates';

const entry = z.strictObject({
  id: z
    .string()
    .regex(/^custom\/[a-zA-Z0-9-]+$/)
    .max(160),
  version: z.number().int().positive(),
  kind: z.enum(['page', 'presentation']),
  title: z.string().trim().min(1).max(100),
  project: z.unknown(),
});
const collection = z.strictObject({
  format: z.literal('alabuga-compositions'),
  version: z.literal(1),
  compositions: z.array(entry).min(1).max(100),
});

/** Validate the entire collection before any persistence request. */
export function importCompositions(input: unknown): SavedComposition[] {
  const parsed = collection.safeParse(input);
  if (!parsed.success)
    throw new Error('Некорректный файл коллекции композиций или неподдерживаемая версия.');
  const ids = new Set<string>();
  return parsed.data.compositions.map(({ project, ...metadata }) => {
    if (ids.has(metadata.id)) throw new Error('В коллекции повторяются идентификаторы композиций.');
    ids.add(metadata.id);
    const document = importProject(project);
    if (
      document.kind !== metadata.kind ||
      document.pages.length !== 1 ||
      document.templateInfo?.unplaced?.length
    )
      throw new Error('Композиция должна содержать один раздел соответствующего типа.');
    return { ...metadata, section: reusableSection(metadata.kind, document.pages[0]) };
  });
}
