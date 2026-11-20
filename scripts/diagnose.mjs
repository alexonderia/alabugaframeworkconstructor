import { parseArgs } from 'node:util';

const usage = `Проверка сервисов Constructor

node scripts/diagnose.mjs [--url URL] [--docs-url URL] [--require-api] [--require-ai] [--require-docs] [--json]

По умолчанию для успешной проверки достаточно доступного редактора.
--require-ai требует доступный API, Ollama и готовую закреплённую модель.
--require-api требует ответ API на проверку запуска.
--require-docs требует руководства Constructor и справочник Framework.
`;

async function read(url, type, validate) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith(type)) {
      await response.body?.cancel();
      return { ok: false, detail: `HTTP ${response.status} или неожиданный тип ответа` };
    }
    const data = type === 'application/json' ? await response.json() : await response.text();
    return validate(data)
      ? { ok: true, data }
      : { ok: false, detail: 'Неожиданное содержимое ответа' };
  } catch (error) {
    return {
      ok: false,
      detail: error.name === 'TimeoutError' ? 'Истекло время ожидания' : 'Не удалось прочитать ответ',
    };
  }
}

function baseUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Укажите HTTP(S) адрес без логина и пароля');
  }
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

const validBuild = (data) => typeof data?.version === 'string'
  && typeof data.revision === 'string' && !!data.revision;
const html = (data) => /<html[\s>]/i.test(data);
const modelReasons = {
  'ollama-unavailable': 'API не получил версию Ollama',
  'model-missing': 'Закреплённая модель отсутствует',
  'pin-mismatch': 'Версия Ollama или digest модели отличается от закреплённого',
  'status-unavailable': 'API не смог проверить состояние модели',
  preparation: 'Инициализация модели ещё не завершилась',
};

async function diagnose(options) {
  const app = baseUrl(options.url || `http://127.0.0.1:${process.env.AF_WEB_PORT || process.env.AF_AI_PORT || 4176}`);
  const at = (path) => new URL(path, app);
  const editorUrl = at('builder/');
  const guidesUrl = at('docs/ru/start.html');
  const [web, api, readiness, guides, metadata] = await Promise.all([
    read(editorUrl, 'text/html', (data) => html(data) && /\bid=["']builder["']/.test(data)),
    read(at('api/ai/health'), 'application/json', (data) => data?.status === 'ok'),
    read(at('api/ai/readiness'), 'application/json', (data) => typeof data?.ready === 'boolean'),
    read(guidesUrl, 'text/html', (data) => html(data) && /<title[^>]*>[^<]*Alabuga Constructor/i.test(data)),
    read(at('build-info.json'), 'application/json', validBuild),
  ]);
  const docsUrl = baseUrl(options['docs-url'] || metadata.data?.frameworkDocsUrl
    || process.env.VITE_FRAMEWORK_DOCS_URL || 'http://127.0.0.1:4391/');
  const docs = await read(docsUrl, 'text/html', html);
  const runtime = readiness.data?.ollama;
  const version = runtime?.version ?? readiness.data?.version;
  const ollama = runtime?.reachable === false ? 'unavailable'
    : runtime?.reachable === true || typeof version === 'string' || readiness.data?.ready === true
      ? 'ok' : 'unknown';
  const ready = readiness.data?.ready === true;
  const webBuild = metadata.data && { version: metadata.data.version, revision: metadata.data.revision };
  const apiBuild = validBuild(api.data?.build)
    ? { version: api.data.build.version, revision: api.data.build.revision } : undefined;
  const buildPair = webBuild && apiBuild
    ? webBuild.version === apiBuild.version && webBuild.revision === apiBuild.revision
      ? 'match' : 'mismatch'
    : 'unknown';
  const status = (result, url) => ({
    state: result.ok ? 'ok' : 'unavailable', url: String(url), detail: result.detail,
  });
  const checks = {
    web: { ...status(web, editorUrl), build: webBuild },
    api: { ...status(api, at('api/ai/health')), build: apiBuild },
    ollama: { state: ollama, version: typeof version === 'string' ? version : undefined },
    model: {
      state: !readiness.ok ? 'unknown' : ready ? 'ok' : 'not-ready',
      name: typeof readiness.data?.model === 'string' ? readiness.data.model : undefined,
      preparation: typeof readiness.data?.activePreparation === 'string'
        ? readiness.data.activePreparation : undefined,
      detail: readiness.ok && !ready
        ? (Object.hasOwn(modelReasons, readiness.data.reason)
          ? modelReasons[readiness.data.reason] : 'Модель пока не готова')
        : readiness.detail,
    },
    guides: status(guides, guidesUrl),
    frameworkDocs: status(docs, docsUrl),
  };
  const requireApi = options['require-api'] || options['require-ai'];
  const ok = web.ok && buildPair !== 'mismatch' && (!requireApi || api.ok)
    && (!options['require-ai'] || (ollama === 'ok' && ready))
    && (!options['require-docs'] || (guides.ok && docs.ok));
  return { ok, buildPair, checks };
}

function print(report) {
  const names = {
    web: 'Редактор', api: 'API', ollama: 'Ollama (из API)', model: 'Модель',
    guides: 'Руководства Constructor', frameworkDocs: 'Справочник Framework',
  };
  const states = { ok: 'доступен', unavailable: 'недоступен', unknown: 'статус неизвестен', 'not-ready': 'не готова' };
  for (const [key, check] of Object.entries(report.checks)) {
    const details = [
      check.url, check.build && `${check.build.version} · ${check.build.revision}`,
      check.version, check.name, check.preparation, check.detail,
    ].filter(Boolean);
    const label = key === 'model' && check.state === 'ok' ? 'готова'
      : key === 'guides' && check.state === 'ok' ? 'доступны'
        : key === 'guides' && check.state === 'unavailable' ? 'недоступны' : states[check.state];
    console.log(`${names[key]} — ${label}${details.length ? ' · ' + details.join(' · ') : ''}`);
  }
  const pair = { match: 'совпадают', mismatch: 'различаются', unknown: 'данных недостаточно' };
  console.log(`Версии сборок web/API — ${pair[report.buildPair]}`);
}

try {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' }, 'docs-url': { type: 'string' }, json: { type: 'boolean' },
      'require-api': { type: 'boolean' }, 'require-ai': { type: 'boolean' },
      'require-docs': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(usage);
  } else {
    try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const report = await diagnose(values);
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else print(report);
    process.exitCode = report.ok ? 0 : 1;
  }
} catch {
  console.error('Проверьте параметры команды и адреса сервисов. Справка доступна через --help.');
  process.exitCode = 2;
}
