import { elementDesign } from './element-design';
import { layoutChooser } from './layout-chooser';
import { sectionVariant } from './layout/placement';
import { motionScenarios } from './scenarios';
import { compositionChooser, requestComposition } from './variants';
import { replaceComposition } from './sections';
import { getSectionTemplate, sectionTemplates, stylePresets } from './templates';
import { settingsGroup, el, button } from './ui';
import {
  inputField,
  textareaField,
  checkboxField,
  selectField as select,
  headingFieldValue,
} from './ui-fields';
import {
  widgetRegistry,
  type AFDocument,
  type Widget,
  type Section,
} from '@alabuga/framework/schema';
import { makeComposition } from '@alabuga/framework/compositions';
import { chooseAsset, cropControl } from './assets';
import { readImage } from './export';
import {
  applyStandardGrid,
  gridFrameFields,
  gridScopeControl,
  standardGridButton,
} from './grid-settings';
import { applyInheritedGrid } from './document-grid';
type Change = () => void;
const themes = Object.fromEntries(
  stylePresets.flatMap((preset) => ('theme' in preset ? [[preset.theme, preset.title]] : [])),
);
function input(
  host: HTMLElement,
  label: string,
  value: string,
  update: (v: string) => void,
  multi = false,
) {
  return multi ? textareaField(host, label, value, update) : inputField(host, label, value, update);
}
function upload(
  host: HTMLElement,
  label: string,
  update: (src: string) => void,
  error: (s: string) => void,
) {
  host.append(
    button(
      'Выбрать из библиотеки',
      () => void chooseAsset(update),
      'af-btn af-btn--secondary af-btn--sm',
    ),
  );
  const i = inputField(host, label, '', () => {}, 'file');
  i.accept = 'image/png,image/jpeg,image/webp,image/gif';
  i.addEventListener('change', async () => {
    try {
      if (i.files?.[0]) update(await readImage(i.files[0]));
    } catch (e) {
      error((e as Error).message);
    }
  });
}
export function widgetDesign(
  host: HTMLElement,
  w: Widget,
  doc: AFDocument,
  changed: Change,
  error: (s: string) => void,
  refresh: Change = changed,
) {
  const update = (fn: () => void) => {
    fn();
    changed();
  };
  elementDesign(host, w, doc, changed, refresh);
  select(host, 'Поверхность', w.surface ?? 'card', { plain: 'Без рамки', card: 'Карточка' }, (v) =>
    update(() => (w.surface = v as 'plain' | 'card')),
  );
  for (const [key, title] of [
    ['tabletOrder', 'Порядок на планшете'],
    ['mobileOrder', 'Порядок на телефоне'],
  ] as const) {
    const i = input(host, title, String(w[key] ?? 0), (v) =>
      update(() => (w[key] = Number(v))),
    ) as HTMLInputElement;
    (i.closest('label') as HTMLElement).dataset.propertyGroup = 'geometry';
    i.type = 'number';
    i.min = '0';
    i.max = '100';
  }
  const motionDetails = el('details', 'settings-disclosure');
  motionDetails.dataset.propertyGroup = 'behavior';
  motionDetails.dataset.setting = 'widget-motion';
  motionDetails.append(el('summary', 'af-btn af-btn--clear af-btn--sm', 'Дополнительно: движение'));
  const motionHost = el('div', 'af-stack');
  motionDetails.append(motionHost);
  host.append(motionDetails);
  const motion = w.motion ?? { effect: 'none', speed: 'normal', intensity: 'subtle', step: 0 };
  select(
    motionHost,
    'Эффект',
    motion.effect,
    {
      none: 'Без эффекта',
      fade: 'Появление',
      rise: 'Мягкий сдвиг',
      scale: 'Масштаб',
      sequence: 'Последовательность',
    },
    (v) =>
      update(() => {
        motion.effect = v as typeof motion.effect;
        w.motion = motion;
      }),
  );
  select(
    motionHost,
    'Темп',
    motion.speed,
    { fast: 'Быстрый', normal: 'Обычный', slow: 'Спокойный' },
    (v) =>
      update(() => {
        motion.speed = v as typeof motion.speed;
        w.motion = motion;
      }),
  );
  select(
    motionHost,
    'Интенсивность',
    motion.intensity,
    { subtle: 'Сдержанная', expressive: 'Выразительная' },
    (v) =>
      update(() => {
        motion.intensity = v as typeof motion.intensity;
        w.motion = motion;
      }),
  );
  if (doc.kind === 'presentation') {
    const i = input(motionHost, 'Шаг появления', String(motion.step), (v) =>
      update(() => {
        motion.step = Number(v);
        w.motion = motion;
      }),
    ) as HTMLInputElement;
    i.type = 'number';
    i.min = '0';
    i.max = '20';
    motionHost.append(
      el('p', 'af-help', '0 — сразу; одинаковый номер — показ вместе по команде «Далее».'),
    );
  }
  if (w.type === 'image') {
    host.append(
      button(
        'Выбрать изображение',
        () =>
          void chooseAsset((src) => {
            w.src = src;
            refresh();
          }),
        'af-btn af-btn--secondary',
      ),
    );
    (host.lastElementChild as HTMLElement).dataset.propertyGroup = 'content';
    const crops = el('div');
    host.append(crops);
    const points = {
      center: { x: 50, y: 50 },
      top: { x: 50, y: 0 },
      bottom: { x: 50, y: 100 },
      left: { x: 0, y: 50 },
      right: { x: 100, y: 50 },
    };
    const drawCrops = () => {
      crops.replaceChildren();
      const image = document.querySelector<HTMLImageElement>(
          `#canvas [data-widget-id="${w.id}"] img,.ai-preview [data-widget-id="${w.id}"] img`,
        ),
        rect = image?.getBoundingClientRect(),
        ratio = rect?.height ? rect.width / rect.height : 4 / 3;
      cropControl(
        crops,
        w.src,
        w.focalPoint ?? points[w.focal ?? 'center'],
        (p) => update(() => (w.focalPoint = p)),
        'Кадр на компьютере',
        { fit: w.fit, aspectRatio: ratio },
      );
      if (doc.kind === 'page')
        cropControl(
          crops,
          w.src,
          w.mobileFocalPoint ?? w.focalPoint ?? points[w.focal ?? 'center'],
          (p) => update(() => (w.mobileFocalPoint = p)),
          'Кадр на телефоне',
          { fit: w.fit, aspectRatio: 4 / 3 },
        );
      else
        crops.append(
          el(
            'p',
            'af-help',
            'У презентации один кадр на всех экранах: слайд масштабируется целиком.',
          ),
        );
    };
    drawCrops();
    select(
      host,
      'Точка кадрирования',
      w.focal ?? 'center',
      { center: 'Центр', top: 'Верх', bottom: 'Низ', left: 'Слева', right: 'Справа' },
      (v) => {
        w.focal = v as typeof w.focal;
        delete w.focalPoint;
        changed();
        drawCrops();
      },
    );
  }
  if (w.type === 'table')
    select(
      host,
      'Оформление таблицы',
      w.variant ?? 'legacy',
      { legacy: 'Исходная', corporate: 'Фирменная', striped: 'Полосы', minimal: 'Минимальная' },
      (v) => update(() => (w.variant = v === 'legacy' ? undefined : (v as typeof w.variant))),
    );
  if (w.type === 'quote') {
    for (const control of [
      input(host, 'Цитата', w.text, (v) => update(() => (w.text = v)), true),
      input(host, 'Автор', w.author, (v) => update(() => (w.author = v))),
    ])
      (control.closest('label') as HTMLElement).dataset.propertyGroup = 'content';
  }
  if (w.type === 'button') {
    const label = input(host, 'Текст кнопки', w.label, (v) => update(() => (w.label = v)));
    (label.closest('label') as HTMLElement).dataset.propertyGroup = 'content';
    select(
      host,
      'Вариант кнопки',
      w.variant,
      { primary: 'Основная', secondary: 'Вторичная' },
      (v) => update(() => (w.variant = v as typeof w.variant)),
    );
    const targets = el('div');
    const draw = () => {
      targets.replaceChildren();
      const a = w.action;
      if (a.type === 'link')
        input(targets, 'Адрес действия', a.href, (v) => update(() => (a.href = v)));
      else if ('target' in a) {
        const options = Object.fromEntries(
          (a.type === 'modal' ? (doc.modals ?? []) : doc.pages).map((p, i) => [
            p.id,
            p.title || `Секция ${i + 1}`,
          ]),
        );
        select(targets, 'Цель действия', a.target, options, (v) => update(() => (a.target = v)));
      }
    };
    select(
      host,
      'Действие',
      w.action.type,
      {
        link: 'Открыть ссылку',
        [doc.kind === 'page' ? 'section' : 'slide']: doc.kind === 'page' ? 'К секции' : 'К слайду',
        modal: 'Открыть окно',
      },
      (v) => {
        if (v === 'link') w.action = { type: 'link', href: 'https://example.com' };
        else {
          const target = v === 'modal' ? doc.modals?.[0]?.id : doc.pages[0].id;
          if (!target) {
            error('Сначала создайте окно в настройках секции.');
            return;
          }
          w.action = { type: v as 'modal' | 'section' | 'slide', target };
        }
        draw();
        changed();
      },
    );
    (host.lastElementChild as HTMLElement).dataset.propertyGroup = 'content';
    targets.dataset.propertyGroup = 'content';
    host.append(targets);
    draw();
  }
  if (w.type === 'cards' || w.type === 'gallery') {
    const list = el('div');
    list.dataset.propertyGroup = 'content';
    host.append(list);
    const draw = () => {
      list.replaceChildren();
      w.items.forEach((item, i) => {
        const group = el('fieldset', 'block-editor');
        group.append(el('legend', '', `Элемент ${i + 1}`));
        if ('title' in item) {
          input(group, 'Заголовок карточки', item.title, (v) => update(() => (item.title = v)));
          input(group, 'Текст карточки', item.text, (v) => update(() => (item.text = v)), true);
        } else {
          input(
            group,
            'Адрес изображения галереи',
            item.src.startsWith('data:') ? '' : item.src,
            (v) => update(() => (item.src = v)),
          );
          upload(group, 'Загрузить в галерею', (src) => update(() => (item.src = src)), error);
          input(group, 'Описание изображения галереи', item.alt, (v) =>
            update(() => (item.alt = v)),
          );
          input(group, 'Подпись галереи', item.caption, (v) => update(() => (item.caption = v)));
        }
        const remove = button(
          'Удалить элемент',
          () => {
            w.items.splice(i, 1);
            draw();
            changed();
          },
          'af-btn af-btn--ghost af-btn--sm',
        );
        remove.disabled = w.items.length === 1;
        group.append(remove);
        list.append(group);
      });
      const add = button(
        'Добавить элемент',
        () => {
          if (w.type === 'cards') w.items.push({ title: 'Новый аргумент', text: 'Описание' });
          else
            w.items.push({ src: '../assets/brand-landscape.svg', alt: 'Изображение', caption: '' });
          draw();
          changed();
        },
        'af-btn af-btn--ghost af-btn--sm',
      );
      add.disabled = w.items.length >= 6;
      list.append(add);
    };
    draw();
  }
}

