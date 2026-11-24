import './styles';
import '@alabuga/framework';
import type { AFDocument } from '@alabuga/framework';
import { brandAssets } from '@alabuga/framework/brand';
import { demoDocument } from '@alabuga/framework/demo-documents';
import { draftDocument } from '@alabuga/ai/contracts';
import { mountControls } from '../src/component-lifecycle';
import { renderDocument } from '../src/framework-adapter';
import { saveProject, writeSetting } from '../src/storage';
import { button, el } from '../src/ui';
import { openDiagnostics } from './diagnostics';

const openAI: typeof import('../src/ai/panel').openAI = (...args) =>
  import('../src/ai/panel').then((module) => module.openAI(...args));
const root = document.querySelector<HTMLElement>('#demo')!;
const editorUrl = '../builder/';
const frameworkDocsUrl = import.meta.env.VITE_FRAMEWORK_DOCS_URL || 'http://127.0.0.1:4391/';
let busy = false;

function link(label: string, href: string, classes = '') {
  const anchor = el('a', classes, label);
  anchor.href = href;
  return anchor;
}

const header = el('header', 'demo-header');
const brand = link('', './', 'demo-brand');
const logo = el('img');
logo.src = brandAssets.logo;
logo.alt = 'Алабуга';
brand.append(logo, el('strong', '', 'Constructor'));
const nav = el('nav');
nav.setAttribute('aria-label', 'Справка');
nav.append(
  link('Помощь', './guide.html'),
  link('Справочник Framework', frameworkDocsUrl),
  button('Готовность к показу', () => void openDiagnostics(), 'af-btn af-btn--secondary'),
);
header.append(brand, nav);

const main = el('main');
const hero = el('section', 'demo-hero');
const heroActions = el('div', 'demo-actions');
heroActions.append(
  link('Открыть редактор', editorUrl, 'af-btn'),
  link('Посмотреть образцы', '#examples', 'af-btn af-btn--secondary'),
);
hero.append(
  el('h1', '', 'Конструктор сайтов и презентаций'),
  el('p', 'demo-lead', 'Создайте проект в редакторе или начните с готового образца.'),
  heroActions,
);

type Mode = 'sample' | 'lesson' | 'ai';

async function create(kind: AFDocument['kind'], mode: Mode, status: HTMLElement) {
  if (busy) return;
  busy = true;
  status.textContent = 'Открываем проект…';
  try {
    if (mode === 'ai') {
      status.textContent = '';
      await openAI({ projectId: 'demo-' + kind, anchorId: '', kind, demo: true }, async (draft) => {
        const id = crypto.randomUUID();
        await saveProject(id, draftDocument(draft), draft.id);
        location.href = editorUrl + '#/edit/' + id;
      });
      return;
    }
    const doc = demoDocument(kind);
    const id = crypto.randomUUID();
    doc.title += ' — моя копия';
    await saveProject(id, doc);
    await writeSetting('tutorial:' + id, {
      version: 2,
      enabled: mode === 'lesson',
      current: mode === 'lesson' ? 3 : 0,
      section: mode === 'lesson' ? (kind === 'page' ? 4 : 5) : 0,
    });
    location.href = editorUrl + '#/edit/' + id;
  } catch {
    status.textContent = 'Не удалось открыть проект. Попробуйте ещё раз.';
  } finally {
    busy = false;
  }
}

function statusLine() {
  const status = el('p', 'af-help demo-status');
  status.setAttribute('role', 'status');
  return status;
}

const gallery = el('section', 'demo-gallery');
gallery.id = 'examples';
gallery.tabIndex = -1;
gallery.setAttribute('aria-labelledby', 'examples-title');
const galleryTitle = el('h2', '', 'Готовые образцы');
galleryTitle.id = 'examples-title';
gallery.append(galleryTitle, el('p', '', 'В редакторе откроется ваша копия образца.'));

const controllers: ReturnType<typeof renderDocument>[] = [];
for (const [kind, title, action] of [
  ['page', 'Сайт', 'Редактировать образец сайта'],
  ['presentation', 'Презентация', 'Редактировать образец презентации'],
] as const) {
  const article = el('article', 'demo-sample');
  const head = el('div', 'demo-sample-head');
  const status = statusLine();
  const sampleButton = button(
    action,
    () => void create(kind, 'sample', status),
    'af-btn af-btn--secondary',
  );
  const host = el('div', 'demo-preview ' + kind);
  head.append(el('h3', '', title), sampleButton);
  article.append(head, status, host);
  gallery.append(article);
  controllers.push(renderDocument(host, demoDocument(kind)));
}

const exercises = el('section', 'demo-exercises');
exercises.append(el('h2', '', 'Попробовать инструменты'));
const format = el('label', 'af-field');
const select = el('select', 'af-select');
for (const [value, title] of [
  ['page', 'Сайт'],
  ['presentation', 'Презентация'],
]) {
  const option = el('option', '', title);
  option.value = value;
  select.append(option);
}
format.append(el('span', 'af-label', 'Формат проекта'), select);
const exerciseStatus = statusLine();
const actions = el('div', 'demo-exercise-actions');
actions.append(
  format,
  button(
    'Урок по настройке блока',
    () => void create(select.value as AFDocument['kind'], 'lesson', exerciseStatus),
    'af-btn af-btn--secondary',
  ),
  button(
    'Создать с ИИ',
    () => void create(select.value as AFDocument['kind'], 'ai', exerciseStatus),
    'af-btn af-btn--secondary',
  ),
);
exercises.append(actions, exerciseStatus);
main.append(hero, gallery, exercises);
root.append(header, main);
const disposeControls = mountControls(actions);
window.addEventListener(
  'pagehide',
  () => {
    disposeControls();
    controllers.forEach((controller) => controller.destroy());
  },
  { once: true },
);
