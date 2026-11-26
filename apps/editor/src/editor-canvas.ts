import { type AFDocument, type Widget, widgetRegistry } from '@alabuga/framework/schema';
import { type DocumentController, renderDocument, frameworkDom as dom } from './framework-adapter';
import { canvasAffordances } from './canvas-affordances';
import { installCanvasCursors } from './canvas-cursors';
import { bindWidgetHandle } from './widget-handles';
import { bindInline, type InlineCommit } from './inline';
import { el, button, iconButton } from './ui';
import { geometryLocked } from './templates';
import { blockControls } from './block-controls';
import type { ResizeDirection } from './block-geometry';
import { gridFrame } from '@alabuga/document-core';

interface CanvasActions {
  document: () => AFDocument;
  selected: () => string;
  flush: () => boolean;
  select: (id: string, index: number) => void;
  change: (edit: (document: AFDocument) => void, message: string) => boolean;
  keyboardChange: (edit: (document: AFDocument) => void, message: string, group: string) => boolean;
  inlineCommit: InlineCommit;
  focusWidget: (id: string, index: number) => void;
  selectWidget: (id: string) => void;
  openCatalog: (mode: 'section' | 'widget', index: number) => void;
  openInspector: (id: string, index: number) => void;
  duplicateWidget: (id: string, index: number) => void;
  removeWidget: (id: string, index: number) => void;
  status: (message: string) => void;
  fit: () => void;
  grid: () => void;
}
interface CanvasElements {
  canvas: HTMLElement;
  toolbar: HTMLElement;
  endAdd: HTMLElement;
}
/** Owns rendering and authoring controls; document mutations stay in the session. */
export class EditorCanvas {
  private controller: DocumentController | undefined;
  private renderedMode: boolean | undefined;
  private renderedSignature = '';
  private readonly boundBoxes = new WeakSet<HTMLElement>();
  private readonly lifetime = new AbortController();
  private preview = false;
  private viewportFrame = 0;
  private fitHintTimer: ReturnType<typeof setTimeout> | undefined;
  private sectionNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly sectionNotice = el('span', 'section-added-notice', 'Секция добавлена');
  private readonly fitHint: HTMLButtonElement;
  private readonly controls: ReturnType<typeof blockControls>;
  private readonly keyboardHandlers = new WeakMap<HTMLElement, (event: KeyboardEvent) => void>();
  private keyboardStroke?: { key: string; group: string; id: string; direction?: ResizeDirection };
  constructor(
    private readonly elements: CanvasElements,
    private readonly actions: CanvasActions,
    signal: AbortSignal,
  ) {
    installCanvasCursors(elements.canvas);
    canvasAffordances(elements.canvas, this.lifetime.signal);
    this.controls = blockControls(elements.canvas, actions.grid, this.lifetime.signal);
    elements.toolbar.querySelector('.editor-more-body')!.append(this.controls.element);
    this.fitHint = button('Текст не помещается — подобрать оформление', actions.fit);
    this.fitHint.hidden = true;
    elements.toolbar.append(this.fitHint);
    this.sectionNotice.hidden = true;
    this.sectionNotice.setAttribute('aria-hidden', 'true');
    elements.toolbar.querySelector('.section-toolbar')!.append(this.sectionNotice);
    for (const type of ['wheel', 'touchmove', 'pointerdown', 'keydown'])
      window.addEventListener(type, () => cancelAnimationFrame(this.viewportFrame), {
        capture: true,
        passive: true,
        signal: this.lifetime.signal,
      });
    signal.addEventListener('abort', () => this.destroy(), { once: true });
    if (signal.aborted) this.destroy();
  }
  render(doc: AFDocument, state: { section: number; selected: string; preview: boolean }) {
    if (this.lifetime.signal.aborted) return;
    const { selected, preview } = state,
      pageIndex = state.section;
    this.preview = preview;
    this.elements.canvas.toggleAttribute(
      'data-standard-grid',
      doc.pages.some((page) => !!page.grid.frame),
    );
    const frame = doc.kind === 'presentation' ? gridFrame(doc.pages[pageIndex].grid) : undefined;
    this.elements.canvas.style.setProperty(
      '--constructor-document-width',
      (frame?.width ?? Math.max(...doc.pages.map((page) => page.grid.frame?.width ?? 1440))) + 'px',
    );
    if (frame)
      this.elements.canvas.style.setProperty('--constructor-document-height', frame.height + 'px');
    else this.elements.canvas.style.removeProperty('--constructor-document-height');
    this.suggestFit();
    this.elements.canvas.inert = false;
    const signature = JSON.stringify(doc);
    if (this.controller && this.renderedMode === preview) {
      if (signature !== this.renderedSignature) this.controller.update(doc);
    } else {
      this.controller?.destroy();
      this.controller = renderDocument(this.elements.canvas, doc, { editing: !preview });
      this.renderedMode = preview;
    }
    this.renderedSignature = signature;
    if (doc.kind === 'presentation') this.controller.goToSlide(pageIndex);
    if (doc.kind === 'page') {
      for (const section of doc.pages) {
        if (!section.grid.frame) continue;
        const shell = this.elements.canvas.querySelector<HTMLElement>(dom.sectionById(section.id));
        for (const widget of section.widgets) {
          const box = shell?.querySelector<HTMLElement>(dom.widgetById(widget.id));
          box?.style.setProperty(
            '--constructor-widget-column',
            `${widget.position.col} / span ${widget.position.width}`,
          );
          box?.style.setProperty(
            '--constructor-widget-row',
            `${widget.position.row} / span ${widget.position.height}`,
          );
        }
      }
    }
    this.elements.endAdd.replaceChildren();
    if (!preview && doc.kind === 'page')
      this.elements.endAdd.append(this.insertion(doc.pages.length));
    if (!preview) {
      this.elements.canvas
        .querySelectorAll('.section-insert,.section-tools,.canvas-empty')
        .forEach((n) => n.remove());
      const shells = this.elements.canvas.querySelectorAll<HTMLElement>(dom.sections);
      shells.forEach((shell) => {
        const index = doc.pages.findIndex((p) => p.id === shell.dataset.sectionId),
          page = doc.pages[index],
          panel = shell.querySelector<HTMLElement>(dom.panel)!;
        shell.toggleAttribute('data-template-geometry', geometryLocked(doc, page.id));
        shell.querySelector(':scope > .canvas-grid-guides')?.remove();
        if (page.grid.frame) {
          const guides = el('div', 'canvas-grid-guides');
          guides.setAttribute('aria-hidden', 'true');
          guides.style.setProperty('--constructor-grid-columns', String(page.grid.columns));
          guides.style.setProperty(
            '--constructor-grid-tablet-columns',
            String(Math.min(page.grid.columns, page.grid.responsive?.tabletColumns ?? 12)),
          );
          guides.style.setProperty(
            '--constructor-grid-mobile-columns',
            String(
              Math.min(
                page.grid.columns,
                page.grid.responsive?.tabletColumns ?? 12,
                page.grid.responsive?.mobileColumns ?? 4,
              ),
            ),
          );
          guides.style.setProperty('--constructor-grid-gap', page.grid.gap + 'px');
          guides.style.setProperty('--constructor-grid-row', page.grid.rowHeight + 'px');
          guides.append(el('div', 'canvas-grid-columns'), el('div', 'canvas-grid-rows'));
          shell.append(guides);
        }
        if (doc.kind === 'page') shell.before(this.insertion(index));
        const tools = el('div', 'section-tools');
        tools.setAttribute('aria-label', 'Действия секции ' + (index + 1));
        tools.append(
          el('span', 'section-number', String(index + 1).padStart(2, '0')),
          this.small('+ Блок', () => this.actions.openCatalog('widget', index)),
          this.small('Настройки секции', () => this.actions.openInspector('', index)),
        );

        for (const box of panel.querySelectorAll<HTMLElement>(dom.widgets)) {
          const w = page.widgets.find((w) => w.id === box.dataset.widgetId)!;
          box.tabIndex = 0;
          box.setAttribute('role', 'group');
          box.setAttribute('aria-label', 'Блок: ' + (w.title || widgetRegistry[w.type].title));
          box.classList.toggle('is-selected', w.id === selected);
          if (this.boundBoxes.has(box)) continue;
          this.boundBoxes.add(box);
          // Renderer owns initial grid placement; do not override its mobile rules.
          const content = box.querySelector<HTMLElement>(dom.content)!;
          content.removeAttribute('tabindex');
          if (content.getAttribute('role') === 'region') content.removeAttribute('role');
          content.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
            if (w.type !== 'button') b.disabled = true;
            b.tabIndex = -1;
          });
          bindInline(box, w, index, this.actions.inlineCommit, () => {
            box.dataset.textEditing = 'true';
            this.actions.focusWidget(w.id, index);
          });
          const bar = el('div', 'widget-tools');
          bar.style.left = w.position.col > page.grid.columns / 2 ? 'auto' : '0';
          bar.style.right = w.position.col > page.grid.columns / 2 ? '0' : 'auto';
          bar.append(
            iconButton(
              'Настройки блока',
              () => this.actions.openInspector(w.id, index),
              'settings',
              'af-btn af-btn--ghost af-btn--sm context-button',
            ),
            iconButton(
              'Копия',
              () => this.actions.duplicateWidget(w.id, index),
              'copy',
              'af-btn af-btn--ghost af-btn--sm context-button',
            ),
            iconButton(
              'Удалить',
              () => this.actions.removeWidget(w.id, index),
              'delete',
              'af-btn af-btn--ghost af-btn--sm context-button',
            ),
          );
          box.append(bar);
          if (w.type === 'image') {
            const change = this.small('Заменить изображение', () =>
              this.actions.openInspector(w.id, index),
            );
            change.classList.add('image-change');
            box.append(change);
          }
          box.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('button,[contenteditable]')) return;
            e.preventDefault();
            this.actions.selectWidget(w.id);
          });
          box.addEventListener('keydown', (e) => {
            if (e.target === box && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              this.actions.openInspector(w.id, index);
            }
          });
          {
            const resize = button('', () => {}, 'widget-handle resize-handle boundary-handle');
            resize.dataset.resizeDirection = 'se';
            resize.setAttribute('aria-label', 'Изменить размер блока');
            box.append(resize);
            this.attachHandle(resize, w, true, panel, index);
            this.keyboardHandlers.set(
              box,
              bindWidgetHandle(box, w.id, index, false, {
                canvas: this.elements.canvas,
                signal: this.lifetime.signal,
                document: this.actions.document,
                flush: this.actions.flush,
                select: this.actions.select,
                change: this.actions.change,
                keyboardChange: this.actions.keyboardChange,
                keyboardGroup: (event) => this.keyGroup(event, w.id),
                status: this.actions.status,
                direction: 'se',
                step: this.controls.step,
                surface: true,
              }),
            );
            box.addEventListener('dblclick', (event) => {
              const field = (event.target as HTMLElement).closest<HTMLElement>('[contenteditable]');
              if (!field) return;
              box.dataset.textEditing = 'true';
              field.focus({ preventScroll: true });
            });
            box.addEventListener('focusout', (event) => {
              if (!(event.relatedTarget instanceof Node) || !box.contains(event.relatedTarget))
                delete box.dataset.textEditing;
            });
            box.addEventListener(
              'keydown',
              (event) => {
                if (event.key === 'Escape' && box.dataset.textEditing) {
                  delete box.dataset.textEditing;
                  box.focus({ preventScroll: true });
                }
              },
              { capture: true },
            );
            for (const [direction, label] of [
              ['n', 'Верхний край'],
              ['s', 'Нижний край'],
              ['w', 'Левый край'],
              ['e', 'Правый край'],
              ['nw', 'Верхний левый угол'],
              ['ne', 'Верхний правый угол'],
              ['sw', 'Нижний левый угол'],
            ] as const) {
              const edge = button('', () => {}, 'widget-handle edge-handle boundary-handle');
              edge.dataset.resizeDirection = direction;
              edge.setAttribute(
                'aria-label',
                'Изменить размер блока — ' + label.toLocaleLowerCase(),
              );
              box.append(edge);
              this.attachHandle(edge, w, true, panel, index, direction);
            }
          }
        }
        if (!page.widgets.length) {
          const empty = el('div', 'canvas-empty');
          empty.append(
            el('h2', '', 'Начните с первого блока'),
            el('p', '', 'Добавьте текст, изображение, таблицу или готовую секцию.'),
            button('+ Добавить блок', () => this.actions.openCatalog('widget', index), 'af-btn'),
          );
          panel.append(empty);
        }
      });
    }
  }
  synchronize(doc: AFDocument) {
    if (this.lifetime.signal.aborted) return;
    this.controller?.synchronize(doc);
    this.renderedSignature = JSON.stringify(doc);
    this.suggestFit();
  }
  select(id: string) {
    if (this.lifetime.signal.aborted) return;
    this.elements.canvas
      .querySelectorAll<HTMLElement>(dom.widgets)
      .forEach((box) => box.classList.toggle('is-selected', box.dataset.widgetId === id));
  }
  private keyGroup(event: KeyboardEvent, id: string, direction?: ResizeDirection) {
    const key = `${id}:${direction ?? 'move'}:${event.key}:${event.shiftKey}:${event.altKey}`;
    if (!event.repeat || this.keyboardStroke?.key !== key)
      this.keyboardStroke = { key, id, direction, group: 'nudge-' + crypto.randomUUID() };
    return this.keyboardStroke!.group;
  }
  /** Keep a held arrow working even when renderer layout temporarily drops focus to body. */
  arrow(event: KeyboardEvent) {
    const id = this.actions.selected(),
      box = this.elements.canvas.querySelector<HTMLElement>(dom.widgetById(id));
    if (!box || this.preview) return false;
    const direction =
      event.repeat && this.keyboardStroke?.id === id ? this.keyboardStroke.direction : undefined;
    const target = direction
      ? (box.querySelector<HTMLElement>(`[data-resize-direction="${direction}"]`) ?? box)
      : box;
    this.keyboardHandlers.get(target)?.(event);
    return event.defaultPrevented;
  }
  scrollSection(id: string) {
    if (this.lifetime.signal.aborted) return;
    clearTimeout(this.sectionNoticeTimer);
    this.sectionNotice.hidden = true;
    cancelAnimationFrame(this.viewportFrame);
    this.elements.canvas
      .querySelector<HTMLElement>(dom.sectionById(id))
      ?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  revealInsertedSection(id: string) {
    if (this.lifetime.signal.aborted) return;
    this.sectionNotice.hidden = false;
    clearTimeout(this.sectionNoticeTimer);
    this.sectionNoticeTimer = setTimeout(() => (this.sectionNotice.hidden = true), 3000);
    cancelAnimationFrame(this.viewportFrame);
    this.viewportFrame = requestAnimationFrame(() => {
      const section = this.elements.canvas.querySelector<HTMLElement>(dom.sectionById(id));
      const insertion = section?.previousElementSibling;
      if (!(insertion instanceof HTMLElement) || !insertion.matches('.section-insert')) return;
      const toolbar = this.elements.toolbar;
      insertion.style.scrollMarginBlockStart =
        Math.ceil(toolbar.getBoundingClientRect().bottom + 16) + 'px';
      insertion.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
    });
  }
  revealSection(id: string, widgetId?: string) {
    if (this.lifetime.signal.aborted) return;
    cancelAnimationFrame(this.viewportFrame);
    const doc = this.actions.document(),
      index = doc.pages.findIndex((page) => page.id === id);
    if (index < 0) return;
    if (doc.kind === 'presentation') this.controller?.goToSlide(index);
    const reveal = () => {
      const section = this.elements.canvas.querySelector<HTMLElement>(dom.sectionById(id));
      const target =
        doc.kind === 'page'
          ? (section?.querySelector<HTMLElement>(widgetId ? dom.widgetById(widgetId) : dom.panel) ??
            section)
          : section;
      target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    };
    reveal();
    this.viewportFrame = requestAnimationFrame(() => {
      this.viewportFrame = requestAnimationFrame(reveal);
    });
  }
  private small(title: string, action: () => void) {
    return button(title, action, 'af-btn af-btn--ghost af-btn--sm context-button');
  }
  private insertion(index: number) {
    const bar = el('div', 'section-insert');
    bar.append(
      iconButton(
        'Добавить секцию',
        () => this.actions.openCatalog('section', index),
        'add',
        'af-btn af-btn--secondary af-btn--sm af-btn--round insert-button',
      ),
    );
    return bar;
  }
  private attachHandle(
    handle: HTMLButtonElement,
    widget: Widget,
    resizing: boolean,
    _panel: HTMLElement,
    index: number,
    direction: ResizeDirection = 'se',
  ) {
    this.keyboardHandlers.set(
      handle,
      bindWidgetHandle(handle, widget.id, index, resizing, {
        canvas: this.elements.canvas,
        signal: this.lifetime.signal,
        document: this.actions.document,
        flush: this.actions.flush,
        select: this.actions.select,
        change: this.actions.change,
        keyboardChange: this.actions.keyboardChange,
        keyboardGroup: (event) => this.keyGroup(event, widget.id, direction),
        status: this.actions.status,
        direction,
        step: this.controls.step,
      }),
    );
  }
  preserveViewport(work: () => void, anchorWidget = true) {
    if (this.lifetime.signal.aborted) return;
    cancelAnimationFrame(this.viewportFrame);
    const id = this.actions.selected(),
      box = id ? this.elements.canvas.querySelector<HTMLElement>(dom.widgetById(id)) : null,
      rect = box?.getBoundingClientRect(),
      viewport = this.elements.canvas.parentElement!,
      scroll = {
        x: window.scrollX,
        y: window.scrollY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
    const visible = rect && rect.bottom > 0 && rect.top < innerHeight;
    work();
    if (visible || !anchorWidget) {
      const restore = () => {
        const current = this.elements.canvas.querySelector<HTMLElement>(dom.widgetById(id));
        if (!anchorWidget) {
          window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
          viewport.scrollLeft = scroll.left;
          viewport.scrollTop = scroll.top;
          current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          return;
        }
        if (current)
          window.scrollBy({
            top: current.getBoundingClientRect().top - rect!.top,
            behavior: 'instant',
          });
      };
      restore();
      // Flow widgets are reordered by the Framework ResizeObserver. WebKit can
      // scroll a focused widget while it is reinserted; restore after that layout.
      this.viewportFrame = requestAnimationFrame(() => {
        this.viewportFrame = requestAnimationFrame(restore);
      });
    }
  }

  suggestFit() {
    clearTimeout(this.fitHintTimer);
    this.fitHintTimer = setTimeout(() => {
      const slide = this.elements.canvas.querySelector<HTMLElement>(dom.activeSlide),
        panel = slide?.querySelector<HTMLElement>(dom.panel);
      this.fitHint.hidden =
        this.preview ||
        !slide ||
        !(
          (panel && panel.offsetTop + panel.offsetHeight > slide.clientHeight - 48) ||
          [...slide.querySelectorAll<HTMLElement>(dom.overflow)].some(
            (n) => n.scrollWidth > n.clientWidth + 2 || n.scrollHeight > n.clientHeight + 2,
          )
        );
    }, 350);
  }

  destroy() {
    if (this.lifetime.signal.aborted) return;
    this.lifetime.abort();
    cancelAnimationFrame(this.viewportFrame);
    clearTimeout(this.fitHintTimer);
    clearTimeout(this.sectionNoticeTimer);
    this.controller?.destroy();
    this.controller = undefined;
    this.fitHint.remove();
    this.sectionNotice.remove();
    this.elements.endAdd.replaceChildren();
  }
}
