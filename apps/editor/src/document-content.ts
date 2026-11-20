import type { AFDocument } from '@alabuga/framework/schema';

/** Section titles name the outline entries; only widgets form the visible content. */
export function documentContent(document: AFDocument): AFDocument {
  return { ...document, pages: document.pages.map((section) => ({ ...section, title: '' })) };
}
