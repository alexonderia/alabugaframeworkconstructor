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

The AI dialog uses one column at widths up to 1023 px or heights up to 500 px. Application actions follow properties without covering them. Presentation previews reserve a 16:9 area before the renderer's first ResizeObserver callback. Properties receive `current` to merge into the latest draft; duplication also reads the current widget. `tests/editor-dialogs.spec.ts` exercises these flows and focus restoration through public UI, including Docker; model responses are mocked.

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
