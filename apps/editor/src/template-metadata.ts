import type { AFDocument, Section } from '@alabuga/framework/schema';

export type TemplateRef = { id: string; version: number };
export type TemplateInfo = {
  document?: TemplateRef;
  sections?: Record<string, TemplateRef>;
  unplaced?: Section[];
  documentGrid?: Section['grid'];
  gridOverrides?: string[];
};

export type EditorDocument = AFDocument & { templateInfo?: TemplateInfo };

export function templateInfo(document: AFDocument) {
  return (document as EditorDocument).templateInfo;
}

export function editTemplateInfo(document: AFDocument) {
  return ((document as EditorDocument).templateInfo ??= {});
}

export function sectionTemplateRef(document: AFDocument, id: string) {
  const sections = templateInfo(document)?.sections;
  return sections && Object.hasOwn(sections, id) ? sections[id] : undefined;
}

export function frameworkDocument(document: EditorDocument): AFDocument {
  const { templateInfo: _metadata, ...framework } = document;
  return framework;
}

export function documentSections(document: AFDocument): readonly Section[] {
  const unplaced = templateInfo(document)?.unplaced;
  return unplaced?.length ? [...document.pages, ...unplaced] : document.pages;
}
