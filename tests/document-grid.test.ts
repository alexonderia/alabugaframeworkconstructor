import test from 'node:test';
import assert from 'node:assert/strict';
import { standardGrid } from '@alabuga/framework/grid';
import { makeComposition } from '@alabuga/framework/compositions';
import {
  applyDocumentGrid,
  applyInheritedGrid,
  prepareDocumentGrid,
  inheritSectionGrid,
  preserveGridSettings,
  setSectionGrid,
} from '../apps/editor/src/document-grid';
import { planGridChange } from '../apps/editor/src/grid-change';
import { checked, EditorModel } from '../apps/editor/src/model';
import { duplicateSection, reusableSection } from '../apps/editor/src/sections';
import { frameworkDocument, templateInfo } from '../apps/editor/src/template-metadata';
import {
  createDocumentFromTemplate,
  customTemplate,
  templateRegistry,
} from '../apps/editor/src/templates';

const create = (kind: 'page' | 'presentation' = 'page') =>
  checked(createDocumentFromTemplate(kind, `document/${kind}/corporate`));
const content = (doc: ReturnType<typeof create>) =>
  doc.pages.map((section) => ({
    id: section.id,
    widgets: section.widgets.map(({ position, ...widget }) => widget),
  }));

for (const kind of ['page', 'presentation'] as const) {
  test(`${kind}: common grid remaps every inheriting section in one reversible operation`, () => {
    const doc = create(kind),
      before = structuredClone(doc),
      model = new EditorModel(doc),
      grid = { ...standardGrid(), columns: 20, gap: 12 };
    model.change((draft) => applyInheritedGrid(draft, 0, grid));
    const next = model.document;
    assert.ok(
      next.pages.every((section) => section.grid.columns === 20 && section.grid.gap === 12),
    );
    assert.deepEqual(templateInfo(next)?.documentGrid, grid);
    assert.deepEqual(content(next), content(before));
    assert.deepEqual(doc, before);
    model.undo();
    assert.deepEqual(model.document, before);
    model.redo();
    assert.deepEqual(model.document, next);
    assert.deepEqual(checked(JSON.parse(JSON.stringify(next))), next);
    assert.equal(Object.hasOwn(frameworkDocument(next), 'templateInfo'), false);
  });

  test(`${kind}: explicit overrides survive common edits, duplication and insertion`, () => {
    const doc = create(kind),
      ownId = doc.pages[1].id;
    setSectionGrid(doc, ownId, true);
    applyInheritedGrid(doc, 1, { ...standardGrid(), columns: 12 });
    const own = structuredClone(doc.pages[1]);
    applyDocumentGrid(doc, { ...standardGrid(), columns: 20 });
    assert.deepEqual(doc.pages[1], own);
    duplicateSection(doc, 1);
    const duplicate = doc.pages[2];
    assert.ok(templateInfo(doc)?.gridOverrides?.includes(duplicate.id));
    const added = makeComposition('split', kind);
    doc.pages.push(inheritSectionGrid(doc, added));
    const next = checked(doc);
    assert.equal(next.pages.at(-1)!.grid.columns, 20);
    assert.equal(next.pages.find((section) => section.id === ownId)!.grid.columns, 12);
    assert.equal(next.pages.find((section) => section.id === duplicate.id)!.grid.columns, 12);
    setSectionGrid(next, ownId, false);
    assert.equal(next.pages.find((section) => section.id === ownId)!.grid.columns, 20);
    assert.deepEqual(templateInfo(next)?.gridOverrides, [duplicate.id]);
  });
}

test('a failure in a later section leaves every section and common metadata intact', () => {
  const doc = create();
  doc.pages[0].widgets = [];
  const before = structuredClone(doc);
  assert.throws(() => applyDocumentGrid(doc, { ...standardGrid(), columns: 1 }), /минимум/);
  assert.deepEqual(doc, before);
  assert.throws(() =>
    applyDocumentGrid(doc, { ...standardGrid(), frame: { ...standardGrid().frame!, left: 2000 } }),
  );
  assert.deepEqual(doc, before);
});

