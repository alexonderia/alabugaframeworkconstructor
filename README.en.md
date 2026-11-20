# Alabuga Constructor

The existing repository remains the main Constructor repository. Framework is independently maintained at https://github.com/alexonderia/alabuga-framework and installed as an exact npm dependency. No Framework source checkout or build is required.

Use Node.js 24.19.0/npm 11.17.0. Configure the private registry with `node scripts/configure-registry.mjs https://YOUR_REGISTRY/`, provide a read token in user npm config, then run `npm ci`, `npm run dev`. Open http://127.0.0.1:5173/demo/. Build with `npm run build`; serve using `npm run ai:server` at the existing http://127.0.0.1:4176 origin.

Editor, AI integration, server, document storage and independent application CI/CD live here. The model pin is preserved. Document schemas 1–5 are supported: legacy schemas 1–3 normalize to 3, responsive sizes use 4, and slide header/number settings use 5. IndexedDB alabuga-workspace and portable project envelopes are both version 3. Download editable project JSON files before changing origin; HTML is the finished output, and Docker volumes do not contain browser projects. Unknown future project/document versions fail before storage writes.

As in the original application, `/` and `/index.html` open the Framework reference. They now redirect to the independently deployed `VITE_FRAMEWORK_DOCS_URL`, preserving query parameters and section hashes. Legacy `/demos/{panel,form,slides,showcase}.html` URLs open the corresponding independent examples. Constructor contains redirect pages only, never Framework documentation/example sources.

The demo's Documentation link opens the independent Framework reference with search, components and live examples. Its local URL is http://127.0.0.1:4391/; start it from the Framework repository with `docker compose -f compose.docs.yaml up --build -d`. Set `VITE_FRAMEWORK_DOCS_URL` before running Vite or building the web image to use another URL; Actions reads the `FRAMEWORK_DOCS_URL` repository variable. Complete Constructor guides remain at `/docs/en/start.html`, covering authoring, projects, AI, fitting, API, storage, operations and quality. The old `/demo/guide.html` opens authoring; Framework's AI/workspace navigation links point to Constructor-owned guides.

The preservation report is in docs/split-preservation.ru.md and the complete source-to-destination map in docs/split-file-audit.json. Optional cross-checkout auditing uses `node scripts/audit-split.mjs --framework-root ../alabuga-framework --with-compose`; normal builds do not require the other repository.

For Docker, configure `ALABUGA_NPM_REGISTRY` and `ALABUGA_NPMRC_FILE` using `.env.example`. Run `npm run docker:build`, then `docker compose up -d --no-build --wait web api`. Check the services with `npm run diagnose -- --require-api`. See the [operations guide](docs/en/operations.md) for Ollama and documentation setup.
