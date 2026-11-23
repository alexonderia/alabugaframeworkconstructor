import type { AFDocument } from '@alabuga/framework/schema';
import { frameworkDocument } from './template-metadata';

/** Section titles name the outline entries; only widgets form the visible content. */
export function documentContent(document: AFDocument): AFDocument {
  return {
    ...frameworkDocument(document),
    pages: document.pages.map((section) => ({ ...section, title: '' })),
  };
}
