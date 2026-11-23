import type { AFDocument, Section } from '@alabuga/framework/schema';
import type { LayoutVariant } from '@alabuga/framework/layout-variants';
import { sitePlacement, siteVariant } from './site';
import { slidePlacement, slideVariant } from './presentation';

const layouts = {
  page: { place: sitePlacement, variant: siteVariant },
  presentation: { place: slidePlacement, variant: slideVariant },
};

export const sectionPlacement = (
  kind: AFDocument['kind'],
  page: Section,
  width: number,
  height: number,
) => layouts[kind].place(page, width, height);

export const sectionVariant = (kind: AFDocument['kind'], page: Section, variant: LayoutVariant) =>
  layouts[kind].variant(page, variant);
