import { read, write } from './db';
import { uid } from '../model';
import { writeSetting } from './settings';
import type { SavedComposition } from '../templates';

const prefix = 'composition:';
export async function listSavedCompositions() {
  const settings = await read<{ id: string; value: SavedComposition }[]>('settings');
  return settings
    .filter(({ id }) => id.startsWith(prefix))
    .map(({ value }) => value)
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

export const saveComposition = (composition: SavedComposition) =>
  writeSetting(prefix + composition.id, composition);

/** Imported entries get independent IDs so an existing local composition survives every import. */
export async function storeImportedCompositions(compositions: SavedComposition[]) {
  const copies = compositions.map((entry) => ({ ...entry, id: 'custom/' + uid('import') }));
  await write(['settings'], (tx) => {
    for (const entry of copies)
      tx.objectStore('settings').put({ id: prefix + entry.id, value: entry });
  });
  return copies;
}
