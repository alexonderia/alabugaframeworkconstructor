import { read, write } from './db';
export const readSetting = <T>(id: string) => read<T | undefined>('settings', id);

export const writeSetting = (id: string, value: unknown) =>
  write(['settings'], (tx) => tx.objectStore('settings').put({ id, value }));
