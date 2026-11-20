import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);

test('diagnostics checks the selected launch mode and rejects mismatched web/API builds', async () => {
  let ready = false;
  let serveApi = true;
  let serveEditor = true;
  let serveDocs = true;
  const build = { version: '0.7.0', revision: 'test-revision' };
  let apiRevision = build.revision;
  const server = createServer((request, response) => {
    const write = (body, mime = 'text/html') => {
      response.setHeader('Content-Type', mime);
      response.end(body);
    };
    const json = (value) => write(JSON.stringify(value), 'application/json');
    const path = request.url;
    if (path === '/builder/' && serveEditor) return write('<html><div id="builder"></div></html>');
    if (path === '/docs/ru/start.html') return write('<html><title>Начало работы — Alabuga Constructor</title></html>');
    if (path === '/reference/' && serveDocs) return write('<html><title>Alabuga Framework</title></html>');
    if (path === '/absent/') response.statusCode = 404;
    if (path === '/build-info.json') return json({ ...build, frameworkDocsUrl: base + '/reference/' });
    if (path === '/api/ai/health' && serveApi) {
      return json({ status: 'ok', build: { ...build, revision: apiRevision } });
    }
    if (path === '/api/ai/readiness' && serveApi) {
      return json(ready
        ? { ready, model: 'qwen3.5:2b', ollama: { reachable: true, version: '0.35.0' } }
        : { ready, ollama: { reachable: false }, reason: 'ollama-unavailable' });
    }
    return write('<html><title>Fallback</title></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function check(...flags) {
    const args = ['scripts/diagnose.mjs', '--url', base, '--json', ...flags];
    try {
      const { stdout } = await exec(process.execPath, args);
      return { code: 0, ...JSON.parse(stdout) };
    } catch (error) {
      if (error.code !== 1) throw error;
      return { code: 1, ...JSON.parse(error.stdout) };
    }
  }
  try {
    const editor = await check('--require-api', '--require-docs');
    assert.equal(editor.code, 0);
    assert.equal(editor.buildPair, 'match');
    assert.equal(editor.checks.ollama.state, 'unavailable');
    assert.equal(editor.checks.frameworkDocs.url, base + '/reference/');
    assert.equal((await check('--require-ai')).code, 1);
    ready = true;
    assert.equal((await check('--require-ai')).code, 0);
    serveDocs = false;
    assert.equal((await check('--docs-url', base + '/absent/', '--require-docs')).code, 1);
    apiRevision = 'different';
    const mismatch = await check();
    assert.equal(mismatch.code, 1);
    assert.equal(mismatch.buildPair, 'mismatch');
    serveApi = false;
    const staticOnly = await check();
    assert.equal(staticOnly.code, 0);
    assert.equal(staticOnly.checks.api.state, 'unavailable');
    assert.equal((await check('--require-api')).code, 1);
    serveEditor = false;
    assert.equal((await check()).code, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('native launch reuses an existing Constructor API even when its AI is unavailable', async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/ai/health') response.end('{"status":"ok"}');
    else {
      response.statusCode = 503;
      response.end('{}');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const { stdout } = await exec(process.execPath, ['--import', 'tsx', 'scripts/start-ai.ts', '--demo'], {
      env: { ...process.env, AF_AI_PORT: String(port), AF_OLLAMA_URL: `http://127.0.0.1:${port}` },
      timeout: 5000,
    });
    assert.match(stdout, new RegExp(`http://127\\.0\\.0\\.1:${port}/demo/`));
    assert.deepEqual(requests, ['/api/ai/health']);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
