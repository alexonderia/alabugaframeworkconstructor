import { el, button, iconButton } from './ui';
import { actionIcon } from './action-icons';
import { inputField, checkboxField, selectField } from './ui-fields';
import { controlHints } from './control-hints';
import type { SnapPreferences, SnapMode } from './snap-geometry';

const descriptions: Record<SnapMode, string> = {
  strict:
    'Край блока всегда привязывается к ближайшей линии. Учитываются обе стороны ячеек и промежутков.',
  off: 'Перемещение и размер без привязки к сетке. Стрелки — подстройка на 1 px.',
  mixed:
    'Свободное перемещение с притяжением края в пределах 6 экранных пикселей от линии. Стрелки — подстройка на 1 px.',
};

/** Editing preferences belong to the editor, independently of document history. */
export function blockControls(canvas: HTMLElement, openGrid: () => void, signal: AbortSignal) {
  const key = 'alabuga:block-controls';
  let step: SnapPreferences = { x: 1, y: 1, mode: 'strict' },
    grid = false;
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (
      saved &&
      [saved.x, saved.y].every((value) => Number.isInteger(value) && value >= 1 && value <= 24)
    ) {
      step = {
        x: saved.x,
        y: saved.y,
        mode: ['strict', 'off', 'mixed'].includes(saved.mode) ? saved.mode : 'strict',
      };
      grid = saved.grid === true;
    }
  } catch {}
  const details = el('details', 'block-controls'),
    trigger = el('summary', 'af-btn af-btn--ghost af-btn--sm block-controls-trigger', 'Привязка'),
    body = el('div', 'block-controls-body af');
  trigger.append(actionIcon('chevron'));
  body.id = 'snap-controls-' + crypto.randomUUID();
  body.setAttribute('popover', 'auto');
  body.setAttribute('role', 'dialog');
  body.setAttribute('aria-label', 'Настройки привязки');
  trigger.setAttribute('aria-controls', body.id);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  details.append(trigger, body);

  const info = (label: string, text: string) => {
    const control = iconButton(
      label,
      () => {},
      'info',
      'af-btn af-btn--clear af-btn--sm snap-info',
    );
    control.removeAttribute('title');
    control.dataset.info = '';
    control.dataset.hint = text;
    control.setAttribute('aria-expanded', 'false');
    return control;
  };
  const header = el('div', 'block-controls-header'),
    actions = el('div', 'block-controls-actions');
  const closeButton = iconButton(
    'Закрыть настройки привязки',
    () => close(true),
    'close',
    'af-btn af-btn--clear af-btn--sm',
  );
  actions.append(
    info(
      'О привязке',
      'Shift при перетаскивании фиксирует одну ось. Escape отменяет жест. В свободных режимах стрелки сдвигают на 1 px, Shift со стрелками меняет размер.',
    ),
    closeButton,
  );
  header.append(el('h3', '', 'Привязка и сетка'), actions);
  body.append(header);
  const save = () => {
    canvas.toggleAttribute('data-show-grid', grid);
    canvas.dataset.snapMode = step.mode;
    try {
      localStorage.setItem(key, JSON.stringify({ ...step, grid }));
    } catch {}
  };
  const mode = selectField(
    body,
    'Режим привязки',
    step.mode,
    { strict: 'Строгая', off: 'Выключена', mixed: 'Комбинированная' },
    (value) => {
      step.mode = value as SnapMode;
      describe();
      save();
    },
  );
  const modeInfo = info('О режиме привязки', descriptions[step.mode]);
  const modeField = mode.closest('label')!,
    modeGroup = el('div', 'block-controls-mode'),
    modeHeading = el('div', 'block-controls-step-label');
  modeField.before(modeGroup);
  modeHeading.append(modeField.querySelector('.af-label')!, modeInfo);
  modeGroup.append(modeHeading, modeField);
  const steps = el('div', 'block-controls-steps'),
    stepHeader = el('div', 'block-controls-step-label');
  stepHeader.append(
    el('span', 'af-label', 'Шаг привязки'),
    info(
      'О шаге привязки',
      'В строгом режиме шаг задаётся в колонках и строках. Размер ячеек меняется в настройках сетки раздела.',
    ),
  );
  const fields = el('div', 'block-controls-step-fields');
  for (const [axis, label, caption] of [
    ['x', 'Шаг по горизонтали, колонок', 'Колонки'],
    ['y', 'Шаг по вертикали, строк', 'Строки'],
  ] as const) {
    const input = inputField(fields, label, step[axis], () => {}, 'number');
    const labelNode = input.closest('label')!.querySelector('.af-label')!;
    labelNode.textContent = caption;
    labelNode.classList.add('af-label--sm');
    input.min = '1';
    input.max = '24';
    input.step = '1';
    input.required = true;
    input.addEventListener(
      'change',
      () => {
        if (!input.reportValidity()) return;
        step[axis] = Number(input.value);
        save();
      },
      { signal },
    );
  }
  steps.append(stepHeader, fields);
  body.append(steps);
  const visibility = el('div', 'block-controls-visibility');
  checkboxField(visibility, 'Показывать сетку', grid, (value) => {
    grid = value;
    save();
  });
  body.append(visibility);
  const footer = el('div', 'block-controls-footer');
  footer.append(
    button(
      'Настроить сетку раздела',
      () => {
        close();
        openGrid();
      },
      'af-btn af-btn--secondary af-btn--sm',
      'settings',
    ),
  );
  body.append(footer);
  const hints = controlHints(body, signal);

  function describe() {
    modeInfo.dataset.hint = descriptions[step.mode];
    steps.hidden = step.mode !== 'strict';
    for (const input of fields.querySelectorAll<HTMLInputElement>('input'))
      input.disabled = step.mode !== 'strict';
  }
  function position() {
    if (!body.matches(':popover-open')) return;
    const rect = trigger.getBoundingClientRect(),
      edge = 12,
      gap = 8;
    const below = innerHeight - rect.bottom - gap - edge,
      above = rect.top - gap - edge;
    const upwards = below < Math.min(body.scrollHeight, 300) && above > below;
    body.style.maxHeight = Math.max(120, upwards ? above : below) + 'px';
    body.style.left =
      Math.max(edge, Math.min(rect.left, innerWidth - body.offsetWidth - edge)) + 'px';
    body.style.top =
      Math.max(edge, upwards ? rect.top - gap - body.offsetHeight : rect.bottom + gap) + 'px';
  }
  function close(focus = false) {
    hints.hide();
    const combobox = body.querySelector<HTMLElement>('[role=combobox][aria-expanded=true]');
    combobox?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (body.matches(':popover-open')) body.hidePopover();
    details.open = false;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus && trigger.isConnected) trigger.focus({ preventScroll: true });
  }
  function open(keyboard: boolean) {
    details.open = true;
    trigger.setAttribute('aria-expanded', 'true');
    body.showPopover();
    position();
    if (keyboard)
      body.querySelector<HTMLElement>('[role=combobox],select')?.focus({ preventScroll: true });
  }
  trigger.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      if (details.open) close();
      else open(event.detail === 0);
    },
    { signal },
  );
  body.addEventListener(
    'toggle',
    (event) => {
      if (event.target !== body || body.matches(':popover-open')) return;
      close();
    },
    { signal },
  );
  document.addEventListener(
    'focusin',
    (event) => {
      if (details.open && !details.contains(event.target as Node)) close();
    },
    { signal },
  );
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !details.open) return;
      if (body.querySelector('[role=combobox][aria-expanded=true]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!hints.dismiss()) close(true);
    },
    { capture: true, signal },
  );
  window.addEventListener('resize', position, { signal });
  window.addEventListener('scroll', position, { capture: true, passive: true, signal });
  const options = new MutationObserver(() => {
    for (const row of body.querySelectorAll<HTMLElement>('[role=option][data-index]')) {
      const value = mode.options[Number(row.dataset.index)]?.value as SnapMode;
      if (descriptions[value]) row.dataset.hint = descriptions[value];
    }
  });
  options.observe(body, { childList: true, subtree: true });
  const resize = new ResizeObserver(position);
  resize.observe(body);
  signal.addEventListener(
    'abort',
    () => {
      close();
      options.disconnect();
      resize.disconnect();
    },
    { once: true },
  );
  save();
  describe();
  return { element: details, step: () => ({ ...step }) };
}
