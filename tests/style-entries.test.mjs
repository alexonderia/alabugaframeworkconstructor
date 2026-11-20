import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styleEntryErrors } from '../scripts/style-entries.mjs';

const owner = 'apps/editor/src/app.ts',
  root = 'apps/editor/src/styles/editor.css',
  module = 'apps/editor/src/styles/editor.ts';
function check(css, extra = {}) {
  return styleEntryErrors(
    new Map(
      Object.entries({
        [owner]: "import './styles/editor';",
        [module]: "import '@alabuga/framework/standalone.css'; import './editor.css';",
        [root]: css,
        'apps/editor/src/styles/shell.css': '.shell { display: grid; }',
        ...extra,
      }),
    ),
    { [owner]: { module, styles: ['@alabuga/framework/standalone.css', root] } },
  );
}
test('entry accepts explicit CSS order and raw standalone runtime loading', () => {
  assert.deepEqual(
    check("@import './shell.css';", {
      'apps/editor/src/surface.ts': "import('@alabuga/framework/standalone.css?raw');",
    }),
    [],
  );
});
test('entry rejects hidden CSS side effects in shared TypeScript', () => {
  assert.match(
    check("@import './shell.css';", {
      'apps/editor/src/ui.ts': "import './styles/shell.css';",
    }).join('\n'),
    /side effects/,
  );
});
test('entry rejects duplicate imports, cycles, missing files and orphan styles', () => {
  assert.match(check("@import './shell.css'; @import './shell.css';").join('\n'), /imported twice/);
  assert.match(
    check("@import '@alabuga/framework/standalone.css'; @import './shell.css';").join('\n'),
    /imported twice/,
  );
  assert.match(
    check("@import './shell.css';", {
      'apps/editor/src/styles/shell.css': "@import './editor.css';",
    }).join('\n'),
    /CSS import cycle/,
  );
  assert.match(check("@import './missing.css';").join('\n'), /missing stylesheet/);
  assert.match(check('').join('\n'), /not reachable/);
});
test('entry rejects ignored late imports and undeclared entry files', () => {
  assert.match(
    check(".shell { display: grid; } @import './shell.css';").join('\n'),
    /must precede/,
  );
  assert.match(
    check("@import './shell.css';", { [owner]: "import './styles/shell.css';" }).join('\n'),
    /declared stylesheet entry module/,
  );
  assert.match(
    check("@import './shell.css';", {
      [module]: "import './editor.css'; import '@alabuga/framework/standalone.css';",
    }).join('\n'),
    /declared order/,
  );
});
