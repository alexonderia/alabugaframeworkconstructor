import { dialogFrame, el } from './ui';

type Actions = {
  arrow: (event: KeyboardEvent) => boolean;
  close: () => boolean;
  undo: () => void;
  redo: () => void;
  save: () => void;
  duplicate: () => void;
  remove: () => void;
  copy: () => string | undefined;
  cut: () => void;
  paste: (text: string) => boolean;
  zoom: (delta: number) => void;
  resetZoom: () => void;
  fit: () => void;
  preview: () => void;
  help: () => void;
  error: (error: unknown) => void;
};

const editing = (target: Element) =>
  !!target.closest(
    'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="spinbutton"]',
  );
const selectingText = () => !!window.getSelection()?.toString();
const key = (event: KeyboardEvent, code: string, fallback: string) =>
  event.code === code || (!event.code && event.key.toLowerCase() === fallback);

/** Native text editing and dialogs retain their own keyboard and clipboard behavior. */
export function bindEditorShortcuts(
  root: HTMLElement,
  canvas: HTMLElement,
  signal: AbortSignal,
  actions: Actions,
) {
  const blocked = (event: Event, allowOverlay = false) => {
    const target = event.target instanceof Element ? event.target : document.activeElement;
    return (
      signal.aborted ||
      event.defaultPrevented ||
      root.inert ||
      !!document.querySelector('dialog[open]') ||
      (!allowOverlay && !!document.querySelector('.tutorial-overlay:popover-open')) ||
      !(target instanceof Element) ||
      (!root.contains(target) &&
        target !== document.body &&
        target !== document.documentElement &&
        !(allowOverlay && target.closest('.author-tutorial'))) ||
      !!target.closest(
        '[inert],[role="listbox"],[role="menu"],.af-select-box[aria-expanded="true"]',
      )
    );
  };
  // Inline text fields stop bubbling key events. Canvas zoom and project download
  // must still work there, while native text undo and clipboard events stay local.
  window.addEventListener(
    'keydown',
    (event) => {
      if (
        blocked(event, !key(event, 'KeyS', 's')) ||
        event.isComposing ||
        event.altKey ||
        !(event.ctrlKey || event.metaKey)
      )
        return;
      let action: (() => void) | undefined;
      if (key(event, 'KeyS', 's')) action = actions.save;
      else if (['Equal', 'NumpadAdd'].includes(event.code) || ['+', '='].includes(event.key))
        action = () => actions.zoom(0.1);
      else if (['Minus', 'NumpadSubtract'].includes(event.code) || event.key === '-')
        action = () => actions.zoom(-0.1);
      else if (key(event, 'Digit0', '0') || event.code === 'Numpad0') action = actions.resetZoom;
      if (action) {
        event.preventDefault();
        action();
      }
    },
    { signal, capture: true },
  );
  window.addEventListener(
    'keydown',
    (event) => {
      const history =
        (event.ctrlKey || event.metaKey) && (key(event, 'KeyZ', 'z') || key(event, 'KeyY', 'y'));
      // A render may remove the focused block between auto-repeat events.
      // Recover only canvas/body focus; fields, toolbar controls and dialogs keep their keys.
      const target = event.target instanceof Element ? event.target : document.body;
      if (
        !blocked(event) &&
        !event.isComposing &&
        !event.ctrlKey &&
        !event.metaKey &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) &&
        (target === document.body || target === document.documentElement || target === canvas)
      ) {
        if (actions.arrow(event)) return;
      }
      if (blocked(event, history) || event.isComposing || event.keyCode === 229 || event.altKey)
        return;
      const command = event.ctrlKey || event.metaKey;
      if (event.key === 'Escape') {
        if (
          target.closest(
            '.outline-menu[open],.project-menu[open],.editor-more[open],.block-controls[open]',
          )
        )
          return;
        if (actions.close()) event.preventDefault();
        return;
      }
      if (editing(target)) return;
      let action: (() => void) | undefined;
      if (command) {
        if (key(event, 'KeyZ', 'z')) action = event.shiftKey ? actions.redo : actions.undo;
        else if (key(event, 'KeyY', 'y')) action = actions.redo;
        else if (key(event, 'KeyD', 'd')) action = actions.duplicate;
        else if (event.key === 'Enter') action = actions.preview;
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!target.closest('button,a,summary,[role="button"]')) action = actions.remove;
      } else if (event.shiftKey && event.code === 'Digit1') action = actions.fit;
      else if (event.shiftKey && event.code === 'Digit0') action = actions.resetZoom;
      else if (event.key === 'F1' || (event.shiftKey && event.code === 'Slash'))
        action = actions.help;
      if (action) {
        event.preventDefault();
        action();
      }
    },
    { signal },
  );
  for (const type of ['copy', 'cut'] as const)
    window.addEventListener(
      type,
      (event) => {
        const target = event.target instanceof Element ? event.target : document.body;
        if (blocked(event) || editing(target) || selectingText() || !event.clipboardData) return;
        try {
          const text = actions.copy();
          if (!text) return;
          event.clipboardData.setData('text/plain', text);
          event.preventDefault();
          if (type === 'cut') actions.cut();
        } catch (error) {
          actions.error(error);
        }
      },
      { signal },
    );
  window.addEventListener(
    'paste',
    (event) => {
      const target = event.target instanceof Element ? event.target : document.body;
      if (blocked(event) || editing(target) || !event.clipboardData) return;
      try {
        if (actions.paste(event.clipboardData.getData('text/plain'))) event.preventDefault();
      } catch (error) {
        event.preventDefault();
        actions.error(error);
      }
    },
    { signal },
  );
  canvas.parentElement!.addEventListener(
    'wheel',
    (event) => {
      if ((!event.ctrlKey && !event.metaKey) || !event.deltaY || blocked(event, true)) return;
      event.preventDefault();
      actions.zoom(event.deltaY > 0 ? -0.1 : 0.1);
    },
    { signal, passive: false },
  );
  for (const [selector, shortcut] of [
    ['#undo', 'Control+Z Meta+Z'],
    ['#redo', 'Control+Shift+Z Meta+Shift+Z Control+Y'],
    ['#save', 'Control+S Meta+S'],
    ['#preview', 'Control+Enter Meta+Enter'],
    ['[aria-label="Увеличить масштаб"]', 'Control+Plus Meta+Plus'],
    ['[aria-label="Уменьшить масштаб"]', 'Control+- Meta+-'],
    ['[aria-label="Масштаб 100%"]', 'Control+0 Meta+0'],
  ])
    root.querySelector(selector)?.setAttribute('aria-keyshortcuts', shortcut);
}

