export const knownVersions = new Map<string, number>();

export const projectVersion = (id: string) => knownVersions.get(id) ?? 0;

export const rememberProjectVersion = (id: string, version: number) =>
  knownVersions.set(id, version);

export class ProjectConflictError extends Error {
  constructor(readonly projectId: string) {
    super(
      'Проект изменён в другой вкладке. Ваши правки сохранены в редакторе — выберите, какую версию открыть.',
    );
    this.name = 'ProjectConflictError';
  }
}

type ProjectChange = { id: string; version: number; deleted?: boolean };

const changes =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('alabuga-project-changes')
    : undefined;

export const publish = (change: ProjectChange) => changes?.postMessage(change);

export function subscribeProjectChanges(
  listener: (change: ProjectChange) => void,
  signal: AbortSignal,
) {
  changes?.addEventListener(
    'message',
    (event) => {
      const value = event.data;
      if (value && typeof value.id === 'string' && Number.isInteger(value.version)) listener(value);
    },
    { signal },
  );
}
