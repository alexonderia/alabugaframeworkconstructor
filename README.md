# Alabuga Constructor

[English](README.en.md) · [Руководство](docs/ru/start.md) · [Разделение проектов](docs/split-implementation.ru.md)

Визуальный конструктор сайтов и презентаций с локальными проектами, автономным HTML и дополнительным ИИ. Текущий репозиторий и его история сохраняются: https://github.com/vldsmelov/alabugaframework. Framework выделен в https://github.com/alexonderia/alabuga-framework и устанавливается как точная npm-зависимость. Его исходники и сборка не требуются.

Node.js 24.19.0, npm 11.17.0. Настройте scoped registry и read token в пользовательском npm config:

```sh
node scripts/configure-registry.mjs https://YOUR_REGISTRY/
npm ci
npm run dev
```

Откройте http://127.0.0.1:5173/demo/. Для production-сборки выполните `npm run build`, затем `npm run ai:server`. Основной адрес остаётся http://127.0.0.1:4176; `/demo/`, `/builder/`, `/api/ai/` и `/docs/{ru,en}/` сохраняются. Модель для разработки редактора не нужна. Инициализация и pin Qwen3.5-2B не менялись.

Корень `/` и `/index.html`, как в прежней сборке, открывают справочник Framework. После разделения это переход на отдельный сайт из `VITE_FRAMEWORK_DOCS_URL` с сохранением query и hash раздела. Старые `/demos/{panel,form,slides,showcase}.html` открывают соответствующие примеры там же. В Constructor сохраняются только страницы перехода; исходники справочника и примеров принадлежат Framework.

Ссылка «Документация» на демонстрационной странице открывает самостоятельный сайт Framework с поиском, компонентами и живыми примерами. Локальный адрес — http://127.0.0.1:4391/; сайт запускается из репозитория Framework командой `docker compose -f compose.docs.yaml up --build -d`. Для другого адреса задайте `VITE_FRAMEWORK_DOCS_URL` перед запуском Vite или сборкой web-образа; в Actions используется repository variable `FRAMEWORK_DOCS_URL`. Подробные руководства Constructor доступны по `/docs/ru/start.html`: автор, проекты, ИИ, подбор оформления, API, хранение, эксплуатация и проверка качества. Прежний `/demo/guide.html` открывает руководство автора. Разделы «Локальный ИИ» и «Проекты и материалы» в справочнике Framework ведут к этим руководствам.

Docker: задайте ALABUGA_NPM_REGISTRY и ALABUGA_NPMRC_FILE по `.env.example`, затем `docker compose -f compose.yaml -f compose.build.yaml up --build -d`. npmrc передаётся как BuildKit secret и не входит в образы. Для модели добавьте `--profile ai`. Для разработки используйте compose.dev.yaml.

Проверки: `npm test`, `npm run test:ai`, `npm run test:bootstrap`, `npm run build`, `npm run check:docs`, `npm run test:compatibility`, `npm run test:browser`, `npm run test:release`. Установите браузеры через `npx playwright install`; для локального Chrome доступна переменная AF_BROWSER_CHANNEL=chrome. GPU-приёмка выполняется отдельно.

IndexedDB alabuga-workspace остаётся версии 2. Документы схем 1–3 поддерживаются; файлы проекта версий 1–3 и прежние файлы без версии читаются. Неизвестные будущие версии отклоняются до сохранения. Сохраняйте origin: изменение протокола, домена или порта не переносит браузерные проекты. Резервная копия проекта — переносимый JSON с материалами; Docker volumes проекты не содержат.

Framework обновляется отдельным PR с точной версией и lock-файлом. Публикация библиотеки не выпускает Constructor. Откат приложения — предыдущая согласованная пара AF_WEB_IMAGE/AF_API_IMAGE, `docker compose up -d --no-build web api`; volumes сохраняются.

Для локального реестра выполните configure-registry без аргумента (127.0.0.1:4873); инструкция администратора находится в отдельном Framework-репозитории. Скрипт перемещает URL архива между реестрами, сохраняя проверяемый integrity и версию пакета.

Код и корпоративные материалы не предоставляются по открытой лицензии.

Сверка с исходным коммитом: [отчёт сохранности](docs/split-preservation.ru.md), [карта всех файлов](docs/split-file-audit.json), [сравнение сборок 4176 и 4390](docs/parity-4176-4390.ru.md). Повторный аудит обоих checkout выполняется отдельно от сборки: `node scripts/audit-split.mjs --framework-root ../alabuga-framework --with-compose`. Обычная установка и сборка Constructor второго репозитория не требуют.
