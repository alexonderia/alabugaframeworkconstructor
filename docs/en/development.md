# Development

## Clean installation

Use Node.js 24.19.0 and npm 11.17.0. Configure the private scoped registry and a read token, then run npm ci. Internal workspaces share the root package-lock.json. npm run dev prepares guides and starts Vite; Framework is an already built dependency. Python is needed only for selected reporting scripts.

## Commands

| Command | Result |
| --- | --- |
| `npm run typecheck` | Packages, applications, scripts and test types |
| `npm run check:boundaries` | Forbidden cross-package imports |
| `npm run check:ui` | Token bindings and absence of local control visual overrides |
| `npm run build:ai` | Generation package |
| `npm run build:editor` | Editor and demonstration |
| `npm run build:docs` | Reference and RU/EN manuals |
| `npm run build:server` | API and initializer executables |
| `npm run build` | Complete release in dist/site |
| `npm test` / `npm run test:ai` | Unit checks |
| `npm run test:browser` | Three browsers on a dedicated server |
| `npm run test:docker` | UI acceptance against the running Docker release in three browsers |

Builds read JS/CSS and assets from the installed package. They do not build a neighboring Framework checkout or start a model. Run npm test, npm run test:ai, npm run test:bootstrap, npm run check:docs and npm run test:compatibility. Release smoke checks built output, offline HTML, PDF and screenshots. Font and brand regeneration and requirements-assets.txt belong only to Framework.

## Framework interface and styles

FR-UI-01 applies to generated sites and presentations and to Constructor itself: the editor, gallery, trash, libraries, history, AI, dialogs, demo and both documentation locales. Use public components, classes and tokens from the installed Framework. Create shared buttons and dialogs through `apps/editor/src/ui.ts` and fields through `ui-fields.ts`.

Constructor owns panel placement, responsive layout and domain behaviour. Framework owns the typography, colours, borders and states of basic controls. Choose sizes through library variants; do not redefine public `--af-*` tokens or copy visual recipes into local CSS. When a variant is missing, use suitable existing components or publish a shared Framework change first.

`mountControls` connects the public Select and DatePicker components to trusted controls, observes added/removed fields and disposes handlers on close. Framework supports changing option sets; do not globally disable enhancement with `data-af-select-native`. Use `.af-label` for field labels, `.af-check` with `.af-checkbox`/`.af-radio` for choices, and `.af-card`/`.af-badge` for cards and counts.

`npm run build` includes `check:ui`, checking CSS and control classes in TS/HTML markup. `tests/ui-framework.spec.ts` compares controls and states against isolated Framework CSS. Standalone HTML continues to use the Framework runtime and stylesheet without shell styles.

## Editor layout

The inspector header sits outside `.inspector-body`; only the body scrolls. A single `.settings-group-body` owns each group’s spacing; avoid broad rules such as `.property-group > div`. Command bars use the Framework medium size, the compact header uses `--sm`, and the phone footer uses `--lg`.

Selected block handles remain available in narrow containers without hover. They retain their screen size while zooming and stay inside the visible canvas, accounting for the phone footer. Do not hide them with media/container queries. `tests/editor-layout.spec.ts` checks geometry, occlusion and real resizing, including against Docker.

Create shared dialog headers with `dialogHeader`. Closing restores the initiating control even when applying changes recreated it. Slide fitting scrolls `.fit-body`, keeping its header and actions separate. Actions must not shrink until their labels overlap.

Use `libraryDialog` for materials, history, quality checks and storage: the heading stays outside `.library-dialog-body`, and storage actions sit in a separate `.library-dialog-actions`. Only the body scrolls. Long names and URLs wrap inside the dialog; cards and list rows can grow vertically. `tests/library-dialogs.spec.ts` covers widths from 320 px to desktop and a short 844×390 viewport, closing after scrolling, deletion and reopening, revision restoration with Undo, persisted descriptions/backgrounds and navigation to a problem widget. These scenarios also run in `test:docker`.

`dialogFrame` returns `{dialog, body}` for gallery dialogs: append content to `body` and keep actions in a separate footer. Creation and rename submit buttons use the native `form` attribute so Enter still submits. Rename restores focus to the same project's card menu by its identifier, including after the gallery refreshes. Gallery notifications are cleared after an allowed route change so a stale Undo action cannot cover editor commands. Composition and layout pickers also use `libraryDialog`; their grid minimum cannot exceed the dialog body's width. `tests/project-dialogs.spec.ts` covers these actions, cancellation, name validation, both creation formats, apply/Undo and increased text spacing; it is included in Docker acceptance.

The AI dialog uses one column at widths up to 1023 px or heights up to 500 px. Application actions follow properties without covering them. Presentation previews reserve a 16:9 area before the renderer's first ResizeObserver callback. Properties receive `current` to merge into the latest draft; duplication also reads the current widget. `tests/editor-dialogs.spec.ts` exercises these flows and focus restoration through public UI, including Docker; model responses are mocked.

The persistent `#catalog` also separates its heading from `.library-dialog-body`; reopening and switching between blocks/sections preserve the normal control lifecycle. `libraryDialog` makes its scrolling body a named region with `tabindex=0`, allowing keyboard scrolling even when explanations contain no fields or buttons. The private outline name uses a separate form with an external submit button and restores focus to the row menu; only browser settings change. Save conflicts keep all three actions outside the scrolling body; write errors use `role=alert` and allow retry. Actions and closing are disabled while a write is pending. A separate copy reserves room for the “ — копия” suffix within the 200-character title limit. `tests/editor-recovery-dialogs.spec.ts` covers catalog/Undo, saving/resetting the private name, write failures and two actual tabs, including downloading an unsaved document, reading the latest stored version and scrolling explanations with Tab/Home/PageDown. These scenarios are included in Docker acceptance.

