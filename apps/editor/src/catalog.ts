import { widgetRegistry, type AFDocument, type Widget } from '@alabuga/framework/schema';
import { chooseAsset } from './assets';
import { compositionPreview } from './composition-preview';
import { transferCompositionsDialog } from './composition-library';
import { createWidget } from './model';
import { listSavedCompositions } from './storage/compositions';
import {
  customTemplate,
  instantiateSection,
  sectionTemplates,
  setSectionTemplate,
  stylePresets,
  templateCategories,
  type SectionTemplate,
} from './templates';
import { button, el, showDialog } from './ui';

type CatalogMode = 'section' | 'widget';
type CatalogActions = {
  document: () => AFDocument;
  change: (edit: (document: AFDocument) => void, status: string) => boolean;
  inserted: (index: number, widgetId: string) => void;
  error: (text: string) => void;
};
const symbols: Record<Widget['type'], string> = {
  text: 'T',
  image: '▧',
  metric: '24',
  calendar: '▦',
  table: '☷',
  button: '↗',
  quote: '❞',
  cards: '▥',
  gallery: '▧',
};

export function editorCatalog(
  dialog: HTMLDialogElement,
  actions: CatalogActions,
  signal: AbortSignal,
) {
  const get = <T extends HTMLElement = HTMLElement>(id: string) =>
    dialog.querySelector<T>('#' + id)!;
  const description = get('catalog-description'),
    theme = get<HTMLSelectElement>('catalog-theme'),
    search = get<HTMLInputElement>('catalog-search'),
    category = get<HTMLSelectElement>('catalog-category'),
    templates = get('templates'),
    palette = get('palette'),
    components = (Object.keys(widgetRegistry) as Widget['type'][]).map((type) => {
      const entry = button('', () => addWidget(type), 'palette-button'),
        icon = el('span', 'palette-icon', symbols[type]);
      entry.dataset.add = type;
      icon.setAttribute('aria-hidden', 'true');
      entry.append(icon, el('strong', '', widgetRegistry[type].title));
      return entry;
    });
  const previews: ReturnType<typeof compositionPreview>[] = [];
  let saved: SectionTemplate[] = [],
    request = 0,
    mode: CatalogMode = 'widget',
    insertAt = 0,
    widgetIndex = 0;

  for (const preset of stylePresets) theme.add(new Option(preset.title, preset.id));
  category.add(new Option('Все категории', ''));
  for (const [id, title] of Object.entries(templateCategories)) category.add(new Option(title, id));
  palette.append(...components);
  const transfer = button(
    'Перенос моих композиций',
    () => {
      transferCompositionsDialog(signal, loadSaved);
    },
    'af-btn af-btn--ghost af-btn--sm',
  );
  get('catalog-description').after(transfer);

  const fail = (error: unknown) => {
    const message = (error as Error).message;
    description.textContent = message;
    actions.error(message);
  };
  function addWidget(type: Widget['type'], src?: string) {
    try {
      const widget = createWidget(type, actions.document(), widgetIndex);
      if (widget.type === 'image' && src) widget.src = src;
      if (!actions.change((doc) => doc.pages[widgetIndex].widgets.push(widget), 'Блок добавлен.'))
        return false;
      if (dialog.open) dialog.close();
      actions.inserted(widgetIndex, widget.id);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }
  function addTemplate(template: SectionTemplate) {
    const section = instantiateSection(template, theme.value);
    if (
      !actions.change((doc) => {
        doc.pages.splice(insertAt, 0, section);
        setSectionTemplate(doc, section.id, template);
      }, 'Композиция добавлена.')
    )
      return;
    dialog.close();
    actions.inserted(insertAt, '');
  }
  function clearPreviews() {
    previews.splice(0).forEach((preview) => preview.destroy());
    templates.replaceChildren();
  }
  function draw() {
    clearPreviews();
    const query = search.value.trim().toLocaleLowerCase('ru');
    const matches = (value: string) => value.toLocaleLowerCase('ru').includes(query);
    if (mode === 'widget') {
      for (const component of components) component.hidden = !matches(component.textContent ?? '');
      get('catalog-empty').hidden = components.some((component) => !component.hidden);
      return;
    }
    const { kind } = actions.document();
    const visible = [
      ...sectionTemplates(kind),
      ...saved.filter((entry) => entry.kind === kind),
    ].filter(
      (entry) =>
        (!category.value || entry.category === category.value) &&
        matches(
          [
            entry.title,
            entry.description,
            ...entry.composition.slots.flatMap(({ fields }) => fields),
          ].join(' '),
        ),
    );
    for (const entry of visible) {
      const card = button('', () => addTemplate(entry), 'template-card'),
        visual = el('div', 'composition-thumbnail'),
        section = instantiateSection(entry, theme.value);
      card.dataset.template = entry.key;
      // A miniature is a standalone preview. Its actual actions belong to the inserted section.
      section.widgets.forEach((widget) => {
        if (widget.type === 'button') widget.action = { type: 'link', href: '#' };
      });
      previews.push(
        compositionPreview(visual, {
          schemaVersion: 5,
          kind,
          title: entry.title,
          pages: [section],
        }),
      );
      card.append(visual, el('strong', '', entry.title), el('span', '', entry.description));
      templates.append(card);
    }
    get('catalog-empty').hidden = !!visible.length;
  }
  function tab(next: CatalogMode) {
    mode = next;
    const sections = mode === 'section';
    const presentation = actions.document().kind === 'presentation';
    get('catalog-title').textContent = sections
      ? presentation
        ? 'Добавить слайд'
        : 'Добавить секцию'
      : 'Добавить блок';
    description.textContent = sections
      ? 'Выберите шаблон и замените содержимое своим.'
      : 'Выберите блок для текущего раздела.';
    for (const [id, selected] of [
      ['catalog-sections', sections],
      ['catalog-components', !sections],
    ] as const) {
      get(id).setAttribute('aria-pressed', String(selected));
    }
    get('catalog-theme-field').hidden = !sections;
    get('catalog-category-field').hidden = !sections;
    templates.hidden = !sections;
    palette.hidden = sections;
    transfer.hidden = !sections;
    draw();
  }
  get('catalog-sections').addEventListener('click', () => tab('section'), { signal });
  get('catalog-components').addEventListener('click', () => tab('widget'), { signal });
  get('catalog-materials').addEventListener(
    'click',
    () => {
      dialog.close();
      void chooseAsset((src) => {
        if (signal.aborted || !addWidget('image', src))
          throw new Error('Не удалось добавить изображение в текущий раздел.');
      }, signal);
    },
    { signal },
  );
  theme.addEventListener('change', draw, { signal });
  category.addEventListener('change', draw, { signal });
  search.addEventListener('input', draw, { signal });
  dialog.addEventListener(
    'close',
    () => {
      // The close event can arrive after a quick reopen.
      if (dialog.open) return;
      request++;
      clearPreviews();
    },
    { signal },
  );
  signal.addEventListener(
    'abort',
    () => {
      clearPreviews();
      if (dialog.open) dialog.close();
    },
    { once: true },
  );

  return (next: CatalogMode, index: number, active: number) => {
    insertAt = next === 'section' ? index : active + 1;
    widgetIndex = next === 'widget' ? index : active;
    category.value = '';
    search.value = '';
    tab(next);
    showDialog(dialog);
    void loadSaved();
  };
  async function loadSaved() {
    const current = ++request;
    await listSavedCompositions()
      .then((entries) => {
        if (current !== request || !dialog.open || signal.aborted) return;
        saved = entries.map(customTemplate);
        if (mode === 'section' && saved.some((entry) => entry.kind === actions.document().kind))
          draw();
      })
      .catch((error) => {
        if (current === request && dialog.open && !signal.aborted) fail(error);
      });
  }
}
