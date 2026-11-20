import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EditorSession,
  type SessionProject,
  type SessionServices,
} from '../apps/editor/src/editor-session';
import { emptyDocument } from '../apps/editor/src/model';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}
function fixture() {
  const initial = emptyDocument();
  initial.title = 'Исходный проект';
  const projects = new Map<string, SessionProject>([
    ['original', { id: 'original', document: structuredClone(initial), version: 4 }],
  ]);
  const writes: { id: string; title: string; expectedVersion: number }[] = [],
    revisions: { id: string; title: string }[] = [],
    states: string[] = [],
    changed: string[] = [];
  let writeGate: Promise<void> | undefined,
    readGate: Promise<void> | undefined,
    failWrites = false,
    failRevisions = false;
  const services: SessionServices = {
    write: async (id, document, expectedVersion) => {
      await writeGate;
      if (failWrites) throw Error('Запись недоступна');
      if (expectedVersion !== (projects.get(id)?.version ?? 0)) throw Error('Конфликт версий');
      writes.push({ id, title: document.title, expectedVersion });
      projects.set(id, { id, document: structuredClone(document), version: expectedVersion + 1 });
      return structuredClone(document);
    },
    read: async (id) => {
      const project = structuredClone(projects.get(id)!);
      await readGate;
      return project;
    },
    version: (id) => projects.get(id)?.version ?? 0,
    revision: async (id, document) => {
      if (failRevisions) throw Error('История недоступна');
      revisions.push({ id, title: document.title });
    },
    state: (state) => states.push(state),
    changed: (id) => changed.push(id),
    revisionError: (error) => {
      throw error;
    },
    revisionDelay: 5,
  };
  const session = new EditorSession(projects.get('original')!, services);
  return {
    session,
    projects,
    writes,
    revisions,
    states,
    changed,
    set writeGate(value: Promise<void> | undefined) {
      writeGate = value;
    },
    set readGate(value: Promise<void> | undefined) {
      readGate = value;
    },
    set failWrites(value: boolean) {
      failWrites = value;
    },
    set failRevisions(value: boolean) {
      failRevisions = value;
    },
  };
}

test('session coalesces edits, advances confirmed versions and keeps grouped undo independent of snapshots', async (t) => {
  const f = fixture(),
    gate = deferred();
  t.after(() => f.session.destroy());
  f.writeGate = gate.promise;
  for (let i = 0; i < 20; i++) f.session.change((doc) => (doc.title = 'Правка ' + i), 'typing');
  const copy = f.session.document;
  copy.title = 'Не отправлено';
  gate.resolve();
  await f.session.queue;
  assert.deepEqual(
    f.writes.map((write) => [write.title, write.expectedVersion]),
    [
      ['Правка 0', 4],
      ['Правка 19', 5],
    ],
  );
  assert.equal(f.session.version, 6);
  assert.equal(f.session.document.title, 'Правка 19');
  assert.equal(f.session.undo(), true);
  await f.session.queue;
  assert.equal(f.session.document.title, 'Исходный проект');
  assert.equal(f.session.redo(), true);
  await f.session.queue;
  assert.equal(f.session.document.title, 'Правка 19');
  assert.equal(f.session.version, 8);
  assert.equal(f.session.isExternalChange({ id: 'original', version: 8 }), false);
  assert.equal(f.session.isExternalChange({ id: 'original', version: 9 }), true);
  assert.equal(f.session.isExternalChange({ id: 'other', version: 9 }), false);
});

test('invalid changes do not alter session state, history or stored versions', (t) => {
  const f = fixture();
  t.after(() => f.session.destroy());
  const before = f.session.document;
  assert.throws(() => f.session.change((doc) => (doc.title = '')));
  assert.deepEqual(f.session.document, before);
  assert.equal(f.session.canUndo, false);
  assert.equal(f.session.version, 4);
  assert.equal(f.writes.length, 0);
  assert.throws(() => f.session.openProject('other', { ...before, title: '' }, 10));
  assert.equal(f.session.projectId, 'original');
  assert.equal(f.session.version, 4);
});

