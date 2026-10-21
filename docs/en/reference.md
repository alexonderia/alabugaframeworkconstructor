# API and format reference

## Public entries

| Import | Main capabilities |
| --- | --- |
| `@alabuga/framework/schema` | AFDocument, Section, Widget, validateDocument, isSafeUrl |
| `@alabuga/framework/runtime` | renderDocument, DocumentController |
| `@alabuga/framework/compositions` | compositionCatalog, makeComposition, changeComposition |
| `@alabuga/framework/layout-variants` | semanticSlots, applyLayoutVariant |
| `@alabuga/framework/slide-fit` | fitSlide, measureSlide, FitSlideOptions, FitSlideResult |
| `@alabuga/framework/export` | exportHTML, ExportOptions |
| `@alabuga/ai` | AIProvider, GenerationRequest, DraftResult, AICommand, generateDraft |

Import CSS explicitly with import '@alabuga/framework/standalone.css'; the JS root does not import styles; the schema entry supports validation in Node.js. Package exports define allowed entries. Never import neighbouring src or dist internals.

```ts
import {validateDocument} from '@alabuga/framework/schema';
import {renderDocument} from '@alabuga/framework/runtime';
const result = validateDocument(input);
if (!result.success) throw new Error(result.issues.map(i => i.message).join('; '));
const controller = renderDocument(host, result.data, {editing: true});
// When closing the document:
controller.destroy();
```

Export accepts `{runtime: {css, script}, resolveAsset?}`. It resolves `asset:<id>` asynchronously. Missing assets produce an error rather than a silent replacement. The resulting HTML does not depend on Ollama or the API. The framework build provides `standalone.css` and `standalone.js` entries for export packaging.

## Formats and compatibility

Documents use `schemaVersion: 3`, `kind: page | presentation`, a title and pages. Portable projects use `format: alabuga-project`, `version: 3`, a document and assets. Imports pass shared validation. Moving source files does not justify a new document version.

GenerationRequest contains kind, scope, count, prompt, audience and sources. DraftResult is stored outside the project document. GenerationServices is supplied through generator options; the browser adapter provides fitSlide. Model requests require a cancellation signal.

## Local HTTP API

| Method and path | Purpose |
| --- | --- |
| GET `/api/ai/health` | API liveness; no model required |
| GET `/api/ai/readiness` | Pinned model readiness and initialization state |
| GET `/api/ai/status` | Version, digest, context and placement |
| GET `/api/ai/diagnostics` | Service state and available GPU information |
| POST `/api/ai/generate` | JSON containing system, prompt and format |

Only one generation runs at a time. Busy requests receive 409, context-budget violations 413, and model errors 502. The server timeout is 120 seconds. The API does not execute user JavaScript or HTML.

## Classes and live examples

Buttons, forms, panel grids and presentations are demonstrated in the [interactive reference]({{FRAMEWORK_DOCS_URL}}). Core classes include `.af-btn`, `.af-field`, `.af-input`, `.af-panel` and `.af-widget`. Corporate variants are selected through documents and composition catalogs, not arbitrary author CSS. The legacy interactive reference is Russian; this manual documents the same public API in English.

## Envelope and resource compatibility

Imports accept bare schema 1–3 documents and alabuga-project envelopes 1–3 or legacy envelopes without version. New exports use envelope 3. Future versions and missing asset:<sha256> materials fail before database writes. npm SemVer, document schemaVersion and envelope version are independent.

assetsBaseUrl is available to rendering, fitting and HTML export. Built-in assets belong to the package; Constructor serves compatible /assets/ URLs. Its storage adapter resolves asset: references. See the [Framework contract]({{FRAMEWORK_DOCS_URL}}docs/en/reference.html).
