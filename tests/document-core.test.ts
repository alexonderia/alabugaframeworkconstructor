import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gridFrame,
  gridRows,
  positionBounds,
  remapSectionGrid,
  planGridChange,
  gridSpace,
  parseGrid,
  type Grid,
  type LayoutSection,
} from '@alabuga/document-core';
import * as renderer from '@alabuga/framework/grid';
import { makeComposition } from '@alabuga/framework/compositions';
import { frameworkGrid } from '../apps/editor/src/framework-grid-adapter';
import { prepareDocumentGrid } from '../apps/editor/src/document-grid';
import { checked, EditorModel } from '../apps/editor/src/model';
import { createDocumentFromTemplate } from '../apps/editor/src/templates';

test('an alternate renderer can use its own grid and widget constraints without Framework', () => {
  const grid: Grid = {
    columns: 32,
    rowHeight: 24,
    gap: 4,
    frame: { width: 1280, height: 720, left: 16, right: 16, top: 24, bottom: 24 },
  };
  const section: LayoutSection & { customData: string } = {
    grid,
    customData: 'kept',
    widgets: [{ type: 'custom-chart', position: { col: 1, row: 1, width: 8, height: 4 } }],
  };
  const before = structuredClone(section);
  const next = planGridChange(section, { ...grid, columns: 40 }, 'presentation', (type) => {
    assert.equal(type, 'custom-chart');
    return { minWidth: 10, minHeight: 6, title: 'Chart' };
  });
  assert.equal(next.widgets[0].position.width, 10);
  assert.equal(next.widgets[0].position.height, 6);
  assert.equal(next.customData, 'kept');
  assert.deepEqual(section, before);
  assert.deepEqual(gridSpace(next, 4, 4, gridRows(grid)), { col: 11, row: 1, width: 4, height: 4 });
  assert.throws(() => frameworkGrid(grid, 'presentation'), /Framework/);
  assert.deepEqual(parseGrid(grid), grid);
});

test('core geometry matches the supported renderer for legacy and framed files', () => {
  const grids: Grid[] = [
    { columns: 12, rowHeight: 64, gap: 16 },
    renderer.standardGrid(),
    { ...renderer.standardGrid(), columns: 20, rowHeight: 48, gap: 12 },
  ];
  for (const grid of grids) {
    assert.deepEqual(gridFrame(grid), renderer.gridFrame(grid));
    assert.equal(gridRows(grid), renderer.gridRows(grid));
    for (const free of [undefined, true] as const) {
      const position = {
        col: free ? 1.4 : 2,
        row: 2,
        width: 4,
        height: 2,
        ...(free ? { free } : {}),
      };
      for (const width of [undefined, 390, 1440])
        assert.deepEqual(
          positionBounds(grid, position, width),
          renderer.positionBounds(grid, position, width),
        );
      for (const kind of ['page', 'presentation'] as const) {
        const section = makeComposition('hero', kind);
        section.grid = structuredClone(grid);
        section.widgets[0].position = position;
        for (const target of grids)
          assert.deepEqual(
            remapSectionGrid(section, target, kind),
            renderer.remapSectionGrid(section, target, kind),
          );
      }
    }
  }
});

test('validation, history and reopening preserve geometry even when common metadata differs', () => {
  const document = checked(
    createDocumentFromTemplate('presentation', 'document/presentation/corporate'),
  );
  document.templateInfo!.documentGrid = { ...renderer.standardGrid(), columns: 20 };
  const before = structuredClone(document);
  assert.deepEqual(checked(document), before);
  const model = new EditorModel(prepareDocumentGrid(document));
  assert.deepEqual(model.document.pages, before.pages);
  model.change((draft) => {
    draft.title = 'Renamed';
  });
  assert.deepEqual(model.document.pages, before.pages);
  const reopened = prepareDocumentGrid(checked(JSON.parse(JSON.stringify(model.document))));
  assert.deepEqual(reopened.pages, before.pages);
  assert.deepEqual(reopened, model.document);
  assert.deepEqual(document, before);
});

test('grid format rejects non-finite numbers, fractional tracks, unknown fields and invalid frames', () => {
  const grid = renderer.standardGrid();
  for (const invalid of [
    { ...grid, columns: Infinity },
    { ...grid, gap: NaN },
    { ...grid, rowHeight: 1.5 },
    { ...grid, columns: 0 },
    { ...grid, theme: 'brand' },
    { ...grid, frame: { ...grid.frame!, left: grid.frame!.width } },
    { ...grid, responsive: { tabletColumns: 0, mobileColumns: 1 } },
  ])
    assert.throws(() => parseGrid(invalid));
  const copy = parseGrid(grid);
  copy.frame!.left++;
  assert.notDeepEqual(copy, grid);
});
