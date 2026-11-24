import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  dependencyErrors,
  findCycles,
  importsOf,
  relativeTarget,
  publicEntry,
} from '../scripts/import-boundaries.mjs';

const aiExports = {
  '.': './src/index.ts',
  './contracts': './src/contracts.ts',
  './commands': './src/commands.ts',
};

test('the boundary command rejects forbidden imports and cycles in a complete workspace fixture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'constructor-boundaries-'));
  const script = fileURLToPath(new URL('../scripts/check-boundaries.mjs', import.meta.url));
  const put = async (path, content) => writeFile(join(root, path), content);
  const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  try {
    for (const dir of [
      'apps/editor/src',
      'apps/ai-server/src',
      'packages/ai/src',
      'packages/document-core/src',
      'scripts',
      'tests',
    ])
      await mkdir(join(root, dir), { recursive: true });
    for (const path of ['package.json', 'apps/editor/package.json', 'packages/ai/package.json'])
      await put(
        path,
        JSON.stringify({ dependencies: { '@alabuga/framework': '1.3.1' }, exports: aiExports }),
      );
    await put('apps/editor/src/entry.ts', "import type {Draft} from '@alabuga/ai/contracts';");
    await put(
      'apps/editor/src/model.ts',
      "import type {AFDocument} from '@alabuga/framework/schema';",
    );
    await put('apps/editor/src/ui.ts', 'export {};');
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    await put('apps/editor/src/model.ts', "export * from './ui';");
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /document modules cannot import UI or persistence/);
    await put('apps/editor/src/model.ts', 'export {};');
    await put('apps/editor/src/entry.ts', "import './feature';");
    await put('apps/editor/src/feature.ts', "const load=()=>import('./entry');");
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Dependency cycle: .*entry.ts -> .*feature.ts -> .*entry.ts/);
    await put('apps/editor/src/feature.ts', "export * from '@alabuga/ai/src/contracts';");
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unpublished AI entry/);
    await put('apps/editor/src/feature.ts', "export * from '../../../packages/ai/src/contracts';");
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cross-workspace relative import/);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'constructor-boundaries-')));
    await rm(root, { recursive: true, force: true });
  }
});

test('dependency policy permits documented package directions and rejects reversed or private imports', () => {
  assert.deepEqual(
    dependencyErrors('apps/editor/src/ai/panel.ts', '@alabuga/ai/contracts', aiExports),
    [],
  );
  assert.deepEqual(
    dependencyErrors(
      'apps/ai-server/src/bootstrap.ts',
      '../../../config/model-lock.json',
      aiExports,
    ),
    [],
  );
  assert.deepEqual(dependencyErrors('packages/ai/src/generate.ts', './contracts', aiExports), []);
  assert.deepEqual(
    dependencyErrors('packages/ai/src/contracts.ts', '@alabuga/framework/schema', aiExports),
    [],
  );
  for (const [file, specifier] of [
    ['packages/ai/src/generate.ts', '../../../apps/editor/src/ui'],
    ['packages/ai/src/generate.ts', '@alabuga/editor'],
    ['apps/ai-server/src/ai-server.ts', '@alabuga/ai'],
    ['apps/editor/src/ai/panel.ts', '../../../../packages/ai/src/contracts'],
    ['apps/editor/src/ai/panel.ts', '@alabuga/ai/src/contracts'],
    ['apps/editor/src/app.ts', 'fs'],
    ['packages/ai/src/generate.ts', 'node:fs'],
    ['packages/document-core/src/grid.ts', '@alabuga/framework/grid'],
    ['packages/document-core/src/grid.ts', '@alabuga/ai'],
    ['packages/document-core/src/grid.ts', '../../../apps/editor/src/model'],
    ['apps/editor/src/grid-change.ts', '@alabuga/framework/grid'],
    ['apps/editor/src/model.ts', '@alabuga/document-core/src/grid'],
    ['apps/editor/src/model.ts', './storage'],
    ['apps/editor/src/model.ts', './ui'],
    ['apps/editor/src/editor-session.ts', './storage'],
    ['apps/editor/src/editor-session.ts', './save-conflict'],
    ['apps/editor/src/editor-canvas.ts', './storage'],
    ['apps/editor/src/editor-canvas.ts', './editor-inspector'],
    ['apps/editor/src/editor-inspector.ts', './editor-session'],
    ['apps/editor/src/editor-inspector.ts', './main'],
    ['apps/editor/src/editor-canvas.ts', './storage/projects'],
    ['apps/editor/src/storage/db.ts', './projects'],
    ['apps/editor/src/storage/db.ts', '../storage'],
    ['apps/editor/src/storage/assets.ts', '../framework-adapter'],
    ['apps/editor/src/storage/projects.ts', '../editor-session'],
    ['apps/editor/src/storage/settings.ts', './maintenance'],
    ['apps/editor/src/project-file/format.ts', '../storage/db'],
    ['apps/editor/src/model.ts', '@alabuga/framework/runtime'],
    ['tests/example.ts', '../../outside/file'],
  ])
    assert.ok(
      dependencyErrors(file, specifier, aiExports).length,
      `${file} must reject ${specifier}`,
    );
  assert.deepEqual(dependencyErrors('apps/editor/src/sections.ts', './model', aiExports), []);
  assert.deepEqual(
    dependencyErrors('apps/editor/src/model.ts', '@alabuga/framework/schema', aiExports),
    [],
  );
});

test('import collection includes type queries, dynamic imports, re-exports and requires', () => {
  const source = `
 import type {Document} from './schema';
 export * from './exports';
 type Draft=import('./contracts').Draft;
 const load=()=>import(\`./panel\`);
 const model=require(('./model' as string));
 import state=require('./state');
 const text="import './not-an-import'";
 `;
  assert.deepEqual(importsOf('fixture.ts', source), [
    './schema',
    './exports',
    './contracts',
    './panel',
    './model',
    './state',
  ]);
});

test('cycle detection reports a complete dependency path without flagging a shared dependency', () => {
  const graph = new Map([
    ['a', ['b', 'c']],
    ['b', ['c']],
    ['c', []],
  ]);
  assert.deepEqual(findCycles(graph), []);
  graph.set('c', ['a']);
  assert.deepEqual(findCycles(graph), [['a', 'b', 'c', 'a']]);
  assert.deepEqual(findCycles(new Map([['self', ['self']]])), [['self', 'self']]);
});

test('relative resolution handles directories and query imports and export patterns keep their suffix', () => {
  const files = new Set(['apps/editor/src/ui.ts', 'apps/editor/src/feature/index.ts']);
  assert.equal(
    relativeTarget('apps/editor/src/app.ts', './ui?raw', files),
    'apps/editor/src/ui.ts',
  );
  assert.equal(
    relativeTarget('apps/editor/src/app.ts', './feature', files),
    'apps/editor/src/feature/index.ts',
  );
  assert.equal(relativeTarget('apps/editor/src/app.ts', './missing', files), undefined);
  assert.equal(publicEntry('@alabuga/ai/contracts', '@alabuga/ai', aiExports), true);
  assert.equal(publicEntry('@alabuga/ai/src/contracts', '@alabuga/ai', aiExports), false);
  assert.equal(
    publicEntry('@example/pkg/icons/arrow.svg', '@example/pkg', {
      './icons/*.svg': './icons/*.svg',
    }),
    true,
  );
  assert.equal(
    publicEntry('@example/pkg/icons/arrow.ts', '@example/pkg', {
      './icons/*.svg': './icons/*.svg',
    }),
    false,
  );
});
