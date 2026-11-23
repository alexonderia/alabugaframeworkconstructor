import type { AFDocument } from '@alabuga/framework/schema';
import { EditorModel, checked } from './model';
import { EditorSaveQueue, type SaveServices } from './editor-save';
import type { EditorDocument } from './template-metadata';
import { prepareDocumentGrid } from './document-grid';

export interface SessionProject {
  id: string;
  document: AFDocument;
  version: number;
  deletedAt?: number;
}

export interface SessionServices extends Omit<SaveServices, 'write'> {
  write: (id: string, document: AFDocument, expectedVersion: number) => Promise<AFDocument>;
  read: (id: string) => Promise<SessionProject>;
  version: (id: string) => number;
}

/** Owns the editable document, write version and lifetime; storage and UI are injected. */
export class EditorSession {
  private model: EditorModel;
  private id: string;
  private storedVersion: number;
  private generation = 0;
  private readonly lifecycle = new AbortController();
  private readonly autosave: EditorSaveQueue;

  constructor(
    project: SessionProject,
    private readonly services: SessionServices,
  ) {
    this.model = new EditorModel(prepareDocumentGrid(project.document));
    this.id = project.id;
    this.storedVersion = project.version;
    this.autosave = new EditorSaveQueue({
      ...services,
      write: (id, document) => this.write(id, document),
    });
  }

  get projectId() {
    return this.id;
  }
  get version() {
    return this.storedVersion;
  }
  get document() {
    return this.model.document;
  }
  get canUndo() {
    return this.model.canUndo;
  }
  get canRedo() {
    return this.model.canRedo;
  }
  get signal() {
    return this.lifecycle.signal;
  }
  get queue() {
    return this.autosave.queue;
  }
  get saveError() {
    return this.autosave.error;
  }

  private assertActive() {
    if (this.signal.aborted) throw new Error('Сессия редактора завершена.');
  }
  private assertCurrent(generation: number) {
    this.assertActive();
    if (generation !== this.generation)
      throw new Error('Текущий проект изменился. Повторите действие.');
  }
  private async write(id: string, document: AFDocument) {
    // Already queued snapshots must still be persisted when the view is disposed.
    const stored = await this.services.write(
      id,
      document,
      id === this.id ? this.storedVersion : this.services.version(id),
    );
    if (id === this.id) this.storedVersion++;
    return stored;
  }
  save() {
    if (!this.signal.aborted) this.autosave.save(this.id, this.document);
  }
  change(edit: (document: AFDocument) => void, group?: string) {
    if (this.signal.aborted) return false;
    const next = this.document;
    edit(next);
    this.model.replace(prepareDocumentGrid(next), group);
    this.save();
    return true;
  }
  replace(document: AFDocument) {
    if (this.signal.aborted) return false;
    this.model.replace(prepareDocumentGrid(document));
    this.save();
    return true;
  }
  undo() {
    if (this.signal.aborted || !this.model.undo()) return false;
    this.save();
    return true;
  }
  redo() {
    if (this.signal.aborted || !this.model.redo()) return false;
    this.save();
    return true;
  }
  isExternalChange(change: { id: string; version: number }) {
    return !this.signal.aborted && change.id === this.id && change.version > this.storedVersion;
  }
  async checkpoint(failureMessage = 'Сначала сохраните проект или разрешите конфликт.') {
    this.assertActive();
    const id = this.id,
      document = this.document,
      generation = this.generation;
    await this.queue;
    this.assertCurrent(generation);
    if (this.saveError) throw new Error(failureMessage);
    await this.services.revision(id, document);
    this.assertCurrent(generation);
  }
  async startProject(document: AFDocument, failureMessage: string) {
    const model = new EditorModel(prepareDocumentGrid(document)),
      generation = this.generation;
    await this.checkpoint(failureMessage);
    this.assertCurrent(generation);
    this.id = crypto.randomUUID();
    this.storedVersion = 0;
    this.model = model;
    this.generation++;
  }
  openProject(id: string, document: AFDocument, version: number) {
    this.assertActive();
    if (id === this.id) this.model.replace(prepareDocumentGrid(document));
    else this.model = new EditorModel(prepareDocumentGrid(document));
    this.id = id;
    this.storedVersion = version;
    this.generation++;
  }
  async saveCopy() {
    this.assertActive();
    const generation = this.generation;
    await this.queue;
    this.assertCurrent(generation);
    const document = this.document,
      suffix = ' — копия';
    document.title = document.title.slice(0, 200 - suffix.length) + suffix;
    const id = crypto.randomUUID();
    await this.write(id, document);
    this.assertCurrent(generation);
    this.model = new EditorModel(document);
    this.id = id;
    this.storedVersion = this.services.version(id);
    this.generation++;
    this.autosave.acknowledge();
    this.services.changed(id);
  }
  async reloadSaved() {
    this.assertActive();
    const generation = this.generation,
      id = this.id;
    await this.queue;
    this.assertCurrent(generation);
    const project = await this.services.read(id);
    this.assertCurrent(generation);
    if (project.deletedAt)
      throw new Error('Проект в корзине. Сначала восстановите его или сохраните свою копию.');
    this.model = new EditorModel(prepareDocumentGrid(project.document));
    this.storedVersion = project.version;
    this.generation++;
    this.autosave.acknowledge();
  }
  async applyDocument(document: EditorDocument) {
    this.assertActive();
    const next = checked(prepareDocumentGrid(document)),
      generation = this.generation,
      id = this.id;
    await this.queue;
    this.assertCurrent(generation);
    await this.write(id, next);
    this.assertCurrent(generation);
    this.model.replace(next);
  }
  destroy() {
    if (this.signal.aborted) return;
    this.lifecycle.abort();
    this.autosave.destroy();
  }
}
