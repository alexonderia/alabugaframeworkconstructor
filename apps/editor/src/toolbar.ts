import { el } from '@alabuga/framework/dom';
import { compactEditorQuery, labelEditorCommands } from './editor-commands';
/** Move canonical controls, keeping handlers and state across breakpoints. */
export function compactToolbar(root: HTMLElement, signal: AbortSignal) {
  const toolbar = root.querySelector<HTMLElement>('.canvas-toolbar')!,
    more = toolbar.querySelector<HTMLDetailsElement>('.editor-more')!,
    view = more.querySelector<HTMLElement>('.editor-more-body')!,
    section = toolbar.querySelector<HTMLElement>('.section-toolbar')!,
    menu = root.querySelector<HTMLElement>('.project-menu>div')!;
  const media = matchMedia(compactEditorQuery),
    mobile = el('nav', 'mobile-editor-actions');
  mobile.setAttribute('aria-label', 'Инструменты редактора');
  root.append(mobile);
  section.prepend(root.querySelector('.outline-toggle')!);
  const zoom = root.querySelector('.canvas-zoom');
  if (zoom) view.append(zoom);
  const ai = root.querySelector('.ai-open');
  if (ai) section.append(ai);
  const controls = [
    '.outline-toggle',
    '#add-widget',
    '#page-settings-open',
    '#preview',
    '#save',
    '#export',
    '.quality-open',
  ].map((selector) => {
    const node = root.querySelector<HTMLElement>(selector)!,
      anchor = document.createComment(selector);
    node.before(anchor);
    return { node, anchor };
  });
  // CSS can hide the old control before matchMedia delivers its change event.
  let responsiveFocus: HTMLElement | undefined;
  root.addEventListener(
    'focusin',
    (event) => {
      const node = event.target as HTMLElement;
      responsiveFocus =
        controls.some((c) => c.node === node) || view.contains(node) ? node : undefined;
    },
    { signal },
  );
  root.addEventListener(
    'focusout',
    (event) => {
      if (event.relatedTarget instanceof Node && !root.contains(event.relatedTarget))
        responsiveFocus = undefined;
    },
    { signal },
  );
  document.addEventListener('pointerdown', () => (responsiveFocus = undefined), {
    capture: true,
    signal,
  });
  const updateInset = () => {
    if (media.matches)
      root.style.setProperty(
        '--constructor-mobile-actions-height',
        Math.ceil(mobile.getBoundingClientRect().height) + 'px',
      );
    else root.style.removeProperty('--constructor-mobile-actions-height');
  };
  const sync = () => {
    const active =
      document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
        ? document.activeElement
        : document.activeElement === document.body && responsiveFocus?.isConnected
          ? responsiveFocus
          : undefined;
    more.open = !media.matches;
    labelEditorCommands(
      root,
      root.dataset.documentKind === 'presentation' ? 'presentation' : 'page',
    );
    const projectFiles: HTMLElement[] = [];
    for (const { node, anchor } of controls) {
      if (node.id === 'add-widget') node.hidden = !media.matches;
      const projectFile =
        node.id === 'save' || node.id === 'export' || node.classList.contains('quality-open');
      if (node.classList.contains('quality-open')) {
        node.classList.toggle('af-btn--icon', !media.matches);
        node.classList.toggle('command-row', media.matches);
      }
      if (media.matches && projectFile) projectFiles.push(node);
      else if (media.matches) mobile.append(node);
      else anchor.after(node);
      if (!projectFile) {
        node.classList.toggle('af-btn--sm', !media.matches && !!node.closest('.canvas-toolbar'));
        node.classList.toggle('af-btn--lg', media.matches);
      }
    }
    if (projectFiles.length) menu.append(...projectFiles);
    updateInset();
    if (active) {
      const visible = (node: HTMLElement | undefined) =>
        node?.getClientRects().length &&
        !node.closest('[hidden],[inert],details:not([open]) > :not(summary)') &&
        !node.matches(':disabled');
      const target = visible(active)
        ? active
        : menu.contains(active)
          ? menu.parentElement?.querySelector<HTMLElement>('summary')
          : view.contains(active)
            ? more.querySelector<HTMLElement>('summary')
            : active.classList.contains('outline-toggle')
              ? root.querySelector<HTMLElement>('.outline-select[aria-current=true]')
              : undefined;
      if (target && document.activeElement !== target) target.focus({ preventScroll: true });
    }
  };
  sync();
  media.addEventListener('change', sync, { signal });
  const resize = new ResizeObserver(updateInset);
  resize.observe(mobile);
  const header = root.querySelector<HTMLElement>('.editor-header')!;
  const dimensions = new ResizeObserver(() => {
    root.style.setProperty(
      '--constructor-header-height',
      Math.ceil(header.getBoundingClientRect().height) + 'px',
    );
    root.style.setProperty(
      '--constructor-toolbar-height',
      Math.ceil(toolbar.getBoundingClientRect().height) + 'px',
    );
  });
  dimensions.observe(header);
  dimensions.observe(toolbar);
  const picker = root.querySelector<HTMLSelectElement>('#pages')!;
  const measure = document.createElement('canvas').getContext('2d')!;
  let pickerFrame = 0;
  const sizePicker = () => {
    pickerFrame = 0;
    if (signal.aborted) return;
    const control = picker.parentElement?.querySelector<HTMLElement>('.af-select__control');
    if (!control) return;
    const style = getComputedStyle(control);
    measure.font = style.font;
    const text = Math.max(
      0,
      ...Array.from(picker.options, (option) => measure.measureText(option.label).width),
    );
    const arrow = control.querySelector<HTMLElement>('.af-select__arrow');
    const width =
      text +
      parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight) +
      parseFloat(style.columnGap) +
      (arrow?.getBoundingClientRect().width || 16) +
      2;
    toolbar.style.setProperty('--constructor-section-picker-width', Math.ceil(width) + 'px');
  };
  const schedulePicker = () => {
    if (!pickerFrame && !signal.aborted) pickerFrame = requestAnimationFrame(sizePicker);
  };
  const pickerOptions = new MutationObserver(schedulePicker);
  pickerOptions.observe(picker, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  void document.fonts.ready.then(schedulePicker);
  document.fonts.addEventListener('loadingdone', schedulePicker, { signal });
  schedulePicker();
  root.querySelectorAll<HTMLDetailsElement>('.project-menu,.editor-more').forEach((details) =>
    details.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && details.open) {
          event.preventDefault();
          details.open = false;
          details.querySelector<HTMLElement>('summary')?.focus();
        }
      },
      { signal },
    ),
  );
  signal.addEventListener(
    'abort',
    () => {
      resize.disconnect();
      dimensions.disconnect();
      pickerOptions.disconnect();
      cancelAnimationFrame(pickerFrame);
      root.style.removeProperty('--constructor-header-height');
      root.style.removeProperty('--constructor-toolbar-height');
      root.style.removeProperty('--constructor-mobile-actions-height');
      mobile.remove();
    },
    { once: true },
  );
}