test('mixed framed and unframed projects retain every saved grid and position', () => {
  const doc = create();
  delete doc.templateInfo;
  doc.pages[0] = planGridChange(doc.pages[0], { ...standardGrid(), columns: 20 }, 'page');
  doc.pages[1] = makeComposition('hero', 'page');
  const before = structuredClone(doc),
    next = prepareDocumentGrid(doc);
  assert.deepEqual(next.pages, before.pages);
  assert.deepEqual(
    templateInfo(next)?.gridOverrides,
    doc.pages.slice(1).map(({ id }) => id),
  );
  assert.deepEqual(content(next), content(before));
  assert.deepEqual(doc, before);
  const legacy = { ...frameworkDocument(doc), pages: [makeComposition('hero', 'page')] };
  assert.deepEqual(prepareDocumentGrid(legacy).pages, legacy.pages);
  assert.deepEqual(templateInfo(prepareDocumentGrid(legacy))?.documentGrid, legacy.pages[0].grid);
});

test('every document and section template starts with the standard grid', () => {
  for (const template of templateRegistry.documents) {
    const doc = template.create();
    assert.deepEqual(templateInfo(doc)?.documentGrid, standardGrid(), template.id);
    assert.ok(
      doc.pages.every((section) => JSON.stringify(section.grid) === JSON.stringify(standardGrid())),
      template.id,
    );
  }
  for (const template of templateRegistry.sections)
    assert.deepEqual(template.create().grid, standardGrid(), template.id);
});

test('catalog copies and older saved templates use standard grid while projects keep custom grids', () => {
  const doc = create();
  applyDocumentGrid(doc, { ...standardGrid(), columns: 20, gap: 16 });
  const before = structuredClone(doc),
    saved = reusableSection('page', doc.pages[1]);
  assert.deepEqual(saved.grid, standardGrid());
  assert.deepEqual(doc, before);
  const old = customTemplate({
    id: 'custom/old',
    version: 1,
    kind: 'page',
    title: 'Old',
    section: doc.pages[1],
  });
  assert.deepEqual(old.create().grid, standardGrid());
  doc.pages.push(inheritSectionGrid(doc, old.create()));
  assert.equal(checked(doc).pages.at(-1)!.grid.columns, 20);
});

test('invalid grid metadata is rejected and stale override references are pruned', () => {
  const doc = create();
  doc.templateInfo!.gridOverrides = ['missing', doc.pages[0].id, doc.pages[0].id];
  assert.deepEqual(templateInfo(checked(doc))?.gridOverrides, [doc.pages[0].id]);
  assert.throws(
    () => checked({ ...doc, templateInfo: { documentGrid: { columns: -1 } } }),
    /сетка документа/,
  );
});

test('legacy presentations retain their original geometry across open, validate and reopen', () => {
  const legacy = checked({
    schemaVersion: 3,
    kind: 'presentation',
    title: 'Старая презентация',
    pages: ['brand-cover', 'metrics'].map((key) => makeComposition(key, 'presentation')),
  });
  const before = structuredClone(legacy),
    next = prepareDocumentGrid(legacy);
  assert.deepEqual(next.pages, before.pages);
  assert.equal(next.schemaVersion, legacy.schemaVersion);
  assert.deepEqual(content(next), content(before));
  assert.deepEqual(legacy, before);
  assert.deepEqual(prepareDocumentGrid(next), next);
  assert.deepEqual(checked(next), next);
  legacy.pages[1].grid.gap = 12;
  const backup = preserveGridSettings(legacy);
  assert.deepEqual(prepareDocumentGrid(backup).pages, legacy.pages);
  assert.deepEqual(templateInfo(backup)?.gridOverrides, [legacy.pages[1].id]);
});

test('explicit presentation grid settings survive preparation', () => {
  const document = create('presentation');
  applyDocumentGrid(document, { ...standardGrid(), columns: 20, gap: 12 });
  setSectionGrid(document, document.pages[1].id, true);
  applyInheritedGrid(document, 1, { ...standardGrid(), columns: 12 });
  const before = structuredClone(document);
  assert.deepEqual(prepareDocumentGrid(document), before);
});