type SlideTools = {
  editWidget: (id: string) => void;
  addTemplate: () => void;
  preview: () => void;
  fit?: () => void;
  fitAll?: () => void;
  saveComposition: () => void;
  unplaced: (host: HTMLElement) => void;
  warning: (message: string) => void;
  notice?: (message: string) => void;
  gridScope?: (edit: (doc: AFDocument) => void, local: boolean) => boolean;
  signal: AbortSignal;
};
export function sectionDesign(
  host: HTMLElement,
  doc: AFDocument,
  index: number,
  commit: (edit: (d: AFDocument) => void) => boolean,
  tools: SlideTools,
) {
  const page = doc.pages[index];
  const opened = new Map<string, boolean>();
  if (host.dataset.designSection === page.id)
    for (const group of host.querySelectorAll<HTMLDetailsElement>('details[data-setting]'))
      opened.set(group.dataset.setting!, group.open);
  host.dataset.designSection = page.id;
  if (doc.kind === 'presentation') {
    slideDesign(host, doc, index, commit, tools, opened);
    return;
  }
  host.replaceChildren();
  const structure = designGroup(host, 'structure', 'Структура', opened, true),
    style = designGroup(host, 'style', 'Оформление', opened),
    behavior = designGroup(host, 'behavior', 'Дополнительно', opened);
  (behavior.closest('details') as HTMLElement).dataset.advancedSetting = '';
  motionScenarios(behavior, doc, index, commit);
  const appearance = structuredClone(
    page.appearance ?? makeComposition('blank', doc.kind).appearance!,
  );
  const apply = () => commit((d) => (d.pages[index].appearance = structuredClone(appearance)));
  if (appearance.background) {
    cropControl(
      style,
      appearance.background,
      appearance.focalPoint,
      (p) => {
        appearance.focalPoint = p;
        apply();
      },
      'Кадр фона',
    );
    cropControl(
      style,
      appearance.background,
      appearance.mobileFocalPoint,
      (p) => {
        appearance.mobileFocalPoint = p;
        apply();
      },
      'Кадр фона на телефоне',
    );
  }
  select(style, 'Фирменная тема', page.appearance?.theme ?? 'light', themes, (v) => {
    appearance.theme = v as typeof appearance.theme;
    if (appearance.backgroundPlacement)
      appearance.backgroundPlacement = v === 'image' ? 'full' : 'none';
    apply();
  });
  const height = select(
    structure,
    'Высота секции',
    page.appearance?.layout ?? 'fixed',
    { flow: 'По содержимому', fixed: 'Фиксированная сетка' },
    (v) => {
      appearance.layout = v as typeof appearance.layout;
      apply();
    },
  );
  (height.closest('label') as HTMLElement).dataset.advancedSetting = '';
  select(
    structure,
    'Расстояния между элементами',
    appearance.spacing,
    { compact: 'Компактно', normal: 'Обычно', generous: 'Просторно' },
    (v) => {
      appearance.spacing = v as typeof appearance.spacing;
      apply();
    },
  );
  select(
    structure,
    'Ширина содержимого',
    appearance.width,
    { wide: 'Широкая', narrow: 'Узкая' },
    (v) => {
      appearance.width = v as typeof appearance.width;
      apply();
    },
  );
  select(
    style,
    'Декор',
    appearance.decoration,
    { none: 'Нет', orbit: 'Окружность', lines: 'Линии' },
    (v) => {
      appearance.decoration = v as typeof appearance.decoration;
      apply();
    },
  );
  const bg = input(
    style,
    'Фоновое изображение',
    appearance.background?.startsWith('data:') ? '' : (appearance.background ?? ''),
    (v) => {
      appearance.background = v || undefined;
    },
  );
  bg.addEventListener('change', apply);
  upload(
    style,
    'Загрузить фон',
    (src) => {
      appearance.background = src;
      delete appearance.backgroundId;
      appearance.backgroundPlacement = 'full';
      appearance.theme = 'image';
      apply();
    },
    (s) => {
      const error = el('p', 'af-error', s);
      style.append(error);
    },
  );
  select(
    style,
    'Кадрирование фона',
    appearance.focal,
    { center: 'Центр', top: 'Верх', bottom: 'Низ', left: 'Слева', right: 'Справа' },
    (v) => {
      appearance.focal = v as typeof appearance.focal;
      apply();
    },
  );
  select(style, 'Затемнение', appearance.shade, { medium: 'Среднее', strong: 'Сильное' }, (v) => {
    appearance.shade = v as typeof appearance.shade;
    apply();
  });
  sectionTemplatesControls(structure, page, doc.kind, commit, tools);
  modalSettings(behavior, doc, commit);
}