export function shortcutHelp() {
  const { body } = dialogFrame('Горячие клавиши');
  body.append(
    el(
      'p',
      'af-help',
      'В macOS используйте Cmd вместо Ctrl. При вводе текста и в диалогах работают обычные сочетания браузера.',
    ),
  );
  const list = el('dl');
  for (const [keys, description] of [
    ['Ctrl+C / Ctrl+X / Ctrl+V', 'Копировать, вырезать и вставить выбранный блок'],
    ['Ctrl+D', 'Дублировать выбранный блок'],
    ['Delete / Backspace', 'Удалить выбранный блок'],
    ['Ctrl+Z', 'Отменить действие'],
    ['Ctrl+Shift+Z / Ctrl+Y', 'Повторить действие'],
    ['Стрелки / Shift+стрелки', 'Переместить блок на один шаг / на десять шагов'],
    ['Alt+стрелки / Alt+Shift+стрелки', 'Изменить размер блока на один шаг / на десять шагов'],
    ['Ctrl++ / Ctrl+− / Ctrl+колесо', 'Изменить масштаб холста'],
    ['Ctrl+0 / Shift+0', 'Масштаб холста 100%'],
    ['Shift+1', 'Вписать холст'],
    ['Ctrl+Enter', 'Открыть предпросмотр'],
    ['Ctrl+S', 'Скачать копию проекта'],
    ['Enter', 'Открыть настройки блока'],
    ['Escape', 'Завершить ввод, закрыть панель или снять выделение'],
    ['F1 / ?', 'Показать горячие клавиши'],
  ])
    list.append(el('dt', '', keys), el('dd', '', description));
  body.append(
    list,
    el(
      'p',
      'af-help',
      'Стрелки работают при фокусе на блоке. На узком холсте они меняют порядок блоков. Геометрия шаблона доступна в расширенном режиме.',
    ),
  );
}
