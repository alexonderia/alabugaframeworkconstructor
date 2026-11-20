import type { AFDocument } from '@alabuga/framework/schema';
export type { Asset } from '../project-file/format';
export type Project = {
  id: string;
  title: string;
  updated: number;
  document: AFDocument;
  version?: number;
  deletedAt?: number;
};

export type ProjectSummary = {
  id: string;
  title: string;
  kind: AFDocument['kind'];
  updated: number;
  sectionCount: number;
  version?: number;
  deletedAt?: number;
};

export const summary = (p: Project): ProjectSummary => ({
  id: p.id,
  title: p.title,
  kind: p.document.kind,
  updated: p.updated,
  sectionCount: p.document.pages.length,
  version: p.version ?? 0,
  ...(p.deletedAt ? { deletedAt: p.deletedAt } : {}),
});

export type Revision = { id: string; project: string; created: number; document: AFDocument };
