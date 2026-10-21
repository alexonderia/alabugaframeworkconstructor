# Getting started

Alabuga Constructor is a local visual editor for responsive websites and 16:9 presentations. Authors combine corporate compositions and editable elements. Version 0.7.0 does not include accounts, cloud publishing or collaborative document editing.

## Requirements

Development requires Node.js 24, npm 11 and Git. Exact tool versions are recorded in `.node-version` and `package.json`. Containers require Docker Compose v2. Ordinary editor development needs neither Python, Ollama nor a GPU. Prepared fonts and corporate assets come from the installed Framework npm package; Constructor does not keep their source copy.

## Editor without AI

```sh
node scripts/configure-registry.mjs https://YOUR_REGISTRY/
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/builder/` or `/demo/`. Vite prints the actual address; specify an available port explicitly if necessary. Browser projects belong to an origin, including its port.

## Built application

```sh
npm run build
npm run ai:server
```

Open `http://127.0.0.1:4176/demo/`. The API serves the application even when no model is running. For a native Windows demonstration that starts an installed Ollama, use `npm run demo`. Initial native installation uses `npm run ai:setup`.

## Docker

```sh
docker compose -f compose.yaml -f compose.build.yaml up --build -d
docker compose -f compose.yaml -f compose.build.yaml --profile ai up --build -d
```

The first command starts the application without a model. The second also prepares Ollama and Qwen3.5-2B. The initial run needs internet access for images and weights; later runs reuse a persistent volume. See [Operations](operations.md) for GPU requirements and recovery.

## Your first result

In the project gallery choose «Создать сайт» or «Создать презентацию». Select a sample, replace its heading, preview it, then download a portable project and HTML. Projects remain editable; HTML is for presenting the result. See the [Author guide](author.md). The application UI currently remains Russian; this manual names actual controls.

Authors must verify AI-generated claims. A technically valid draft is not a guarantee of factual accuracy.

## Registry and documentation

Configure the scoped registry and a read token in your user npm config before installation. Never commit tokens. The prepared local registry is http://127.0.0.1:4873/; NPM_CONFIG_USERCONFIG can point to its read config. Only installation and builds require registry access; the built application does not.

Documentation opens the independently deployed [interactive Framework reference]({{FRAMEWORK_DOCS_URL}}). Set VITE_FRAMEWORK_DOCS_URL when building Constructor. Application guides remain here: [AI](ai.md), [projects and assets](projects.md), [slide fitting](slide-fit.md).
