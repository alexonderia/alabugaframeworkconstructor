import test from 'node:test';
import assert from 'node:assert/strict';
import { resizePosition, snapDelta } from '../apps/editor/src/block-geometry';
const grid = { columns: 12, rowHeight: 64, gap: 16 };
const initial = { col: 3, row: 3, width: 4, height: 3 };
test('resize edges keep their opposite side fixed and honor the slide bounds', () => {
  assert.deepEqual(resizePosition(initial, 'text', grid, 'nw', -1, -1, 8), {
    col: 2,
    row: 2,
    width: 5,
    height: 4,
  });
  assert.deepEqual(resizePosition(initial, 'text', grid, 'sw', -2, 2, 8), {
    col: 1,
    row: 3,
    width: 6,
    height: 5,
  });
  assert.deepEqual(resizePosition(initial, 'text', grid, 'ne', 2, 1, 8), {
    col: 3,
    row: 4,
    width: 6,
    height: 2,
  });
  assert.deepEqual(resizePosition(initial, 'image', grid, 'nw', 20, 20, 8), {
    col: 5,
    row: 4,
    width: 2,
    height: 2,
  });
  assert.deepEqual(resizePosition(initial, 'text', grid, 'se', 20, 20, 8), {
    col: 3,
    row: 3,
    width: 10,
    height: 6,
  });
  assert.deepEqual(initial, { col: 3, row: 3, width: 4, height: 3 });
  assert.equal(snapDelta(3.1, 2), 4);
  assert.equal(snapDelta(-3.1, 2), -4);
});
