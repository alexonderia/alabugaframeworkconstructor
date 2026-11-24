import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDocument, checked, createWidget, EditorModel } from '../apps/editor/src/model';
import { copyWidget, pasteWidget } from '../apps/editor/src/widget-clipboard';

function source() {
  const doc = emptyDocument();
  const widget = createWidget('text', doc, 0);
  widget.position = { col: 1, row: 1, width: 4, height: 3 };
  widget.title = 'Содержимое';
  doc.pages[0].widgets.push(widget);
  return checked(doc);
}

test('clipboard copies content and precise geometry, finds room and supports one undo', () => {
  const doc = source(),
    before = structuredClone(doc);
  const widget = doc.pages[0].widgets[0];
  const text = copyWidget(doc, 0, widget.id)!;
  const result = pasteWidget(doc, 0, text)!;
  assert.deepEqual(doc, before);
  const copy = result.document.pages[0].widgets.at(-1)!;
  assert.notEqual(copy.id, widget.id);
  assert.deepEqual({ ...copy, id: widget.id, position: widget.position }, widget);
  assert.equal(copy.position.col, 5);
  const model = new EditorModel(doc);
  model.replace(result.document);
  model.undo();
  assert.deepEqual(model.document, before);
  model.redo();
  assert.deepEqual(model.document, result.document);
});

test('pasting into another grid keeps data and uses the destination grid without changing the source', () => {
  const doc = source(),
    other = emptyDocument('presentation');
  other.pages[0].grid.columns = 12;
  const result = pasteWidget(other, 0, copyWidget(doc, 0, doc.pages[0].widgets[0].id)!)!;
  assert.equal(result.document.pages[0].grid.columns, 12);
  assert.equal(result.document.pages[0].widgets[0].position.width, 2);
  assert.equal(result.document.pages[0].widgets[0].title, 'Содержимое');
  assert.equal(other.pages[0].widgets.length, 0);
});

test('modal buttons bring their referenced content and get independent IDs', () => {
  const doc = emptyDocument();
  doc.modals = [{ id: 'modal-source', title: 'Подробности', text: 'Текст окна' }];
  const widget = createWidget('button', doc, 0);
  if (widget.type !== 'button') throw new Error('fixture');
  widget.action = { type: 'modal', target: 'modal-source' };
  doc.pages[0].widgets.push(widget);
  const result = pasteWidget(emptyDocument(), 0, copyWidget(checked(doc), 0, widget.id)!)!;
  const copy = result.document.pages[0].widgets[0];
  assert.equal(copy.type, 'button');
  if (copy.type !== 'button' || copy.action.type !== 'modal') throw new Error('missing action');
  assert.notEqual(copy.action.target, 'modal-source');
  assert.equal(copy.action.target, result.document.modals![0].id);
  assert.equal(result.document.modals![0].text, 'Текст окна');
});

test('invalid, future and unsafe clipboard data cannot mutate the document', () => {
  const doc = source(),
    before = structuredClone(doc),
    payload = JSON.parse(copyWidget(doc, 0, doc.pages[0].widgets[0].id)!);
  assert.equal(pasteWidget(doc, 0, 'ordinary text'), undefined);
  assert.equal(pasteWidget(doc, 0, '{"format":"another-app"}'), undefined);
  assert.throws(() => pasteWidget(doc, 0, JSON.stringify({ ...payload, version: 100 })));
  payload.widget.type = 'image';
  payload.widget.src = 'javascript:alert(1)';
  assert.throws(() => pasteWidget(doc, 0, JSON.stringify(payload)));
  assert.deepEqual(doc, before);
});

test('a full slide rejects insertion without removing or replacing its existing block', () => {
  const doc = source(),
    target = emptyDocument('presentation');
  const existing = createWidget('text', target, 0);
  existing.position = { col: 1, row: 1, width: 24, height: 12 };
  target.pages[0].widgets.push(existing);
  const before = structuredClone(target);
  assert.throws(() => pasteWidget(target, 0, copyWidget(doc, 0, doc.pages[0].widgets[0].id)!));
  assert.deepEqual(target, before);
});
