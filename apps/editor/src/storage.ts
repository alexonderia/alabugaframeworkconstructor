/** Compatibility entry: existing callers share the same repositories and database. */
export type { Project, ProjectSummary, Revision, Asset } from './storage/types';
export {
  projectVersion,
  rememberProjectVersion,
  ProjectConflictError,
  subscribeProjectChanges,
} from './storage/project-state';
export {
  listProjects,
  listProjectSummaries,
  getProject,
  currentProject,
  activateProject,
  saveProject,
  renameProject,
  trashProject,
  restoreProject,
  deleteProject,
} from './storage/projects';
export { listAssets, describeAsset, addAsset, hydrate, materialCacheUsage } from './storage/assets';
export { mapImages } from './storage/images';
export { readSetting, writeSetting } from './storage/settings';
export { saveDraftSetting, loadDraftSetting } from './storage/drafts';
export { listRevisions, saveRevision } from './storage/revisions';
export { migrateLegacy } from './storage/legacy-import';
export { portableProject } from './storage/portable-project';
export { importProject } from './project-file/format';
export { inspectStorage, removeUnusedAssets } from './storage/maintenance';
