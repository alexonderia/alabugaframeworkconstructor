import { showDialog, libraryDialog, el, button, invocationTarget } from './ui';

interface ConflictActions {
  signal: AbortSignal;
  settled: () => Promise<void>;
  saveCopy: () => Promise<void>;
  reloadSaved: () => Promise<void>;
}

export function showSaveConflict(actions: ConflictActions) {
  if (actions.signal.aborted || document.querySelector('.save-conflict')) return;
  const { dialog, body } = libraryDialog('Конфликт сохранения', 'product-dialog save-conflict'),
    status = el('p');
  status.setAttribute('role', 'status');
  let resolving = false;
  const controls = el('div', 'af-dialog__actions library-dialog-actions save-conflict-actions');
  dialog.addEventListener('cancel', (event) => {
    if (resolving) event.preventDefault();
  });
  const perform = (work: () => Promise<void>) => async () => {
    if (resolving) return;
    resolving = true;
    const trigger = invocationTarget(),
      buttons = dialog.querySelectorAll('button');
    buttons.forEach((button) => (button.disabled = true));
    status.setAttribute('role', 'status');
    status.textContent = 'Выполняем выбранное действие…';
    try {
      await actions.settled();
      if (actions.signal.aborted) return;
      await work();
      dialog.close();
    } catch (error) {
      status.setAttribute('role', 'alert');
      status.textContent = (error as Error).message;
    } finally {
      resolving = false;
      buttons.forEach((button) => (button.disabled = false));
      if (dialog.open) trigger?.focus({ preventScroll: true });
    }
  };
  body.append(
    el(
      'p',
      '',
      'Проект изменён в другой вкладке. Ваши правки остались в редакторе. Сохраните их отдельной копией или откройте версию из браузерного хранилища.',
    ),
    status,
  );
  dialog.append(controls);
  controls.append(
    button('Сохранить мою копию', perform(actions.saveCopy), 'af-btn'),
    button('Открыть сохранённую версию', perform(actions.reloadSaved), 'af-btn af-btn--secondary'),
    button('Продолжить редактирование', () => dialog.close(), 'af-btn af-btn--ghost'),
  );
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  showDialog(dialog);
}
