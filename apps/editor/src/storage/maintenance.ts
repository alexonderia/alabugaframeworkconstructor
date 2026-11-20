import type { AFDocument } from '@alabuga/framework/schema';
import type { Project, Revision, Asset } from './types';
import { db, write } from './db';
import { imageReferences } from './images';
type WorkspaceData = {
  projects: Project[];
  revisions: Revision[];
  settings: { id: string; value: any }[];
  assets: Asset[];
};

function readWorkspace(tx: IDBTransaction, done: (data: WorkspaceData) => void) {
  const data = {} as WorkspaceData;
  let remaining = 4;
  for (const name of ['projects', 'revisions', 'settings', 'assets'] as const) {
    const r = tx.objectStore(name).getAll();
    r.onsuccess = () => {
      data[name] = r.result;
      if (!--remaining) done(data);
    };
  }
}

function assetUsage(data: WorkspaceData) {
  const used = new Map<string, Set<string>>(),
    add = (doc: AFDocument, label: string) => {
      for (const id of imageReferences(doc)) {
        if (!used.has(id)) used.set(id, new Set());
        used.get(id)!.add(label);
      }
    };
  for (const p of data.projects) add(p.document, p.title + (p.deletedAt ? ' (корзина)' : ''));
  for (const r of data.revisions) add(r.document, 'История версий');
  const draft = data.settings.find((s) => s.id === 'ai-draft')?.value;
  if (draft?.sections) add({ pages: draft.sections.filter(Boolean) } as AFDocument, 'Черновик ИИ');
  return used;
}

export async function inspectStorage() {
  const d = await db(),
    data = await new Promise<WorkspaceData>((resolve, reject) => {
      const tx = d.transaction(['projects', 'revisions', 'settings', 'assets']);
      readWorkspace(tx, resolve);
      tx.onerror = () => reject(tx.error);
    }),
    used = assetUsage(data),
    descriptions = new Map(
      data.settings
        .filter((s) => s.id.startsWith('asset-description:'))
        .map((s) => [s.id.slice(18), String(s.value)]),
    );
  const estimate = await navigator.storage?.estimate().catch(() => undefined);
  return {
    usage: estimate?.usage,
    quota: estimate?.quota,
    assets: data.assets.map((a) => ({
      id: a.id,
      description: descriptions.get(a.id) || a.description || 'Без описания',
      bytes: a.data.length * 2,
      usedBy: [...(used.get(a.id) ?? [])],
      library: descriptions.has(a.id),
    })),
  };
}

/** References are checked again while all referencing stores are locked for writing. */
export async function removeUnusedAssets(ids: string[]) {
  let count = 0;
  await write(['projects', 'revisions', 'settings', 'assets'], (tx) =>
    readWorkspace(tx, (data) => {
      const used = assetUsage(data),
        exists = new Set(data.assets.map((a) => a.id));
      for (const id of new Set(ids))
        if (exists.has(id) && !used.has(id)) {
          tx.objectStore('assets').delete(id);
          tx.objectStore('settings').delete('asset-description:' + id);
          count++;
        }
    }),
  );
  return count;
}
