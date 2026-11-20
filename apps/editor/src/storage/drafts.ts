import type { Asset } from './types';
import { write } from './db';
import { readSetting } from './settings';
import { normalizeAssets, hydrate } from './assets';
export async function saveDraftSetting(value: import('@alabuga/ai/contracts').DraftResult) {
  const copy = structuredClone(value),
    pages = copy.sections.filter((p): p is NonNullable<typeof p> => !!p);
  let assets: Asset[] = [];
  if (pages.length) {
    const normalized = await normalizeAssets({
      schemaVersion: 3,
      kind: copy.request.kind,
      title: copy.title,
      pages,
    });
    let i = 0;
    copy.sections = copy.sections.map((p) => (p ? normalized.document.pages[i++] : null));
    assets = normalized.assets;
  }
  let removed = false;
  await write(['assets', 'settings'], (tx) => {
    const request = tx.objectStore('settings').get('removed:' + copy.projectId);
    request.onsuccess = () => {
      if (request.result) {
        removed = true;
        return;
      }
      assets.forEach((a) => tx.objectStore('assets').put(a));
      tx.objectStore('settings').put({ id: 'ai-draft', value: copy });
    };
  });
  if (removed) throw new Error('Проект удалён. Черновик не сохранён.');
}

export async function loadDraftSetting() {
  const record = await readSetting<{ value: import('@alabuga/ai/contracts').DraftResult }>(
    'ai-draft',
  );
  if (!record) return;
  const d = record.value,
    pages = d.sections.filter((p): p is NonNullable<typeof p> => !!p);
  if (pages.length) {
    const hydrated = await hydrate({
      schemaVersion: 3,
      kind: d.request.kind,
      title: d.title,
      pages,
    });
    let i = 0;
    d.sections = d.sections.map((p) => (p ? hydrated.pages[i++] : null));
  }
  return d;
}
