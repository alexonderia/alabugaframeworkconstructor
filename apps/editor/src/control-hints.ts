import { el } from './ui';

/** One top-layer hint for pointer, keyboard and click-to-pin information controls. */
export function controlHints(host: HTMLElement, signal: AbortSignal) {
  const hint = el('div', 'control-hint');
  hint.id = 'control-hint-' + crypto.randomUUID();
  hint.setAttribute('role', 'tooltip');
  hint.setAttribute('popover', 'manual');
  host.append(hint);
  let owner: HTMLElement | undefined,
    pinned = false,
    pointerMuted = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const hide = () => {
    clearTimeout(timer);
    if (hint.matches(':popover-open')) hint.hidePopover();
    owner?.removeAttribute('aria-describedby');
    if (owner?.hasAttribute('data-info')) owner.setAttribute('aria-expanded', 'false');
    owner = undefined;
    pinned = false;
  };
  const position = () => {
    if (!owner || !hint.matches(':popover-open')) return;
    const r = owner.getBoundingClientRect(),
      margin = 12,
      gap = 8;
    const width = hint.offsetWidth,
      height = hint.offsetHeight;
    if (owner.matches('[role=option]')) {
      const right = r.right + gap,
        left = r.left - gap - width;
      if (right + width <= innerWidth - margin || left >= margin) {
        hint.style.left = (right + width <= innerWidth - margin ? right : left) + 'px';
        hint.style.top = Math.max(margin, Math.min(r.top, innerHeight - height - margin)) + 'px';
        return;
      }
      const list = owner.closest('[role=listbox]')!.getBoundingClientRect();
      hint.style.left = Math.max(margin, Math.min(list.left, innerWidth - width - margin)) + 'px';
      hint.style.top =
        Math.max(
          margin,
          list.bottom + gap + height < innerHeight - margin
            ? list.bottom + gap
            : list.top - gap - height,
        ) + 'px';
      return;
    }
    hint.style.left = Math.max(margin, Math.min(r.left, innerWidth - width - margin)) + 'px';
    hint.style.top =
      Math.max(
        margin,
        r.bottom + gap + height < innerHeight - margin ? r.bottom + gap : r.top - gap - height,
      ) + 'px';
  };
  const show = (target: HTMLElement, pin = false) => {
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
    pinned = pin || pinned;
    hint.textContent = target.dataset.hint;
    target.setAttribute('aria-describedby', hint.id);
    if (target.hasAttribute('data-info')) target.setAttribute('aria-expanded', String(pinned));
    if (!hint.matches(':popover-open')) hint.showPopover();
    position();
  };
  host.addEventListener(
    'pointerover',
    (event) => {
      if (event.pointerType === 'touch') return;
      const target = (event.target as Element).closest<HTMLElement>('[data-hint]');
      if (!target || pinned || pointerMuted) return;
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
      if (target && !pinned) {
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
      if (pinned || (next && (hint.contains(next) || owner?.contains(next)))) return;
      clearTimeout(timer);
      timer = setTimeout(hide, 120);
    },
    { signal },
  );
  hint.addEventListener('pointerenter', () => clearTimeout(timer), { signal });
  hint.addEventListener(
    'pointerleave',
    () => {
      if (!pinned) hide();
    },
    { signal },
  );
  host.addEventListener(
    'focusin',
    (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-hint]');
      if (target) show(target);
      else if (!pinned) hide();
    },
    { signal },
  );
  host.addEventListener(
    'focusout',
    () => {
      if (!pinned) hide();
    },
    { signal },
  );
  host.addEventListener(
    'click',
    (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-info]');
      if (target) {
        if (owner === target && pinned) hide();
        else show(target, true);
      } else {
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
