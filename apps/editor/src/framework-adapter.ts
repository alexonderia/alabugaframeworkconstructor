import {
  renderDocument as render,
  type DocumentController,
  type AFDocument,
} from '@alabuga/framework';
import { assetsBaseUrl } from './framework-assets';
export { assetsBaseUrl, embedLocalImage } from './framework-assets';
import { fitSlide as fit, type FitSlideOptions } from '@alabuga/framework/slide-fit';
import { validateDocument } from '@alabuga/framework/schema';
import { documentContent } from './document-content';
export type { DocumentController, AFDocument };
export const frameworkDom = Object.freeze({
  panel: '.af-panel',
  activeSlide: '.af-slide--active',
  widgets: '[data-widget-id]',
  sections: '[data-section-id]',
  content: '.af-widget__content',
  overflow: '.af-widget__content,.af-table-scroll',
  heading: ':scope > .af-heading,:scope > .af-slide__title',
  label: '.af-label',
  copy: '.af-title,.af-prose p,.af-metric__value',
  sectionById: (id: string) => '[data-section-id="' + CSS.escape(id) + '"]',
  widgetById: (id: string) => '[data-widget-id="' + CSS.escape(id) + '"]',
  sectionBackground: (id: string) => frameworkDom.sectionById(id) + ' > .af-section-background',
  editableWidget: (id: string) => frameworkDom.widgetById(id) + ' [contenteditable]',
  title: '.af-widget__title',
  prose: '.af-prose',
  metric: '.af-metric__value',
  caption: '.af-caption',
  action: '[data-action-id]',
  quote: '.af-quote__text',
  author: '.af-quote__author',
  card: '.af-feature',
  cardTitle: '.af-feature__title',
  cardText: '.af-feature__text',
  galleryCaption: 'figcaption',
  tableRows: 'tbody tr',
});
function readDocument(input: unknown) {
  const result = validateDocument(input);
  if (!result.success) throw new Error(result.issues.map((issue) => issue.message).join('; '));
  return result.data;
}
export const renderDocument: typeof render = (container, input, options = {}) => {
  let document = readDocument(input);
  const controller = render(container, documentContent(document), {
    assetsBaseUrl: assetsBaseUrl(),
    ...options,
  });
  return {
    ...controller,
    update(input) {
      const next = readDocument(input);
      controller.update(documentContent(next));
      document = next;
    },
    synchronize(input) {
      const next = readDocument(input);
      controller.synchronize(documentContent(next));
      document = next;
    },
    getDocument() {
      return structuredClone(document);
    },
  };
};
export const fitSlide: typeof fit = async (slide, options: FitSlideOptions = {}) => {
  const result = await fit({ ...slide, title: '' }, { assetsBaseUrl: assetsBaseUrl(), ...options });
  return { ...result, slide: { ...result.slide, title: slide.title } };
};
