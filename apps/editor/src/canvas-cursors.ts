/** Match action icons: 24-unit geometry, rounded 1.75-unit strokes and brand tokens. */
export function installCanvasCursors(canvas: HTMLElement) {
  const style = getComputedStyle(canvas),
    ink = style.getPropertyValue('--af-color-brand-blue').trim(),
    halo = style.getPropertyValue('--af-color-brand-white').trim();
  if (!ink || !halo) return;
  const resize = 'M4 12h16 M9 7l-5 5 5 5 M15 7l5 5-5 5',
    move = 'M12 3v18 M3 12h18 M8 7l4-4 4 4 M8 17l4 4 4-4 M7 8l-4 4 4 4 M17 8l4 4-4 4';
  const cursors = [
    ['move', move, 0, 'move'],
    ['ew', resize, 0, 'ew-resize'],
    ['ns', resize, 90, 'ns-resize'],
    ['nwse', resize, 45, 'nwse-resize'],
    ['nesw', resize, -45, 'nesw-resize'],
  ] as const;
  for (const [name, path, angle, fallback] of cursors) {
    // A fixed 32px cursor with a centered hotspot stays precise at every canvas zoom.
    // The white under-stroke keeps the blue icon readable over photos and dark blocks.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g transform="rotate(${angle} 16 16)"><g transform="translate(4 4)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${path}" stroke="${halo}" stroke-width="4.25"/><path d="${path}" stroke="${ink}" stroke-width="1.75"/></g></g></svg>`;
    canvas.style.setProperty(
      `--block-cursor-${name}`,
      `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, ${fallback}`,
    );
  }
}

/** Keep the gesture's cursor when the pointer crosses content or leaves the canvas. */
export function holdBlockCursor(cursor: string) {
  const root = document.documentElement,
    previous = root.style.getPropertyValue('--block-drag-cursor'),
    priority = root.style.getPropertyPriority('--block-drag-cursor'),
    active = root.hasAttribute('data-block-cursor');
  root.style.setProperty('--block-drag-cursor', cursor);
  root.setAttribute('data-block-cursor', '');
  return () => {
    root.toggleAttribute('data-block-cursor', active);
    if (previous) root.style.setProperty('--block-drag-cursor', previous, priority);
    else root.style.removeProperty('--block-drag-cursor');
  };
}
