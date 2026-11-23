import assert from 'node:assert/strict';
import test from 'node:test';
import { importCompositions } from '../apps/editor/src/composition-file';
import { placeUnplacedWidget } from '../apps/editor/src/sections';
import { validateDocument } from '@alabuga/framework/schema';
import { documentContent } from '../apps/editor/src/document-content';
import { checked, EditorModel, emptyDocument, findSpace } from '../apps/editor/src/model';
import { importProject } from '../apps/editor/src/project-file/format';
import { replaceComposition, restoreUnplaced, reusableSection } from '../apps/editor/src/sections';
import { imageReferences } from '../apps/editor/src/storage/images';
import { sectionVariant } from '../apps/editor/src/layout/placement';
import { editTemplateInfo, templateInfo } from '../apps/editor/src/template-metadata';
import {
  createDocumentFromTemplate,
  customTemplate,
  geometryLocked,
  getSectionTemplate,
  instantiateSection,
  templateRegistry,
} from '../apps/editor/src/templates';

const image = 'data:image/png;base64,iVBORw0KGgo=';
const assetId = 'a'.repeat(64);

test('collection import validates every entry, resolves images and preserves the input', () => {
  const section = getSectionTemplate('page', 'split').create();
  const figure = section.widgets.find((widget) => widget.type === 'image')!;
  figure.src = 'asset:' + assetId;
  const item = {
    id: 'custom/team',
    version: 1,
    kind: 'page',
    title: 'Команда',
    project: {
      format: 'alabuga-project',
      version: 3,
      document: { ...emptyDocument(), pages: [section] },
      assets: [{ id: assetId, data: image }],
    },
  };
  const collection = { format: 'alabuga-compositions', version: 1, compositions: [item] };
  const snapshot = structuredClone(collection);
  const imported = importCompositions(collection);
  assert.equal(imported[0].section.widgets.find((widget) => widget.type === 'image')?.src, image);
  assert.deepEqual(collection, snapshot);
  assert.throws(
    () => importCompositions({ ...collection, compositions: [item, item] }),
    /повторяются/,
  );
  assert.throws(() => importCompositions({ ...collection, version: 2 }), /версия/);
  assert.throws(
    () => importCompositions({ ...collection, compositions: [{ ...item, kind: 'presentation' }] }),
    /типа/,
  );
  assert.throws(
    () =>
      importCompositions({
        ...collection,
        compositions: [
          {
            ...item,
            project: {
              ...item.project,
              assets: [],
            },
          },
        ],
      }),
    /Отсутствует материал/,
  );
});

test('individual unplaced blocks move atomically and undo restores the reserve', () => {
  const doc = emptyDocument();
  const source = getSectionTemplate('page', 'split').create();
  doc.pages.push(source);
  const figure = structuredClone(source.widgets.find((widget) => widget.type === 'image')!);
  replaceComposition(doc, source.id, getSectionTemplate('page', 'text'), true);
  const model = new EditorModel(doc);
  const reserveId = model.document.templateInfo!.unplaced![0].id;
  model.change((current) =>
    placeUnplacedWidget(current, reserveId, figure.id, current.pages[0].id),
  );
  const moved = model.document.pages[0].widgets[0];
  assert.deepEqual({ ...moved, position: figure.position }, figure);
  const placed = model.document;
  assert.equal(placed.templateInfo?.unplaced, undefined);
  model.undo();
  assert.equal(model.document.templateInfo?.unplaced?.[0].widgets[0].id, figure.id);
  model.redo();
  assert.equal(model.document.pages[0].widgets[0].id, figure.id);
  const full = emptyDocument('presentation');
  full.pages[0].widgets = [
    {
      id: 'full',
      type: 'text',
      title: '',
      content: [],
      position: { col: 1, row: 1, width: 24, height: 12 },
    },
  ];
  editTemplateInfo(full).unplaced = [{ ...source, widgets: [figure] }];
  const snapshot = structuredClone(full);
  assert.throws(
    () => placeUnplacedWidget(full, source.id, figure.id, full.pages[0].id),
    /Нет свободного места/,
  );
  assert.deepEqual(full, snapshot);
});

test('the registry has unique stable references and fresh valid instances for both kinds', () => {
  const all = [...templateRegistry.sections, ...templateRegistry.documents];
  assert.equal(new Set(all.map(({ id }) => id)).size, all.length);
  for (const template of templateRegistry.sections) {
    assert.ok(template.version > 0);
    assert.notEqual(template.create().id, template.create().id);
    const section = instantiateSection(template, 'contrast');
    const doc = checked({ ...emptyDocument(template.kind), pages: [section] });
    assert.equal(doc.pages[0].appearance?.theme, 'contrast');
    assert.equal(template.composition.slots.length, section.widgets.length);
    for (const variant of template.composition.variants)
      assert.equal(sectionVariant(template.kind, section, variant).layoutVariant, variant);
  }
  for (const template of templateRegistry.documents) {
    const doc = checked(createDocumentFromTemplate(template.kind, template.id));
    assert.equal(doc.kind, template.kind);
    assert.deepEqual(templateInfo(doc)?.document, { id: template.id, version: template.version });
    assert.equal(validateDocument(documentContent(doc)).success, true);
  }
  assert.throws(() => getSectionTemplate('presentation', 'header'), /недоступен/);
  assert.throws(
    () => createDocumentFromTemplate('page', 'document/presentation/corporate'),
    /недоступен/,
  );
});

