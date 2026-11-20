import postcss from 'postcss';
import { posix } from 'node:path';
import { importsOf } from './import-boundaries.mjs';

export const styleEntries = {
  'apps/editor/src/app.ts': {
    module: 'apps/editor/src/styles/editor.ts',
    styles: [
      'apps/editor/src/styles/shared.css',
      '@alabuga/framework/standalone.css',
      'apps/editor/src/styles/editor.css',
    ],
  },
  'apps/editor/demo/main.ts': {
    module: 'apps/editor/demo/styles.ts',
    styles: [
      '@alabuga/framework/standalone.css',
      'apps/editor/src/styles/product.css',
      'apps/editor/demo/style.css',
      'apps/editor/src/styles/shared.css',
    ],
  },
  'apps/editor/src/ai/panel.ts': {
    module: 'apps/editor/src/ai/panel.ts',
    styles: ['apps/editor/src/styles/dialogs/ai.css'],
  },
};

/** Validate stylesheet ownership without depending on the bundler's module order. */
export function styleEntryErrors(sources, entries = styleEntries) {
  const errors = [],
    reached = new Set();
  const target = (file, spec) =>
    spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), spec)) : spec;
  const modules = new Map(Object.values(entries).map((entry) => [entry.module, entry.styles]));
  for (const [file, source] of sources) {
    if (!file.endsWith('.ts')) continue;
    const css = importsOf(file, source).filter((spec) => spec.endsWith('.css'));
    const expected = modules.get(file);
    if (
      expected &&
      JSON.stringify(css.map((spec) => target(file, spec))) !== JSON.stringify(expected)
    )
      errors.push(`${file}: import only the declared stylesheets, in their declared order`);
    else if (!expected && css.length)
      errors.push(`${file}: stylesheet side effects belong in a declared entry`);
  }
  function visit(file, seen, stack) {
    if (stack.includes(file)) {
      errors.push(`CSS import cycle: ${[...stack, file].join(' -> ')}`);
      return;
    }
    if (seen.has(file)) {
      errors.push(`${file}: stylesheet imported twice in one entry`);
      return;
    }
    seen.add(file);
    if (file === '@alabuga/framework/standalone.css') return;
    if (!sources.has(file)) {
      errors.push(`${file}: missing stylesheet`);
      return;
    }
    reached.add(file);
    let hasRules = false;
    for (const node of postcss.parse(sources.get(file), { from: file }).nodes) {
      if (node.type === 'comment') continue;
      if (node.type !== 'atrule' || node.name !== 'import') {
        hasRules = true;
        continue;
      }
      if (hasRules) errors.push(`${file}: @import must precede stylesheet rules`);
      const spec = /^['"]([^'"]+)['"]$/.exec(node.params)?.[1];
      if (!spec || (!spec.startsWith('.') && spec !== '@alabuga/framework/standalone.css')) {
        errors.push(`${file}: use an explicit local or public Framework CSS import`);
        continue;
      }
      const next = spec.startsWith('.') ? target(file, spec) : spec;
      if (spec.startsWith('.') && !next.startsWith('apps/editor/')) {
        errors.push(`${file}: stylesheet escapes the editor workspace`);
        continue;
      }
      visit(next, seen, [...stack, file]);
    }
  }
  for (const [owner, entry] of Object.entries(entries)) {
    if (!sources.has(owner)) errors.push(`${owner}: missing stylesheet owner`);
    if (!sources.has(entry.module)) errors.push(`${entry.module}: missing stylesheet entry module`);
    if (owner !== entry.module) {
      const imported = importsOf(owner, sources.get(owner) ?? '').map((spec) => {
        const resolved = target(owner, spec);
        return sources.has(resolved + '.ts') ? resolved + '.ts' : resolved;
      });
      if (imported.filter((file) => file === entry.module).length !== 1)
        errors.push(`${owner}: import the declared stylesheet entry module ${entry.module} once`);
    }
    const seen = new Set();
    for (const style of entry.styles) visit(style, seen, []);
  }
  for (const file of sources.keys())
    if (file.endsWith('.css') && file !== 'apps/editor/src/documentation.css' && !reached.has(file))
      errors.push(`${file}: stylesheet is not reachable from a declared entry`);
  return errors;
}