function sectionTemplatesControls(
  host: HTMLElement,
  page: Section,
  kind: AFDocument['kind'],
  commit: (edit: (doc: AFDocument) => void) => boolean,
  tools: SlideTools,
) {
  const initial = page.composition ?? 'blank';
  const options = Object.fromEntries(
    sectionTemplates(kind).map((entry) => [entry.key, entry.title]),
  );
  if (!Object.hasOwn(options, initial)) options[initial] = 'Текущая композиция';
  const apply = (template: ReturnType<typeof getSectionTemplate>, park?: boolean) =>
    commit((doc) => replaceComposition(doc, page.id, template, park));
  const selector = select(
    host,
    kind === 'page' ? 'Шаблон секции' : 'Шаблон слайда',
    initial,
    options,
    (key) => {
      if (key === initial) return;
      requestComposition(
        page,
        getSectionTemplate(kind, key),
        apply,
        tools.warning,
        tools.signal,
        () => {
          selector.value = initial;
          selector.dispatchEvent(new Event('change', { bubbles: true }));
        },
      );
    },
  );
  (selector.closest('label') as HTMLElement).dataset.advancedSetting = '';
  compositionChooser(host, page, kind, apply, tools.warning, tools.signal);
  layoutChooser(
    host,
    page,
    kind,
    (variant) =>
      commit((doc) => {
        const index = doc.pages.findIndex(({ id }) => id === page.id);
        if (index < 0) throw new Error('Раздел уже удалён.');
        doc.pages[index] = sectionVariant(kind, doc.pages[index], variant);
      }),
    tools.signal,
  );
  if (page.widgets.length)
    host.append(
      button('Сохранить как композицию', tools.saveComposition, 'af-btn af-btn--ghost af-btn--sm'),
    );
  tools.unplaced(host);
}

