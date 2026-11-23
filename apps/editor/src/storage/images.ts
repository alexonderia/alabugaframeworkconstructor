import type { AFDocument } from '@alabuga/framework/schema';
import { documentSections } from '../template-metadata';
export async function mapImages(doc: AFDocument, mapper: (src: string) => Promise<string>) {
  for (const p of documentSections(doc)) {
    if (p.appearance?.background) p.appearance.background = await mapper(p.appearance.background);
    for (const w of p.widgets) {
      if (w.type === 'image') w.src = await mapper(w.src);
      if (w.type === 'gallery') for (const item of w.items) item.src = await mapper(item.src);
    }
  }
}

export function imageReferences(doc: AFDocument) {
  const ids = new Set<string>();
  const add = (src?: string) => {
    if (src?.startsWith('asset:')) ids.add(src.slice(6));
  };
  for (const p of documentSections(doc)) {
    add(p.appearance?.background);
    for (const w of p.widgets) {
      if (w.type === 'image') add(w.src);
      if (w.type === 'gallery') w.items.forEach((a) => add(a.src));
    }
  }
  return ids;
}
