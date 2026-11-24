import type { AFDocument, Widget } from '@alabuga/framework/schema';
import { sectionVariant } from './layout/placement';

export type TutorialTarget = { sectionId: string; widgetId?: string; textIndex?: number };
export type TutorialTask = {
  target?: TutorialTarget;
  baseline?: string;
  complete?: boolean;
  skipped?: boolean;
};
export type TutorialState = {
  version: 2;
  enabled: boolean;
  dismissed: boolean;
  section: number;
  current: number;
  tasks: TutorialTask[];
  previewed: boolean;
  exported: boolean;
};

export function initialTutorial(value?: Partial<TutorialState>): TutorialState {
  // Checklist ticks from the old tutorial are not evidence of an editor action.
  const modern = value?.version === 2;
  return {
    version: 2,
    enabled: value?.enabled === true,
    dismissed: modern ? value.dismissed === true : value?.enabled === false,
    section: Math.max(0, value?.section ?? 0),
    current: modern ? Math.max(0, Math.min(5, value.current ?? 0)) : 0,
    tasks: Array.from({ length: 5 }, (_, index) => (modern ? (value.tasks?.[index] ?? {}) : {})),
    previewed: modern && value.previewed === true,
    exported: modern && value.exported === true,
  };
}

function textWidget(widget: Widget) {
  return widget.type === 'text' && widget.content.some((block) => 'text' in block);
}

export function tutorialLayout(doc: AFDocument, sectionId: string) {
  const page = doc.pages.find(({ id }) => id === sectionId);
  if (!page) return false;
  try {
    sectionVariant(doc.kind, page, page.layoutVariant === 'asymmetric' ? 'primary' : 'asymmetric');
    return true;
  } catch {
    return false;
  }
}

export function tutorialTarget(doc: AFDocument, step: number, section: number): TutorialTarget {
  const current = doc.pages[Math.min(section, doc.pages.length - 1)];
  const pages = [current, ...doc.pages.filter((page) => page !== current)];
  if (step === 1)
    return { sectionId: pages.find((page) => tutorialLayout(doc, page.id))?.id ?? current.id };
  if (step === 4) return { sectionId: current.id };
  const candidates = pages.flatMap((page) => page.widgets.map((widget) => ({ page, widget })));
  const found =
    step === 2
      ? candidates.find(({ widget }) => widget.type === 'image')
      : (candidates.find(
          ({ widget }) =>
            widget.type === 'text' && widget.content.some((block) => block.type === 'heading'),
        ) ?? candidates.find(({ widget }) => textWidget(widget)));
  if (!found) return { sectionId: current.id };
  const { page, widget } = found;
  const textIndex =
    widget.type === 'text' ? widget.content.findIndex((block) => block.type === 'heading') : -1;
  return {
    sectionId: page.id,
    widgetId: widget.id,
    ...(widget.type === 'text'
      ? {
          textIndex:
            textIndex < 0 ? widget.content.findIndex((block) => 'text' in block) : textIndex,
        }
      : {}),
  };
}

export function tutorialValue(doc: AFDocument, step: number, target: TutorialTarget) {
  const page = doc.pages.find(({ id }) => id === target.sectionId);
  if (!page) return undefined;
  if (step === 1)
    return tutorialLayout(doc, page.id) ? (page.layoutVariant ?? 'default') : undefined;
  const widget = page.widgets.find(({ id }) => id === target.widgetId);
  if (!widget) return undefined;
  if (step === 0 && widget.type === 'text') {
    const block = widget.content[target.textIndex ?? 0];
    return block && 'text' in block ? block.text.trim() : undefined;
  }
  if (step === 2 && widget.type === 'image') return widget.src;
  if (step === 3)
    return JSON.stringify([widget.style, widget.typography, widget.align, widget.surface]);
  return undefined;
}

export function tutorialHeading(doc: AFDocument, target?: TutorialTarget) {
  const widget = doc.pages
    .find(({ id }) => id === target?.sectionId)
    ?.widgets.find(({ id }) => id === target?.widgetId);
  return widget?.type === 'text' && widget.content[target?.textIndex ?? 0]?.type === 'heading';
}
