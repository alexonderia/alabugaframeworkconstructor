import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument, type AFDocument } from '@alabuga/framework/schema';
import { standardGrid } from '@alabuga/framework/grid';
import { applyGridChange, planGridChange } from '../apps/editor/src/grid-change';
import { EditorModel } from '../apps/editor/src/model';

function fixture(): AFDocument {
  return {
    schemaVersion: 6,
    kind: 'presentation',
    title: 'Grid',
    pages: [
      {
        id: 'section',
        title: '',
        grid: standardGrid(),
        widgets: [
          {
            id: 'heading',
            type: 'text',
            title: '',
            position: { col: 1, row: 1, width: 24, height: 3 },
            content: [{ type: 'paragraph', text: 'Keep this text', dropCap: false }],
          },
          {
            id: 'image',
            type: 'image',
            title: 'Photo',
            position: { col: 1, row: 4, width: 12, height: 9 },
            src: 'https://example.com/photo.png',
            alt: 'Keep alt',
            fit: 'contain',
            caption: 'Caption',
          },
          {
            id: 'cards',
            type: 'cards',
            title: 'Cards',
            position: { col: 13, row: 4, width: 12, height: 9 },
            items: [{ title: 'Keep title', text: 'Keep body' }],
          },
        ],
      },
    ],
  };
}
const content = (doc: AFDocument) => doc.pages[0].widgets.map(({ position, ...widget }) => widget);

test('changing columns, rows and gaps adapts occupied geometry in one undo operation', () => {
  const source = fixture(),
    before = structuredClone(source),
    model = new EditorModel(source);
  const grid = { ...source.pages[0].grid, columns: 12, rowHeight: 80, gap: 12 };
  model.change((doc) => applyGridChange(doc, 0, grid));
  assert.deepEqual(validateDocument(model.document).issues, []);
  assert.deepEqual(content(model.document), content(source));
  assert.equal(model.document.pages[0].widgets[0].position.width, 12);
  assert.equal(model.document.pages[0].grid.responsive?.tabletColumns, 12);
  model.undo();
  assert.deepEqual(model.document, before);
  model.redo();
  assert.equal(model.document.pages[0].grid.columns, 12);
  assert.deepEqual(source, before);
});

test('rounding neighboring cells into fewer columns reflows them without overlap or lost data', () => {
  const source = fixture();
  source.pages[0].widgets = Array.from({ length: 24 }, (_, i) => ({
    id: 'metric-' + i,
    type: 'metric',
    title: '',
    value: String(i),
    note: 'Keep ' + i,
    position: { col: i + 1, row: 1, width: 1, height: 1 },
  }));
  const original = content(source);
  applyGridChange(source, 0, { ...source.pages[0].grid, columns: 12 });
  assert.deepEqual(validateDocument(source).issues, []);
  assert.deepEqual(content(source), original);
  assert.ok(source.pages[0].widgets.some((w) => w.position.row > 1));
});

test('a smaller slide area compacts blocks only when their mapped sizes cannot fit', () => {
  const source = fixture();
  applyGridChange(source, 0, { ...source.pages[0].grid, columns: 6, rowHeight: 160 });
  assert.deepEqual(validateDocument(source).issues, []);
  assert.equal(source.pages[0].widgets.length, 3);
  assert.deepEqual(source.pages[0].grid.responsive, { tabletColumns: 6, mobileColumns: 4 });
});

test('impossible grid changes report the minimum and leave every input field intact', () => {
  const source = fixture(),
    before = structuredClone(source);
  assert.throws(
    () => applyGridChange(source, 0, { ...source.pages[0].grid, columns: 1 }),
    /минимум 2 колонки/,
  );
  assert.deepEqual(source, before);
  const grid = standardGrid();
  grid.frame!.left = 1600;
  grid.frame!.right = 400;
  assert.throws(() => applyGridChange(source, 0, grid), /Сумма полей слева и справа/);
  assert.deepEqual(source, before);
});

test('websites can add rows when shrinking columns and legacy grids keep their schema', () => {
  const source = fixture();
  source.kind = 'page';
  applyGridChange(source, 0, { ...source.pages[0].grid, columns: 4 });
  assert.deepEqual(validateDocument(source).issues, []);
  assert.deepEqual(source.pages[0].grid.responsive, { tabletColumns: 4, mobileColumns: 4 });
  const legacy: AFDocument = {
    schemaVersion: 3,
    kind: 'presentation',
    title: 'Legacy',
    pages: [{ ...fixture().pages[0], grid: { columns: 12, rowHeight: 64, gap: 16 }, widgets: [] }],
  };
  const next = planGridChange(legacy.pages[0], { columns: 8, rowHeight: 80, gap: 8 }, legacy.kind);
  legacy.pages[0] = next;
  const valid = validateDocument(legacy);
  assert.ok(valid.success);
  assert.equal(valid.data.schemaVersion, 3);
  assert.equal(next.grid.frame, undefined);
});
