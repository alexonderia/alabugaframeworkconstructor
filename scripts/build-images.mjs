import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildRevision } from './build-revision.ts';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const revision = buildRevision();
console.log(`Constructor ${version} · ${revision}`);
const result = spawnSync('docker', [
  'compose', '-f', 'compose.yaml', '-f', 'compose.build.yaml', 'build', 'web', 'api',
], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, AF_APP_VERSION: version, AF_REVISION: revision },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
