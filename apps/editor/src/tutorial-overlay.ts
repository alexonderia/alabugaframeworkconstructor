import { el } from './ui';

export type TutorialSpot = {
  target?: HTMLElement | null;
  allowed?: HTMLElement[];
  instruction?: string;
  interactive?: boolean;
};
type Rect = { left: number; top: number; right: number; bottom: number };
const focusable = 'button,input,textarea,select,a[href],summary,[tabindex],[contenteditable]';
const visible = (node: HTMLElement) =>
  node.isConnected &&
  node.getClientRects().length > 0 &&
  !node.closest('[hidden],[inert]') &&
  getComputedStyle(node).visibility !== 'hidden';

/** A viewport layer shared by the editor, its modal drawer and native dialogs. */
export function tutorialOverlay(
  root: HTMLElement,
  panel: HTMLElement,
  resolve: () => TutorialSpot,
  instruction: (text?: string) => void,
  exit: () => void,
  signal: AbortSignal,
) {
  const layer = el('div', 'tutorial-overlay'),
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    mask = document.createElementNS(svg.namespaceURI, 'mask'),
    background = document.createElementNS(svg.namespaceURI, 'rect'),
    shade = document.createElementNS(svg.namespaceURI, 'rect'),
    holes = document.createElementNS(svg.namespaceURI, 'g'),
    outlines = document.createElementNS(svg.namespaceURI, 'g');
  mask.id = 'tutorial-mask-' + crypto.randomUUID();
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  background.setAttribute('fill', 'white');
  shade.setAttribute('mask', `url(#${mask.id})`);
  shade.setAttribute('class', 'tutorial-shade');
  svg.setAttribute('class', 'tutorial-dimmer');
  svg.setAttribute('aria-hidden', 'true');
  mask.append(background, holes);
  svg.append(mask, shade, outlines);
  layer.append(svg);
  layer.setAttribute('popover', 'manual');
  let active = false,
    frame = 0,
    lastTarget: HTMLElement | undefined,
    lastGeometry = '',
    regions: HTMLElement[] = [],
    initialDialogs = new Set<HTMLDialogElement>();
  const resize = new ResizeObserver(() => schedule());
  resize.observe(panel);
  function mount() {
    const dialog = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1),
      drawer = root.querySelector<HTMLElement>('#inspector[aria-modal="true"]'),
      parent = dialog ?? drawer ?? document.body;
    if (layer.parentElement !== parent) {
      const focused = panel.contains(document.activeElement)
        ? (document.activeElement as HTMLElement)
        : undefined;
      if (layer.matches(':popover-open')) layer.hidePopover();
      parent.append(layer);
      lastGeometry = '';
      if (active) layer.showPopover();
      focused?.focus({ preventScroll: true });
    }
    if (panel.parentElement !== layer) layer.append(panel);
    if (active && !layer.matches(':popover-open')) layer.showPopover();
  }
  function clipped(node: HTMLElement): Rect | undefined {
    const viewport = window.visualViewport,
      left = viewport?.offsetLeft ?? 0,
      top = viewport?.offsetTop ?? 0,
      rect = node.getBoundingClientRect();
    const result = {
      left: Math.max(left, rect.left),
      top: Math.max(top, rect.top),
      right: Math.min(left + (viewport?.width ?? innerWidth), rect.right),
      bottom: Math.min(top + (viewport?.height ?? innerHeight), rect.bottom),
    };
    // Top-layer popovers are not clipped by their DOM ancestors.
    if (!node.matches(':popover-open'))
      for (
        let parent = node.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent),
          bounds = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
          result.left = Math.max(result.left, bounds.left);
          result.right = Math.min(result.right, bounds.right);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          result.top = Math.max(result.top, bounds.top);
          result.bottom = Math.min(result.bottom, bounds.bottom);
        }
      }
    return result.right > result.left && result.bottom > result.top ? result : undefined;
  }
  function update() {
    frame = 0;
    if (!active || signal.aborted) return;
    mount();
    const spot = resolve(),
      target = spot.target ?? undefined;
    instruction(spot.instruction);
    regions = [spot.interactive === false ? undefined : target, ...(spot.allowed ?? [])].filter(
      (node): node is HTMLElement => !!node?.isConnected,
    );
    // Framework select menus use their own top-layer popover.
    const lists = regions.flatMap((region) => {
      const controls = [
        region,
        ...region.querySelectorAll<HTMLElement>('[role=combobox][aria-expanded=true]'),
      ];
      return controls.flatMap((control) => {
        const id = control.getAttribute('aria-controls'),
          list = id ? document.getElementById(id) : null;
        return list && visible(list) ? [list] : [];
      });
    });
    regions.push(...lists);
    if (target !== lastTarget) {
      if (lastTarget) resize.unobserve(lastTarget);
      lastTarget = target;
      if (target) {
        resize.observe(target);
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      }
    }
    const rectangles = [target, ...lists]
      .filter((node): node is HTMLElement => !!node && visible(node))
      .map(clipped)
      .filter((rect): rect is Rect => !!rect);
    const viewport = window.visualViewport,
      x = viewport?.offsetLeft ?? 0,
      y = viewport?.offsetTop ?? 0,
      width = viewport?.width ?? innerWidth,
      height = viewport?.height ?? innerHeight,
      gap = 16,
      edge = 12,
      cardWidth = Math.min(360, width - edge * 2);
    panel.style.width = cardWidth + 'px';
    panel.style.maxHeight = Math.max(120, height - edge * 2) + 'px';
    const cardHeight = Math.min(panel.getBoundingClientRect().height, height - edge * 2),
      anchor = rectangles[0],
      clampX = (n: number) => Math.max(x + edge, Math.min(n, x + width - edge - cardWidth)),
      clampY = (n: number, h = cardHeight) =>
        Math.max(y + edge, Math.min(n, y + height - edge - h));
    let left = x + (width - cardWidth) / 2,
      top = y + (height - cardHeight) / 2;
    if (anchor) {
      const centreX = (anchor.left + anchor.right - cardWidth) / 2,
        centreY = (anchor.top + anchor.bottom - cardHeight) / 2,
        candidates = [
          { left: anchor.left - gap - cardWidth, top: clampY(centreY) },
          { left: anchor.right + gap, top: clampY(centreY) },
          { left: clampX(centreX), top: anchor.top - gap - cardHeight },
          { left: clampX(centreX), top: anchor.bottom + gap },
        ];
      const fits = candidates.find(
        (candidate) =>
          candidate.left >= x + edge &&
          candidate.left + cardWidth <= x + width - edge &&
          candidate.top >= y + edge &&
          candidate.top + cardHeight <= y + height - edge &&
          rectangles.every(
            (r) =>
              candidate.left + cardWidth <= r.left - 6 ||
              candidate.left >= r.right + 6 ||
              candidate.top + cardHeight <= r.top - 6 ||
              candidate.top >= r.bottom + 6,
          ),
      );
      if (fits) ({ left, top } = fits);
      else {
        const leftSpace = anchor.left - x - edge - gap,
          rightSpace = x + width - edge - anchor.right - gap,
          sideWidth = Math.min(cardWidth, Math.max(leftSpace, rightSpace));
        if (sideWidth >= 280) {
          panel.style.width = sideWidth + 'px';
          const actualHeight = Math.min(panel.getBoundingClientRect().height, height - edge * 2);
          left = leftSpace >= rightSpace ? anchor.left - gap - sideWidth : anchor.right + gap;
          top = clampY((anchor.top + anchor.bottom - actualHeight) / 2, actualHeight);
        } else {
          // On a phone the card uses the larger space above or below the field.
          const above = anchor.top - y - edge - gap,
            below = y + height - edge - anchor.bottom - gap;
          const available = Math.max(above, below);
          if (available >= 120) {
            panel.style.maxHeight = available + 'px';
            const actualHeight = Math.min(panel.getBoundingClientRect().height, available);
            left = clampX(centreX);
            top = above >= below ? anchor.top - gap - actualHeight : anchor.bottom + gap;
          } else {
            left = x + edge;
            top = y + edge;
          }
        }
      }
    }
    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
    const geometry = JSON.stringify([innerWidth, innerHeight, rectangles]);
    if (geometry !== lastGeometry) {
      lastGeometry = geometry;
      for (const node of [background, shade]) {
        node.setAttribute('width', String(innerWidth));
        node.setAttribute('height', String(innerHeight));
      }
      holes.replaceChildren();
      outlines.replaceChildren();
      for (const rect of rectangles) {
        for (const [parent, className] of [
          [holes, ''],
          [outlines, 'tutorial-spotlight'],
        ] as const) {
          const shape = document.createElementNS(svg.namespaceURI, 'rect');
          shape.setAttribute('x', String(rect.left - 5));
          shape.setAttribute('y', String(rect.top - 5));
          shape.setAttribute('width', String(rect.right - rect.left + 10));
          shape.setAttribute('height', String(rect.bottom - rect.top + 10));
          shape.setAttribute('rx', '8');
          if (className) shape.setAttribute('class', className);
          else shape.setAttribute('fill', 'black');
          parent.append(shape);
        }
      }
    }
  }
  function schedule() {
    if (active && !frame) frame = requestAnimationFrame(update);
  }
  const allowed = (node: EventTarget | null) =>
    node instanceof Node &&
    (panel.contains(node) || regions.some((region) => region.contains(node)));
  const guard = (event: Event) => {
    if (!active || !event.isTrusted || allowed(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const name of ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu'])
    window.addEventListener(name, guard, { capture: true, signal });
  window.addEventListener(
    'keydown',
    (event) => {
      if (!active) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        exit();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [
        ...new Set(
          [...regions, panel].flatMap((region) => [
            region,
            ...region.querySelectorAll<HTMLElement>(focusable),
          ]),
        ),
      ].filter((node) => visible(node) && node.tabIndex >= 0 && !node.matches(':disabled'));
      if (!controls.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = controls.indexOf(document.activeElement as HTMLElement),
        next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[next].focus({ preventScroll: true });
    },
    { capture: true, signal },
  );
  window.addEventListener(
    'scroll',
    (event) => {
      // Scrolling the instruction must not reset its own constrained height/scroll position.
      if (event.target instanceof Node && layer.contains(event.target)) return;
      schedule();
    },
    { capture: true, passive: true, signal },
  );
  window.addEventListener('resize', schedule, { signal });
  window.visualViewport?.addEventListener('resize', schedule, { signal });
  window.visualViewport?.addEventListener('scroll', schedule, { signal });
  document.addEventListener(
    'toggle',
    (event) => {
      if (!active || event.target === layer || !(event.target instanceof HTMLElement)) return;
      if (event.target.matches('[popover]:popover-open')) {
        // Keep the instruction above newly opened select menus as well.
        if (layer.matches(':popover-open')) layer.hidePopover();
        layer.showPopover();
      }
      schedule();
    },
    { capture: true, signal },
  );
  const observer = new MutationObserver((changes) => {
    if (changes.some((change) => !layer.contains(change.target))) schedule();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'hidden', 'class', 'disabled', 'aria-expanded', 'aria-modal'],
  });
  signal.addEventListener(
    'abort',
    () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      layer.remove();
    },
    { once: true },
  );
  return {
    setActive(value: boolean) {
      if (active === value) {
        schedule();
        return;
      }
      active = value;
      panel.classList.toggle('tutorial-floating', active);
      if (active) {
        initialDialogs = new Set(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
        mount();
        update();
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        if (layer.matches(':popover-open')) layer.hidePopover();
        for (const region of regions)
          for (const control of region.querySelectorAll<HTMLElement>(
            '[role=combobox][aria-expanded=true]',
          ))
            control.click();
        lastTarget = undefined;
        regions = [];
        instruction();
        for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]'))
          if (!initialDialogs.has(dialog)) dialog.close();
      }
    },
    refresh: schedule,
  };
}