test('a compatible composition keeps IDs, text, materials, actions and individual overrides', () => {
  const first = getSectionTemplate('page', 'asymmetric');
  const target = getSectionTemplate('page', 'brand-cover');
  const doc = { ...emptyDocument(), pages: [instantiateSection(first)] };
  const source = doc.pages[0];
  const button = source.widgets.find((widget) => widget.type === 'button')!;
  button.action = { type: 'section', target: source.id };
  button.style = { color: 'blue', locked: true };
  const text = source.widgets.find((widget) => widget.type === 'text')!;
  text.content.push({ type: 'link', text: 'Наш проект', href: '#' + source.id });
  const model = new EditorModel(doc);
  assert.throws(
    () => model.change((draft) => replaceComposition(draft, source.id, target)),
    /другие места/,
  );
  assert.equal(model.canUndo, false);
  model.change((draft) => replaceComposition(draft, source.id, target, true));
  const next = model.document;
  for (const original of [button, text]) {
    const moved = next.pages[0].widgets.find(({ id }) => id === original.id)!;
    assert.deepEqual({ ...moved, position: original.position }, original);
  }
  assert.equal(next.pages[0].appearance?.theme, source.appearance?.theme);
  assert.equal(next.templateInfo?.unplaced?.[0].widgets[0].type, 'image');
  assert.equal(geometryLocked(next, source.id), true);
  assert.equal(model.undo(), true);
  assert.deepEqual(model.document, checked(doc));
  assert.equal(model.redo(), true);
  assert.deepEqual(model.document, next);
});

test('portable projects keep unplaced resources and unknown template versions for later recovery', () => {
  const doc = createDocumentFromTemplate('page', 'document/page/corporate');
  const section = doc.pages.find((page) => page.composition === 'split')!;
  const figure = section.widgets.find((widget) => widget.type === 'image')!;
  figure.src = 'asset:' + assetId;
  replaceComposition(doc, section.id, getSectionTemplate('page', 'text'), true);
  editTemplateInfo(doc).document = { id: 'document/page/retired', version: 42 };
  assert.deepEqual([...imageReferences(doc)], [assetId]);
  const envelope = {
    format: 'alabuga-project',
    version: 3,
    document: doc,
    assets: [{ id: assetId, data: image }],
  };
  const imported = importProject(JSON.parse(JSON.stringify(envelope)));
  const reserve = imported.templateInfo!.unplaced![0];
  const restored = reserve.widgets[0];
  assert.equal(restored.type === 'image' && restored.src, image);
  assert.equal(imported.templateInfo?.document?.version, 42);
  assert.equal(
    documentContent(imported).pages.some((page) => page.id === reserve.id),
    false,
  );
  assert.equal(Object.hasOwn(documentContent(imported), 'templateInfo'), false);
  restoreUnplaced(imported, reserve.id, section.id);
  const placed = checked(imported);
  assert.equal(placed.templateInfo?.unplaced, undefined);
  assert.deepEqual(placed.pages.find((page) => page.id === reserve.id)?.widgets, [restored]);
  assert.throws(() => importProject({ ...envelope, assets: [] }), /Отсутствует материал/);
});

test('site variants provide a flowing layout while the slide engine enforces fixed bounds', () => {
  const site = getSectionTemplate('page', 'split').create();
  const responsive = sectionVariant('page', site, 'stacked');
  assert.equal(responsive.appearance?.layout, 'flow');
  assert.ok(responsive.widgets.some((widget) => widget.position.row > 1));
  const slide = getSectionTemplate('presentation', 'split').create();
  assert.equal(sectionVariant('presentation', slide, 'primary').appearance?.layout, 'fixed');
  assert.doesNotThrow(() => findSpace(emptyDocument('page'), 0, 24, 13));
  assert.throws(() => findSpace(emptyDocument('presentation'), 0, 24, 13), /Нет свободного места/);
});

test('catalog copies clear links and actions while the project retains every target', () => {
  for (const kind of ['page', 'presentation'] as const) {
    const source = getSectionTemplate(kind, 'hero').create();
    const action = source.widgets.find((widget) => widget.type === 'button')!;
    const text = source.widgets.find((widget) => widget.type === 'text')!;
    text.content.push({ type: 'link', text: 'Компания', href: 'https://example.com/team' });
    for (const target of [
      { type: 'link', href: 'https://example.com' },
      { type: 'section', target: 'other' },
      { type: 'slide', target: 'other' },
      { type: 'modal', target: 'dialog' },
    ] as const) {
      action.action = target;
      const snapshot = structuredClone(source);
      const saved = reusableSection(kind, source);
      assert.deepEqual(source, snapshot);
      assert.deepEqual(saved.widgets.find((widget) => widget.type === 'button')?.action, {
        type: 'link',
        href: '',
      });
      const savedText = saved.widgets.find((widget) => widget.type === 'text')!;
      assert.deepEqual(savedText.content.at(-1), { type: 'link', text: 'Компания', href: '' });
      const template = customTemplate({
        id: 'custom/test',
        version: 1,
        kind,
        title: 'Команда',
        section: saved,
      });
      const instance = template.create();
      assert.notEqual(instance.id, source.id);
      assert.deepEqual(instance.widgets.find((widget) => widget.type === 'button')?.action, {
        type: 'link',
        href: '#',
      });
      assert.doesNotThrow(() => checked({ ...emptyDocument(kind), pages: [instance] }));
    }
  }
});
