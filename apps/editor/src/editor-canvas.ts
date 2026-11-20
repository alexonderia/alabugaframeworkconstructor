import { type AFDocument, type Widget, widgetRegistry } from '@alabuga/framework/schema';
import { type DocumentController, renderDocument, frameworkDom as dom } from './framework-adapter';
import { canvasAffordances } from './canvas-affordances';
import { bindWidgetHandle } from './widget-handles';
import { bindInline, type InlineCommit } from './inline';
import { el, button, iconButton } from './ui';

interface CanvasActions {
  document: () => AFDocument;
  selected: () => string;
  flush: () => boolean;
  select: (id: string, index: number) => void;
  change: (edit: (document: AFDocument) => void, message: string) => boolean;
  inlineCommit: InlineCommit;
  focusWidget: (id: string, index: number) => void;
  selectWidget: (id: string) => void;
  openCatalog: (mode: 'section' | 'widget', index: number) => void;
  openInspector: (id: string, index: number) => void;
  duplicateWidget: (id: string, index: number) => void;
  removeWidget: (id: string, index: number) => void;
  status: (message: string) => void;
  fit: () => void;
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
  private readonly fitHint: HTMLButtonElement;
  constructor(
    private readonly elements: CanvasElements,
    private readonly actions: CanvasActions,
    signal: AbortSignal,
  ) {
    canvasAffordances(elements.canvas, this.lifetime.signal);
    this.fitHint = button('Текст не помещается — подобрать оформление', actions.fit);
    this.fitHint.hidden = true;
    elements.toolbar.append(this.fitHint);
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
          bindInline(box, w, index, this.actions.inlineCommit, () =>
            this.actions.focusWidget(w.id, index),
          );
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
            const move = button(
                '↕',
                () => {},
                'af-btn af-btn--secondary af-btn--icon widget-handle move-handle',
              ),
              resize = button(
                '↘',
                () => {},
                'af-btn af-btn--secondary af-btn--icon widget-handle resize-handle',
              );
            move.setAttribute('aria-label', 'Переместить блок');
            resize.setAttribute('aria-label', 'Изменить размер блока');
            box.append(move, resize);
            this.attachHandle(move, w, false, panel, index);
            this.attachHandle(resize, w, true, panel, index);
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
  scrollSection(id: string) {
    if (this.lifetime.signal.aborted) return;
    this.elements.canvas
      .querySelector<HTMLElement>(dom.sectionById(id))
      ?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  private small(title: string, action: () => void) {
    return button(title, action, 'af-btn af-btn--ghost af-btn--sm context-button');
  }
  private insertion(index: number) {
    const bar = el('div', 'section-insert');
    bar.append(
      button(
        '+ Добавить секцию',
        () => this.actions.openCatalog('section', index),
        'insert-button',
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
  ) {
    bindWidgetHandle(handle, widget.id, index, resizing, {
      canvas: this.elements.canvas,
      signal: this.lifetime.signal,
      document: this.actions.document,
      flush: this.actions.flush,
      select: this.actions.select,
      change: this.actions.change,
      status: this.actions.status,
    });
  }
  preserveViewport(work: () => void) {
    if (this.lifetime.signal.aborted) return;
    cancelAnimationFrame(this.viewportFrame);
    const id = this.actions.selected(),
      box = id ? this.elements.canvas.querySelector<HTMLElement>(dom.widgetById(id)) : null,
      rect = box?.getBoundingClientRect();
    const visible = rect && rect.bottom > 0 && rect.top < innerHeight;
    work();
    if (visible) {
      const restore = () => {
        const current = this.elements.canvas.querySelector<HTMLElement>(dom.widgetById(id));
        if (current)
          window.scrollBy({
            top: current.getBoundingClientRect().top - rect.top,
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
    this.controller?.destroy();
    this.controller = undefined;
    this.fitHint.remove();
    this.elements.endAdd.replaceChildren();
  }
}
