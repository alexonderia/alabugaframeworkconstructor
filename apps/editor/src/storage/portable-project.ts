import type { AFDocument } from '@alabuga/framework/schema';
import type { Asset } from './types';
import { hydrate } from './assets';
import { mapImages } from './images';
import { embedLocalImage } from '../framework-assets';
export async function portableProject(doc: AFDocument) {
  const document = await hydrate(doc),
    assets: Asset[] = [];
  await mapImages(document, async (src) => {
    if (/^https?:/i.test(src)) return src;
    const data = await embedLocalImage(src),
      id = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('');
    if (!assets.some((a) => a.id === id)) assets.push({ id, data });
    return 'asset:' + id;
  });
  return { format: 'alabuga-project', version: 3, document, assets };
}
