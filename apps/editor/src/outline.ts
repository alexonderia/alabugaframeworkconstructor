import { el, button, iconButton } from './ui';
import { actionIcon, type ActionIcon } from './action-icons';
import { renderDocument } from './framework-adapter';
import { type DocumentController } from '@alabuga/framework/runtime';
import type { AFDocument } from '@alabuga/framework/schema';
import { sectionDisplayName } from './section-name';
import { gridFrame } from '@alabuga/document-core';
import { controlHints, settingsInfo } from './control-hints';
import { compactEditorQuery } from './editor-commands';
export function createOutline(
  root: HTMLElement,
  select: (index: number) => void,
  action: (action: 'copy' | 'up' | 'down' | 'delete' | 'rename', index: number) => void,
  reorder: (from: number, to: number) => void,
  add?: () => void,
  name?: (id: string) => string | undefined,
) {
  const host = el('div', 'editor-outline');
  host.setAttribute('role', 'complementary');
  host.setAttribute('aria-label', 'Структура документа');
  const header = el('div', 'outline-header'),
    titleRow = el('div', 'outline-heading-row'),
    heading = el('h2'),
    count = el('span', 'outline-count'),
    headerActions = el('div', 'settings-header-actions'),
    body = el('div', 'outline-body');
  body.tabIndex = 0;
  body.id = 'outline-list-' + crypto.randomUUID();
  body.setAttribute('role', 'region');
  titleRow.append(heading, count, headerActions);
  header.append(titleRow);
  host.append(header, body);
  root.append(host);
  const rows = new Map<
    string,
    {
      row: HTMLElement;
      button: HTMLButtonElement;
      inner: HTMLElement;
      visual: HTMLElement;
      signature: string;
      controller?: DocumentController;
      index: number;
    }
  >();
  const lifecycle = new AbortController();
  const hints = controlHints(host, lifecycle.signal);
  const collapsedKey = 'alabuga:outline-collapsed';
  const compact = matchMedia(compactEditorQuery);
  let collapsed = false,
    restoreToggleFocus = false,
    kind: AFDocument['kind'] = 'page';
  try {
    collapsed = localStorage.getItem(collapsedKey) === 'true';
  } catch {}
  const collapse = iconButton(
    'Свернуть секции',
    () => {
      collapsed = !collapsed;
      try {
        localStorage.setItem(collapsedKey, String(collapsed));
      } catch {}
      hints.hide();
      for (const menu of body.querySelectorAll<HTMLDetailsElement>('.outline-menu[open]'))
        menu.open = false;
      syncCollapsed();
      collapse.focus({ preventScroll: true });
      scheduleLayout();
    },
    'chevron',
    'af-btn af-btn--secondary outline-collapse',
  );
  collapse.hidden = true;
  collapse.setAttribute('aria-controls', body.id);
  root.append(collapse);
  const syncCollapsed = () => {
    const active = collapsed && !compact.matches;
    const restoreFocus = active && body.contains(document.activeElement);
    root.classList.toggle('outline-collapsed', active);
    body.hidden = active;
    body.inert = active;
    collapse.setAttribute('aria-expanded', String(!active));
    const label = `${active ? 'Развернуть' : 'Свернуть'} ${kind === 'page' ? 'секции' : 'слайды'}`;
    collapse.setAttribute('aria-label', label);
    collapse.title = label;
    if (restoreFocus) restoreToggleFocus = true;
  };
  compact.addEventListener(
    'change',
    () => {
      const restoreFocus = compact.matches && document.activeElement === collapse;
      syncCollapsed();
      scheduleLayout();
      if (restoreFocus)
        root.querySelector<HTMLElement>('.outline-toggle')?.focus({ preventScroll: true });
    },
    { signal: lifecycle.signal },
  );
  headerActions.append(
    settingsInfo(
      'О структуре документа',
      'Выберите раздел, чтобы перейти к нему. Перетащите карточку для изменения порядка или используйте Alt + стрелку вверх/вниз. Меню «Действия» позволяет переименовать, дублировать или удалить выбранный раздел.',
    ),
  );
  let layoutFrame = 0;
  const layout = () => {
    layoutFrame = 0;
    if (!host.getClientRects().length) {
      hints.hide();
      collapse.hidden = true;
      return;
    }
    host.style.setProperty(
      '--constructor-outline-height',
      Math.max(160, innerHeight - Math.max(12, host.getBoundingClientRect().top) - 12) + 'px',
    );
    const bounds = host.getBoundingClientRect();
    collapse.hidden = compact.matches;
    collapse.style.left = (root.classList.contains('outline-collapsed') ? 24 : bounds.right) + 'px';
    collapse.style.top =
      Math.max(24, Math.min(innerHeight - 24, bounds.top + bounds.height / 2)) + 'px';
    if (restoreToggleFocus && !collapse.hidden) {
      collapse.focus({ preventScroll: true });
      restoreToggleFocus = false;
    }
    for (const item of rows.values()) {
      const sourceWidth = item.inner.offsetWidth,
        sourceHeight = item.inner.scrollHeight;
      if (!sourceWidth || !sourceHeight) continue;
      const scale = Math.min(
        item.visual.clientWidth / sourceWidth,
        item.visual.clientHeight / sourceHeight,
      );
      item.inner.style.transform = `scale(${scale})`;
      item.inner.style.left = (item.visual.clientWidth - sourceWidth * scale) / 2 + 'px';
      item.inner.style.top = (item.visual.clientHeight - sourceHeight * scale) / 2 + 'px';
    }
  };
  const scheduleLayout = () => {
    if (!layoutFrame) layoutFrame = requestAnimationFrame(layout);
  };
  const sizeObserver = new ResizeObserver(scheduleLayout);
  const visibilityObserver = new MutationObserver(scheduleLayout);
  visibilityObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', scheduleLayout, { signal: lifecycle.signal });
  window.addEventListener('scroll', scheduleLayout, {
    signal: lifecycle.signal,
    capture: true,
    passive: true,
  });
  body.addEventListener('load', scheduleLayout, { signal: lifecycle.signal, capture: true });
  void document.fonts.ready.then(() => {
    if (!lifecycle.signal.aborted) scheduleLayout();
  });
  document.addEventListener(
    'pointerdown',
    (event) => {
      for (const { row } of rows.values()) {
        const menu = row.querySelector<HTMLDetailsElement>('.outline-menu');
        if (menu?.open && event.target instanceof Node && !menu.contains(event.target))
          menu.open = false;
      }
    },
    { signal: lifecycle.signal },
  );
  const update = (doc: AFDocument, active: number) => {
    kind = doc.kind;
    syncCollapsed();
    heading.textContent = doc.kind === 'page' ? 'Секции' : 'Слайды';
    count.textContent = String(doc.pages.length);
    count.title = `Всего: ${doc.pages.length}`;
    body.setAttribute('aria-label', doc.kind === 'page' ? 'Список секций' : 'Список слайдов');
    headerActions.querySelector('.outline-add')?.remove();
    headerActions.querySelector('.outline-close')?.remove();
    if (add) {
      const plus = button('+', add, 'af-btn af-btn--secondary af-btn--icon af-btn--sm outline-add');
      plus.setAttribute('aria-label', doc.kind === 'page' ? 'Добавить секцию' : 'Добавить слайд');
      headerActions.append(plus);
    }
    const close = iconButton(
      'Закрыть структуру',
      () => root.classList.remove('outline-open'),
      'close',
      'af-btn af-btn--clear af-btn--lg outline-close',
    );
    headerActions.append(close);
    for (const [id, item] of rows)
      if (!doc.pages.some((p) => p.id === id)) {
        item.controller?.destroy();
        sizeObserver.unobserve(item.visual);
        sizeObserver.unobserve(item.inner);
        item.row.remove();
        rows.delete(id);
      }
    doc.pages.forEach((p, index) => {
      let item = rows.get(p.id);
      const signature = JSON.stringify([doc.kind, doc.title, index, doc.pages.length, p]);
      const title = name?.(p.id) || sectionDisplayName(p, doc.kind, index);
      if (!item) {
        const row = el('div', 'outline-row'),
          b = button('', () => select(rows.get(p.id)!.index), 'outline-select'),
          visual = el('div', 'outline-visual'),
          inner = el('div');
        visual.setAttribute('aria-hidden', 'true');
        visual.inert = true;
        visual.append(inner);
        b.append(visual, el('span'));
        row.append(b);
        const controls = el('div', 'outline-actions');
        for (const [a, label] of [
          ['rename', 'Название'],
          ['copy', 'Копия'],
          ['up', '↑'],
          ['down', '↓'],
          ['delete', '×'],
        ] as const) {
          const control = button(
            label,
            () => action(a, rows.get(p.id)!.index),
            'af-btn af-btn--clear af-btn--sm context-button',
          );
          control.dataset.action = a;
          if (a === 'delete') controls.append(el('hr', 'outline-action-divider'));
          controls.append(control);
        }
        const menu = el('details', 'outline-menu'),
          trigger = el('summary', 'af-btn af-btn--clear af-btn--sm', 'Действия');
        trigger.append(el('span', 'af-icon af-icon--expand'));
        trigger.lastElementChild!.setAttribute('aria-hidden', 'true');
        menu.append(trigger, controls);
        row.append(menu);
        menu.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            menu.open = false;
            trigger.focus();
          } else if (e.target === trigger && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            menu.open = true;
            const buttons = controls.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
            (e.key === 'ArrowDown' ? buttons[0] : buttons[buttons.length - 1])?.focus();
          }
        });
        controls.addEventListener(
          'click',
          (e) => {
            const target = e
              .composedPath()
              .find((node): node is HTMLButtonElement => node instanceof HTMLButtonElement);
            if (target && !target.disabled) menu.open = false;
          },
          { capture: true },
        );
        row.draggable = true;
        row.addEventListener('dragstart', (e) =>
          e.dataTransfer!.setData('text/plain', String(rows.get(p.id)!.index)),
        );
        row.addEventListener('dragover', (e) => e.preventDefault());
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          const from = Number(e.dataTransfer!.getData('text/plain'));
          if (Number.isInteger(from) && from >= 0 && from < rows.size)
            reorder(from, rows.get(p.id)!.index);
        });
        b.addEventListener('keydown', (e) => {
          if (e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            action(e.key === 'ArrowUp' ? 'up' : 'down', rows.get(p.id)!.index);
            rows.get(p.id)?.button.focus({ preventScroll: true });
          }
        });
        item = { row, button: b, inner, visual, signature: '', index };
        rows.set(p.id, item);
        sizeObserver.observe(visual);
        sizeObserver.observe(inner);
      }
      item.index = index;
      item.button.dataset.outlineIndex = String(index);
      item.button.setAttribute('aria-current', String(index === active));
      item.row.classList.toggle('is-current', index === active);
      item.button.setAttribute('aria-label', `${index + 1}. ${title}`);
      item.button.querySelector(':scope > span')!.textContent = `${index + 1}. ${title}`;
      const kind = doc.kind === 'page' ? 'секцию' : 'слайд';
      const labels: Record<string, string> = {
          rename: 'Название в структуре',
          copy: 'Дублировать',
          up: 'Переместить выше',
          down: 'Переместить ниже',
          delete: 'Удалить',
        },
        visible: Record<string, string> = {
          rename: 'Переименовать',
          copy: 'Дублировать',
          up: 'Выше',
          down: 'Ниже',
          delete: 'Удалить',
        },
        icons: Record<string, ActionIcon> = {
          rename: 'rename',
          copy: 'copy',
          up: 'up',
          down: 'down',
          delete: 'delete',
        };
      item.row.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((b) => {
        b.disabled =
          b.dataset.action === 'up'
            ? index === 0
            : b.dataset.action === 'down'
              ? index === doc.pages.length - 1
              : b.dataset.action === 'delete'
                ? doc.pages.length === 1
                : false;
        b.replaceChildren(
          actionIcon(icons[b.dataset.action!]),
          document.createTextNode(visible[b.dataset.action!]),
        );
        b.setAttribute('aria-label', `${labels[b.dataset.action!]}: ${kind} «${title}»`);
      });
      const menu = item.row.querySelector<HTMLDetailsElement>('.outline-menu');
      if (menu) {
        menu.hidden = index !== active;
        menu.querySelector('summary')!.setAttribute('aria-label', `Действия: ${kind} «${title}»`);
      }
      if (signature !== item.signature) {
        item.controller?.destroy();
        const isolated = structuredClone(p);
        const frame = gridFrame(p.grid);
        item.inner.style.width = frame.width + 'px';
        item.visual.style.setProperty('--constructor-thumbnail-height', frame.height + 'px');
        isolated.widgets.forEach((w) => {
          if (w.type === 'button' && 'target' in w.action) w.action = { type: 'link', href: '#' };
        });
        item.controller = renderDocument(
          item.inner,
          { ...doc, pages: [isolated] },
          { editing: true, slideOffset: index, slideCount: doc.pages.length },
        );
        item.signature = signature;
      }
      if (body.children[index] !== item.row)
        body.insertBefore(item.row, body.children[index] ?? null);
    });
    scheduleLayout();
  };
  return Object.assign(update, {
    destroy() {
      lifecycle.abort();
      root.classList.remove('outline-collapsed');
      collapse.remove();
      cancelAnimationFrame(layoutFrame);
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      rows.forEach((r) => r.controller?.destroy());
      rows.clear();
      host.remove();
    },
  });
}
