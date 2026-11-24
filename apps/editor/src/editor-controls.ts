import { el, button } from './ui';
export function createZoomControls(canvas: HTMLElement, status: HTMLElement) {
  const viewport = canvas.parentElement!;
  let zoom = 1,
    baseWidth = 0,
    fitting = false,
    resizeFrame = 0,
    screen = '';
  const bar = el('div', 'canvas-zoom'),
    label = button('100%', () => reset(), 'af-btn af-btn--ghost af-btn--sm');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Масштаб холста');
  label.setAttribute('aria-label', 'Масштаб 100%');
  const apply = () => {
    canvas.style.width = baseWidth ? baseWidth + 'px' : '';
    canvas.style.maxWidth = baseWidth ? 'none' : '';
    canvas.style.zoom = String(zoom);
    canvas.style.setProperty('--constructor-ui-scale', String(1 / zoom));
    label.textContent = Math.round(zoom * 100) + '%';
  };
  const reset = () => {
    fitting = false;
    zoom = 1;
    baseWidth = 0;
    apply();
  };
  const fit = () => {
    fitting = true;
    canvas.style.zoom = '1';
    canvas.style.width = '';
    canvas.style.maxWidth = '';
    baseWidth = canvas.offsetWidth;
    const slide = canvas.querySelector<HTMLElement>('.af-slide--active');
    // Slide decorations and editing controls must not enlarge the slide frame.
    const width = slide
        ? parseFloat(canvas.style.getPropertyValue('--constructor-document-width')) ||
          slide.offsetWidth
        : Math.max(baseWidth, canvas.scrollWidth),
      availableWidth = viewport.clientWidth;
    let scale = availableWidth / Math.max(1, width);
    if (slide) {
      const availableHeight = Math.max(
        160,
        window.innerHeight - viewport.getBoundingClientRect().top - 32,
      );
      scale = Math.min(scale, availableHeight / Math.max(1, slide.getBoundingClientRect().height));
    }
    baseWidth = width;
    zoom = Math.min(1, Math.max(0.1, scale));
    apply();
  };
  const change = (delta: number) => {
    fitting = false;
    if (!baseWidth) baseWidth = canvas.offsetWidth;
    zoom = Math.max(0.1, Math.min(2, zoom + delta));
    apply();
  };
  const less = button('−', () => change(-0.1), 'af-btn af-btn--ghost af-btn--sm'),
    more = button('+', () => change(0.1), 'af-btn af-btn--ghost af-btn--sm');
  less.setAttribute('aria-label', 'Уменьшить масштаб');
  more.setAttribute('aria-label', 'Увеличить масштаб');
  bar.append(less, label, more, button('Вписать', fit, 'af-btn af-btn--ghost af-btn--sm'));
  const resized = () => {
    if (!fitting || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (fitting) fit();
    });
  };
  const observer = new ResizeObserver(resized);
  observer.observe(viewport);
  observer.observe(status);
  window.addEventListener('resize', resized);
  return {
    bar,
    reset,
    fit,
    change,
    sync() {
      const fixedCanvas =
        !!canvas.querySelector('.af-document--presentation') ||
        (canvas.hasAttribute('data-standard-grid') && canvas.dataset.device === 'desktop');
      const current = `${fixedCanvas}:${canvas.dataset.device}:${canvas.style.getPropertyValue('--constructor-document-width')}:${canvas.style.getPropertyValue('--constructor-document-height')}`;
      if (current === screen) return;
      const previousFixedCanvas = screen.startsWith('true:');
      screen = current;
      if (fixedCanvas) fit();
      else if (previousFixedCanvas) reset();
    },
    destroy() {
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      window.removeEventListener('resize', resized);
    },
  };
}