Showcase diagnostics uses `libraryDialog`: closing stays in the header while commands, the report and samples scroll inside the body. Closing aborts the current request and restores focus; reopening starts an independent check. Demo sample containers enter the page before rendering; slide viewports reserve their 16:9 proportions to avoid a ResizeObserver height cycle in WebKit. `tests/demo-diagnostics.spec.ts` covers narrow/short windows, text spacing, axe, keyboard access, both samples, request cancellation and retry after connection or storage failures. These browser tests mock the model API; real acceptance runs separately through `test:model`.

Publishing `bootstrap.json` keeps atomic replacement and briefly retries `EPERM`, `EACCES` or `EBUSY`: a Windows reader or virus scanner can temporarily hold the file open. Other errors propagate immediately; replacement is limited to six attempts. Temporary-lock and permanent-failure checks live in `tests/bootstrap.test.ts`.

Generation sends the section topic separately from the outline premise; author-edited purpose remains in the request as additional guidance. `contentFormat` can reference a whole relevant source fact for short prose; a source sentence shared by several cards does not lock their explanations to the same text. An explicit measurement list after a colon fixes values and units and leaves extra slots empty. Content checks examine prose and cards without the section heading so the heading cannot conceal an unrelated explanation. These checks are heuristics; reviewing 20 raw responses is separate.

`ai:acceptance` supports `AF_BROWSER_CHANNEL`, `AF_TEST_URL`, `AF_AI_TEST_URL` and `AF_AI_REPORT_DIR`, retaining API requests/schemas/responses and implementation hashes. Incomplete or technically failing runs exit nonzero. This script calls the shared generator through a dev server; `test:model` separately exercises built Docker through public UI. `ai:report` uses the same directory, binds `review.json` to the completion time in `acceptance.json` and cannot declare 18/20 on an incomplete set. Run report checks with `npm run test:ai-report` (Python 3).

Content requests put a compact field contract, priority evidence and delivery requirements in the model context. `rankedFacts` accounts for editor actions; new outlines align source premises to their topic before author review. Resuming preserves author-edited purpose. New unreviewed headings stay free; quoted headings, reviewed outlines and repairs of copied material names keep them fixed.

`sourceEvidence` preserves original sentences and can add independent actions from an unambiguous affirmative list with a known actor. Negation, conditions and unsupported prefixes disable splitting. Card references use disjoint permitted source groups; original input remains in the request. `source-table` only accepts short same-property facts belonging to the correct format, without shortening them or inventing values. Results still become the existing commands and Document schema 3. Repeating a whole paragraph across sections triggers one repair; already-used source prose remains available for paraphrasing.

`AF_AI_CASES=1,2` runs an explicitly marked debug subset, which cannot count as 20-task acceptance. `AF_AI_TASKS_FILE` supplies a different fixture with `label`, `sources`, `cases` and optional `count`. Control inputs and criteria are retained in `artifacts/ai/instructions/holdout-input.json`. By default the script owns its temporary dev server, so termination of an external server cannot interrupt acceptance. The HTML report counts a control set separately from the 18/20 target.

## Adding an element or composition

Define an element in the schema and shared renderer, then add editor properties and documentation examples. A composition defines semantic slots, supported components, grid variants and text limits. Test identifier preservation, layout switching, export and mobile order. Public APIs must not depend on editor internals.

A provider implements AIProvider, returns data matching the supplied schema and honours AbortSignal. Test malformed JSON, timeouts, cancellation and unavailable services. Measurement and layout remain constructor responsibilities.

## Pull requests

Use a small branch for one task. Describe the problem, resulting behaviour, compatibility and validation. Include screenshots for visual changes, old-document tests for schema changes and negative scenarios for APIs. Shared-library changes require consumer tests. Update Russian and English documentation together.

Do not commit model weights, local projects, secrets or complete test-artifact directories. Assign area owners after creating the repository; this preparation does not invent GitHub usernames.

## Updating Framework

Update the root, apps/editor and packages/ai manifests to one exact version and commit the root lockfile. scripts/select-framework-version.mjs accepts an explicit version or --minimum for compatibility checks. Publish schema/runtime changes in Framework first, then accept them in an independent Constructor PR. npm link, file:, Git dependencies and source aliases are prohibited. configure-registry.mjs relocates the archive URL without changing its version or integrity.

Dependabot checks daily at 09:00 Europe/Moscow. Configure the real HTTPS endpoint in .github/dependabot.yml and separate read secrets for Actions/Dependabot. Automerge and deployment triggered by a Framework release are not enabled.

The optional scripts/validation-report.py PDF report uses PyMuPDF: python -m pip install -r scripts/requirements-reports.txt.

## Responsive sizes and accessibility

Constructor pins Framework 1.2.0 in every workspace and the lockfile. `widget.responsive.tablet/mobile` is a public library contract; Framework source is never copied into the app. `editor-responsive.spec.ts` covers independent sizing, validation, screen switching, undo, save, reopen and offline HTML. Native Chrome zoom requires a separate OS keyboard run; canvas CSS zoom and a reduced viewport are different checks. NVDA runs as an actual Windows process with captured speech logs. Touch emulation does not establish physical phone or on-screen keyboard acceptance.
