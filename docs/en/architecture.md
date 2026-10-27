# Architecture

Constructor pins Framework 1.2.0 and requires at least 1.2.0. UI components initialize only in editor-owned containers and clean up before DOM replacement. DatePicker is enhanced; Select controls retain their native backing field and use the public Framework component. The editable document canvas is not passed to general component initialization.

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

## Documents and rendering

The schema remains version 3. Documents contain sections, elements, positions, backgrounds, typography, actions and motion. Canvas, preview and export use the same runtime. The editor adds authoring controls and maintains change history in EditorModel. Schema imports need no DOM or CSS; rendering and slide measurement require a browser.

## Assets and export

IndexedDB stores images separately from document structure, referenced through stable `asset:` identifiers. The editor adapter resolves them before display and export. Library export also accepts an asynchronous `resolveAsset(id)` function and explicit standalone runtime CSS/JS. It never accesses IndexedDB.

Image processing belongs to framework; storage does not import editor export. The installed npm package already contains the standalone runtime, consumed through public entries without a local library build. CSS, fonts and runtime script are embedded in exported HTML.

## Generation

Request → outline → semantic-slot content → commands → isolated draft → checks → application. AIProvider separates transport from generation. GenerationServices supplies browser slide fitting; the ai package does not import editor UI. Geometry validation is provided as a callback.

The AI panel loads dynamically. Draft changes do not replace the active project before application. Project documents do not include prompts, generation state or diagnostic reports.

## Decisions and limits

There is no server project database, account system or synchronization. The model Docker volume is not a project backup. The AI server executes one request at a time. Changing these constraints requires a separate architectural decision and migration tests, not an implicit extension of this refactor.

## Independent repositories

Framework is now a separate repository publishing @alabuga/framework. Constructor 0.7.0 pins 1.2.0 in its manifests and lockfile; editor, ai and ai-server remain private internal workspaces. Framework releases never release or deploy Constructor. Cross-package access uses public exports. apps/editor/src/framework-adapter.ts centralizes rendering, fitting, built-in resource URLs and DOM editing hooks.

The installed package already provides standalone.css and standalone.js. Constructor never builds Framework. Library DOM/CSS/API compatibility is a SemVer contract documented in Framework docs/public-contract.md. The Framework reference is a separate static website; VITE_FRAMEWORK_DOCS_URL configures its link and CONSTRUCTOR_URL configures return links when building that site. Browser storage and AI stay in Constructor.
