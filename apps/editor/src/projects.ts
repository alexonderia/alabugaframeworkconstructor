import { showDialog, libraryDialog, el, button } from './ui';
import { type AFDocument } from '@alabuga/framework/schema';
import { listProjects, listRevisions, getProject, hydrate, saveRevision } from './storage';
import { documentSurface } from './document-surface';

export async function projectDialog(
  current: string,
  doc: AFDocument,
  open: (id: string, doc: AFDocument) => void,
  versions = false,
  createVersion?: () => Promise<void>,
  signal?: AbortSignal,
) {
  if (signal?.aborted) return;
  const { dialog, body } = libraryDialog(
      versions ? 'История версий' : 'Мои проекты',
      'project-library',
    ),
    list = el('div', 'af-stack project-library-list'),
    status = el('p', '', 'Загружаем…');
  status.setAttribute('role', 'status');
  let activePreview: HTMLDialogElement | undefined;
  if (versions) dialog.classList.add('version-history-panel');
  async function restoreVersion(snapshot: AFDocument, preview?: HTMLDialogElement) {
    await saveRevision(current, doc);
    const restored = await hydrate(snapshot);
    if (!dialog.isConnected || signal?.aborted) return;
    open(current, restored);
    preview?.close();
    dialog.close();
  }
  function previewVersion(snapshot: AFDocument, created: number) {
    if (activePreview?.open || signal?.aborted) return;
    const { dialog: preview, body: previewBody } = libraryDialog(
      'Предпросмотр версии',
      'version-preview-dialog',
    );
    activePreview = preview;
    const previewStatus = el('p', 'af-help', 'Загружаем предпросмотр…');
    previewStatus.setAttribute('role', 'status');
    const host = el('div', 'version-preview-surface');
    previewBody.append(
      el('p', 'af-help', `${snapshot.title} · ${new Date(created).toLocaleString('ru')}`),
      previewStatus,
      host,
    );
    const actions = el('div', 'af-dialog__actions library-dialog-actions');
    const restore = button(
      'Восстановить эту версию',
      async () => {
        restore.disabled = true;
        try {
          await restoreVersion(snapshot, preview);
        } catch (error) {
          previewStatus.textContent = (error as Error).message;
        } finally {
          restore.disabled = false;
        }
      },
      'af-btn',
    );
    actions.append(restore);
    preview.append(actions);
    document.body.append(preview);
    const surface = documentSurface(host, snapshot);
    restore.disabled = true;
    preview.addEventListener(
      'close',
      () => {
        surface.destroy();
        preview.remove();
        if (activePreview === preview) activePreview = undefined;
      },
      { once: true },
    );
    showDialog(preview);
    void surface.ready
      .then(() => {
        if (!preview.isConnected) return;
        previewStatus.textContent = '';
        restore.disabled = false;
      })
      .catch((error) => {
        if (preview.isConnected)
          previewStatus.textContent =
            'Не удалось открыть предпросмотр: ' + (error as Error).message;
      });
  }
  async function drawVersions() {
    const revisions = await listRevisions(current);
    if (!dialog.isConnected) return;
    list.replaceChildren();
    if (!revisions.length)
      list.append(
        el(
          'p',
          'af-help',
          'Пока нет сохранённых версий. Создайте точку восстановления или продолжайте работу: версии также создаются автоматически.',
        ),
      );
    for (const r of revisions) {
      const entry = el('div', 'version-history-entry');
      entry.append(el('strong', '', new Date(r.created).toLocaleString('ru')));
      const actions = el('div', 'version-history-actions');
      actions.append(
        button(
          'Предпросмотр',
          () => previewVersion(r.document, r.created),
          'af-btn af-btn--secondary af-btn--sm',
        ),
      );
      actions.append(
        button(
          'Восстановить эту версию',
          async () => {
            try {
              await restoreVersion(r.document);
            } catch (e) {
              status.textContent = String(e);
            }
          },
          'af-btn af-btn--ghost af-btn--sm',
        ),
      );
      entry.append(actions);
      list.append(entry);
    }
  }
  if (versions && createVersion) {
    const create = button(
      'Создать версию',
      async () => {
        create.disabled = true;
        try {
          await createVersion();
          await drawVersions();
          status.textContent = 'Точка восстановления создана.';
        } catch (e) {
          status.textContent = (e as Error).message;
        } finally {
          create.disabled = false;
        }
      },
      'af-btn',
    );
    body.append(create);
  }
  body.append(status, list);
  document.body.append(dialog);
  const abort = () => dialog.close();
  signal?.addEventListener('abort', abort, { once: true });
  dialog.addEventListener('close', () => {
    activePreview?.close();
    signal?.removeEventListener('abort', abort);
    dialog.remove();
  });
  showDialog(dialog);
  try {
    if (versions) {
      await drawVersions();
    } else {
      for (const p of (await listProjects()).sort((a, b) => b.updated - a.updated))
        list.append(
          button(p.title + ' · ' + new Date(p.updated).toLocaleString('ru'), async () => {
            try {
              const next = await getProject(p.id);
              open(p.id, await hydrate(next.document));
              dialog.close();
            } catch (e) {
              status.textContent = String(e);
            }
          }),
        );
    }
    status.textContent = '';
  } catch (e) {
    status.textContent = 'Не удалось открыть хранилище: ' + String(e);
  }
}
