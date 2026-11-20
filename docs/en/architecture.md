# Architecture

Constructor pins Framework {{FRAMEWORK_VERSION}} and requires at least {{FRAMEWORK_MINIMUM}}. Documentation builds read these values from package.json. UI components initialize only in editor-owned containers and clean up before DOM replacement. DatePicker is enhanced; Select controls retain their native backing field and use the public Framework component. The editable document canvas is not passed to general component initialization.

`document-surface.ts` hosts the public standalone runtime/CSS inside an iframe. Preview, shared quality checks and exported HTML use the same Framework runtime without copying renderer implementation. The isolation serves document sizing and routing; the iframe contains trusted runtime and a validated AFDocument. Preflight checks website viewports at 1440/768/390 px and slides at 1600 px, blocking export for clipped content or unavailable images.

IndexedDB 3 uses an internal Project.version counter checked atomically for stale writes. BroadcastChannel informs the interface but the transaction enforces protection. Revisions are indexed by project; repeated assets are read in one batch. The material cache retains at most approximately 16 MiB of UTF-16 strings. Save scheduling keeps the active write and latest pending snapshot. Asset deletion checks projects, trash, revisions and AI draft references in one transaction. Write versions and private structure labels do not extend AFDocument.

## Package boundaries

| Package | Responsibility | Dependencies |
| --- | --- | --- |
| framework | Schema, runtime, compositions, fitting, export | Zod; no editor |
| ai | Contracts, commands, generation, content review | Public framework APIs and Zod |
| editor | Gallery, canvas, properties, IndexedDB, AI UI | framework and ai |
| ai-server | HTTP, limits, Ollama, model initialization | Node.js and model configuration |
| docs | Manuals and interactive examples | framework |

Framework publishes an independent npm package. Constructor workspaces stay private; a library change and its application update use separate PRs. Cross-package imports use public exports only. Shared model configuration lives outside the server implementation.

`npm run check:boundaries` enforces package directions: editor may use public ai exports; ai and ai-server cannot import other application workspaces. Cross-workspace relative imports are forbidden, and editor/ai cannot import Node.js built-ins. Document modules (`model`, `sections`, `section-name`, `document-content`, `property-patch`, `editor-save`, `editor-session`) may depend only on each other and public Framework schema/compositions, keeping UI and IndexedDB out of their dependencies. Update their explicit list in `scripts/import-boundaries.mjs` when extracting modules.

The check also detects cycles in relative imports across workspace sources, including type imports, re-exports and literal dynamic imports. Computed paths and runtime dependencies are outside this graph. Negative cases and the command running against an isolated fixture workspace are included in `npm test`.

## Editor session

`editor-session.ts` owns `EditorModel`, the project ID, confirmed write version, `EditorSaveQueue` and `AbortSignal`. Edits, undo/redo, project transitions, conflict copies, reloading saved data and applying a prepared document go through the session. Reading, writing, revisions and notifications are injected through `SessionServices`; the module imports no DOM, UI or IndexedDB.

`main.ts` connects the session to storage and view controllers, wires commands, selected widgets, the active section and navigation. `save-conflict.ts` handles the action dialog and focus. Leaving validates pending forms, drains the queue and creates a recovery revision. Destroying the session cancels handlers and notifications while queued snapshots finish writing. Reads or applications completed after a project switch or disposal cannot replace the active document. Starting a project waits for the previous write and revision; failure retains the current session.

`editor-canvas.ts` owns the Framework controller, rendered document signature, inline bindings, widget tools and handles, overflow hint and scroll preservation. `synchronize` updates renderer data without repainting text while typing. `editor-inspector.ts` owns form drafts, validation states, section/document settings, refresh after inline edits, focus and the responsive drawer. Partial inspector updates do not refill unfinished grid fields. Document changes go through callbacks to the session; the inspector does not call the canvas directly.

