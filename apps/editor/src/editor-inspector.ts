import type { AFDocument } from '@alabuga/framework/schema';
import { frameworkDom as dom } from './framework-adapter';
import { properties } from './properties';
import { sectionDesign } from './design';
import { widgetLayout } from './widget-layout';
import { headingFieldValue, selectField } from './ui-fields';
import { inspectorLayout } from './inspector-layout';
import { responsiveDrawer } from './responsive-drawer';
import { disposeControls } from './component-lifecycle';
import { el, button, invocationTarget } from './ui';
import { saveCompositionDialog } from './composition-library';
import { restoreUnplaced, placeUnplacedWidget } from './sections';
import { widgetRegistry } from '@alabuga/framework/schema';
import { sectionDisplayName } from './section-name';
import { templateInfo } from './template-metadata';
import {
  applyStandardGrid,
  gridFrameFields,
  gridScopeControl,
  standardGridButton,
} from './grid-settings';
import { applyInheritedGrid } from './document-grid';
import { controlHints, settingsInfo } from './control-hints';
import { inspectorHelp } from './settings-help';

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
}
/** Owns inspector drafts, panel focus and controls without owning the document. */
export class EditorInspector {
  private readonly lifetime = new AbortController();
  private readonly access: ReturnType<typeof responsiveDrawer>;
  private flushDraft = () => true;
  private draftState: InspectorDraftState = 'valid';
  private trigger: HTMLElement | undefined;
  private refreshFrame = 0;
  private readonly sectionExtras = el('div', 'settings-group-body section-extra-settings');
  private readonly sectionAdvanced = el('details', 'advanced-grid section-property-group');
  private gridDraft: AFDocument['pages'][number]['grid'] | undefined;
  private readonly gridExtras = el('div', 'af-stack');
  private readonly gridFeedback = el('p', 'af-help');
  constructor(
    private readonly root: HTMLElement,
    private readonly drawer: HTMLElement,
    private readonly host: HTMLElement,
    private readonly canvas: HTMLElement,
    private readonly actions: InspectorActions,
    signal: AbortSignal,
  ) {
    const headerActions = el('div', 'settings-header-actions');
    const close = this.get('close-inspector');
    close.before(headerActions);
    headerActions.append(
      settingsInfo(
        'О настройках',
        'Изменения сохраняются автоматически в этом браузере. Для сетки используйте «Применить сетку». Действия можно отменить. Для переноса проекта скачайте копию JSON.',
      ),
      close,
    );
    const hints = controlHints(this.drawer, this.lifetime.signal);
    const visibility = new MutationObserver(() => {
      if (this.drawer.hidden) hints.hide();
    });
    visibility.observe(this.drawer, { attributes: true, attributeFilter: ['hidden'] });
    this.lifetime.signal.addEventListener('abort', () => visibility.disconnect(), { once: true });
    this.access = responsiveDrawer(root, drawer, () => this.close(), this.lifetime.signal);
    inspectorLayout(drawer, this.lifetime.signal);
    inspectorHelp(drawer, this.lifetime.signal);
    const settings = this.get<HTMLFormElement>('settings');
    settings.dataset.gridDraft = 'true';
    this.gridFeedback.setAttribute('role', 'status');
    this.gridFeedback.setAttribute('aria-live', 'polite');
    const applyGrid = el('button', 'af-btn', 'Применить сетку');
    applyGrid.type = 'submit';
    const advancedTitle = el('summary', 'af-btn af-btn--clear');
    const chevron = el('span', 'af-icon af-icon--expand');
    chevron.setAttribute('aria-hidden', 'true');
    advancedTitle.append(el('span', 'settings-group-title', 'Дополнительные параметры'), chevron);
    this.sectionAdvanced.append(advancedTitle, settings, this.sectionExtras);
    this.get('design-settings').after(this.sectionAdvanced);
    const gridActions = el('div', 'settings-actions');
    settings.append(this.gridExtras);
    gridActions.append(
      applyGrid,
      button('Отменить изменения сетки', () => {
        this.loadGridDraft(this.actions.document().pages[this.actions.context().section], 'page');
        this.gridFeedback.textContent = 'Изменения сетки отменены.';
        this.gridFeedback.classList.remove('af-error');
        this.actions.status('Изменения сетки отменены.');
      }),
      standardGridButton(() => {
        if (!this.flush()) return;
        this.actions.change(
          (d) => applyStandardGrid(d, this.actions.context().section),
          'Стандартная сетка применена. Можно отменить действие.',
        );
      }),
    );
    settings.append(gridActions, this.gridFeedback);
    settings.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        if (settings.reportValidity()) settings.dataset.applied = String(this.updateSettings());
      },
      { signal: this.lifetime.signal },
    );
    this.get('page-title').addEventListener('change', () => this.updateSettings(false), {
      signal: this.lifetime.signal,
    });
    settings.addEventListener(
      'input',
      () => {
        settings.dataset.dirty = 'true';
        this.gridFeedback.classList.remove('af-error');
        this.gridFeedback.textContent = 'Изменения сетки ещё не применены.';
      },
      { signal: this.lifetime.signal },
    );
    settings.addEventListener(
      'invalid',
      (event) => {
        const field = event.target as HTMLInputElement;
        this.gridFeedback.classList.add('af-error');
        this.gridFeedback.textContent =
          (field.closest('label')?.textContent ?? 'Поле') + ': ' + field.validationMessage;
      },
      { capture: true, signal: this.lifetime.signal },
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
    if (!this.flushPendingForms() || !this.flushSectionSettings()) return;
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
  openDocument(trigger: HTMLElement) {
    if (!this.flushPendingForms() || !this.flushSectionSettings()) return;
    this.trigger = trigger;
    this.root.classList.remove('outline-open');
    this.actions.selectDocument();
    this.drawer.hidden = false;
    this.actions.redraw();
    this.get('document-properties-name').focus({ preventScroll: true });
  }
  openGrid(index: number) {
    if (!this.flushPendingForms() || !this.flushSectionSettings()) return;
    this.open('', index);
    this.drawer.querySelector<HTMLButtonElement>('#slide-tab-structure')?.click();
    const grid = this.drawer.querySelector<HTMLDetailsElement>(
      this.actions.document().kind === 'page' ? '.advanced-grid' : '.slide-grid',
    );
    if (grid) {
      grid.open = true;
      grid.scrollIntoView({ block: 'nearest' });
      grid.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    }
  }
  close() {
    if (!this.flushPendingForms() || !this.flushSectionSettings()) return;
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
    this.drawer.dataset.inspectorView = documentMode ? 'document' : selected ? 'block' : 'section';
    this.drawer.toggleAttribute(
      'data-compact-settings',
      !documentMode && (Boolean(selected) || doc.kind === 'page'),
    );
    this.sectionAdvanced.hidden =
      Boolean(selected) || documentMode || preview || doc.kind !== 'page';
    this.get('inspector-title').textContent = selected
      ? 'Настройки блока'
      : doc.kind === 'presentation'
        ? 'Настройки слайда'
        : 'Настройки секции';
    if (!keepProperties && syncGrid) {
      this.loadGridDraft(active, doc.kind);
      this.gridFeedback.textContent = '';
      this.gridFeedback.classList.remove('af-error');
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
          signal: this.lifetime.signal,
          warning: (message) => this.actions.status(message, true),
          notice: (message) => this.actions.status(message),
          gridScope: (edit, local) =>
            this.actions.change(edit, 'Настройка наследования сетки применена.', local),
          saveComposition: () => {
            if (!this.flushPendingForms() || !this.flushSectionSettings()) return;
            const current = this.actions.document();
            const source = current.pages.find(({ id }) => id === active.id);
            if (source) saveCompositionDialog(source, current.kind, this.lifetime.signal);
          },
          unplaced: (host) => this.drawUnplaced(host, doc, active.id),
          sectionExtras: this.sectionExtras,
        },
      );
    if (keepProperties) return;
    this.draftState = 'valid';
    this.actions.stateChanged();
    this.flushDraft = () => true;
    const w = active.widgets.find((w) => w.id === selected);
    (this.drawer.querySelector('.page-settings') as HTMLElement).hidden =
      !!w || preview || doc.kind === 'presentation';
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
      this.host.replaceChildren();
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
        `${doc.kind === 'presentation' ? 'Презентация 16:9' : 'Адаптивный сайт'} · ${doc.pages.length} ${doc.kind === 'presentation' ? 'слайдов' : 'секций'}`,
      ),
      el(
        'p',
        'af-help',
        'Проект и материалы сохраняются в этом браузере. Для резервной копии скачайте переносимый файл.',
      ),
    );
    this.drawUnplaced(this.host, doc, doc.pages[this.actions.context().section].id);
  }

  private drawUnplaced(host: HTMLElement, doc: AFDocument, after: string) {
    const list = templateInfo(doc)?.unplaced;
    if (!list?.length) return;
    const group = el('fieldset', 'block-editor');
    group.append(el('legend', '', 'Неразмещённые блоки'));
    for (const section of list) {
      const count = section.widgets.length;
      group.append(
        el('p', 'af-help', `${section.title} · блоков: ${count}`),
        button(
          doc.kind === 'page' ? 'Разместить в новой секции' : 'Разместить на новом слайде',
          () =>
            this.actions.change(
              (current) => restoreUnplaced(current, section.id, after),
              'Блоки размещены.',
            ),
          'af-btn af-btn--secondary af-btn--sm',
        ),
      );
      for (const widget of section.widgets) {
        const row = el('fieldset', 'block-editor');
        row.dataset.unplacedWidget = widget.id;
        row.append(el('legend', '', widget.title || widgetRegistry[widget.type].title));
        const destination = selectField(
          row,
          'Разместить в разделе',
          after,
          Object.fromEntries(
            doc.pages.map((page, index) => [page.id, sectionDisplayName(page, doc.kind, index)]),
          ),
          () => {},
        );
        row.append(
          button(
            'Разместить блок',
            () => {
              if (!this.flushPendingForms() || !this.flushSectionSettings()) return;
              this.actions.change(
                (current) => placeUnplacedWidget(current, section.id, widget.id, destination.value),
                'Блок размещён. Можно отменить действие.',
              );
            },
            'af-btn af-btn--secondary af-btn--sm',
          ),
        );
        group.append(row);
      }
    }
    host.append(group);
  }

  private loadGridDraft(active: AFDocument['pages'][number], kind: AFDocument['kind']) {
    this.get<HTMLInputElement>('columns').value = String(active.grid.columns);
    this.get<HTMLInputElement>('row-height').value = String(active.grid.rowHeight);
    this.get<HTMLInputElement>('gap').value = String(active.grid.gap);
    this.gridDraft = structuredClone(active.grid);
    this.gridExtras.replaceChildren();
    if (kind === 'page')
      gridScopeControl(
        this.gridExtras,
        this.actions.document(),
        this.actions.context().section,
        (edit, local) =>
          this.actions.change(edit, 'Настройка наследования сетки применена.', local),
      );
    gridFrameFields(this.gridExtras, this.gridDraft, kind);
    this.get<HTMLFormElement>('settings').dataset.dirty = 'false';
  }

  private updateSettings(includeGrid = true) {
    const pageIndex = this.actions.context().section;
    const title = this.get<HTMLInputElement>('page-title').value,
      previousTitle = this.actions.document().pages[pageIndex].title,
      columns = Number(this.get<HTMLInputElement>('columns').value),
      rowHeight = Number(this.get<HTMLInputElement>('row-height').value),
      gap = Number(this.get<HTMLInputElement>('gap').value);
    const applied = this.actions.change(
      (d) => {
        if (title !== headingFieldValue(previousTitle)) d.pages[pageIndex].title = title;
        if (includeGrid)
          applyInheritedGrid(d, pageIndex, {
            ...structuredClone(this.gridDraft ?? d.pages[pageIndex].grid),
            columns,
            rowHeight,
            gap,
          });
      },
      'Настройки секции сохранены.',
      true,
    );
    if (applied) {
      const current = this.actions.document();
      this.syncSectionTitle(current.pages[pageIndex]);
      if (includeGrid) {
        this.loadGridDraft(current.pages[pageIndex], current.kind);
        this.gridFeedback.classList.remove('af-error');
        this.gridFeedback.textContent =
          'Сетка применена. Положение и размеры блоков пересчитаны. Можно отменить действие.';
      }
    } else if (includeGrid) {
      this.gridFeedback.classList.add('af-error');
      this.gridFeedback.textContent = this.actions.errorMessage();
    }
    return applied;
  }

  flushPendingForms() {
    if (!this.flush()) return false;
    for (const form of this.drawer.querySelectorAll<HTMLFormElement>(
      'form[data-grid-draft][data-dirty=true]',
    )) {
      if (form.id === 'settings' && this.actions.document().kind !== 'page') continue;
      const grid = form.closest<HTMLDetailsElement>('.slide-grid,.advanced-grid');
      if (form.closest('.slide-grid'))
        this.drawer.querySelector<HTMLButtonElement>('#slide-tab-structure')?.click();
      if (grid) grid.open = true;
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
        Number(this.get<HTMLInputElement>('gap').value) !== p.grid.gap ||
        JSON.stringify(this.gridDraft?.frame) !== JSON.stringify(p.grid.frame) ||
        JSON.stringify(this.gridDraft?.responsive) !== JSON.stringify(p.grid.responsive)
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