function designGroup(
  host: HTMLElement,
  key: string,
  title: string,
  opened: ReadonlyMap<string, boolean>,
  initiallyOpen = false,
) {
  const { group, body } = settingsGroup(title, 'section-property-group');
  group.dataset.setting = key;
  group.open = opened.get(key) ?? initiallyOpen;
  host.append(group);
  return body;
}
function modalSettings(
  host: HTMLElement,
  doc: AFDocument,
  commit: (edit: (d: AFDocument) => void) => boolean,
) {
  host.append(el('h3', '', 'Модальные окна проекта'));
  for (const modal of doc.modals ?? []) {
    const title = input(host, 'Название окна', modal.title, () => {}),
      text = input(host, 'Текст окна', modal.text, () => {}, true);
    const save = () =>
      commit((d) => {
        const m = d.modals!.find((m) => m.id === modal.id)!;
        m.title = title.value;
        m.text = text.value;
      });
    title.addEventListener('change', save);
    text.addEventListener('change', save);
    host.append(
      button(
        'Удалить окно',
        () =>
          commit((d) => {
            d.modals = d.modals?.filter((m) => m.id !== modal.id);
          }),
        'af-btn af-btn--ghost af-btn--sm',
      ),
    );
  }
  host.append(
    button(
      'Добавить окно',
      () =>
        commit((d) => {
          (d.modals ??= []).push({
            id: 'modal-' + crypto.randomUUID(),
            title: 'Новое окно',
            text: 'Добавьте содержание.',
          });
        }),
      'af-btn af-btn--ghost af-btn--sm',
    ),
  );
}

