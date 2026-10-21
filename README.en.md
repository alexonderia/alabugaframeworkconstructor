# Alabuga Constructor

The existing repository remains the main Constructor repository. Framework is independently maintained at https://github.com/alexonderia/alabuga-framework and installed as an exact npm dependency. No Framework source checkout or build is required.

Use Node.js 24.19.0/npm 11.17.0. Configure the private registry with `node scripts/configure-registry.mjs https://YOUR_REGISTRY/`, provide a read token in user npm config, then run `npm ci`, `npm run dev`. Open http://127.0.0.1:5173/demo/. Build with `npm run build`; serve using `npm run ai:server` at the existing http://127.0.0.1:4176 origin.

Editor, AI integration, server, document storage and independent application CI/CD live here. The model pin, document schemas 1–3 and IndexedDB alabuga-workspace version 2 are preserved. Download portable projects before changing origin. Unknown future project/document versions fail before storage writes.

As in the original application, `/` and `/index.html` open the Framework reference. They now redirect to the independently deployed `VITE_FRAMEWORK_DOCS_URL`, preserving query parameters and section hashes. Legacy `/demos/{panel,form,slides,showcase}.html` URLs open the corresponding independent examples. Constructor contains redirect pages only, never Framework documentation/example sources.

The demo's Documentation link opens the independent Framework reference with search, components and live examples. Its local URL is http://127.0.0.1:4391/; start it from the Framework repository with `docker compose -f compose.docs.yaml up --build -d`. Set `VITE_FRAMEWORK_DOCS_URL` before running Vite or building the web image to use another URL; Actions reads the `FRAMEWORK_DOCS_URL` repository variable. Complete Constructor guides remain at `/docs/en/start.html`, covering authoring, projects, AI, fitting, API, storage, operations and quality. The old `/demo/guide.html` opens authoring; Framework's AI/workspace navigation links point to Constructor-owned guides.

The preservation report is in docs/split-preservation.ru.md and the complete source-to-destination map in docs/split-file-audit.json. Optional cross-checkout auditing uses `node scripts/audit-split.mjs --framework-root ../alabuga-framework --with-compose`; normal builds do not require the other repository.

Docker needs ALABUGA_NPM_REGISTRY and ALABUGA_NPMRC_FILE. npm credentials use a BuildKit secret and are not embedded in runtime images. Framework upgrades arrive in separate dependency PRs; library publication never deploys Constructor. See README.md and docs/en/ for checks and rollback.
