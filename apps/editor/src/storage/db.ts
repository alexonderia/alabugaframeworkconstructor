import { summary } from './types';
let database: Promise<IDBDatabase> | undefined;

export function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('alabuga-workspace', 3);
    r.onupgradeneeded = (event) => {
      for (const name of ['projects', 'assets', 'revisions', 'settings', 'summaries'])
        if (!r.result.objectStoreNames.contains(name))
          r.result.createObjectStore(name, { keyPath: 'id' });
      const revisions = r.transaction!.objectStore('revisions');
      if (!revisions.indexNames.contains('project')) revisions.createIndex('project', 'project');
      if (event.oldVersion < 2) {
        const cursor = r.transaction!.objectStore('projects').openCursor();
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c) {
            r.transaction!.objectStore('summaries').put(summary(c.value));
            c.continue();
          }
        };
      }
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => {
        r.result.close();
        database = undefined;
      };
      resolve(r.result);
    };
    r.onerror = () => {
      database = undefined;
      reject(r.error);
    };
    r.onblocked = () => {
      database = undefined;
      reject(new Error('Закройте другие вкладки конструктора и повторите открытие.'));
    };
  }).catch((e) => {
    database = undefined;
    throw e;
  }));
}

export async function read<T>(store: string, id?: string): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r =
      id === undefined
        ? d.transaction(store).objectStore(store).getAll()
        : d.transaction(store).objectStore(store).get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function write(stores: string[], work: (tx: IDBTransaction) => void) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(stores, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Запись отменена'));
    try {
      work(tx);
    } catch (error) {
      // A synchronous callback failure must not commit requests already queued.
      try {
        tx.abort();
      } finally {
        reject(error);
      }
    }
  });
}
