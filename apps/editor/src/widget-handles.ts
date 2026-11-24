import { type AFDocument, type Widget } from '@alabuga/framework/schema';
import { frameworkDocument } from './template-metadata';
import { holdBlockCursor } from './canvas-cursors';
import { resizePosition, type ResizeDirection } from './block-geometry';
import { gridRows, gridFrame, positionBounds } from '@alabuga/document-core';
import { validateDocument, widgetRegistry } from '@alabuga/framework/schema';
import {
  manipulateRect,
  positionFromRect,
  trackLines,
  type SnapPreferences,
  type Rect,
} from './snap-geometry';
import {
  widgetLayout,
  layoutNote,
  orderedWidgets,
  reorderWidget,
  responsiveSize,
  setResponsiveSize,
  responsiveKey,
} from './widget-layout';
type Options = {
  surface?: boolean;
  direction: ResizeDirection;
  step: () => SnapPreferences;
  canvas: HTMLElement;
  signal: AbortSignal;
  document: () => AFDocument;
  flush: () => boolean;
  select: (id: string, index: number) => void;
  change: (edit: (doc: AFDocument) => void, message: string) => boolean;
  keyboardChange?: (edit: (doc: AFDocument) => void, message: string, group: string) => boolean;
  keyboardGroup?: (event: KeyboardEvent) => string;
  status: (message: string) => void;
};
/** Grid handles edit geometry; responsive handles edit the layout actually shown. */
export function bindWidgetHandle(
  handle: HTMLElement,
  id: string,
  index: number,
  resizing: boolean,
  options: Options,
) {
  let lastTextClick: { field: HTMLElement; time: number } | undefined;
  const boxNow = () =>
    options.canvas.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(id)}"]`)!;
  const current = () => options.document().pages[index].widgets.find((widget) => widget.id === id)!;
  const locked = () =>
    !!boxNow().closest('[data-template-geometry]') &&
    !!boxNow().closest('[data-editor-mode="standard"]');
  const focus = (deferred = true) => {
    if (options.signal.aborted) return;
    // Framework layout can reinsert the focused node after the synchronous render.
    // Restore only an otherwise lost focus, without taking it from a text field or dialog.
    if (deferred)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (
            document.activeElement === document.body &&
            boxNow()?.classList.contains('is-selected')
          )
            focus(false);
        }),
      );
    if (options.surface) {
      boxNow()?.focus({ preventScroll: true });
      return;
    }
    boxNow()
      ?.querySelector<HTMLElement>(
        handle.dataset.resizeDirection
          ? '[data-resize-direction="' + options.direction + '"]'
          : resizing
            ? '.resize-handle'
            : '.move-handle',
      )
      ?.focus({ preventScroll: true });
  };
  let keyboardGroup: string | undefined;
  const change = (edit: (doc: AFDocument) => void, message: string) =>
    keyboardGroup && options.keyboardChange
      ? options.keyboardChange(edit, message, keyboardGroup)
      : options.change(edit, message);
  const update = (position: Widget['position'], resized = resizing) =>
    change(
      (doc) => {
        doc.pages[index].widgets.find((widget) => widget.id === id)!.position = position;
      },
      resized ? 'Размер блока изменён.' : 'Блок перемещён.',
    );
  const order = (mode: ReturnType<typeof widgetLayout>, target: number) =>
    change((doc) => reorderWidget(doc.pages[index], mode, id, target), 'Порядок блоков изменён.');
  const resizeResponsive = (
    mode: ReturnType<typeof widgetLayout>,
    size: ReturnType<typeof responsiveSize>,
  ) =>
    change(
      (doc) =>
        setResponsiveSize(
          doc.pages[index].widgets.find((widget) => widget.id === id)!,
          mode,
          size,
        ),
      'Адаптивный размер блока изменён.',
    );
  const keydown = (event: KeyboardEvent, direct = false) => {
    if (options.signal.aborted || event.defaultPrevented) return;
    if (options.surface && !direct && event.target !== handle) return;
    if (event.ctrlKey || event.metaKey || event.isComposing) return;
    const keyboardResize = resizing || (options.surface && event.altKey),
      multiplier = event.shiftKey ? 10 : 1;
    const delta = (
      { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<
        string,
        number[]
      >
    )[event.key];
    if (!delta) return;
    event.preventDefault();
    if (locked()) {
      options.status('Чтобы перемещать блоки шаблона, включите расширенный режим редактора.');
      return;
    }
    if (!options.flush()) return;
    options.select(id, index);
    keyboardGroup = options.keyboardGroup?.(event);
    const mode = widgetLayout(boxNow());
    if (mode !== 'grid' && handle.classList.contains('edge-handle')) return;
    if (mode === 'auto') {
      options.status(layoutNote(mode));
      return;
    }
    if (mode !== 'grid') {
      if (keyboardResize) {
        const size = responsiveSize(current(), mode, options.document().pages[index].grid.columns);
        size.width = Math.max(1, Math.min(100, size.width + delta[0] * (5 * multiplier)));
        if (delta[1])
          size.minHeight = Math.max(
            0,
            Math.min(3200, (size.minHeight || boxNow().offsetHeight) + delta[1] * 16 * multiplier),
          );
        resizeResponsive(mode, size);
      } else {
        const widgets = orderedWidgets(options.document().pages[index], mode);
        order(
          mode,
          widgets.findIndex((widget) => widget.id === id) + (delta[1] || delta[0]) * multiplier,
        );
      }
    } else {
      const doc = options.document(),
        page = doc.pages[index],
        step = options.step();
      if (step.mode !== 'strict' || current().position.free) {
        const box = boxNow(),
          panel = box.parentElement!,
          bounds = panel.getBoundingClientRect(),
          rect = box.getBoundingClientRect(),
          scale = bounds.width / panel.offsetWidth;
        const initial = current().position.free
          ? positionBounds(page.grid, current().position, panel.clientWidth)
          : {
              x: (rect.left - bounds.left) / scale,
              y: (rect.top - bounds.top) / scale,
              width: rect.width / scale,
              height: rect.height / scale,
            };
        const f = gridFrame(page.grid),
          sx = (panel.clientWidth + page.grid.gap) / page.grid.columns,
          sy = page.grid.rowHeight + page.grid.gap,
          strict = step.mode === 'strict';
        const result = manipulateRect(
          initial,
          delta[0] * (strict ? sx * step.x : 1) * multiplier,
          delta[1] * (strict ? sy * step.y : 1) * multiplier,
          keyboardResize ? options.direction : 'move',
          {
            x: -f.left,
            y: -f.top,
            width: panel.clientWidth + f.left + f.right,
            height:
              doc.kind === 'presentation' ? f.height : 1000 * (page.grid.rowHeight + page.grid.gap),
          },
          { width: 16, height: 16 },
          strict
            ? {
                x: trackLines(
                  Array.from({ length: page.grid.columns + 1 }, (_, i) => i * sx),
                  page.grid.gap,
                  step.x,
                ),
                y: trackLines(
                  Array.from({ length: 1002 }, (_, i) => i * sy),
                  page.grid.gap,
                  step.y,
                ).filter((line) => doc.kind !== 'presentation' || line <= f.contentHeight),
              }
            : { x: [], y: [] },
          strict ? 'strict' : 'off',
          0,
          delta[0] ? 'x' : 'y',
        );
        update(positionFromRect(result.rect, page.grid, panel.clientWidth), keyboardResize);
        focus();
        return;
      }
      const x = delta[0] * step.x * multiplier,
        y = delta[1] * step.y * multiplier;
      let position = { ...current().position };
      if (keyboardResize) {
        const maxRow = doc.kind === 'presentation' ? gridRows(page.grid) : 1000;
        position = resizePosition(
          position,
          current().type,
          page.grid,
          options.direction,
          x,
          y,
          maxRow,
        );
      } else {
        position.col = Math.max(
          1,
          Math.min(page.grid.columns - position.width + 1, position.col + x),
        );
        const rows = doc.kind === 'presentation' ? gridRows(page.grid) : 1000;
        position.row = Math.max(1, Math.min(rows - position.height + 1, position.row + y));
      }
      update(position, keyboardResize);
    }
    focus();
  };
  handle.addEventListener('keydown', keydown);
  handle.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      keyboardGroup = undefined;
      const target = event.target as HTMLElement;
      const editing = target.closest<HTMLElement>('[contenteditable]');
      if (options.surface) {
        const box = boxNow();
        if (!box.classList.contains('is-selected')) {
          if (target.closest('button,input,select,textarea')) return;
          event.preventDefault();
          if (!options.flush()) return;
          options.select(id, index);
          box.focus({ preventScroll: true });
          lastTextClick = editing ? { field: editing, time: performance.now() } : undefined;
          return;
        }
        if (
          target.closest('.widget-handle,button,input,select,textarea') ||
          (editing && box.dataset.textEditing === 'true')
        )
          return;
        if (locked()) return;
        if (
          editing &&
          lastTextClick?.field === editing &&
          performance.now() - lastTextClick.time < 500
        ) {
          box.dataset.textEditing = 'true';
          editing.focus({ preventScroll: true });
          lastTextClick = undefined;
          return;
        }
      }
      if (handle.classList.contains('edge-handle') && widgetLayout(boxNow()) === 'auto') return;
      event.preventDefault();
      event.stopPropagation();
      const cursor = getComputedStyle(handle).cursor;
      // Firefox can cancel a pointer whose pressed target is removed by flush.
      // Capture on the stable canvas before a pending property edit redraws it.
      options.canvas.setPointerCapture(event.pointerId);
      if (!options.flush()) {
        options.canvas.releasePointerCapture(event.pointerId);
        return;
      }
      options.select(id, index);
      // A pending property edit can replace the original handle during flush.
      const box = boxNow(),
        panel = box.parentElement!,
        mode = widgetLayout(box);
      if (mode === 'auto') {
        options.canvas.releasePointerCapture(event.pointerId);
        options.status(layoutNote(mode));
        return;
      }
      const doc = options.document(),
        page = doc.pages[index],
        initial = { ...current().position },
        g = page.grid,
        bounds = panel.getBoundingClientRect(),
        scale = bounds.width / panel.offsetWidth,
        start = { x: event.clientX, y: event.clientY },
        rect = box.getBoundingClientRect(),
        snap = options.step(),
        direction = options.direction;
      const stepX = (panel.clientWidth + g.gap) / g.columns,
        stepY = g.rowHeight + g.gap;
      const tracks = getComputedStyle(panel)
          .gridTemplateRows.split(' ')
          .map(parseFloat)
          .filter(Number.isFinite),
        starts = [0];
      tracks.forEach((height) => starts.push(starts.at(-1)! + height + g.gap));
      if (g.frame) starts.splice(0, starts.length, 0);
      while (starts.length <= 1001) starts.push(starts.at(-1)! + stepY);
      const lines = {
        x: trackLines(
          Array.from({ length: g.columns + 1 }, (_, i) => i * stepX),
          g.gap,
          snap.mode === 'strict' ? snap.x : 1,
        ),
        y: trackLines(starts, g.gap, snap.mode === 'strict' ? snap.y : 1).filter(
          (line) => doc.kind !== 'presentation' || line <= gridFrame(g).contentHeight,
        ),
      };
      const initialRect: Rect = initial.free
          ? positionBounds(g, initial, panel.clientWidth)
          : {
              x: (rect.left - bounds.left) / scale,
              y: (rect.top - bounds.top) / scale,
              width: rect.width / scale,
              height: rect.height / scale,
            },
        frame = gridFrame(g);
      const canvasBounds = {
        x: -frame.left,
        y: -frame.top,
        width: panel.clientWidth + frame.left + frame.right,
        height: doc.kind === 'presentation' ? frame.height : 1000 * stepY,
      };
      const min = widgetRegistry[current().type],
        minimum =
          snap.mode === 'strict'
            ? {
                width: Math.min(initialRect.width, min.minWidth * stepX - g.gap),
                height: Math.min(initialRect.height, min.minHeight * stepY - g.gap),
              }
            : { width: 16, height: 16 };
      const ordered = orderedWidgets(page, mode),
        initialOrder = ordered.findIndex((widget) => widget.id === id);
      let targetOrder = initialOrder,
        position = { ...initial },
        moved = false,
        gestureStarted = false;
      const initialSize = responsiveSize(
          current(),
          mode,
          options.document().pages[index].grid.columns,
        ),
        size = { ...initialSize },
        device = responsiveKey(mode);
      const properties = [
        'grid-column',
        'grid-row',
        '--af-precise-x',
        '--af-precise-y',
        '--af-precise-width',
        '--af-precise-height',
        `--af-${device}-width`,
        `--af-${device}-height`,
      ];
      const original = properties.map((name) => ({
        name,
        value: box.style.getPropertyValue(name),
        priority: box.style.getPropertyPriority(name),
      }));
      const wasPrecise = box.hasAttribute('data-free-position'),
        wasPrecisePanel = panel.classList.contains('af-precise-panel'),
        panelMinHeight = panel.style.minHeight;
      const guides = document.createElement('div');
      guides.className = 'canvas-snap-guides';
      guides.setAttribute('aria-hidden', 'true');
      panel.append(guides);
      panel.classList.add('af-precise-panel');
      if (doc.kind === 'page') panel.style.minHeight = panel.clientHeight + 'px';
      const siblings = Array.from(panel.children).filter(
          (node): node is HTMLElement => node instanceof HTMLElement && node.matches('.af-widget'),
        ),
        orders = siblings.map((node) => ({ node, value: node.style.order }));
      const abort = new AbortController();
      const releaseCursor = holdBlockCursor(cursor);
      const onExit = () => finish(false);
      options.signal.addEventListener('abort', onExit, { once: true });
      const finish = (save: boolean) => {
        if (abort.signal.aborted) return;
        abort.abort();
        releaseCursor();
        options.signal.removeEventListener('abort', onExit);
        panel.classList.remove('is-positioning');
        guides.remove();
        panel.classList.toggle('af-precise-panel', wasPrecisePanel);
        panel.style.minHeight = panelMinHeight;
        box.toggleAttribute('data-free-position', wasPrecise);
        box.classList.remove('invalid-position');
        for (const { name, value, priority } of original)
          if (value) box.style.setProperty(name, value, priority);
          else box.style.removeProperty(name);
        for (const { node, value } of orders) node.style.order = value;
        if (options.canvas.hasPointerCapture(event.pointerId))
          options.canvas.releasePointerCapture(event.pointerId);
        if (save && moved) {
          if (mode !== 'grid') {
            if (resizing) resizeResponsive(mode, size);
            else order(mode, targetOrder);
          } else update(position);
        }
        if (options.surface && save && !gestureStarted && editing?.isConnected) {
          lastTextClick = { field: editing, time: performance.now() };
          focus();
        } else {
          lastTextClick = undefined;
          focus();
        }
      };
      if (box.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      // Capture on the stable canvas: responsive reordering reinserts widget nodes.
      panel.classList.toggle('is-positioning', mode === 'grid');
      options.canvas.setPointerCapture(event.pointerId);
      options.canvas.addEventListener(
        'pointermove',
        (move) => {
          const dx = move.clientX - start.x,
            dy = move.clientY - start.y;
          if (!gestureStarted) {
            if (Math.hypot(dx, dy) < 4) return;
            gestureStarted = true;
          }
          if (mode !== 'grid') {
            if (resizing) {
              const horizontal = direction.includes('e') ? dx : 0;
              const vertical = direction.includes('s') ? dy : 0;
              size.width = Math.max(
                1,
                Math.min(
                  100,
                  initialSize.width +
                    Math.round((horizontal / (bounds.width + g.gap * scale)) * 100),
                ),
              );
              size.minHeight =
                Math.abs(vertical) > 2
                  ? Math.max(
                      0,
                      Math.min(
                        3200,
                        Math.round(
                          (initialSize.minHeight || rect.height / scale) + vertical / scale,
                        ),
                      ),
                    )
                  : initialSize.minHeight;
              box.style.setProperty(`--af-${device}-width`, String(size.width));
              box.style.setProperty(`--af-${device}-height`, size.minHeight + 'px');
            } else {
              const delta =
                Math.round(dy / Math.max(48, rect.height / 2)) ||
                Math.round(dx / Math.max(48, bounds.width / 2));
              targetOrder = Math.max(0, Math.min(ordered.length - 1, initialOrder + delta));
              const preview = [...ordered];
              const [widget] = preview.splice(initialOrder, 1);
              preview.splice(targetOrder, 0, widget);
              preview.forEach(
                (widget, i) =>
                  (siblings.find((node) => node.dataset.widgetId === widget.id)!.style.order =
                    String(i)),
              );
            }
            moved = resizing
              ? JSON.stringify(size) !== JSON.stringify(initialSize)
              : targetOrder !== initialOrder;
            return;
          }
          const result = manipulateRect(
            initialRect,
            dx / scale,
            dy / scale,
            resizing ? direction : 'move',
            canvasBounds,
            minimum,
            lines,
            snap.mode,
            6 / scale,
            !resizing && move.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : undefined,
          );
          position = positionFromRect(
            result.rect,
            g,
            panel.clientWidth,
            snap.mode !== 'strict' ||
              !!initial.free ||
              (doc.kind === 'page' &&
                tracks.some((height) => Math.abs(height - g.rowHeight) > 0.1)),
          );
          moved = JSON.stringify(position) !== JSON.stringify(initial);
          box.setAttribute('data-free-position', '');
          for (const [key, value] of Object.entries({
            x: position.col - 1,
            y: position.row - 1,
            width: position.width,
            height: position.height,
          }))
            box.style.setProperty('--af-precise-' + key, String(value));
          guides.replaceChildren();
          for (const axis of ['x', 'y'] as const)
            if (result.guides[axis] !== undefined) {
              const line = document.createElement('div');
              line.className = 'canvas-snap-line';
              line.dataset.axis = axis;
              line.style.setProperty(axis === 'x' ? 'left' : 'top', result.guides[axis] + 'px');
              guides.append(line);
            }
          if (doc.kind === 'page')
            panel.style.minHeight =
              Math.max(bounds.height / scale, result.rect.y + result.rect.height) + 'px';
          const candidate = options.document();
          candidate.pages[index].widgets.find((widget) => widget.id === id)!.position = position;
          box.classList.toggle(
            'invalid-position',
            !validateDocument(frameworkDocument(candidate)).success,
          );
        },
        { signal: abort.signal },
      );
      options.canvas.addEventListener('pointerup', () => finish(true), { signal: abort.signal });
      options.canvas.addEventListener('pointercancel', () => finish(false), {
        signal: abort.signal,
      });
      options.canvas.addEventListener('lostpointercapture', () => finish(false), {
        signal: abort.signal,
      });
      window.addEventListener(
        'keydown',
        (key) => {
          if (key.key === 'Escape') {
            key.preventDefault();
            key.stopImmediatePropagation();
            finish(false);
          }
        },
        { capture: true, signal: abort.signal },
      );
    },
    { capture: options.surface, signal: options.signal },
  );
  return (event: KeyboardEvent) => keydown(event, true);
}