function slideHeadingSettings(
  host: HTMLElement,
  page: Section,
  index: number,
  commit: (edit: (d: AFDocument) => void) => boolean,
) {
  const value = headingFieldValue(page.title),
    title = input(host, 'Заголовок слайда', value, () => {});
  title.maxLength = 200;
  title.addEventListener('change', () => {
    if (title.value !== value) commit((d) => (d.pages[index].title = title.value));
  });
}

function slideDesign(
  host: HTMLElement,
  doc: AFDocument,
  index: number,
  commit: (edit: (d: AFDocument) => void) => boolean,
  tools: SlideTools,
  opened: ReadonlyMap<string, boolean>,
) {
  const page = doc.pages[index];
  const active =
    host.closest('[data-editor-mode="standard"]') && host.dataset.slideTab === 'behavior'
      ? 'structure'
      : (host.dataset.slideTab ?? 'structure');
  host.replaceChildren();
  host.append(el('h2', 'af-title inspector-heading', `Слайд ${index + 1}`));
  const nav = el('div', 'slide-settings-tabs');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Настройки слайда');
  host.append(nav);
  const tabs = new Map<string, HTMLButtonElement>(),
    panels = new Map<string, HTMLElement>();
  const activate = (id: string) => {
    host.dataset.slideTab = id;
    tabs.forEach((b, key) => {
      b.setAttribute('aria-selected', String(key === id));
      b.classList.toggle('af-btn--ghost', key !== id);
      b.tabIndex = key === id ? 0 : -1;
    });
    panels.forEach((p, key) => (p.hidden = key !== id));
  };
  for (const [id, title] of [
    ['structure', 'Структура'],
    ['background', 'Оформление'],
    ['behavior', 'Поведение'],
  ]) {
    const tab = button(title, () => activate(id), 'slide-settings-tab');
    tab.id = 'slide-tab-' + id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'slide-panel-' + id);
    nav.append(tab);
    tabs.set(id, tab);
    const panel = el('div', 'slide-settings-panel');
    panel.id = 'slide-panel-' + id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    host.append(panel);
    panels.set(id, panel);
    tab.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const keys = [...tabs.keys()].filter(
          (key) => key !== 'behavior' || !host.closest('[data-editor-mode="standard"]'),
        ),
        current = keys.indexOf(id),
        next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? keys.length - 1
              : (current + (e.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
      activate(keys[next]);
      tabs.get(keys[next])!.focus();
    });
  }
  activate(active);
  const structure = panels.get('structure')!,
    background = panels.get('background')!,
    behavior = panels.get('behavior')!;
  slideHeadingSettings(structure, page, index, commit);
  sectionTemplatesControls(structure, page, doc.kind, commit, tools);
  structure.append(
    button('Добавить слайд по шаблону', tools.addTemplate, 'af-btn af-btn--secondary af-btn--sm'),
  );
  const grid = el('details', 'slide-grid settings-disclosure');
  grid.dataset.setting = 'slide-grid';
  grid.dataset.advancedSetting = '';
  nav.querySelector<HTMLElement>('#slide-tab-behavior')!.dataset.advancedSetting = '';
  behavior.dataset.advancedSetting = '';
  grid.open = opened.get('slide-grid') ?? false;
  grid.append(el('summary', 'af-btn af-btn--clear af-btn--sm', 'Сетка и размеры'));
  const form = el('form', 'af-stack');
  form.dataset.gridDraft = 'true';
  const feedback = el('p', 'af-help');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  form.addEventListener('input', () => {
    form.dataset.dirty = 'true';
    feedback.classList.remove('af-error');
    feedback.textContent = 'Изменения сетки ещё не применены.';
  });
  form.addEventListener(
    'invalid',
    (event) => {
      const field = event.target as HTMLInputElement;
      feedback.classList.add('af-error');
      feedback.textContent =
        (field.closest('label')?.textContent ?? 'Поле') + ': ' + field.validationMessage;
    },
    true,
  );
  const draft = structuredClone(page.grid);
  gridScopeControl(form, doc, index, tools.gridScope ?? commit);
  for (const [key, label, min, max] of [
    ['columns', 'Колонки', 1, 24],
    ['rowHeight', 'Строка, px', 32, 160],
    ['gap', 'Отступ, px', 0, 48],
  ] as const) {
    const field = input(
      form,
      label,
      String(draft[key]),
      (v) => (draft[key] = Number(v)),
    ) as HTMLInputElement;
    field.type = 'number';
    field.min = String(min);
    field.max = String(max);
    field.required = true;
  }
  gridFrameFields(form, draft, doc.kind);
  const originalValues = Array.from(form.querySelectorAll<HTMLInputElement>('input'), (field) => ({
    field,
    value: field.value,
  }));
  form.append(
    el(
      'p',
      'af-help',
      'Измените нужные параметры и нажмите «Применить сетку». Положение и размеры блоков будут пересчитаны.',
    ),
  );
  const save = el('button', 'af-btn af-btn--ghost af-btn--sm', 'Применить сетку');
  save.type = 'submit';
  form.append(save);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let issue = '';
    const applied = commit((d) => {
      try {
        applyInheritedGrid(d, index, draft);
      } catch (error) {
        issue = (error as Error).message;
        throw error;
      }
    });
    form.dataset.applied = String(applied);
    if (!applied) {
      feedback.classList.add('af-error');
      feedback.textContent =
        issue || 'Сетка не применена. Проверьте параметры и повторите действие.';
    }
  });
  form.append(
    button('Отменить изменения сетки', () => {
      Object.assign(draft, structuredClone(page.grid));
      for (const { field, value } of originalValues) field.value = value;
      form.dataset.dirty = 'false';
      feedback.classList.remove('af-error');
      feedback.textContent = 'Изменения сетки отменены.';
      tools.notice?.('Изменения сетки отменены.');
    }),
    feedback,
  );
  grid.append(form);
  grid.append(
    standardGridButton(() => {
      commit((d) => applyStandardGrid(d, index));
    }),
  );
  structure.append(grid, el('h3', '', 'Элементы слайда'));
  if (!page.widgets.length)
    structure.append(el('p', 'af-help', 'Слайд пока пуст. Выберите шаблон или добавьте блок.'));
  page.widgets.forEach((w, i) => {
    const row = el('div', 'slide-element');
    const size = el(
      'span',
      'af-help',
      `${w.position.width}×${w.position.height} · колонка ${w.position.col}, строка ${w.position.row}`,
    );
    size.dataset.advancedSetting = '';
    row.append(
      button(
        `${i + 1}. ${w.title || widgetRegistry[w.type].title}`,
        () => tools.editWidget(w.id),
        'af-btn af-btn--ghost af-btn--sm',
      ),
      size,
    );
    structure.append(row);
  });
  const appearance = structuredClone(
    page.appearance ?? makeComposition('blank', 'presentation').appearance!,
  );
  appearance.layout = 'fixed';
  const apply = () => commit((d) => (d.pages[index].appearance = structuredClone(appearance)));
  const chrome = structuredClone(page.chrome ?? {}),
    applyChrome = () => commit((d) => (d.pages[index].chrome = structuredClone(chrome)));
  for (const [scope, label, action] of [
    ['Этот слайд', 'Подобрать фон и размещение', tools.fit],
    ['Все слайды', 'Подобрать оформление всей презентации', tools.fitAll],
  ] as const) {
    if (!action) continue;
    const group = el('fieldset', 'block-editor');
    group.append(el('legend', '', scope), button(label, action));
    background.append(group);
  }
  const current = el('fieldset', 'block-editor');
  current.append(el('legend', '', 'Настройки этого слайда'));
  background.append(current);
  const { group: chromeGroup, body: chromeSettings } = settingsGroup(
    'Подпись и номер слайда',
    'section-property-group',
  );
  chromeGroup.dataset.setting = 'slide-chrome';
  chromeGroup.open = opened.get('slide-chrome') ?? false;
  const header = el('fieldset', 'block-editor');
  header.append(el('legend', '', 'Подпись презентации'));
  chromeSettings.append(header);
  checkboxField(header, 'Показывать подпись презентации', chrome.header?.visible !== false, (v) => {
    chrome.header = { ...chrome.header, visible: v };
    applyChrome();
  });
  const headerText = input(header, 'Текст подписи', chrome.header?.text ?? '', () => {});
  headerText.maxLength = 240;
  headerText.placeholder = 'АЛАБУГА / ' + doc.title;
  headerText.addEventListener('change', () => {
    chrome.header = { ...chrome.header, text: headerText.value.trim() || undefined };
    applyChrome();
  });
  header.append(
    el(
      'p',
      'af-help',
      'Пустое поле — «АЛАБУГА / название проекта». Положение и размер одинаковы на всех слайдах.',
    ),
  );
  const numbering = el('fieldset', 'block-editor');
  numbering.append(el('legend', '', 'Нумерация страниц'));
  chromeSettings.append(numbering);
  checkboxField(numbering, 'Показывать номер страницы', chrome.number?.visible !== false, (v) => {
    chrome.number = { ...chrome.number, visible: v };
    applyChrome();
  });
  const pageNumber = input(numbering, 'Номер страницы', chrome.number?.value ?? '', () => {});
  pageNumber.maxLength = 20;
  pageNumber.placeholder = String(index + 1).padStart(2, '0');
  pageNumber.addEventListener('change', () => {
    chrome.number = { ...chrome.number, value: pageNumber.value.trim() || undefined };
    applyChrome();
  });
  select(
    numbering,
    'Формат номера',
    chrome.number?.format ?? 'padded',
    { padded: '01, 02, 03', plain: '1, 2, 3', total: '1 / всего слайдов' },
    (v) => {
      chrome.number = {
        ...chrome.number,
        format: v as NonNullable<typeof chrome.number>['format'],
      };
      applyChrome();
    },
  );
  select(
    numbering,
    'Положение номера',
    chrome.number?.position ?? 'right',
    { left: 'Слева внизу', center: 'По центру внизу', right: 'Справа внизу' },
    (v) => {
      chrome.number = {
        ...chrome.number,
        position: v as NonNullable<typeof chrome.number>['position'],
      };
      applyChrome();
    },
  );
  select(
    numbering,
    'Фон номера страницы',
    chrome.number?.background ?? 'transparent',
    {
      transparent: 'Без фона',
      white: 'Белый',
      ink: 'Тёмно-синий',
      blue: 'Фирменный синий',
      light: 'Светло-голубой',
    },
    (v) => {
      chrome.number = {
        ...chrome.number,
        background: v as NonNullable<typeof chrome.number>['background'],
      };
      applyChrome();
    },
  );
  select(
    numbering,
    'Цвет текста номера страницы',
    chrome.number?.color ?? 'inherit',
    {
      inherit: 'Из темы',
      ink: 'Тёмно-синий',
      blue: 'Фирменный синий',
      white: 'Белый',
      muted: 'Второстепенный',
    },
    (v) => {
      chrome.number = { ...chrome.number, color: v as NonNullable<typeof chrome.number>['color'] };
      applyChrome();
    },
  );
  numbering.append(
    el(
      'p',
      'af-help',
      'Пустой номер рассчитывается по порядку слайдов и обновляется при перестановке. Свой текст заменяет автоматический номер.',
    ),
  );
  if (appearance.background)
    cropControl(
      current,
      appearance.background,
      appearance.focalPoint,
      (p) => {
        appearance.focalPoint = p;
        apply();
      },
      'Кадр фона',
    );
  select(
    current,
    'Фон слайда',
    appearance.theme,
    {
      light: 'Светлый',
      contrast: 'Тёмный фирменный',
      accent: 'Синий фирменный',
      image: 'Изображение',
    },
    (v) => {
      appearance.theme = v as typeof appearance.theme;
      if (appearance.backgroundPlacement)
        appearance.backgroundPlacement = v === 'image' ? 'full' : 'none';
      apply();
    },
  );
  select(
    current,
    'Декор',
    appearance.decoration,
    { none: 'Нет', orbit: 'Окружность', lines: 'Линии' },
    (v) => {
      appearance.decoration = v as typeof appearance.decoration;
      apply();
    },
  );
  const bg = input(
    current,
    'Фоновое изображение',
    appearance.background?.startsWith('data:') ? '' : (appearance.background ?? ''),
    () => {},
  );
  bg.addEventListener('change', () => {
    appearance.background = bg.value || undefined;
    delete appearance.backgroundId;
    appearance.backgroundPlacement = bg.value ? 'full' : 'none';
    if (bg.value) appearance.theme = 'image';
    apply();
  });
  upload(
    current,
    'Загрузить фон',
    (src) => {
      appearance.background = src;
      delete appearance.backgroundId;
      appearance.backgroundPlacement = 'full';
      appearance.theme = 'image';
      apply();
    },
    (s) => current.append(el('p', 'af-error', s)),
  );
  if (appearance.background) {
    current.append(
      el(
        'p',
        'af-help',
        appearance.background.startsWith('data:')
          ? 'Изображение встроено в проект.'
          : 'Изображение задано ссылкой.',
      ),
      button(
        'Убрать изображение',
        () => {
          delete appearance.background;
          delete appearance.backgroundId;
          appearance.backgroundPlacement = 'none';
          appearance.theme = 'light';
          apply();
        },
        'af-btn af-btn--ghost af-btn--sm',
      ),
    );
  }
  select(
    current,
    'Кадрирование фона',
    appearance.focal,
    { center: 'Центр', top: 'Верх', bottom: 'Низ', left: 'Слева', right: 'Справа' },
    (v) => {
      appearance.focal = v as typeof appearance.focal;
      apply();
    },
  );
  select(current, 'Затемнение', appearance.shade, { medium: 'Среднее', strong: 'Сильное' }, (v) => {
    appearance.shade = v as typeof appearance.shade;
    apply();
  });
  current.append(chromeGroup);
  motionScenarios(behavior, doc, index, commit);
  select(
    behavior,
    'Переход слайда',
    page.transition ?? 'none',
    { none: 'Без эффекта', fade: 'Растворение', slide: 'Сдвиг' },
    (v) => commit((d) => (d.pages[index].transition = v as Section['transition'])),
  );
  select(
    behavior,
    'Показ элементов',
    page.widgets.some((w) => w.motion?.step) ? 'steps' : 'all',
    { all: 'Все сразу', steps: 'По шагам' },
    (v) =>
      commit((d) =>
        d.pages[index].widgets.forEach((w, i) => {
          w.motion = {
            effect: w.motion?.effect ?? 'fade',
            speed: w.motion?.speed ?? 'normal',
            intensity: w.motion?.intensity ?? 'subtle',
            step: v === 'all' ? 0 : i,
          };
        }),
      ),
  );
  behavior.append(
    el(
      'p',
      'af-help',
      '«Далее» раскрывает следующий шаг, затем переключает слайд. «Назад» возвращает предыдущий шаг. Автоматического перелистывания нет.',
    ),
  );
  const advanced = el('details', 'settings-disclosure');
  advanced.dataset.setting = 'slide-motion';
  advanced.open = opened.get('slide-motion') ?? false;
  advanced.append(
    el('summary', 'af-btn af-btn--clear af-btn--sm', 'Дополнительно: шаги и эффекты'),
  );
  behavior.append(advanced);
  page.widgets.forEach((w, i) => {
    const group = el('fieldset', 'block-editor');
    group.append(el('legend', '', `${i + 1}. ${w.title || widgetRegistry[w.type].title}`));
    const motion = w.motion ?? {
      effect: 'none' as const,
      speed: 'normal' as const,
      intensity: 'subtle' as const,
      step: 0,
    };
    const step = input(
      group,
      'Шаг: ' + (w.title || widgetRegistry[w.type].title),
      String(motion.step),
      () => {},
    ) as HTMLInputElement;
    step.type = 'number';
    step.min = '0';
    step.max = '20';
    step.required = true;
    step.addEventListener('change', () => {
      if (step.reportValidity())
        commit((d) => {
          d.pages[index].widgets[i].motion = { ...motion, step: Number(step.value) };
        });
    });
    select(
      group,
      'Эффект: ' + (w.title || widgetRegistry[w.type].title),
      motion.effect,
      {
        none: 'Нет',
        fade: 'Появление',
        rise: 'Сдвиг',
        scale: 'Масштаб',
        sequence: 'Последовательность',
      },
      (v) =>
        commit((d) => {
          d.pages[index].widgets[i].motion = {
            ...motion,
            effect: v as NonNullable<Widget['motion']>['effect'],
          };
        }),
    );
    advanced.append(group);
  });
  behavior.append(
    el(
      'p',
      'af-help',
      'Шаг 0 — сразу. Одинаковый номер — показ вместе. При печати видны все элементы.',
    ),
    button('Посмотреть этот слайд', tools.preview, 'af-btn'),
  );
  const modals = el('details', 'settings-disclosure');
  modals.dataset.setting = 'slide-modals';
  modals.open = opened.get('slide-modals') ?? false;
  modals.append(el('summary', 'af-btn af-btn--clear af-btn--sm', 'Окна презентации'));
  modalSettings(modals, doc, commit);
  behavior.append(modals);
}
