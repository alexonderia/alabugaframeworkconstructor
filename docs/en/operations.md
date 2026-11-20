# Docker and operations

## Launch modes

Configure `ALABUGA_NPM_REGISTRY` and `ALABUGA_NPMRC_FILE` using `.env.example` before building. Editing, local projects and export work without a model at `http://127.0.0.1:4176/builder/`.

| Mode | Commands |
| --- | --- |
| Editor without AI | `npm run docker:build`, then `docker compose up -d --no-build --wait web api` |
| Editor with native Ollama | Start the chosen Ollama instance and configure an `AF_OLLAMA_URL` reachable from Docker, then run the web/API commands |
| Editor with containerized Ollama | Set `AF_OLLAMA_URL=http://ollama:11434`, then run `npm run docker:build`, `docker compose --profile ai up -d --no-build --wait web api ollama` and `docker compose --profile ai run --rm model-init` |

With prepared images, start with the launch command. For a fully native editor and AI, use `npm run ai` after model setup. If a Constructor API already responds on the selected port, the command prints the existing editor address. Check model readiness separately in every mode.

`npm run docker:build` records the version from `package.json` and the Git SHA in the OCI labels of both images. A `-dirty` suffix means the build may include working tree changes. CI can pass `AF_REVISION` explicitly in the environment. Diagnostics reads the running build from `/build-info.json` and `/api/ai/health`.

Start the independent Framework reference from its repository with `docker compose -f compose.docs.yaml up --build -d --wait`; its local address is `http://127.0.0.1:4391/`. Set `VITE_FRAMEWORK_DOCS_URL` before building web to use a different address. Constructor guides remain on the application origin at `/docs/en/start.html`.

For source editing with live reload, run `docker compose -f compose.dev.yaml up --build`. Dependencies use a separate volume to avoid mixing Windows and Linux node_modules. After lockfile changes, restarting the container runs npm ci again.

## Initial AI setup

Docker first downloads the Ollama image. The initializer waits for the service, verifies its version and checks `qwen3.5:2b` against config/model-lock.json. Missing weights are downloaded with progress state. The digest is verified again afterwards. A mismatch disables AI; an existing mismatched model is not silently replaced.

The current registry tag differs from the project's previously accepted text-only Q8_0 build. To reproduce that exact build, `config/pinned-model-manifest.json` preserves its original manifest. Initialization downloads the four content-addressed files from the official registry and verifies their sizes and SHA-256 before publishing the manifest. Interrupted files resume through HTTP Range. No weights are committed or included in application images. Do not replace this setup with an unverified `ollama pull qwen3.5:2b`. If a conflicting model already exists, inspect and back it up before explicitly removing its tag; the initializer refuses to overwrite it. The initializer alone runs as root to write the shared Ollama volume; the API runs as the unprivileged node user.

The `ollama-models` volume preserves weights across restarts. Do not use `docker compose down -v` when preserving the model. A prepared installation works offline with cached images and weights; a cold installation needs a network.

## Checks and recovery

`npm run diagnose` reports the editor, API, Ollama as seen by the API, pinned model, Constructor guides and Framework reference. It runs on Node.js 24 without installed dependencies. The application port comes from `AF_WEB_PORT` or `AF_AI_PORT`, with 4176 as the default. Use `--url` for another application address or `--docs-url` for another reference site. For JSON output, run `node scripts/diagnose.mjs --json`.

By default the check requires a reachable editor and matching web/API build versions when both are known. Add `--require-api` for Docker. Check a complete installation with `npm run diagnose -- --require-ai --require-docs` after model initialization and starting the reference site. Exit code 1 indicates a failed required check. Exit code 2 indicates invalid arguments.

```sh
docker compose ps
docker compose logs --tail=100 api
docker compose --profile ai logs --tail=100 model-init
docker compose --profile ai run --rm model-init
```

The final command retries interrupted preparation. Health indicates process liveness; readiness reports model and initialization state separately. A digest mismatch stops release: compare the pinned configuration with the intended model and repeat acceptance. Do not edit the lock solely to suppress an error.

## Environment

| Variable | Purpose |
| --- | --- |
| AF_OLLAMA_URL | Ollama URL; Compose uses http://ollama:11434 |
| AF_AI_HOST / AF_AI_PORT | API bind address and port; native default 127.0.0.1:4176 |
| AF_AI_CONTEXT | 4096; 2048 is allowed for a repeated memory measurement |
| AF_AI_ENFORCE_LOCK | Enabled by default; 0 is reserved for mock-based tests, never acceptance |
| AF_AI_STATE_DIR | Persistent initialization state directory |
| AF_ALLOWED_ORIGINS | Comma-separated frontend origins |
| AF_AI_PROXY | Vite API proxy URL |

For native Ollama, provide an AF_OLLAMA_URL reachable from the container. `host.docker.internal` addresses the host, but a service bound only to host loopback may remain unreachable. Do not expose Ollama to the internet as a workaround; configure internal access or run the editor/API natively.

## GPU and updates

GPU mode requires NVIDIA Container Toolkit on Linux or compatible Docker Desktop/WSL2 configuration. Verify full model placement through Ollama and total VRAM separately. Native Windows/Vulkan results do not validate Linux containers; do not claim a 4 GB configuration passes without measuring it.

Before upgrading, download editable project JSON files: autosave lives in the browser, while HTML is the finished output. Build the new image, check health/readiness, both document formats and export. Roll back using the previous image and compatible projects without removing model storage. The current application supports document schemas 1–5; an older application may not open schema 4/5 features. Operational logs should not include full user prompts or documents.

For a reproducible release, set `AF_WEB_IMAGE=alabuga-web:release-001` and `AF_API_IMAGE=alabuga-api:release-001` in `.env` before `npm run docker:build`. Keep these images until acceptance of the next release. To roll back, restore the previous tags in `.env` and run `docker compose up -d --no-build web api`, keeping the same port, origin and volumes. Before retrying initialization, stop any active model download.

## Independent images and registry

Set ALABUGA_NPM_REGISTRY and ALABUGA_NPMRC_FILE from .env.example for builds. npmrc is a BuildKit secret, never an image layer. Run existing images with compose.yaml without npm credentials or registry access; compose.build.yaml is for builds only. API/web releases form a matching version/commit/digest pair. Deployment uses that pair without rebuilding on the server and restores the previous pair if health checks fail. Production rollback still requires acceptance.

VITE_FRAMEWORK_DOCS_URL sets the independent reference URL before building web; Actions reads repository variable FRAMEWORK_DOCS_URL. Local split verification uses docs port 4391 and application port 4390. These test origins do not replace the user installation on 4176.

Use Framework infra/registry/README.md to configure HTTPS registry hosting, publisher/read accounts, backups, recovery and monitoring. JWTs expire in 30 days; rotate secrets by day 25. Constructor never receives publisher credentials. Framework releases do not deploy the application.

## UI acceptance in Docker

After updating containers, run `npm run test:docker`. The suite uses the already running application at `http://127.0.0.1:4176`; set `AF_ACCEPTANCE_URL` to use a different address. It checks narrow and short viewports, user text spacing, panel roles, focus during responsive command moves and description contrast in interactive cards. It does not run model generation. Results and traces are stored in `artifacts/release/docker-tests`.

This is automated UI verification. It does not replace acceptance with an on-screen keyboard on a real phone, screen-reader testing or author sessions.