test('starting a project waits for pending persistence and preserves the old session on failure', async (t) => {
  const f = fixture();
  t.after(() => f.session.destroy());
  f.failWrites = true;
  f.session.change((doc) => (doc.title = 'Не потерять'));
  await f.session.queue;
  const next = emptyDocument('presentation');
  await assert.rejects(f.session.startProject(next, 'Не сохранено'), /Не сохранено/);
  assert.equal(f.session.projectId, 'original');
  assert.equal(f.session.document.title, 'Не потерять');
  assert.equal(f.revisions.length, 0);
  f.failWrites = false;
  f.session.save();
  await f.session.queue;
  f.failRevisions = true;
  await assert.rejects(f.session.startProject(next, 'Не сохранено'), /История недоступна/);
  assert.equal(f.session.projectId, 'original');
  assert.equal(f.session.canUndo, true);
  f.failRevisions = false;
  await f.session.startProject(next, 'Не сохранено');
  assert.notEqual(f.session.projectId, 'original');
  assert.equal(f.session.version, 0);
  assert.equal(f.session.canUndo, false);
  assert.equal(f.session.document.kind, 'presentation');
  assert.deepEqual(f.revisions, [{ id: 'original', title: 'Не потерять' }]);
  f.session.save();
  await f.session.queue;
  assert.equal(f.writes.at(-1)!.expectedVersion, 0);
  assert.equal(f.projects.get('original')!.document.title, 'Не потерять');
});

test('a conflicting session keeps its document on failed copy and can recover into a separate project', async (t) => {
  const f = fixture();
  t.after(() => f.session.destroy());
  f.projects.get('original')!.version = 5;
  f.session.change((doc) => (doc.title = 'А'.repeat(200)));
  await f.session.queue;
  assert.equal(f.session.saveError, true);
  assert.equal(f.session.version, 4);
  const original = structuredClone(f.projects.get('original'));
  f.failWrites = true;
  await assert.rejects(f.session.saveCopy(), /Запись недоступна/);
  assert.equal(f.session.projectId, 'original');
  assert.equal(f.session.document.title.length, 200);
  assert.equal(f.session.canUndo, true);
  f.failWrites = false;
  await f.session.saveCopy();
  assert.notEqual(f.session.projectId, 'original');
  assert.equal(f.session.version, 1);
  assert.equal(f.session.saveError, false);
  assert.equal(f.session.canUndo, false);
  assert.equal(f.session.document.title, 'А'.repeat(192) + ' — копия');
  assert.deepEqual(f.projects.get('original'), original);
  f.session.change((doc) => (doc.title = 'Копия после правки'));
  await f.session.queue;
  assert.equal(f.writes.at(-1)!.expectedVersion, 1);
  assert.deepEqual(f.projects.get('original'), original);
});

test('reloading uses the latest saved version and refuses a deleted or malformed project atomically', async (t) => {
  const f = fixture();
  t.after(() => f.session.destroy());
  f.session.change((doc) => (doc.title = 'Местная правка'));
  await f.session.queue;
  const saved = f.projects.get('original')!;
  saved.document.title = 'Версия другой вкладки';
  saved.version = 9;
  saved.deletedAt = 1;
  await assert.rejects(f.session.reloadSaved(), /Проект в корзине/);
  assert.equal(f.session.document.title, 'Местная правка');
  assert.equal(f.session.version, 5);
  delete saved.deletedAt;
  saved.document.title = '';
  await assert.rejects(f.session.reloadSaved());
  assert.equal(f.session.document.title, 'Местная правка');
  assert.equal(f.session.version, 5);
  saved.document.title = 'Версия другой вкладки';
  await f.session.reloadSaved();
  assert.equal(f.session.document.title, 'Версия другой вкладки');
  assert.equal(f.session.version, 9);
  assert.equal(f.session.canUndo, false);
  f.session.change((doc) => (doc.title = 'После загрузки'));
  await f.session.queue;
  assert.equal(f.writes.at(-1)!.expectedVersion, 9);
});

