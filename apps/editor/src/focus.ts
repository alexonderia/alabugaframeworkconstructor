import { frameworkDom as dom } from './framework-adapter';
/** Restore contextual controls without scrolling the canvas or losing a text selection. */
export function captureFocus(host: HTMLElement) {
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  const selectors = 'input,textarea,select,button,[role=slider],[role=tab]';
  const key = (n: Element) =>
    n.id ||
    n.getAttribute('aria-label') ||
    n.closest('label')?.querySelector(dom.label)?.textContent ||
    (n.matches('button') ? n.textContent?.trim() : '') ||
    '';
  const identity = active && key(active),
    fields = Array.from(host.querySelectorAll(selectors)),
    index = fields.indexOf(active!),
    occurrence = fields.filter((n) => key(n) === identity).indexOf(active!),
    start = active?.selectionStart,
    end = active?.selectionEnd,
    scroll = host.scrollTop;
  return () => {
    if (index >= 0) {
      const candidates = Array.from(host.querySelectorAll<HTMLElement>(selectors));
      const next =
        active === document.activeElement
          ? active
          : ((identity ? candidates.filter((n) => key(n) === identity)[occurrence] : undefined) ??
            candidates[index]);
      if (next !== document.activeElement) next?.focus({ preventScroll: true });
      if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
        if (start != null && end != null)
          try {
            next.setSelectionRange(start, end);
          } catch {}
      }
    }
    host.scrollTop = scroll;
  };
}
