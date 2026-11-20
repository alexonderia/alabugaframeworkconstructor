import type { AFDocument } from '@alabuga/framework/schema';
import type { Revision } from './types';
import { db, write } from './db';
import { normalizeAssets } from './assets';
export async function listRevisions(id: string) {
  const d = await db();
  return new Promise<Revision[]>((resolve, reject) => {
    const r = d.transaction('revisions').objectStore('revisions').index('project').getAll(id);
    r.onsuccess = () => resolve((r.result as Revision[]).sort((a, b) => b.created - a.created));
    r.onerror = () => reject(r.error);
  });
}

export async function saveRevision(project: string, input: AFDocument) {
  const { document, assets } = await normalizeAssets(input);
  await write(['revisions', 'assets', 'projects'], (tx) => {
    const projectRequest = tx.objectStore('projects').get(project);
    projectRequest.onsuccess = () => {
      if (!projectRequest.result || projectRequest.result.deletedAt) return;
      assets.forEach((a) => tx.objectStore('assets').put(a));
      const s = tx.objectStore('revisions'),
        request = s.index('project').getAll(project);
      request.onsuccess = () => {
        const existing = (request.result as Revision[]).sort((a, b) => b.created - a.created);
        if (existing[0] && JSON.stringify(existing[0].document) === JSON.stringify(document))
          return;
        s.put({
          id: crypto.randomUUID(),
          project,
          created: Math.max(Date.now(), (existing[0]?.created ?? 0) + 1),
          document,
        });
        existing.slice(19).forEach((r) => s.delete(r.id));
      };
    };
  });
}
