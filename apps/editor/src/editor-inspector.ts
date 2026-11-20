import type { AFDocument } from '@alabuga/framework/schema';
import { frameworkDom as dom } from './framework-adapter';
import { properties } from './properties';
import { sectionDesign } from './design';
import { widgetLayout } from './widget-layout';
import { headingFieldValue } from './ui-fields';
import { downloadCopyLabel } from './editor-shell';
import { inspectorLayout } from './inspector-layout';
import { responsiveDrawer } from './responsive-drawer';
import { disposeControls } from './component-lifecycle';
import { el, button, invocationTarget } from './ui';

export type InspectorDraftState = 'valid' | 'pending' | 'invalid';
export interface InspectorContext {
  selected: string;
  section: number;
  documentMode: boolean;
  preview: boolean;
}
interface InspectorActions {
  context: () => InspectorContext;
  document: () => AFDocument;
  change: (
    edit: (document: AFDocument) => void,
    message?: string,
    keepProperties?: boolean,
  ) => boolean;
  select: (id: string, index: number) => void;
  selectDocument: () => void;
  redraw: () => void;
  preserveViewport: (work: () => void) => void;
  fit: (all: boolean) => void;
  openInspector: (id: string, index: number) => void;
  openCatalog: (mode: 'section' | 'widget', index: number) => void;
  preview: () => void;
  removeWidget: () => void;
  duplicateWidget: () => void;
  status: (message: string, error?: boolean) => void;
  errorMessage: () => string;
  isSaved: () => boolean;
  stateChanged: () => void;
  projects: () => void;
  history: () => void;
  download: () => void;
}
/** Owns inspector drafts, panel focus and controls without owning the document. */
export class EditorInspector {
  private readonly lifetime = new AbortController();
  private readonly access: ReturnType<typeof responsiveDrawer>;
  private flushDraft = () => true;
  private draftState: InspectorDraftState = 'valid';
  private trigger: HTMLElement | undefined;
  private refreshFrame = 0;
  constructor(
    private readonly root: HTMLElement,
    private readonly drawer: HTMLElement,
    private readonly host: HTMLElement,
    private readonly canvas: HTMLElement,
    private readonly actions: InspectorActions,
    signal: AbortSignal,
  ) {
    this.access = responsiveDrawer(root, drawer, () => this.close(), this.lifetime.signal);
    inspectorLayout(drawer, this.lifetime.signal);
    const settings = this.get<HTMLFormElement>('settings');
    settings.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        this.updateSettings();
      },
      { signal: this.lifetime.signal },
    );
    settings.addEventListener(
      'change',
      () => {
        if (settings.checkValidity()) this.updateSettings();
      },
      { signal: this.lifetime.signal },
    );
    signal.addEventListener('abort', () => this.destroy(), { once: true });
    if (signal.aborted) this.destroy();
  }
  private get<T extends HTMLElement = HTMLElement>(id: string) {
    return this.root.querySelector<T>('#' + id)!;
  }
  get state() {
    return this.draftState;
  }
  flush() {
    return !this.lifetime.signal.aborted && this.flushDraft();
  }
  discard() {
    this.flushDraft = () => true;
  }
  sync() {
    if (this.lifetime.signal.aborted) return;
    this.access.sync();
  }
  private rememberTrigger() {
    const trigger = invocationTarget();
    if (trigger && !this.drawer.contains(trigger)) this.trigger = trigger;
  }
  open(id: string, index: number) {
    if (!this.flush()) return;
    this.rememberTrigger();
    this.root.classList.remove('outline-open');
    this.actions.select(id, index);
    this.actions.preserveViewport(() => {
      this.drawer.hidden = false;
      this.actions.redraw();
    });
    this.drawer.querySelector('.inspector-body')!.scrollTop = 0;
    (id
      ? Array.from(this.drawer.querySelectorAll<HTMLElement>('input,textarea')).find(
          (node) => node.getClientRects().length,
        )
      : (this.drawer.querySelector<HTMLElement>('[role=tab][aria-selected=true]') ??
        Array.from(this.drawer.querySelectorAll<HTMLElement>('input,textarea')).find(
          (node) => node.getClientRects().length,
        ))
    )?.focus({ preventScroll: true });
  }
  openDocument() {
    if (!this.flush()) return;
    this.rememberTrigger();
    this.root.classList.remove('outline-open');
    this.actions.selectDocument();
    this.drawer.hidden = false;
    this.actions.redraw();
    this.get('document-properties-name').focus({ preventScroll: true });
  }
  close() {
    if (!this.flush()) return;
    this.actions.preserveViewport(() => {
      this.drawer.hidden = true;
      this.root.classList.remove('has-inspector');
    });
    this.canvas.inert = false;
    this.sync();
    (this.trigger?.isConnected && this.trigger.getClientRects().length
      ? this.trigger
      : (this.canvas.querySelector<HTMLElement>('.af-widget.is-selected') ??
        this.get('page-settings-open'))
    ).focus({ preventScroll: true });
  }
  refresh() {
    if (this.lifetime.signal.aborted) return;
    cancelAnimationFrame(this.refreshFrame);
    this.refreshFrame = requestAnimationFrame(() => {
      if (
        this.drawer.hidden ||
        this.draftState !== 'valid' ||
        this.drawer.contains(document.activeElement)
      )
        return;
      const body = this.drawer.querySelector<HTMLElement>('.inspector-body')!,
        scroll = body.scrollTop,
        doc = this.actions.document();
      this.render(doc, doc.pages[this.actions.context().section]);
      body.scrollTop = scroll;
    });
  }
  private syncSectionTitle(active: AFDocument['pages'][number]) {
    this.get<HTMLInputElement>('page-title').value = headingFieldValue(active.title);
  }
  render(
    doc: AFDocument,
    active: AFDocument['pages'][number],
    keepProperties = false,
    syncGrid = false,
  ) {
    if (this.lifetime.signal.aborted) return;
    const { selected, section: pageIndex, documentMode, preview } = this.actions.context();
    this.get('inspector-title').textContent = selected
      ? 'Настройки блока'
      : doc.kind === 'presentation'
        ? 'Настройки слайда'
        : 'Настройки секции';
    if (!keepProperties && syncGrid) {
      this.get<HTMLInputElement>('columns').value = String(active.grid.columns);
      this.get<HTMLInputElement>('row-height').value = String(active.grid.rowHeight);
      this.get<HTMLInputElement>('gap').value = String(active.grid.gap);
    }
    if (!keepProperties) this.syncSectionTitle(active);
    if (documentMode && !preview) {
      this.drawDocumentProperties(doc);
      return;
    }
    this.get('design-settings').hidden = !!selected || preview;
    if (!keepProperties && !selected)
      sectionDesign(
        this.get('design-settings'),
        doc,
        pageIndex,
        (edit) => this.actions.change(edit, 'Настройки сохранены.'),
        {
          fit: () => this.actions.fit(false),
          fitAll: () => this.actions.fit(true),
          editWidget: (id) => this.actions.openInspector(id, pageIndex),
          addTemplate: () => this.actions.openCatalog('section', pageIndex + 1),
          preview: this.actions.preview,
        },
      );
    if (keepProperties) return;
    this.draftState = 'valid';
    this.actions.stateChanged();
    this.flushDraft = () => true;
    const w = active.widgets.find((w) => w.id === selected);
    (this.drawer.querySelector('.page-settings') as HTMLElement).hidden =
      !!w || doc.kind === 'presentation';
    if (w && !preview)
      this.flushDraft = properties(this.host, w, {
        document: doc,
        layout: () =>
          widgetLayout(this.canvas.querySelector<HTMLElement>(dom.widgetById(selected))!),
        current: () =>
          this.actions
            .document()
            .pages[this.actions.context().section].widgets.find(
              (widget) => widget.id === this.actions.context().selected,
            )!,
        columns: active.grid.columns,
        apply: (next) =>
          this.actions.change(
            (d) => {
              const i = d.pages[pageIndex].widgets.findIndex((x) => x.id === next.id);
              d.pages[pageIndex].widgets[i] = structuredClone(next);
            },
            'Сохранено.',
            true,
          ),
        remove: () => this.actions.removeWidget(),
        duplicate: () => this.actions.duplicateWidget(),
        error: (t) => this.actions.status(t, true),
        errorMessage: () => this.actions.errorMessage(),
        settled: (valid) => {
          this.draftState = valid ? 'valid' : 'invalid';
          this.actions.stateChanged();
          if (valid)
            this.actions.status(this.actions.isSaved() ? 'Сохранено.' : 'Изменения применены.');
        },
        pending: () => {
          this.draftState = 'pending';
          this.actions.stateChanged();
        },
      });
    else {
      disposeControls(this.host);
      this.host.replaceChildren(
        ...(doc.kind === 'presentation'
          ? []
          : [el('p', 'af-help', 'Сетка действует внутри этой секции. Изменения видны сразу.')]),
      );
    }
  }

  private drawDocumentProperties(doc: AFDocument) {
    this.get('inspector-title').textContent = 'Настройки документа';
    this.get('design-settings').hidden = true;
    (this.drawer.querySelector('.page-settings') as HTMLElement).hidden = true;
    disposeControls(this.host);
    this.host.replaceChildren();
    this.flushDraft = () => true;
    this.draftState = 'valid';
    this.actions.stateChanged();
    const label = el('label', 'af-field'),
      name = el('input', 'af-input');
    name.id = 'document-properties-name';
    name.value = doc.title;
    name.maxLength = 200;
    name.required = true;
    label.append(el('span', 'af-label', 'Название документа'), name);
    name.addEventListener('change', () => {
      if (!this.actions.change((d) => (d.title = name.value.trim())))
        name.value = this.actions.document().title;
    });
    this.host.append(
      label,
      el(
        'p',
        'af-help',
        `${doc.kind === 'presentation' ? 'Презентация 16:9' : 'Адаптивный сайт'} · ${doc.pages.length} ${doc.kind === 'presentation' ? 'слайдов' : 'секций'} · схема 3`,
      ),
      el(
        'p',
        'af-help',
        'Проект и материалы сохраняются в этом браузере. Для резервной копии скачайте переносимый файл.',
      ),
      button('Мои проекты', this.actions.projects),
      button('История версий', this.actions.history),
      button(downloadCopyLabel, this.actions.download),
    );
  }

  private updateSettings() {
    const pageIndex = this.actions.context().section;
    const title = this.get<HTMLInputElement>('page-title').value,
      previousTitle = this.actions.document().pages[pageIndex].title,
      columns = Number(this.get<HTMLInputElement>('columns').value),
      rowHeight = Number(this.get<HTMLInputElement>('row-height').value),
      gap = Number(this.get<HTMLInputElement>('gap').value);
    const applied = this.actions.change(
      (d) => {
        if (title !== headingFieldValue(previousTitle)) d.pages[pageIndex].title = title;
        d.pages[pageIndex].grid = { columns, rowHeight, gap };
      },
      'Настройки секции сохранены.',
      true,
    );
    if (applied) this.syncSectionTitle(this.actions.document().pages[pageIndex]);
    return applied;
  }

  flushPendingForms() {
    if (!this.flush()) return false;
    for (const form of this.drawer.querySelectorAll<HTMLFormElement>(
      'form[data-grid-draft][data-dirty=true]',
    )) {
      if (!form.reportValidity()) return false;
      form.requestSubmit();
      if (form.dataset.applied !== 'true') return false;
    }

    return true;
  }
  flushSectionSettings() {
    if (this.lifetime.signal.aborted) return false;
    const { selected, section: pageIndex, documentMode } = this.actions.context();
    if (
      !this.drawer.hidden &&
      !selected &&
      !documentMode &&
      this.actions.document().kind === 'page'
    ) {
      if (!this.get<HTMLFormElement>('settings').reportValidity()) return false;
      const p = this.actions.document().pages[pageIndex];
      if (
        this.get<HTMLInputElement>('page-title').value !== headingFieldValue(p.title) ||
        Number(this.get<HTMLInputElement>('columns').value) !== p.grid.columns ||
        Number(this.get<HTMLInputElement>('row-height').value) !== p.grid.rowHeight ||
        Number(this.get<HTMLInputElement>('gap').value) !== p.grid.gap
      ) {
        if (!this.updateSettings()) return false;
      }
    }

    return true;
  }
  destroy() {
    if (this.lifetime.signal.aborted) return;
    this.lifetime.abort();
    cancelAnimationFrame(this.refreshFrame);
    disposeControls(this.host);
    this.discard();
  }
}