test('a persisted document replacement is one undo action and a failed write leaves the live document intact', async (t) => {
  const f = fixture();
  t.after(() => f.session.destroy());
  const next = f.session.document;
  next.title = 'Применённый черновик';
  await assert.rejects(f.session.applyDocument({ ...next, title: '' }));
  assert.equal(f.writes.length, 0);
  assert.equal(f.session.document.title, 'Исходный проект');
  f.failWrites = true;
  await assert.rejects(f.session.applyDocument(next), /Запись недоступна/);
  assert.equal(f.session.document.title, 'Исходный проект');
  assert.equal(f.session.canUndo, false);
  assert.equal(f.session.version, 4);
  f.failWrites = false;
  await f.session.applyDocument(next);
  assert.equal(f.session.version, 5);
  assert.equal(f.writes.length, 1);
  assert.equal(f.session.undo(), true);
  await f.session.queue;
  assert.equal(f.session.document.title, 'Исходный проект');
});

test('disposing a session keeps queued snapshots durable and stops callbacks, revisions and further edits', async () => {
  const f = fixture(),
    gate = deferred();
  f.writeGate = gate.promise;
  f.session.change((doc) => (doc.title = 'Первый снимок'));
  f.session.change((doc) => (doc.title = 'Последний снимок'));
  const states = f.states.length;
  f.session.destroy();
  f.session.destroy();
  assert.equal(f.session.signal.aborted, true);
  assert.equal(
    f.session.change((doc) => (doc.title = 'Поздняя правка')),
    false,
  );
  gate.resolve();
  await f.session.queue;
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(
    f.writes.map((write) => write.title),
    ['Первый снимок', 'Последний снимок'],
  );
  assert.equal(f.states.length, states);
  assert.deepEqual(f.changed, []);
  assert.deepEqual(f.revisions, []);
  assert.equal(f.session.undo(), false);
  await assert.rejects(f.session.reloadSaved(), /Сессия редактора завершена/);
});

test('an obsolete read cannot replace a switched or disposed session', async (t) => {
  const f = fixture(),
    gate = deferred();
  t.after(() => f.session.destroy());
  f.readGate = gate.promise;
  const loading = f.session.reloadSaved();
  await Promise.resolve();
  const other = emptyDocument();
  other.title = 'Другой проект';
  f.session.openProject('other', other, 12);
  gate.resolve();
  await assert.rejects(loading, /Текущий проект изменился/);
  assert.equal(f.session.projectId, 'other');
  assert.equal(f.session.document.title, 'Другой проект');
  assert.equal(f.session.version, 12);
  const nextGate = deferred();
  f.readGate = nextGate.promise;
  f.projects.set('other', { id: 'other', document: other, version: 12 });
  const pending = f.session.reloadSaved();
  await Promise.resolve();
  f.session.destroy();
  nextGate.resolve();
  await assert.rejects(pending, /Сессия редактора завершена/);
  assert.equal(f.session.document.title, 'Другой проект');
});

test('switching projects while an old write completes keeps each project version and undo history separate', async (t) => {
  const f = fixture(),
    gate = deferred();
  t.after(() => f.session.destroy());
  f.writeGate = gate.promise;
  f.session.change((doc) => (doc.title = 'Запись первого проекта'));
  const other = emptyDocument();
  other.title = 'Второй проект';
  f.projects.set('other', { id: 'other', document: other, version: 10 });
  f.session.openProject('other', other, 10);
  assert.equal(f.session.canUndo, false);
  f.session.change((doc) => (doc.title = 'Правка второго проекта'));
  gate.resolve();
  await f.session.queue;
  assert.equal(f.session.version, 11);
  assert.equal(f.projects.get('original')!.version, 5);
  assert.deepEqual(
    f.writes.map((write) => [write.id, write.expectedVersion]),
    [
      ['original', 4],
      ['other', 10],
    ],
  );
  f.session.openProject('other', { ...other, title: 'История второго' }, 11);
  assert.equal(f.session.canUndo, true);
});
