import { readdir, readFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  dependencyErrors,
  findCycles,
  importsOf,
  publicEntry,
  relativeTarget,
  workspaceOf,
} from './import-boundaries.mjs';
const require = createRequire(import.meta.url),
  framework = JSON.parse(
    await readFile(require.resolve('@alabuga/framework/package.json'), 'utf8'),
  );
try {
  await access('packages/framework');
  throw new Error('Framework sources must not exist in Constructor');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const roots = [
    'apps/editor',
    'apps/ai-server',
    'packages/ai',
    'packages/document-core',
    'scripts',
    'tests',
  ],
  errors = [];
const ai = JSON.parse(await readFile('packages/ai/package.json', 'utf8'));
const files = new Set((await Promise.all(roots.map(walk))).flat());
const graph = new Map();
async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true }))
        .filter((e) => !['dist', 'node_modules'].includes(e.name))
        .map((e) => (e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name])),
    )
  ).flat();
}
function check(file, spec) {
  const clean = spec.split('?')[0];
  if (/packages\/framework|alabuga-framework[\\/]src|@alabuga\/framework\/(src|dist)\//.test(clean))
    errors.push(file + ': internal Framework reference ' + spec);
  if (clean === '@alabuga/framework' || clean.startsWith('@alabuga/framework/')) {
    if (!publicEntry(clean, '@alabuga/framework', framework.exports))
      errors.push(file + ': unpublished Framework entry ' + clean);
  }
  errors.push(...dependencyErrors(file, spec, ai.exports));
  if (clean.startsWith('.') && workspaceOf(file)) {
    const target = relativeTarget(file, clean, files);
    if (target && workspaceOf(target)) graph.get(file).add(target);
  }
}
for (const file of files)
  if (
    /\.(ts|mjs|css)$/.test(file) &&
    !file.endsWith('check-boundaries.mjs') &&
    !file.endsWith('import-boundaries.mjs')
  ) {
    if (workspaceOf(file)) graph.set(file, new Set());
    const text = await readFile(file, 'utf8');
    if (/\/packages\/framework\/src\//.test(text))
      errors.push(file + ': Framework source browser URL');
    if (file.endsWith('.css')) {
      for (const m of text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) check(file, m[1]);
      continue;
    }
    for (const spec of importsOf(file, text)) check(file, spec);
  }
for (const cycle of findCycles(graph)) errors.push('Dependency cycle: ' + cycle.join(' -> '));
for (const file of ['package.json', 'apps/editor/package.json', 'packages/ai/package.json']) {
  const p = JSON.parse(await readFile(file, 'utf8')),
    v = p.dependencies?.['@alabuga/framework'];
  const localPin =
    file === 'package.json'
      ? 'file:vendor/alabuga-framework-1.4.0-grid.4.tgz'
      : 'file:../../vendor/alabuga-framework-1.4.0-grid.4.tgz';
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(v) && v !== localPin)
    errors.push(file + ': Framework must use an exact npm version');
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  'Public Framework/AI/core exports, isolated document core, workspace directions, document modules and dependency cycles checked',
);
