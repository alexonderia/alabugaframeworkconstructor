# Development

## Clean installation

Use Node.js 24.19.0 and npm 11.17.0. Configure the private scoped registry and a read token, then run npm ci. Internal workspaces share the root package-lock.json. npm run dev prepares guides and starts Vite; Framework is an already built dependency. Python is needed only for selected reporting scripts.

## Commands

| Command | Result |
| --- | --- |
| `npm run typecheck` | Packages, applications, scripts and test types |
| `npm run check:boundaries` | Forbidden cross-package imports |
| `npm run build:ai` | Generation package |
| `npm run build:editor` | Editor and demonstration |
| `npm run build:docs` | Reference and RU/EN manuals |
| `npm run build:server` | API and initializer executables |
| `npm run build` | Complete release in dist/site |
| `npm test` / `npm run test:ai` | Unit checks |
| `npm run test:browser` | Three browsers on a dedicated server |

Builds read JS/CSS and assets from the installed package. They do not build a neighboring Framework checkout or start a model. Run npm test, npm run test:ai, npm run test:bootstrap, npm run check:docs and npm run test:compatibility. Release smoke checks built output, offline HTML, PDF and screenshots. Font and brand regeneration and requirements-assets.txt belong only to Framework.

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
