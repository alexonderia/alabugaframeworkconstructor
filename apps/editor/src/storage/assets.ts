import type { AFDocument } from '@alabuga/framework/schema';
import type { Asset } from './types';
import { db, read, write } from './db';
import { writeSetting } from './settings';
import { mapImages, imageReferences } from './images';
import { checked } from '../document-validation';
import { embedLocalImage } from '../framework-assets';
export const listAssets = async () => {
  const assets = await read<Asset[]>('assets'),
    settings = await read<{ id: string; value: unknown }[]>('settings'),
    descriptions = new Map(settings.map((s) => [s.id, s.value]));
  return assets.map((a) => ({
    ...a,
    description:
      (descriptions.get('asset-description:' + a.id) as string | undefined) ?? a.description,
  }));
};

export async function describeAsset(id: string, description: string) {
  const asset = await read<Asset | undefined>('assets', id);
  if (!asset) throw new Error('Материал не найден');
  await writeSetting('asset-description:' + id, description.slice(0, 200));
}

export async function addAsset(data: string, description: string) {
  const id = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  await write(['assets', 'settings'], (tx) => {
    tx.objectStore('assets').put({ id, data });
    tx.objectStore('settings').put({
      id: 'asset-description:' + id,
      value: description.slice(0, 200),
    });
  });
  return id;
}

export async function hydrate(document: AFDocument) {
  const doc = structuredClone(document),
    ids = new Set<string>();
  await mapImages(doc, async (src) => {
    if (src.startsWith('asset:')) ids.add(src.slice(6));
    return src;
  });
  if (!ids.size) return doc;
  const d = await db(),
    assets = await new Promise<Map<string, Asset>>((resolve, reject) => {
      const tx = d.transaction('assets'),
        values = new Map<string, Asset>();
      for (const id of ids) {
        const r = tx.objectStore('assets').get(id);
        r.onsuccess = () => {
          if (r.result) values.set(id, r.result);
        };
      }
      tx.oncomplete = () => resolve(values);
      tx.onerror = () => reject(tx.error);
    });
  await mapImages(doc, async (src) => {
    if (!src.startsWith('asset:')) return src;
    const asset = assets.get(src.slice(6));
    if (!asset) throw new Error('Не найден материал ' + src);
    return asset.data;
  });
  return doc;
}

// Bound retained data URLs by approximate UTF-16 bytes, including keys and results.
const materialCache = new Map<string, { value: Promise<Asset>; bytes: number }>();

let materialBytes = 0;

const materialLimit = 16 * 1024 * 1024;

function forgetMaterial(key: string) {
  const old = materialCache.get(key);
  if (old) {
    materialBytes -= old.bytes;
    materialCache.delete(key);
  }
}

export const materialCacheUsage = () => ({
  entries: materialCache.size,
  bytes: materialBytes,
  limit: materialLimit,
});

export function verifyAssets(
  tx: IDBTransaction,
  doc: AFDocument,
  assets: Asset[],
  missing: (error: Error) => void,
  commit: () => void,
) {
  const incoming = new Set(assets.map((a) => a.id)),
    ids = [...imageReferences(doc)].filter((id) => !incoming.has(id));
  if (!ids.length) {
    commit();
    return;
  }
  let remaining = ids.length,
    failed = false;
  for (const id of ids) {
    const r = tx.objectStore('assets').get(id);
    r.onsuccess = () => {
      if (!r.result) {
        failed = true;
        missing(
          new Error(
            'Не найден материал. Откройте сохранённую версию проекта или загрузите изображение заново.',
          ),
        );
      }
      if (--remaining === 0 && !failed) commit();
    };
  }
}

export async function normalizeAssets(input: AFDocument) {
  const document = checked(input),
    assets = new Map<string, Asset>(),
    operation = new Map<string, Asset>();
  await mapImages(document, async (src) => {
    if (src.startsWith('asset:') || /^https?:/i.test(src)) return src;
    let asset = operation.get(src);
    if (!asset) {
      let entry = materialCache.get(src);
      if (entry) {
        materialCache.delete(src);
        materialCache.set(src, entry);
      } else {
        const value = (async () => {
          const data = src.startsWith('data:') ? src : await embedLocalImage(src);
          const id = Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))),
            (b) => b.toString(16).padStart(2, '0'),
          ).join('');
          return { id, data };
        })();
        entry = { value, bytes: src.length * 4 };
        if (entry.bytes <= materialLimit) {
          materialCache.set(src, entry);
          materialBytes += entry.bytes;
          while (materialBytes > materialLimit) forgetMaterial(materialCache.keys().next().value!);
        }
        value.catch(() => forgetMaterial(src));
      }
      asset = await entry.value;
      if (materialCache.get(src) === entry) {
        materialBytes -= entry.bytes;
        entry.bytes = (src.length + asset.data.length) * 2;
        materialBytes += entry.bytes;
        while (materialBytes > materialLimit) forgetMaterial(materialCache.keys().next().value!);
      }
      operation.set(src, asset);
    }
    assets.set(asset.id, asset);
    return 'asset:' + asset.id;
  });
  return { document, assets: [...assets.values()] };
}
