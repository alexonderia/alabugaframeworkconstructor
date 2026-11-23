import type { AFDocument, Section } from '@alabuga/framework/schema';
import { reusableSection } from './sections';
import {
  saveComposition,
  listSavedCompositions,
  storeImportedCompositions,
} from './storage/compositions';
import { importCompositions } from './composition-file';
import { portableProject } from './storage';
import { download } from './export';
import { MAX_PROJECT_BYTES } from './project-file';
import { customTemplate } from './templates';
import { button, el, libraryDialog, showDialog } from './ui';
import { inputField } from './ui-fields';

export function saveCompositionDialog(
  section: Section,
  kind: AFDocument['kind'],
  signal: AbortSignal,
) {
  const { dialog, body } = libraryDialog('Сохранить композицию', 'asset-library'),
    form = el('form', 'af-stack'),
    status = el('p', 'af-error'),
    name = inputField(form, 'Название композиции', section.title, () => {}),
    submit = el('button', 'af-btn', 'Сохранить в каталог');
  submit.type = 'submit';
  name.required = true;
  name.maxLength = 100;
  status.setAttribute('role', 'alert');
  form.append(status, submit);
  body.append(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = name.value.trim();
    if (!title) return;
    void (async () => {
      submit.disabled = true;
      try {
        await saveComposition({
          id: 'custom/' + crypto.randomUUID(),
          version: 1,
          kind,
          title,
          section: reusableSection(kind, section),
        });
        dialog.close();
      } catch (error) {
        status.textContent = (error as Error).message;
        submit.disabled = false;
      }
    })();
  });
  const abort = () => dialog.close();
  signal.addEventListener('abort', abort, { once: true });
  dialog.addEventListener(
    'close',
    () => {
      signal.removeEventListener('abort', abort);
      dialog.remove();
    },
    { once: true },
  );
  document.body.append(dialog);
  showDialog(dialog);
}

export function transferCompositionsDialog(signal: AbortSignal, changed: () => Promise<void>) {
  const { dialog, body } = libraryDialog('Перенос моих композиций', 'asset-library'),
    status = el('p', 'af-help'),
    file = el('input', 'af-input'),
    label = el('label', 'af-field');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.setAttribute('aria-label', 'Импорт коллекции композиций');
  label.append(el('span', 'af-label', 'Импорт коллекции композиций'), file);
  status.setAttribute('role', 'status');
  let busy = false;
  const run = async (work: () => Promise<string>) => {
    if (busy || signal.aborted || !dialog.open) return;
    busy = true;
    file.disabled = true;
    exportButton.disabled = true;
    status.textContent = 'Подготавливаем коллекцию…';
    try {
      const message = await work();
      if (dialog.open) status.textContent = message;
    } catch (error) {
      if (dialog.open) status.textContent = (error as Error).message;
    } finally {
      busy = false;
      file.disabled = false;
      exportButton.disabled = false;
    }
  };
  const exportButton = button(
    'Скачать мои композиции',
    () =>
      void run(async () => {
        const entries = await listSavedCompositions();
        if (!entries.length) throw new Error('Сначала сохраните композицию в каталог.');
        if (entries.length > 100) throw new Error('За один раз можно перенести до 100 композиций.');
        const compositions = [];
        for (const entry of entries) {
          const { section: _source, ...metadata } = entry;
          signal.throwIfAborted();
          const project = await portableProject({
            schemaVersion: 3,
            kind: metadata.kind,
            title: metadata.title,
            pages: [customTemplate(entry).create()],
          });
          compositions.push({ ...metadata, project });
        }
        const collection = { format: 'alabuga-compositions', version: 1, compositions };
        importCompositions(collection);
        const serialized = JSON.stringify(collection);
        if (new Blob([serialized]).size > MAX_PROJECT_BYTES)
          throw new Error(
            'Коллекция превышает 100 МБ. Уменьшите размер изображений перед переносом.',
          );
        if (!dialog.open) return '';
        download('alabuga-compositions.json', serialized, 'application/json');
        return `Композиций скачано: ${entries.length}.`;
      }),
    'af-btn af-btn--secondary',
  );
  file.addEventListener('change', () => {
    const incoming = file.files?.[0];
    file.value = '';
    if (!incoming) return;
    void run(async () => {
      if (incoming.size > MAX_PROJECT_BYTES)
        throw new Error('Коллекция должна быть не больше 100 МБ.');
      const compositions = importCompositions(JSON.parse(await incoming.text()));
      signal.throwIfAborted();
      if (!dialog.open) return '';
      await storeImportedCompositions(compositions);
      if (!signal.aborted) await changed();
      return `Композиций добавлено: ${compositions.length}.`;
    });
  });
  body.append(
    el(
      'p',
      'af-help',
      'Файл включает собственные композиции сайтов и презентаций и их локальные изображения. Импорт добавляет независимые копии в каталог.',
    ),
    exportButton,
    label,
    status,
  );
  const abort = () => dialog.close();
  signal.addEventListener('abort', abort, { once: true });
  dialog.addEventListener(
    'close',
    () => {
      signal.removeEventListener('abort', abort);
      dialog.remove();
    },
    { once: true },
  );
  document.body.append(dialog);
  showDialog(dialog);
}