Both controllers receive the session signal and dispose their handlers, observers, timers, animation frames and controls. Repeated disposal is safe. Import checks prevent them from directly importing `main`, `editor-session`, `storage` or each other; existing nested forms and material libraries keep their dependencies. Data formats and visible fields are unchanged.

## Documents and rendering

Section names (`page.title`) are outline metadata. The adapter derives a rendering view with blank section names while preserving widget content. Canvas, thumbnails, preview, quality checks and HTML export use this view. The editor model, storage, adapter `getDocument()` and portable JSON retain the original names; slide fitting restores the original name in its result as well.

Document schemas 1–5 are supported. Schemas 1–3 without newer features normalize to 3; independent responsive sizes use schema 4, and slide header/number settings use schema 5. The portable project envelope and IndexedDB remain version 3; these version numbers are independent. Documents contain sections, elements, positions, backgrounds, typography, actions and motion. Canvas, preview and export use the same runtime. The editor adds authoring controls and maintains change history in EditorModel. Schema imports need no DOM or CSS; rendering and slide measurement require a browser.

## Assets and export

`storage.ts` keeps its existing 35 public names and re-exports operations from `storage/`. `db.ts` owns one lazy connection, migrations and the transaction coordinator; `projects`, `revisions`, `drafts` and `settings` own their operations. `assets` prepares, hashes, caches and hydrates materials; `images` traverses references; `maintenance` inspects usage and cleans up; `legacy-import` handles old localStorage. `types` defines records and summaries; `project-state` owns versions, notifications and conflict errors. Import checks enforce directions between these modules and forbid imports back into the facade, UI or session.

Saving a project still uses one projects/summaries/assets/settings transaction; cleanup rechecks references while projects/revisions/settings/assets are locked. Image preparation finishes before opening a transaction. A synchronous exception in its callback now aborts it, preventing an image from being retained without its description when a later write fails. The database name, stores, version 3 and migration algorithms are unchanged.

`project-file/format.ts` parses portable files independently of IndexedDB and UI; `document-validation.ts` provides their shared document validation. Both are protected as pure document modules. `storage/portable-project.ts` prepares portable output after resolving assets. `framework-assets.ts` uses public image preparation APIs without importing the renderer; the Framework adapter keeps its previous re-exports of those functions.

IndexedDB stores images separately from document structure, referenced through stable `asset:` identifiers. The editor adapter resolves them before display and export. Library export also accepts an asynchronous `resolveAsset(id)` function and explicit standalone runtime CSS/JS. It never accesses IndexedDB.

Image processing belongs to framework; storage does not import editor export. The installed npm package already contains the standalone runtime, consumed through public entries without a local library build. CSS, fonts and runtime script are embedded in exported HTML.

## Generation

Request → outline → semantic-slot content → commands → isolated draft → checks → application. AIProvider separates transport from generation. GenerationServices supplies browser slide fitting; the ai package does not import editor UI. Geometry validation is provided as a callback.

The AI panel loads dynamically. Draft changes do not replace the active project before application. Project documents do not include prompts, generation state or diagnostic reports.

## Decisions and limits

There is no server project database, account system or synchronization. The model Docker volume is not a project backup. The AI server executes one request at a time. Changing these constraints requires a separate architectural decision and migration tests, not an implicit extension of this refactor.

## Independent repositories

Framework is now a separate repository publishing @alabuga/framework. Constructor pins {{FRAMEWORK_VERSION}} in its manifests and lockfile; editor, ai and ai-server remain private internal workspaces. Framework releases never release or deploy Constructor. Cross-package access uses public exports. apps/editor/src/framework-adapter.ts centralizes rendering, fitting, built-in resource URLs and DOM editing hooks.

The installed package already provides standalone.css and standalone.js. Constructor never builds Framework. Library DOM/CSS/API compatibility is a SemVer contract documented in Framework docs/public-contract.md. The Framework reference is a separate static website; VITE_FRAMEWORK_DOCS_URL configures its link and CONSTRUCTOR_URL configures return links when building that site. Browser storage and AI stay in Constructor.
