# Quality and limitations

## Validation layers

Unit tests cover schemas, commands, draft isolation, API failures and initialization. Browser regression covers authoring, persistence, recovery, accessibility, images, motion, export and responsive layouts in Chromium, Firefox and WebKit. Dedicated load scenarios use 100 projects and 50 slides containing 500 elements.

Playwright owns a dedicated server on port 4275. It does not reuse the author's Vite on 5173 or built application on 4176. An occupied test port must produce a clear failure rather than attach to an unknown application.

## Real model

```sh
npm run demo
npm run demo:rehearse
```

The rehearsal uses an isolated browser profile: it checks the model, generates a section and slide, edits text, applies results, reopens projects and exports with the network blocked. Reports go to artifacts and should not be committed. Browser tests with a mocked API do not replace this run.

For the built native application, `npm run test:model` starts its own API on port 4386 and stops it afterwards. For Docker, set `AF_CHECK_URL=http://127.0.0.1:4176` before that command (PowerShell: `$env:AF_CHECK_URL='http://127.0.0.1:4176'`). The existing container API remains running. The script also samples nvidia-smi every 250 ms when available and writes gpu-summary.json; compare physical VRAM with Ollama placement metadata. Do not run browser regression, Docker image extraction and inference concurrently on a memory-constrained laptop.

The last pre-refactor free-generation benchmark found 12 of 20 outputs usable by content, while all 20 were technically valid. This is historical evidence, not a guarantee for the current build. Evaluate new runs separately for relevance, completeness, facts and layout. Better geometry does not repair semantic errors.

## Preparing a demonstration

Check the model version and digest, assets and full GPU offload. Run «Проверить сценарий показа» and read both results. Prepare source facts and clearly labelled samples. Demonstrate templates, element editing, live generation, draft review and export. Never present a saved sample as freshly generated output.

## Release and known boundaries

The 7 October 2026 refactor passed 264 browser checks, three additional documentation checks and 57 unit checks. A clean copy built and exported the ten-section website and eleven-slide presentation; Chromium produced an eleven-page PDF. On the RTX 3050 Ti 4 GB, native Vulkan peaked at 2967 MiB; Docker/WSL2 peaked at 3059 MiB, both with full GPU placement and context 4096. Warm Docker generation took 5.079 seconds for the section and 5.562 seconds for the slide; the first cold probe took 66.56 seconds including loading. These are two prepared scenarios, not a new twenty-prompt content-quality benchmark. Reports and raw evidence are kept separately from source.

A release requires a clean installation, full regression, offline HTML, an 11-page PDF, visual review and an explicit list of outstanding checks. Record GPU, first weight download and container memory separately if the environment prevented verification.

Automation does not replace a five-author usability study or a presenter rehearsal. Roles, collaboration, server form handling, web search, image generation and arbitrary author code are outside this release. Report issues with the version, environment, steps, expected behaviour and actual result.

## Split verification

The October 7 measurements above belong to the old monorepo and do not replace current acceptance. Split evidence records 62 unit and 90 Chromium scenarios through installed Chrome, isolated archive consumers, Docker smoke and local Verdaccio recovery. Firefox/WebKit, the real GPU model and production infrastructure remain unverified. See [AI](ai.md) and [projects](projects.md) for the original protocols and clearly dated historical results.
