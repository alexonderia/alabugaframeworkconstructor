# Local AI assistant

Before generation, the interface shows checking, preparation, ready or unavailable state. Generation requires confirmed readiness; failed checks can be retried. Result commands appear when a draft exists. On phones, «К результату и замечаниям» jumps to progress and issues. Current errors are brought into view; installation commands belong to administrator help.

Detailed material moved from the former reference chapter. Measurements dated October 2, 2026 below are historical. On October 26 a separate technical rehearsal exercised Docker → pinned Ollama 0.35.0 / Qwen3.5-2B Q8_0 → Vulkan on RTX 5060 Laptop 8 GB. The model stayed entirely on GPU at context 4096. Generation, isolated editing, application, reopening and offline HTML passed for a section and slide; warmed generation took 3.401 and 3.919 s. The cold section probe including model loading took 25.238 s; its subsequent slide probe took 3.710 s. Peak total GPU use was 4938 of 8151 MiB across 166 samples. Evidence: `artifacts/ai/diagnostics/real-model/report.json` and the adjacent `gpu-summary.json`. This checks two tasks on a different device; acceptance on the target RTX 3050 Ti 4 GB remains open; the subsequent 20-task content evaluation is reported below.

## Continued content evaluation — October 26, 2026

After instruction and source-selection fixes, a complete run of the unchanged 20 tasks produced **16/20 technical passes and 14/20 usable drafts** in agent review. The **18/20 target remains unmet**. Six pre-recorded control tasks about another editor, List, produced **6/6 technical and 4/6 editorial passes**, counted separately. Control responses were not used to tune the code afterward. Evidence: `artifacts/ai/instructions/checked/report.html` and `holdout/report.html`. These are individual runs, not combined successes from several attempts.

New fragment headings can improve during filling; headings confirmed in the outline or explicitly quoted by the author stay fixed. If an illustration name replaces content, repair falls back to the planned heading. Website/presentation comparisons can assemble cells from source facts about the same property. For cards and workflow steps, the application can derive independent affirmative actions while retaining their source actor; sentences with negation or conditions are not split. Different cards receive different permitted source points. These parts are assembled by the application rather than freely written by the model.

Card-label/explanation alignment, individual steps and comparisons of arbitrary entities still fail. The main set also retains failures in offline explanation, a divider with wrong units, three capabilities, mobile instructions and repeated parts of a whole deck. Authors must review content.

## Content evaluation — October 26, 2026

Three real Qwen runs used the original 20 tasks and unchanged source facts on RTX 5060 Laptop 8 GB. Baseline: 16/20 technical passes and 10/20 usable drafts; intermediate: 18/20 and 12/20; final after fixes and stricter checks: **15/20 technical, 11/20 editorial**. The **18/20 criterion was not met**. Agent review followed a rubric recorded before the runs, using unedited responses; this is neither author research nor an independent holdout set. All runs remain in `artifacts/ai/quality/`; final evidence is `final/report.html`, `final/acceptance.json` and `final/review.json`.

Fixes retain section topics separately from the outline premise, avoid pasting a shared source sentence into different cards and omit unused metric slots. The model can select a short relevant source paragraph for verbatim insertion; the interface discloses this. New checks block some wrong-topic responses, descriptions substituted for instructions, reordered word filler and storage/display-format confusion. Weak headings, individual steps, comparisons and complete documents remain open. Technical readiness does not imply editorial suitability.

## Drafts and historical acceptance

Qwen3.5-2B creates editable sections and slides from corporate compositions. It first creates an isolated draft; the project changes only after «Применить черновик». Generation, editing, restoration, application and undo work, but content acceptance is a separate requirement.

The original interactive guide recorded October 2, 2026: 16/20 technical passes and 12/20 usable drafts, against a target of 18/20. The later pre-refactor guide recorded 20 technically valid responses with the same 12 usable drafts. These are distinct historical runs, not current post-split measurements. The model may omit requested points, repeat phrases or leave example text. Service phrases block application until fixed; authors verify every fact.

