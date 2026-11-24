import { showDialog, el, button, invocationTarget } from './ui';
import { editorCatalog } from './catalog';
import { editorMarkup } from './editor-shell';
import { editorCommands, labelEditorCommands } from './editor-commands';
import { EditorCanvas } from './editor-canvas';
import { EditorInspector } from './editor-inspector';
import { compactToolbar } from './toolbar';
import { loadSectionNames, renameSection } from './section-labels';
import { storageDialog } from './storage-dialog';
import { mountControls, disposeControls } from './component-lifecycle';
import { frameworkDom as dom } from './framework-adapter';
import { EditorSession } from './editor-session';
import { showSaveConflict } from './save-conflict';
import { createZoomControls, bindEditorShortcuts } from './editor-controls';
import { downloadEditorHTML } from './editor-export';
import { tutorial, tutorialState } from './tutorial';
import { openSlideFit } from './slide-fit';
import { captureFocus } from './focus';
import { responsiveDrawer } from './responsive-drawer';
import { readProjectFile } from './project-file';
import { readViewState, writeViewState, type ViewState } from './view-state';
import { frameworkDocument, templateInfo } from './template-metadata';
const openAI: typeof import('./ai/panel').openAI = (...args) =>
  import('./ai/panel').then((m) => m.openAI(...args));
import { insertDraft } from '@alabuga/ai/commands';
import { draftDocument } from '@alabuga/ai/contracts';
import { qualityDialog } from './quality';
import { type AFDocument, type Widget } from '@alabuga/framework';
import { findSpace, uid } from './model';
import { sectionDisplayName } from './section-name';
import { download, projectFilename } from './export';
import type { InlineCommit } from './inline';
import { createDocumentFromTemplate } from './templates';
import { duplicateSection } from './sections';
import {
  saveProject,
  saveRevision,
  hydrate,
  portableProject,
  getProject,
  projectVersion,
  ProjectConflictError,
  subscribeProjectChanges,
} from './storage';
import { projectDialog } from './projects';
import { createOutline } from './outline';
import { needsStandardPresentationGrid, preserveGridSettings } from './document-grid';

const backupTipKey = 'alabuga:backup-tip-shown';
let backupTipShown = false;

