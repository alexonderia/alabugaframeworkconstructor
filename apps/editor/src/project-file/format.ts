import { checked } from '../document-validation';
export type Asset = { id: string; data: string; description?: string };

export function importProject(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('Некорректный файл проекта');
  const obj = input as { format?: string; version?: unknown; document?: unknown; assets?: Asset[] };
  if (obj.format !== undefined && obj.format !== 'alabuga-project')
    throw new Error('Неизвестный формат проекта');
  if (obj.format === 'alabuga-project') {
    if (obj.version !== undefined && ![1, 2, 3].includes(obj.version as number))
      throw new Error('Неподдерживаемая версия файла проекта');
    if (obj.assets !== undefined && !Array.isArray(obj.assets))
      throw new Error('Некорректная библиотека материалов');
  }
  const doc = checked(obj?.format === 'alabuga-project' ? obj.document : input);
  const resolve = (src: string) => {
    if (!src.startsWith('asset:')) return src;
    const asset = obj.assets?.find((a) => a.id === src.slice(6));
    if (!asset || typeof asset.data !== 'string') throw new Error('Отсутствует материал ' + src);
    return asset.data;
  };
  for (const p of doc.pages) {
    if (p.appearance?.background) p.appearance.background = resolve(p.appearance.background);
    for (const w of p.widgets) {
      if (w.type === 'image') w.src = resolve(w.src);
      if (w.type === 'gallery') w.items.forEach((i) => (i.src = resolve(i.src)));
    }
  }
  return checked(doc);
}
