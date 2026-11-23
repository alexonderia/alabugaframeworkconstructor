import test from 'node:test';
import assert from 'node:assert/strict';
import { standardGrid, positionBounds } from '@alabuga/framework/grid';
import { validateDocument } from '@alabuga/framework/schema';
import { manipulateRect, positionFromRect, trackLines } from '../apps/editor/src/snap-geometry';
import { emptyDocument, EditorModel } from '../apps/editor/src/model';
import { applyDocumentGrid } from '../apps/editor/src/document-grid';
import { frameworkDocument } from '../apps/editor/src/template-metadata';

const initial = { x: 80, y: 80, width: 103, height: 95 };
const bounds = { x: -100, y: -176, width: 1920, height: 1080 };
const minimum = { width: 16, height: 16 };
const lines = {
  x: trackLines([0, 72, 144, 216, 288, 360], 8),
  y: trackLines([0, 72, 144, 216, 288, 360], 8),
};
const drag = (dx: number, dy: number, mode: 'strict' | 'mixed' | 'off') =>
  manipulateRect(initial, dx, dy, 'move', bounds, minimum, lines, mode, 6);

test('magnets target both boundaries of each cell and never create a trailing gutter line', () => {
  assert.deepEqual(trackLines([0, 72, 144, 216], 8), [0, 64, 72, 136, 144, 208]);
  assert.deepEqual(trackLines([0, 72, 144, 216, 288], 8, 2), [0, 136, 144, 280]);
});

test('off ignores lines; mixed attracts either edge on both axes only near a line and releases cleanly', () => {
  assert.deepEqual(drag(53, 56, 'off'), { rect: { ...initial, x: 133, y: 136 }, guides: {} });
  const near = drag(53, 56, 'mixed');
  assert.equal(near.rect.x, 136);
  assert.equal(near.rect.y, 136);
  assert.deepEqual(near.guides, { x: 136, y: 136 });
  const far = drag(25, 25, 'mixed');
  assert.equal(far.rect.x + far.rect.width, 208); // Right edge, rather than the origin.
  assert.equal(far.rect.y, 105);
  assert.equal(drag(40, 40, 'mixed').rect.x, 120); // More than 6 px from either edge.
  assert.notEqual(drag(40, 40, 'strict').rect.x, 120);
  assert.equal(drag(25, 33, 'mixed').guides.y, 208); // Bottom edge.
  assert.equal(
    manipulateRect(initial, 41, 0, 'move', bounds, minimum, lines, 'mixed', 6).guides.x,
    undefined,
  );
  assert.equal(
    manipulateRect(initial, 41, 0, 'move', bounds, minimum, lines, 'mixed', 12).guides.x,
    216,
  ); // Same screen radius at 50% zoom.
});

test('all resize directions anchor their opposite edge; axis lock and canvas bounds remain exact', () => {
  for (const direction of ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'] as const) {
    const { rect } = manipulateRect(initial, 13, 17, direction, bounds, minimum, lines, 'off', 6);
    if (direction.includes('w')) assert.equal(rect.x + rect.width, initial.x + initial.width);
    else assert.equal(rect.x, initial.x);
    if (direction.includes('n')) assert.equal(rect.y + rect.height, initial.y + initial.height);
    else assert.equal(rect.y, initial.y);
  }
  const locked = manipulateRect(initial, 60, 20, 'move', bounds, minimum, lines, 'mixed', 6, 'x');
  assert.equal(locked.rect.y, initial.y);
  assert.equal(locked.guides.y, undefined);
  assert.equal(drag(-1000, -1000, 'off').rect.x, -100);
  assert.equal(drag(-1000, -1000, 'off').rect.y, -176);
});

test('precise positions survive validation, history and grid changes without rounding to cells', () => {
  const doc = emptyDocument('presentation');
  const rect = { x: 107, y: 93, width: 157, height: 119 };
  const position = positionFromRect(rect, standardGrid(), 1720);
  doc.pages[0].widgets = [{ id: 'precise', type: 'text', title: '', content: [], position }];
  const model = new EditorModel(doc);
  assert.equal(model.document.schemaVersion, 7);
  const rendered = positionBounds(standardGrid(), model.document.pages[0].widgets[0].position);
  for (const key of ['x', 'y', 'width', 'height'] as const)
    assert.ok(Math.abs(rendered[key] - rect[key]) < 0.001);
  model.change((draft) =>
    applyDocumentGrid(draft, { ...standardGrid(), columns: 20, rowHeight: 80, gap: 12 }),
  );
  const next = model.document;
  const remapped = positionBounds(next.pages[0].grid, next.pages[0].widgets[0].position);
  for (const key of ['x', 'y', 'width', 'height'] as const)
    assert.ok(Math.abs(remapped[key] - rect[key]) < 0.001);
  model.change((draft) =>
    applyDocumentGrid(draft, {
      ...standardGrid(),
      frame: { ...standardGrid().frame!, left: 180, top: 160 },
    }),
  );
  const changed = model.document,
    unchanged = positionBounds(changed.pages[0].grid, changed.pages[0].widgets[0].position);
  assert.ok(Math.abs(unchanged.x + 180 - (rect.x + 100)) < 0.001);
  assert.ok(Math.abs(unchanged.y + 160 - (rect.y + 176)) < 0.001);
  assert.ok(Math.abs(unchanged.width - rect.width) < 0.001);
  model.undo();
  model.undo();
  assert.deepEqual(model.document.pages[0].widgets[0].position, position);
  assert.equal(validateDocument(JSON.parse(JSON.stringify(frameworkDocument(next)))).success, true);
  const invalid = structuredClone(doc);
  delete invalid.pages[0].widgets[0].position.free;
  assert.equal(validateDocument(frameworkDocument(invalid)).success, false);
});