export async function mountEditor(
  root: HTMLElement,
  projectId: string,
  initial: AFDocument,
  navigate: (route: string) => void,
  changed: (id: string) => void,
  initialVersion = projectVersion(projectId),
  beforeMount: () => void = () => {},
  returnView?: ViewState,
) {
  const upgradedGrid = needsStandardPresentationGrid(initial);
  if (upgradedGrid) await saveRevision(projectId, preserveGridSettings(initial));
  const learning = await tutorialState(projectId);
  let sectionNames = await loadSectionNames(projectId);
  const initialMessage = upgradedGrid
    ? 'Сетка презентации обновлена. Исходная версия доступна в истории.'
    : '';
  function fitCurrent(all: boolean) {
    if (!flush()) return;
    openSlideFit(
      () => ({ id: session.projectId, document: session.document }),
      pageIndex,
      (doc) =>
        commit((d) => {
          d.pages = doc.pages;
        }),
      all,
    );
  }
  const session = new EditorSession(
    { id: projectId, document: initial, version: initialVersion },
    {
      write: (id, doc, expectedVersion) => saveProject(id, doc, undefined, { expectedVersion }),
      read: async (id) => {
        const project = await getProject(id);
        return {
          id,
          document: project.deletedAt ? project.document : await hydrate(project.document),
          version: project.version ?? 0,
          deletedAt: project.deletedAt,
        };
      },
      revision: saveRevision,
      version: projectVersion,
      changed,
      revisionError: (error) => message(String(error), true),
      state: (state, error) => {
        lastSaveStatus =
          state === 'saving'
            ? 'Сохраняем…'
            : state === 'saved'
              ? 'Сохранено в браузере'
              : 'Не сохранено — скачайте проект';
        root.classList.toggle('save-failed', state === 'failed');
        paintSaveState();
        if (state === 'saved') showFirstBackupTip();
        if (error) message(String(error), true);
        if (error instanceof ProjectConflictError) showConflict();
      },
    },
  );
  let pageIndex = Math.min(returnView?.section ?? learning?.section ?? 0, initial.pages.length - 1),
    selected = '',
    preview = false,
    documentMode = false;

  // Keep the outgoing surface intact through all asynchronous preparation.
  beforeMount();
  root.className = '';
  root.innerHTML = editorMarkup;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const canvas = get('canvas'),
    inspector = get('properties'),
    drawer = get('inspector'),
    catalog = get<HTMLDialogElement>('catalog');
  const canvasView = new EditorCanvas(
    {
      canvas,
      toolbar: root.querySelector<HTMLElement>('.canvas-toolbar')!,
      endAdd: get('end-add'),
    },
    {
      document: () => session.document,
      selected: () => selected,
      flush: () => flush(),
      select: (id, index) => {
        selected = id;
        pageIndex = index;
      },
      change: commit,
      inlineCommit: (edit, group) => inlineCommit(edit, group),
      focusWidget,
      selectWidget,
      openCatalog,
      openInspector,
      duplicateWidget,
      removeWidget,
      status: (text) => message(text),
      fit: () => fitCurrent(false),
      grid: () => inspectorView.openGrid(pageIndex),
    },
    session.signal,
  );
  const inspectorView = new EditorInspector(
    root,
    drawer,
    inspector,
    canvas,
    {
      context: () => ({ selected, section: pageIndex, documentMode, preview }),
      document: () => session.document,
      change: commit,
      select: (id, index) => {
        selected = id;
        pageIndex = index;
        documentMode = false;
      },
      selectDocument: () => {
        documentMode = true;
        selected = '';
      },
      redraw: () => draw(),
      preserveViewport: (work) => canvasView.preserveViewport(work),
      fit: fitCurrent,
      openInspector,
      openCatalog,
      preview: openPreview,
      removeWidget: () => removeWidget(),
      duplicateWidget: () => duplicateWidget(),
      status: (text, error) => message(text, error),
      errorMessage: () => get('status').textContent ?? '',
      isSaved: () => lastSaveStatus === 'Сохранено в браузере',
      stateChanged: () => paintSaveState(),
      projects: () => void session.queue.then(() => navigate('/projects')),
      history: () =>
        void session.queue.then(() =>
          projectDialog(session.projectId, session.document, switchProject, true),
        ),
      download: () => get('save').click(),
    },
    session.signal,
  );
  const flush = () => inspectorView.flushPendingForms() && inspectorView.flushSectionSettings();
  function flushDocumentChanges() {
    if (!inspectorView.flushPendingForms()) return false;
    const title = get<HTMLInputElement>('project-name').value;
    if (title !== session.document.title && !commit((d) => (d.title = title.trim()))) return false;
    return inspectorView.flushSectionSettings();
  }
  const message = (text: string, error = false) => {
    if (session.signal.aborted) return;
    get('status').textContent = text;
    get('status').classList.toggle('status-error', error);
  };
  let lastSaveStatus = 'Сохранено в браузере';
  get('save-state').textContent = lastSaveStatus;
  const paintSaveState = () => {
    get('save-state').textContent =
      inspectorView.state === 'invalid'
        ? 'Изменения не применены — проверьте настройки'
        : inspectorView.state === 'pending'
          ? 'Проверяем изменения…'
          : lastSaveStatus;
  };
  function showFirstBackupTip() {
    if (session.signal.aborted || backupTipShown) return;
    backupTipShown = true;
    try {
      if (localStorage.getItem(backupTipKey)) return;
      localStorage.setItem(backupTipKey, '1');
    } catch {
      // The in-memory flag still limits the hint to one visit.
    }
    get('backup-tip').hidden = false;
  }
  get('dismiss-backup-tip').addEventListener(
    'click',
    () => {
      get('backup-tip').hidden = true;
      get('save-state').focus({ preventScroll: true });
    },
    { signal: session.signal },
  );
  const saveLocal = () => session.save();
  get('save-state').setAttribute('role', 'status');
  get('save-state').setAttribute('aria-live', 'polite');
  get('save-state').setAttribute('aria-atomic', 'true');
  subscribeProjectChanges((change) => {
    if (session.isExternalChange(change))
      message(
        change.deleted
          ? 'Проект перемещён в корзину в другой вкладке. Сохраните свою копию.'
          : 'Проект изменён в другой вкладке. При сохранении мы предложим выбрать версию.',
        true,
      );
  }, session.signal);
  function showConflict() {
    showSaveConflict({
      signal: session.signal,
      settled: () => session.queue,
      saveCopy: async () => {
        await session.saveCopy();
        draw();
        message('Ваша копия сохранена. Исходный проект не изменён.');
      },
      reloadSaved: async () => {
        await session.reloadSaved();
        draw();
        message('Открыта сохранённая версия.');
      },
    });
  }

  function historyButtons() {
    get<HTMLButtonElement>('undo').disabled = !session.canUndo;
    get<HTMLButtonElement>('redo').disabled = !session.canRedo;
  }
  function commit(
    edit: (d: AFDocument) => void,
    success = 'Изменения применены.',
    keepProperties = false,
  ) {
    if (session.signal.aborted) return false;
    const restoreFocus = captureFocus(drawer);
    try {
      session.change(edit);
      canvasView.preserveViewport(() => {
        draw(keepProperties);
        if (!keepProperties) restoreFocus();
      });
      message(
        success.replace('Сохранено.', 'Изменения применены.').replace('сохранены.', 'применены.'),
      );
      return true;
    } catch (e) {
      message((e as Error).message, true);
      return false;
    }
  }
  const inlineCommit: InlineCommit = (edit, group) => {
    if (session.signal.aborted) return false;
    try {
      session.change(edit, group);
      canvasView.synchronize(session.document);
      historyButtons();
      inspectorView.refresh();
      return true;
    } catch (error) {
      message((error as Error).message, true);
      return false;
    }
  };
  function focusWidget(id: string, index: number) {
    const changed = selected !== id || pageIndex !== index || documentMode;
    selected = id;
    pageIndex = index;
    documentMode = false;
    get<HTMLSelectElement>('pages').value = String(index);
    canvasView.select(id);
    if (changed && !drawer.hidden) {
      const doc = session.document;
      inspectorView.render(doc, doc.pages[index]);
      drawer.querySelector('.inspector-body')!.scrollTop = 0;
    }
  }
  function selectWidget(id: string) {
    if (!flush()) return;
    documentMode = false;
    const index = session.document.pages.findIndex((p) => p.widgets.some((w) => w.id === id));
    if (index < 0) return;
    selected = id;
    pageIndex = index;
    canvasView.preserveViewport(() => draw());
  }
  function openInspector(id = '', index = pageIndex) {
    inspectorView.open(id, index);
  }
  function closeInspector() {
    inspectorView.close();
  }
  const showCatalog = editorCatalog(
    catalog,
    {
      document: () => session.document,
      change: commit,
      inserted: (index, widgetId) => {
        pageIndex = index;
        selected = widgetId;
        documentMode = false;
        draw();
        scrollSection();
      },
      error: (text) => message(text, true),
    },
    session.signal,
  );
  function openCatalog(mode: 'section' | 'widget', index: number) {
    if (inspectorView.flushPendingForms() && inspectorView.flushSectionSettings())
      showCatalog(mode, index, pageIndex);
  }
  function scrollSection(index = pageIndex) {
    const id = session.document.pages[index]?.id;
    if (id) canvasView.scrollSection(id);
  }
  function openPreview() {
    if (!flush()) return;
    writeViewState(session.projectId, {
      section: pageIndex,
      device: get<HTMLSelectElement>('device').value as ViewState['device'],
      scroll: window.scrollY,
    });
    navigate('/view/' + session.projectId);
  }
  function duplicateWidget(id = selected, index = pageIndex) {
    if (!flush()) return;
    try {
      const d = session.document,
        copy = structuredClone(d.pages[index].widgets.find((w) => w.id === id)!);
      copy.id = uid();
      copy.position = findSpace(d, index, copy.position.width, copy.position.height);
      selected = copy.id;
      pageIndex = index;
      commit((doc) => doc.pages[index].widgets.push(copy), 'Блок скопирован.');
    } catch (e) {
      message((e as Error).message, true);
    }
  }
  function removeWidget(id = selected, index = pageIndex) {
    selected = '';
    inspectorView.discard();
    commit((d) => {
      d.pages[index].widgets = d.pages[index].widgets.filter((w) => w.id !== id);
    }, 'Блок удалён. Можно отменить действие.');
  }
  function sectionAction(action: 'copy' | 'delete' | 'up' | 'down' | 'rename', index: number) {
    if (!flush()) return;
    if (action === 'rename') {
      const doc = session.document;
      renameSection(
        session.projectId,
        doc.pages[index].id,
        sectionDisplayName(doc.pages[index], doc.kind, index),
        sectionNames,
        () => draw(),
      );
      return;
    }
    const d = session.document;
    if (action === 'delete' && d.pages.length === 1) return;
    let next = index;
    if (action === 'copy') {
      duplicateSection(d, index);
      next = index + 1;
    } else if (action === 'delete') {
      d.pages.splice(index, 1);
      next = Math.min(index, d.pages.length - 1);
    } else {
      next = index + (action === 'up' ? -1 : 1);
      if (next < 0 || next >= d.pages.length) return;
      [d.pages[index], d.pages[next]] = [d.pages[next], d.pages[index]];
    }
    try {
      session.replace(d);
      pageIndex = next;
      selected = '';
      draw();
      scrollSection();
      message('Структура обновлена.');
    } catch (e) {
      message((e as Error).message, true);
    }
  }
  const commands = editorCommands(root, session.signal, (text) => message(text, true));
  const run = commands.bind;
  function draw(keepProperties = false) {
    const doc = session.document;
    pageIndex = Math.max(0, Math.min(pageIndex, doc.pages.length - 1));
    const active = doc.pages[pageIndex];
    if (!active.widgets.some((w) => w.id === selected)) selected = '';
    root.classList.toggle('is-preview', preview);
    root.classList.toggle('has-inspector', !drawer.hidden && !preview);
    drawOutline(doc);
    get<HTMLInputElement>('project-name').value = doc.title;
    historyButtons();
    labelEditorCommands(root, doc.kind);
    const picker = get<HTMLSelectElement>('pages');
    picker.replaceChildren();
    doc.pages.forEach((p, i) => {
      const option = el(
        'option',
        '',
        i + 1 + '. ' + (sectionNames[p.id] || sectionDisplayName(p, doc.kind, i)),
      );
      option.value = String(i);
      picker.append(option);
    });
    picker.value = String(pageIndex);
    get('page-kind').textContent = doc.kind === 'page' ? 'Секция' : 'Слайд';
    get('slide-actions').hidden = doc.kind !== 'presentation';
    if (preview) drawer.hidden = true;
    canvasView.render(doc, { section: pageIndex, selected, preview });
    inspectorView.render(doc, active, keepProperties, true);
    inspectorView.sync();
    zoomControls.sync();
  }

  run('undo', () => {
    inspectorView.discard();
    if (session.undo()) {
      draw();
      message('Действие отменено.');
    }
  });
  run('redo', () => {
    inspectorView.discard();
    if (session.redo()) {
      draw();
      message('Действие повторено.');
    }
  });
  run('add-widget', () => openCatalog('widget', pageIndex));
  run('page-settings-open', () =>
    openInspector(matchMedia('(max-width:767px)').matches ? selected : ''),
  );
  run('close-inspector', closeInspector);
  run('close-catalog', () => catalog.close());
  for (const [id, kind] of [
    ['new-page', 'page'],
    ['new-deck', 'presentation'],
  ] as const)
    run(id, async () => {
      if (!flush()) return;
      await startProject(createDocumentFromTemplate(kind, `document/${kind}/blank`));
      pageIndex = 0;
      selected = '';
      preview = false;
      drawer.hidden = true;
      (root.querySelector('.project-menu') as HTMLDetailsElement).open = false;
      saveLocal();
      draw();
      message('Новый документ. Добавьте блок или секцию.');
    });
  get<HTMLInputElement>('project-name').addEventListener('change', (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (!flush() || !commit((d) => (d.title = value.trim())))
      get<HTMLInputElement>('project-name').value = session.document.title;
  });
  get<HTMLSelectElement>('pages').addEventListener('change', (e) => {
    const next = Number((e.target as HTMLSelectElement).value);
    if (!flush()) return;
    pageIndex = next;
    selected = '';
    documentMode = false;
    draw();
    scrollSection();
  });
  run('add-slide', () => openCatalog('section', pageIndex + 1));

  run('preview', openPreview);
  run('save', async () => {
    if (!flushDocumentChanges()) return;
    const control = get<HTMLButtonElement>('save'),
      id = session.projectId,
      snapshot = session.document;
    control.disabled = true;
    try {
      download(
        projectFilename(snapshot.title, 'json'),
        JSON.stringify(await portableProject(snapshot), null, 2),
        'application/json',
      );
      if (!session.signal.aborted && session.projectId === id) {
        get('backup-tip').hidden = true;
        message('Копия проекта скачана.');
      }
    } catch (e) {
      if (session.projectId === id) message('Не удалось подготовить копию: ' + String(e), true);
    } finally {
      control.disabled = false;
    }
  });
  get<HTMLInputElement>('open').addEventListener('change', async (e) => {
    try {
      const parsed = await readProjectFile(e.target as HTMLInputElement);
      if (!parsed || !flush()) return;
      await startProject(parsed);
      pageIndex = 0;
      selected = '';
      preview = false;
      drawer.hidden = true;
      (root.querySelector('.project-menu') as HTMLDetailsElement).open = false;
      saveLocal();
      draw();
      message('Проект открыт.');
    } catch (error) {
      message('Не удалось открыть проект. ' + (error as Error).message, true);
    }
  });
  run('export', async () => {
    if (!flush()) return;
    const control = get<HTMLButtonElement>('export');
    control.disabled = true;
    message('Подготовка HTML…');
    try {
      const document = session.document;
      await downloadEditorHTML(document);
      message(
        templateInfo(document)?.unplaced?.length
          ? 'HTML скачан. Неразмещённые блоки доступны в проекте.'
          : 'HTML скачан. Внешние изображения по HTTP(S) требуют сети.',
      );
    } catch (e) {
      message((e as Error).message, true);
    } finally {
      control.disabled = false;
    }
  });
  bindEditorShortcuts(session.signal, {
    close: () => {
      if (root.classList.contains('outline-open')) {
        closeOutline();
        return true;
      }
      if (drawer.hidden) return false;
      closeInspector();
      return true;
    },
    undo: () => get('undo').click(),
    redo: () => get('redo').click(),
    save: () => {
      if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement))
        document.activeElement.blur();
      get('save').click();
    },
  });
  for (const [id, kind] of [
    ['demo-page', 'page'],
    ['demo-deck', 'presentation'],
  ] as const)
    run(id, async () => {
      if (!flush()) return;
      await startProject(createDocumentFromTemplate(kind, `document/${kind}/showcase`));
      pageIndex = 0;
      selected = '';
      preview = false;
      drawer.hidden = true;
      (root.querySelector('.project-menu') as HTMLDetailsElement).open = false;
      saveLocal();
      draw();
      message('Создан отдельный проект из эталона. Предыдущий доступен в «Мои проекты».');
    });
  let restoringDevice = false;
  get<HTMLSelectElement>('device').addEventListener('change', (e) => {
    if (restoringDevice) return;
    const select = e.target as HTMLSelectElement;
    if (!flush()) {
      restoringDevice = true;
      select.value = canvas.dataset.device ?? 'desktop';
      select.dispatchEvent(new Event('change'));
      restoringDevice = false;
      return;
    }
    canvas.dataset.device = select.value;
    zoomControls.reset();
    zoomControls.sync();
    if (selected && !drawer.hidden) {
      const doc = session.document;
      inspectorView.render(doc, doc.pages[pageIndex]);
    }
  });

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (!drawer.hidden && (e.target as HTMLElement).closest('[contenteditable]') && !flush())
        e.preventDefault();
    },
    { capture: true },
  );
  root.querySelector('.project-menu > div')!.append(
    button(
      'Документ',
      () => {
        inspectorView.openDocument();
      },
      'af-btn af-btn--ghost af-btn--sm document-settings-open',
    ),
  );
  async function startProject(document: AFDocument) {
    lastSaveStatus = 'Сохраняем…';
    paintSaveState();
    root.inert = true;
    message('Сохраняем текущую версию…');
    try {
      await session.startProject(document, 'Не сохранено — скачайте проект');
      sectionNames = {};
    } catch (e) {
      lastSaveStatus = session.saveError ? 'Не сохранено' : 'Сохранено в браузере';
      paintSaveState();
      throw e;
    } finally {
      root.inert = false;
    }
  }
  const updateOutline = createOutline(
    root,
    (index) => {
      if (!flush()) return;
      root.classList.remove('outline-open');
      documentMode = false;
      pageIndex = index;
      selected = '';
      draw();
      scrollSection();
    },
    sectionAction,
    (from, to) => {
      if (!flush()) return;
      commit((d) => {
        const [p] = d.pages.splice(from, 1);
        d.pages.splice(to, 0, p);
      });
      pageIndex = to;
      draw();
    },
    () => openCatalog('section', session.document.pages.length),
    (id) => sectionNames[id],
  );
  function drawOutline(doc: AFDocument) {
    if (!preview) updateOutline(doc, pageIndex);
  }

  const zoomControls = createZoomControls(
    canvas,
    root.querySelector<HTMLElement>('.editor-status')!,
  );
  root.querySelector('.canvas-toolbar')!.append(
    zoomControls.bar,
    button(
      'Проверка качества',
      () =>
        qualityDialog(session.document, canvas, (issue) => {
          openInspector(issue.widget ?? '', issue.section);
          scrollSection(issue.section);
        }),
      'af-btn af-btn--ghost af-btn--sm quality-open',
    ),
  );
  const menu = root.querySelector('.project-menu > div')!;
  menu.append(button('Хранилище и материалы', storageDialog));
  const switchProject = (id: string, doc: AFDocument) => {
    inspectorView.discard();
    session.openProject(id, doc, projectVersion(id));
    sectionNames = {};
    void loadSectionNames(id)
      .then((names) => {
        if (session.projectId === id) {
          sectionNames = names;
          draw();
        }
      })
      .catch((e) => message(String(e), true));
    pageIndex = 0;
    selected = '';
    preview = false;
    saveLocal();
    draw();
  };
  menu.append(
    button('Создать версию', async () => {
      if (!flush()) return;
      await session.queue;
      if (session.saveError) {
        message('Сначала сохраните проект или разрешите конфликт.', true);
        return;
      }
      try {
        await session.checkpoint();
        message('Точка восстановления создана.');
      } catch (e) {
        message(String(e), true);
      }
    }),
  );
  menu.prepend(
    button('Мои проекты', () => {
      if (flush()) void session.queue.then(() => navigate('/projects'));
    }),
    button('История версий', () => {
      if (flush())
        void session.queue.then(() =>
          projectDialog(session.projectId, session.document, switchProject, true),
        );
    }),
  );
  canvas.dataset.device = readViewState(session.projectId)?.device ?? 'desktop';
  get<HTMLSelectElement>('device').value = canvas.dataset.device;
  draw();
  message(initialMessage);
  root.querySelector('.section-toolbar')!.append(
    button(
      'Создать с ИИ',
      async () => {
        if (!flush()) return;
        try {
          await openAI(
            {
              projectId: session.projectId,
              anchorId: session.document.pages[pageIndex].id,
              kind: session.document.kind,
            },
            async (draft) => {
              if (!flush()) throw new Error('Сначала исправьте настройки текущего проекта.');
              if (draft.request.scope === 'section') {
                if (session.projectId !== draft.projectId)
                  throw new Error('Текущий проект изменился. Выберите место вставки заново.');
                await session.queue;
                const document = session.document;
                const next = insertDraft(
                  frameworkDocument(document),
                  draftDocument(draft).pages,
                  draft.anchorId,
                  draft.request.kind,
                );
                await session.applyDocument(
                  document.templateInfo ? { ...next, templateInfo: document.templateInfo } : next,
                );
                pageIndex = next.pages.findIndex((p) => p.id === draft.anchorId) + 1;
                selected = '';
                lastSaveStatus = 'Сохранено в браузере';
                paintSaveState();
                draw();
                scrollSection();
                message('Черновик добавлен. Можно отменить одним действием.');
              } else {
                await session.queue;
                await session.checkpoint();
                const next = draftDocument(draft),
                  id = crypto.randomUUID();
                await saveProject(id, next, draft.id);
                switchProject(id, next);
                message('Создан отдельный проект из черновика ИИ.');
              }
            },
          );
        } catch (e) {
          message(String(e), true);
        }
      },
      'af-btn af-btn--secondary af-btn--sm ai-open',
    ),
  );
  const back = button('← Проекты', () => navigate('/projects'), 'af-btn af-btn--ghost');
  root.querySelector('.editor-brand')!.replaceWith(back);
  const retry = button(
    'Повторить сохранение',
    () => saveLocal(),
    'af-btn af-btn--ghost af-btn--sm',
  );
  retry.classList.add('retry-save');
  get('save-state').after(retry);
  let outlineTrigger: HTMLElement | undefined;
  function closeOutline() {
    root.classList.remove('outline-open');
    outlineAccess.sync();
    outlineTrigger?.focus({ preventScroll: true });
  }
  const outlineAccess = responsiveDrawer(
    root,
    root.querySelector<HTMLElement>('.editor-outline')!,
    closeOutline,
    session.signal,
    () => root.classList.contains('outline-open'),
  );
  root.addEventListener(
    'click',
    (event) => {
      if ((event.target as HTMLElement).closest('.outline-close')) closeOutline();
    },
    { signal: session.signal },
  );
  root.querySelector('.canvas-toolbar')!.prepend(
    button(
      'Структура',
      () => {
        if (!flush()) return;
        outlineTrigger = invocationTarget();
        drawer.hidden = true;
        root.classList.remove('has-inspector');
        inspectorView.sync();
        root.classList.toggle('outline-open');
        outlineAccess.sync();
        if (root.classList.contains('outline-open'))
          root.querySelector<HTMLElement>('.outline-close')?.focus({ preventScroll: true });
      },
      'af-btn af-btn--ghost outline-toggle',
    ),
  );

  get('save-state').classList.add('header-save-state');
  root.querySelector('.document-name')!.after(get('save-state'));
  const openBlockStyle = () => {
    const style = drawer.querySelector<HTMLDetailsElement>(
      '#properties details[data-setting="style"]',
    );
    if (style) style.open = true;
  };
  const showLearning = tutorial(
    root.querySelector('.editor-workspace')!,
    session.projectId,
    learning,
    (step) => {
      if (!flush()) return;
      const doc = session.document;
      const current = doc.pages[pageIndex];
      if (step === 1) {
        openInspector('', pageIndex);
        return;
      }
      if (step === 4) {
        get('preview').click();
        return;
      }
      const desired = step === 2 ? 'image' : 'text';
      const index = current.widgets.some((w) => w.type === desired)
        ? pageIndex
        : doc.pages.findIndex((p) => p.widgets.some((w) => w.type === desired));
      if (index < 0) {
        get('add-widget').click();
        return;
      }
      const w = doc.pages[index].widgets.find((w) => w.type === desired)!;
      openInspector(w.id, index);
      if (step === 3) openBlockStyle();
      scrollSection(index);
      if (step === 0) canvas.querySelector<HTMLElement>(dom.editableWidget(w.id))?.focus();
    },
  );
  menu.append(button('Пять действий для знакомства', showLearning));
  mountControls(root);
  compactToolbar(root, session.signal);
  const returnScroll = returnView?.scroll;
  if (returnScroll)
    void document.fonts.ready.then(() => {
      if (!session.signal.aborted)
        window.scrollTo({ top: returnScroll, left: 0, behavior: 'instant' });
    });
  if (learning?.enabled) {
    scrollSection(pageIndex);
    if (learning.section) {
      openInspector(session.document.pages[pageIndex].widgets[0]?.id ?? '', pageIndex);
      openBlockStyle();
    }
  }
  window.addEventListener(
    'beforeunload',
    (e) => {
      if (session.saveError || lastSaveStatus === 'Сохраняем…' || inspectorView.state !== 'valid') {
        e.preventDefault();
        e.returnValue = '';
      }
    },
    { signal: session.signal },
  );
  if (upgradedGrid) session.save();
  return {
    async beforeLeave() {
      if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement))
        document.activeElement.blur();
      if (!flushDocumentChanges()) return false;
      root.inert = true;
      try {
        await session.queue;
        if (session.saveError) {
          message('Не удалось сохранить. Повторите запись или скачайте проект.', true);
          return false;
        }
        try {
          await session.checkpoint();
        } catch (e) {
          message(String(e), true);
          return false;
        }
        return true;
      } finally {
        root.inert = false;
      }
    },
    destroy() {
      zoomControls.destroy();
      disposeControls(root);
      session.destroy();
      canvasView.destroy();
      inspectorView.destroy();
      updateOutline.destroy();
      document.querySelectorAll<HTMLDialogElement>('dialog').forEach((d) => {
        d.close();
        d.remove();
      });
      root.replaceChildren();
      root.className = '';
    },
  };
}
// void boot().catch(e=>{document.querySelector('#builder')!.textContent='Не удалось запустить редактор: '+String(e)});
