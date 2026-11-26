import { el, button, libraryDialog, showDialog } from './ui';
import { actionIcon, type ActionIcon } from './action-icons';
import { mountAssetPicker } from './assets';
import { mountControls } from './component-lifecycle';

/** Navigation owns placement; canonical commands keep their handlers and session lifetime. */
export function editorNavigation(
  root: HTMLElement,
  actions: {
    signal: AbortSignal;
    flush: () => boolean;
    addMaterial: (src: string) => void;
  },
) {
  const { signal } = actions;
  const file = root.querySelector<HTMLDetailsElement>('.project-menu')!;
  const menu = file.querySelector<HTMLElement>('.command-menu')!;
  const header = root.querySelector<HTMLElement>('.editor-header')!;
  header.querySelector('.document-name')!.before(file);
  const row = (node: HTMLElement, icon: ActionIcon) => {
    node.classList.remove('af-btn--secondary', 'af-btn--ghost');
    node.classList.add('af-btn', 'af-btn--clear', 'af-btn--sm', 'command-row');
    node.prepend(actionIcon(icon));
    return node;
  };
  const documentSettings = row(
    menu.querySelector<HTMLElement>('.document-settings-open')!,
    'settings',
  );
  const open = menu.querySelector<HTMLElement>('.file-open')!;
  const input = open.querySelector('input')!;
  open.replaceChildren(el('span', '', 'Открыть JSON…'), input);
  row(open, 'upload');

  const creation = libraryDialog('Создать проект', 'product-dialog new-project-dialog');
  const formats = el('div', 'new-project-formats'),
    examples = el('div', 'new-project-formats');
  for (const id of ['new-page', 'new-deck']) formats.append(menu.querySelector('#' + id)!);
  for (const id of ['demo-page', 'demo-deck']) examples.append(menu.querySelector('#' + id)!);
  creation.body.append(
    el('p', 'af-help', 'Выберите формат нового проекта.'),
    formats,
    el('h3', '', 'Начать с образца'),
    examples,
  );
  root.append(creation.dialog);
  creation.body.addEventListener(
    'click',
    (event) => {
      if (
        (event.target as Element).closest('#new-page,#new-deck,#demo-page,#demo-deck') &&
        actions.flush()
      )
        creation.dialog.close();
    },
    { signal, capture: true },
  );
  const create = row(
    button('Создать проект…', () => {
      if (!actions.flush()) return;
      file.open = false;
      showDialog(creation.dialog, () => file.querySelector('summary'));
    }),
    'add',
  );
  const separator = el('hr', 'command-divider');

  const history = menu.querySelector<HTMLElement>('.history-open')!;
  history.className = 'af-btn af-btn--ghost af-btn--icon history-open';
  history.setAttribute('aria-label', 'История версий');
  history.title = 'История версий';
  history.replaceChildren(actionIcon('pending'));
  root.querySelector('.editor-history')!.append(history);
  const quality = root.querySelector<HTMLElement>('.quality-open')!;
  quality.className = 'af-btn af-btn--ghost af-btn--icon quality-open';
  quality.setAttribute('aria-label', 'Проверка качества');
  quality.title = 'Проверить проект перед экспортом';
  quality.replaceChildren(
    actionIcon('checklist'),
    el('span', 'quality-label', 'Проверка качества'),
  );
  root.querySelector('.editor-file-actions')!.prepend(quality);

  const shortcuts = row(menu.querySelector<HTMLElement>('.help-shortcuts')!, 'info');
  const tutorial = row(menu.querySelector<HTMLElement>('.help-tutorial')!, 'chevron');
  const storage = row(menu.querySelector<HTMLElement>('.storage-open')!, 'settings');
  menu.replaceChildren(create, open, separator, documentSettings);

  const help = el('details', 'editor-help');
  const helpTrigger = el('summary', 'af-btn af-btn--ghost af-btn--icon af-btn--round');
  helpTrigger.setAttribute('aria-label', 'Помощь');
  helpTrigger.title = 'Помощь';
  const helpGlyph = el('span', 'af-btn__icon help-glyph', '?');
  helpGlyph.setAttribute('aria-hidden', 'true');
  helpTrigger.append(helpGlyph);
  const helpMenu = el('div', 'command-menu');
  helpMenu.append(shortcuts, tutorial);
  help.append(helpTrigger, helpMenu);
  root.append(help);

  const outline = root.querySelector<HTMLElement>('.editor-outline')!;
  const sections = outline.querySelector<HTMLElement>('.outline-body')!;
  const tabs = el('div', 'outline-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Панели проекта');
  const sectionsTab = button('Секции', () => activate(false), 'af-btn af-btn--clear af-btn--sm');
  const materialsTab = button('Материалы', () => activate(true), 'af-btn af-btn--clear af-btn--sm');
  const materials = el('div', 'materials-body');
  let picker: ReturnType<typeof mountAssetPicker> | undefined;
  let showingMaterials = false;
  sections.id ||= 'project-sections';
  materials.id = 'project-materials';
  sectionsTab.id = 'project-sections-tab';
  materialsTab.id = 'project-materials-tab';
  for (const [tab, panel] of [
    [sectionsTab, sections],
    [materialsTab, materials],
  ] as const) {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
  }
  tabs.append(sectionsTab, materialsTab);
  outline.querySelector('.outline-header')!.append(tabs);
  const pickerHost = el('div');
  materials.append(storage, pickerHost);
  outline.append(materials);
  function activate(active: boolean) {
    showingMaterials = active;
    sections.hidden = active || root.classList.contains('outline-collapsed');
    sections.inert = sections.hidden;
    materials.hidden = !active;
    sectionsTab.setAttribute('aria-selected', String(!active));
    materialsTab.setAttribute('aria-selected', String(active));
    sectionsTab.tabIndex = active ? -1 : 0;
    materialsTab.tabIndex = active ? 0 : -1;
    outline.classList.toggle('show-materials', active);
    if (active && !picker) {
      picker = mountAssetPicker(
        pickerHost,
        (src) => {
          actions.addMaterial(src);
          activate(false);
          if (outline.getClientRects().length && getComputedStyle(outline).display !== 'none')
            sectionsTab.focus({ preventScroll: true });
        },
        { signal, initialCategory: '', confirmLabel: 'Добавить на холст' },
      );
      mountControls(materials);
    }
  }
  tabs.addEventListener(
    'keydown',
    (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const active = event.key === 'End' || (event.key !== 'Home' && !showingMaterials);
      activate(active);
      (active ? materialsTab : sectionsTab).focus();
    },
    { signal },
  );
  const visibility = new MutationObserver(() => {
    if (showingMaterials && !sections.hidden) {
      sections.hidden = true;
      sections.inert = true;
    }
  });
  visibility.observe(sections, { attributes: true, attributeFilter: ['hidden'] });
  root.addEventListener(
    'materials-changed',
    () => {
      picker?.destroy();
      picker = undefined;
      if (showingMaterials) activate(true);
    },
    { signal },
  );
  const kind = new MutationObserver(() => {
    sectionsTab.textContent = root.dataset.documentKind === 'presentation' ? 'Слайды' : 'Секции';
  });
  kind.observe(root, { attributes: true, attributeFilter: ['data-document-kind'] });
  activate(false);
  const menus = [file, help];
  for (const details of menus) {
    const trigger = details.querySelector<HTMLElement>('summary')!;
    trigger.setAttribute('aria-haspopup', 'true');
    const items = () =>
      [
        ...details.querySelectorAll<HTMLElement>(
          '.command-menu button,.command-menu input[type=file]',
        ),
      ].filter((node) => !node.matches(':disabled') && !!node.getClientRects().length);
    details.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && details.open) {
          event.preventDefault();
          event.stopImmediatePropagation();
          details.open = false;
          trigger.focus();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          details.open = true;
          const controls = items(),
            index = controls.indexOf(document.activeElement as HTMLElement);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? controls.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) %
                  controls.length;
          controls[next]?.focus();
        }
      },
      { signal },
    );
    details.addEventListener(
      'click',
      (event) => {
        if ((event.target as Element).closest('.command-menu button')) details.open = false;
      },
      { signal },
    );
    details.addEventListener(
      'toggle',
      () => {
        trigger.setAttribute('aria-expanded', String(details.open));
        if (details.open) for (const other of menus) if (other !== details) other.open = false;
      },
      { signal },
    );
    details.addEventListener(
      'focusout',
      (event) => {
        if (event.relatedTarget instanceof Node && !details.contains(event.relatedTarget))
          details.open = false;
      },
      { signal },
    );
  }
  document.addEventListener(
    'pointerdown',
    (event) => {
      for (const details of menus)
        if (!details.contains(event.target as Node)) details.open = false;
    },
    { signal },
  );
  signal.addEventListener(
    'abort',
    () => {
      visibility.disconnect();
      kind.disconnect();
      picker?.destroy();
      creation.dialog.close();
      creation.dialog.remove();
      help.remove();
    },
    { once: true },
  );
}
