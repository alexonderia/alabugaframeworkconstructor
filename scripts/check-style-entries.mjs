import { readdir, readFile } from 'node:fs/promises';
import { styleEntryErrors } from './style-entries.mjs';

async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true }))
        .filter((entry) => !['dist', 'node_modules'].includes(entry.name))
        .map((entry) =>
          entry.isDirectory()
            ? walk(dir + '/' + entry.name)
            : /\.(ts|css)$/.test(entry.name)
              ? [dir + '/' + entry.name]
              : [],
        ),
    )
  ).flat();
}
const sources = new Map(
  await Promise.all(
    (await walk('apps/editor')).map(async (file) => [file, await readFile(file, 'utf8')]),
  ),
);
const errors = styleEntryErrors(sources);
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  'Stylesheet entries: explicit owners, imports, cycles, duplicates and reachability checked',
);
