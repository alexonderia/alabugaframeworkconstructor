import type { AFDocument } from '@alabuga/framework/schema';
import { read, write } from './db';
import { summary, type Project, type ProjectSummary } from './types';
import { knownVersions, projectVersion, ProjectConflictError, publish } from './project-state';
import { normalizeAssets, verifyAssets } from './assets';
import { checked } from '../document-validation';
export const listProjects = () => read<Project[]>('projects');

export const listProjectSummaries = () => read<ProjectSummary[]>('summaries');

export async function getProject(id: string) {
  const p = await read<Project | undefined>('projects', id);
  if (!p) throw new Error('Проект не найден');
  knownVersions.set(id, p.version ?? 0);
  return { ...p, document: checked(p.document) };
}

export async function currentProject() {
  const current = await read<{ id: string; value: string } | undefined>('settings', 'current');
  if (!current) return;
  const p = await read<Project | undefined>('projects', current.value);
  return p && !p.deletedAt ? p : undefined;
}

export async function activateProject(id: string) {
  await write(['settings'], (tx) => tx.objectStore('settings').put({ id: 'current', value: id }));
}

export async function saveProject(
  id: string,
  input: AFDocument,
  draftId?: string,
  options: { expectedVersion?: number } = {},
) {
  const expected = options.expectedVersion ?? projectVersion(id),
    { document: doc, assets } = await normalizeAssets(input);
  let failure: Error | undefined,
    version = 0;
  await write(['projects', 'summaries', 'assets', 'settings'], (tx) => {
    const projects = tx.objectStore('projects'),
      get = projects.get(id);
    get.onsuccess = () => {
      const tombstone = tx.objectStore('settings').get('removed:' + id);
      tombstone.onsuccess = () => {
        const existing = get.result as Project | undefined;
        if (existing?.deletedAt || tombstone.result) {
          failure = new Error(
            'Проект находится в корзине или удалён. Скачайте изменения или восстановите проект.',
          );
          return;
        }
        if ((existing?.version ?? 0) !== expected) {
          failure = new ProjectConflictError(id);
          return;
        }
        verifyAssets(
          tx,
          doc,
          assets,
          (error) => (failure = error),
          () => {
            version = expected + 1;
            for (const asset of assets) tx.objectStore('assets').put(asset);
            if (draftId) {
              const draft = tx.objectStore('settings').get('ai-draft');
              draft.onsuccess = () => {
                if (draft.result?.value.id === draftId) {
                  draft.result.value.projectId = id;
                  tx.objectStore('settings').put(draft.result);
                }
              };
            }
            const p: Project = {
              id,
              title: doc.title,
              updated: Date.now(),
              document: doc,
              version,
            };
            projects.put(p);
            tx.objectStore('summaries').put(summary(p));
            tx.objectStore('settings').put({ id: 'current', value: id });
          },
        );
      };
    };
  });
  if (failure) throw failure;
  knownVersions.set(id, version);
  publish({ id, version });
  return doc;
}

async function updateProject(id: string, change: (p: Project) => void, expectedVersion?: number) {
  let failure: Error | undefined, updated: Project | undefined;
  await write(['projects', 'summaries', 'settings'], (tx) => {
    const store = tx.objectStore('projects'),
      r = store.get(id);
    r.onsuccess = () => {
      const p = r.result as Project | undefined;
      if (!p) {
        failure = new Error('Проект не найден');
        return;
      }
      if (expectedVersion !== undefined && (p.version ?? 0) !== expectedVersion) {
        failure = new ProjectConflictError(id);
        return;
      }
      change(p);
      p.version = (p.version ?? 0) + 1;
      updated = p;
      store.put(p);
      tx.objectStore('summaries').put(summary(p));
      if (p.deletedAt) {
        const c = tx.objectStore('settings').get('current');
        c.onsuccess = () => {
          if (c.result?.value === id) tx.objectStore('settings').delete('current');
        };
      }
    };
  });
  if (failure) throw failure;
  if (updated) {
    knownVersions.set(id, updated.version!);
    publish({ id, version: updated.version!, deleted: !!updated.deletedAt });
  }
}

export async function renameProject(id: string, title: string, expectedVersion?: number) {
  title = title.trim();
  if (!title || title.length > 200)
    throw new Error('Название должно содержать от 1 до 200 символов.');
  await updateProject(
    id,
    (p) => {
      p.title = title;
      p.document.title = title;
      p.updated = Date.now();
    },
    expectedVersion,
  );
}

export const trashProject = (id: string) =>
  updateProject(id, (p) => {
    p.deletedAt = Date.now();
  });

export const restoreProject = (id: string) =>
  updateProject(id, (p) => {
    delete p.deletedAt;
  });

export async function deleteProject(id: string) {
  let rejected = false;
  await write(['projects', 'summaries', 'revisions', 'settings'], (tx) => {
    const r = tx.objectStore('projects').get(id);
    r.onsuccess = () => {
      if (!r.result?.deletedAt) {
        rejected = true;
        return;
      }
      tx.objectStore('projects').delete(id);
      tx.objectStore('summaries').delete(id);
      tx.objectStore('settings').put({ id: 'removed:' + id, value: true });
      const revisions = tx
        .objectStore('revisions')
        .index('project')
        .openCursor(IDBKeyRange.only(id));
      revisions.onsuccess = () => {
        const c = revisions.result;
        if (c) {
          if (c.value.project === id) c.delete();
          c.continue();
        }
      };
      const draft = tx.objectStore('settings').get('ai-draft');
      draft.onsuccess = () => {
        if (draft.result?.value.projectId === id) tx.objectStore('settings').delete('ai-draft');
      };
    };
  });
  if (rejected) throw new Error('Сначала переместите проект в корзину.');
}
