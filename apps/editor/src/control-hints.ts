import { el } from './ui';

// Info help is the innermost layer, before any drawer or editor Escape handler.
// Register once for the application; each instance clears its owner on hide/dispose.
let informationHelp: { owner: HTMLElement; dismiss: () => void } | undefined;
if (typeof window !== 'undefined')
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !informationHelp) return;
      const help = informationHelp;
      const visible = help.owner.isConnected && help.owner.getClientRects().length > 0;
      help.dismiss();
      if (visible) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true },
  );

/** Focusable information icon with the same hint for pointer and keyboard users. */
export function settingsInfo(label: string, text: string) {
  const control = el('span', 'settings-info');
  control.setAttribute('role', 'img');
  control.setAttribute('aria-label', label);
  control.tabIndex = 0;
  const icon = el('span', 'af-icon af-icon--info af-icon--sm');
  icon.setAttribute('aria-hidden', 'true');
  control.append(icon);
  control.dataset.info = '';
  control.dataset.hint = text;
  return control;
}

/** One top-layer hint for pointer and keyboard information icons. */
export function controlHints(host: HTMLElement, signal: AbortSignal) {
  const hint = el('div', 'control-hint');
  hint.id = 'control-hint-' + crypto.randomUUID();
  hint.setAttribute('role', 'tooltip');
  hint.setAttribute('popover', 'manual');
  host.append(hint);
  let owner: HTMLElement | undefined,
    pointerMuted = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const hide = () => {
    clearTimeout(timer);
    if (hint.matches(':popover-open')) hint.hidePopover();
    owner?.removeAttribute('aria-describedby');
    if (informationHelp?.owner === owner) informationHelp = undefined;
    owner = undefined;
  };
  const position = () => {
    if (!owner || !hint.matches(':popover-open')) return;
    const margin = 16;
    const gap = 8;
    const { clientWidth, clientHeight } = document.documentElement;
    const viewport = window.visualViewport;
    const x = viewport?.offsetLeft ?? 0;
    const y = viewport?.offsetTop ?? 0;
    const leftEdge = x + margin;
    const rightEdge = Math.min(clientWidth, x + (viewport?.width ?? clientWidth)) - margin;
    const topEdge = y + margin;
    const bottomEdge = Math.min(clientHeight, y + (viewport?.height ?? clientHeight)) - margin;
    hint.style.setProperty(
      '--control-hint-available-width',
      Math.max(0, rightEdge - leftEdge) + 'px',
    );
    const r = owner.getBoundingClientRect();
    const { width, height } = hint.getBoundingClientRect();
    const place = (left: number, top: number) => {
      hint.style.left = Math.max(leftEdge, Math.min(left, rightEdge - width)) + 'px';
      hint.style.top = Math.max(topEdge, Math.min(top, bottomEdge - height)) + 'px';
    };
    let anchor = r;
    if (owner.matches('[role=option]')) {
      const right = r.right + gap,
        left = r.left - gap - width;
      if (right + width <= rightEdge || left >= leftEdge) {
        place(right + width <= rightEdge ? right : left, r.top);
        return;
      }
      anchor = owner.closest('[role=listbox]')!.getBoundingClientRect();
    }
    const below = anchor.bottom + gap;
    place(anchor.left, below + height <= bottomEdge ? below : anchor.top - gap - height);
  };
  const show = (target: HTMLElement) => {
    clearTimeout(timer);
    if (
      signal.aborted ||
      !target.isConnected ||
      !target.dataset.hint ||
      !target.getClientRects().length
    )
      return;
    if (owner !== target) hide();
    owner = target;
    hint.textContent = target.dataset.hint;
    target.setAttribute('aria-describedby', hint.id);
    if (target.hasAttribute('data-info'))
      informationHelp = {
        owner: target,
        dismiss: () => {
          hide();
          pointerMuted = true;
        },
      };
    if (!hint.matches(':popover-open')) hint.showPopover();
    position();
  };
  host.addEventListener(
    'pointerover',
    (event) => {
      if (event.pointerType === 'touch') return;
      const target = (event.target as Element).closest<HTMLElement>('[data-hint]');
      if (!target || pointerMuted) return;
      clearTimeout(timer);
      timer = setTimeout(() => show(target), 180);
    },
    { signal },
  );
  host.addEventListener(
    'pointermove',
    (event) => {
      if (!pointerMuted) return;
      pointerMuted = false;
      const target = (event.target as Element).closest<HTMLElement>('[data-hint]');
      if (target) {
        clearTimeout(timer);
        timer = setTimeout(() => show(target), 180);
      }
    },
    { signal },
  );
  host.addEventListener(
    'pointerout',
    (event) => {
      const next = event.relatedTarget as Node | null;
      if (next && (hint.contains(next) || owner?.contains(next))) return;
      clearTimeout(timer);
      timer = setTimeout(hide, 120);
    },
    { signal },
  );
  hint.addEventListener('pointerenter', () => clearTimeout(timer), { signal });
  hint.addEventListener('pointerleave', hide, { signal });
  host.addEventListener(
    'focusin',
    (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-hint]');
      if (target) show(target);
      else hide();
    },
    { signal },
  );
  host.addEventListener('focusout', hide, { signal });
  host.addEventListener(
    'click',
    (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-info]');
      if (!target) {
        hide();
        pointerMuted = true;
      }
    },
    { signal },
  );
  host.addEventListener(
    'change',
    () => {
      hide();
      pointerMuted = true;
    },
    { signal },
  );
  // Select options retain focus on the combobox; expose the active option's help.
  host.addEventListener(
    'keydown',
    (event) => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      queueMicrotask(() => {
        const list = host.querySelector<HTMLElement>('[role=listbox]:not([hidden])');
        const target = list?.querySelector<HTMLElement>('[role=option][data-active]');
        if (target) show(target);
      });
    },
    { signal },
  );
  window.addEventListener('resize', position, { signal });
  window.addEventListener('scroll', position, { signal, capture: true, passive: true });
  window.visualViewport?.addEventListener('resize', position, { signal });
  window.visualViewport?.addEventListener('scroll', position, { signal, passive: true });
  const visibility = new MutationObserver(() => {
    if (owner && (!owner.isConnected || !owner.getClientRects().length)) hide();
  });
  visibility.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });
  signal.addEventListener(
    'abort',
    () => {
      hide();
      visibility.disconnect();
      hint.remove();
    },
    { once: true },
  );
  return {
    hide,
    dismiss() {
      if (!owner) return false;
      hide();
      pointerMuted = true;
      return true;
    },
  };
}