On the historical RTX 3050 Ti Laptop run, context 4096 placed the model entirely on GPU, with peak total use 2967 MiB out of 4096. Sections took 3–9 seconds, a five-section draft 30.6 s and six slides 35.3 s; both larger drafts needed editing. Original evidence lives in artifacts/ai/report.html and runtime.json when generated. Edited showcase HTML/PDF are not scored as raw model output. These pre-split numbers remain historical; the October 26 device check is reported separately above.

## Install and run

```sh
npm run ai:setup
npm run ai
```

Native setup needs Windows x64, Python 3, Node.js 24.19.0/npm 11.17.0 and network access. It installs official Ollama 0.35.0 under .local/ollama with the compact Vulkan backend, and qwen3.5:2b under .local/models. Archive entries are checked by size/CRC and installed SHA-256 values recorded in installation.json. An existing Ollama on localhost:11434 may be used instead. Docker uses its pinned initializer; see [operations](operations.md).

Open the [editor](/builder/). Prepared weights run offline. For development start npm run ai:server and npm run dev; /api/ai requests are proxied to the local API.

## Create a document

1. Select «Создать с ИИ» and choose a section, slide, page of up to five sections, or deck of up to six slides.
2. Describe the topic and audience. Supply verified facts, contacts and links.
3. Optionally select up to six images. Add descriptions: the model receives text, not pixel analysis.
4. Generate a draft and inspect content and issues. Edit text on its canvas and properties below it.
5. Retry a section if needed. «Продолжить» retains completed sections and the previous brief; «Создать черновик» starts over using current fields.
6. Verify the content, confirm that review and apply. A fragment is one undoable insertion; a complete document becomes a new project.

Example brief: create six slides for content authors covering the visual constructor, consistent corporate style, ready compositions, editing, preview and export. Supply these facts: Constructor runs locally in the browser, uses IndexedDB projects, provides editable text/images and HTML export, and presents slides in 16:9.

## Memory and speed

The target device is RTX 3050 Ti Laptop with 4 GB VRAM. Context starts at 4096, one request runs at a time, reasoning is disabled. num_gpu=99 requests all layers on GPU: automatic placement reserves image-processing memory and historically moved part of this model into RAM. File size is not VRAM usage. config/model-lock.json pins the accepted build; /api/ai/diagnostics reports runtime state.

```powershell
$env:AF_AI_CONTEXT='2048'
npm run ai
```

RAM offload does not pass the full-GPU requirement. If neither context works, record the device limitation; no other model is selected automatically.

## Contracts and safety of execution

AIProvider isolates transport. GenerationRequest specifies mode, brief, audience and source facts; GenerationProgress reports progress; DraftResult stores structure, sections and issues separately from AFDocument. AICommand supports createSection, setText, setCards, setMetric, setImage, setGallery, setQuote, setButton and setTable. Composition variants supply color/motion; application code creates IDs and grid positions.

Output is constrained by JSON Schema, command execution and the document validator. The model does not execute code. Documents remain schema 3; AI state is stored separately in IndexedDB. Exported HTML has no Ollama dependency.

## Errors and recovery

- Ollama or model unavailable: run ai:setup or inspect the Docker initializer.
- Context budget exceeded: reduce source facts or selected assets; inputs are never silently truncated.
- Timeout: requests stop after 120 seconds, completed sections stay in the draft.
- Overflow or invalid commands: one automatic repair attempt per section, then manual editing or retry.
- Insertion target removed or project changed: reopen from the intended section and select insertion after it.
- Draft save failed: no saved status is shown and application is blocked until writing succeeds.

```sh
npm run test:ai
npx playwright test tests/ai.spec.ts
# Keep the real AI/API running for this separate acceptance run.
npm run ai:acceptance
```

Unit/browser tests use explicit mock responses. ai:acceptance calls the real model for 20 Russian briefs and saves artifacts/ai results. These checks do not replace one another. Verify factual content and Russian-language quality before publishing. See [quality](quality.md).
