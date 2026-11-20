import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importProject } from '../apps/editor/src/project-file/format';
import { emptyDocument, createWidget, checked } from '../apps/editor/src/model';

test('the standalone project parser resolves backgrounds, images and galleries without mutating its input', () => {
  const asset = 'asset:' + 'a'.repeat(64),
    data = 'data:image/png;base64,AA==',
    empty = emptyDocument(),
    document = checked({
      ...empty,
      pages: [{ ...empty.pages[0], appearance: { background: asset } }],
    });
  const image = createWidget('image', document, 0);
  document.pages[0].widgets.push(image);
  const gallery = createWidget('gallery', document, 0);
  if (image.type !== 'image' || gallery.type !== 'gallery') throw Error('Wrong fixture');
  image.src = asset;
  gallery.items.forEach((item) => (item.src = asset));
  document.pages[0].widgets = [image, gallery];
  const input = {
      format: 'alabuga-project',
      version: 3,
      document,
      assets: [{ id: asset.slice(6), data }],
    },
    before = structuredClone(input);
  const parsed = importProject(input);
  assert.equal(parsed.pages[0].appearance!.background, data);
  assert.equal(parsed.pages[0].widgets[0].type === 'image' && parsed.pages[0].widgets[0].src, data);
  assert.ok(
    parsed.pages[0].widgets[1].type === 'gallery' &&
      parsed.pages[0].widgets[1].items.every((item) => item.src === data),
  );
  assert.deepEqual(input, before);
  assert.equal(typeof indexedDB, 'undefined');
});
