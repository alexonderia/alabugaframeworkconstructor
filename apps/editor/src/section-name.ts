import type { AFDocument, Section } from '@alabuga/framework/schema';
import { sectionTemplates } from './templates';
export function sectionDisplayName(section: Section, kind: AFDocument['kind'], index: number) {
  const heading = section.widgets
    .flatMap((w) => (w.type === 'text' ? w.content : []))
    .find((b) => b.type === 'heading' && b.text.trim());
  return (
    section.title.trim() ||
    (heading && 'text' in heading ? heading.text : '') ||
    section.widgets.find((w) => w.title.trim())?.title ||
    sectionTemplates(kind).find(({ key }) => key === section.composition)?.title ||
    `${kind === 'page' ? 'Секция' : 'Слайд'} ${index + 1}`
  )
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}
