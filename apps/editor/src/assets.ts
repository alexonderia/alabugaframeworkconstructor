import { showDialog, libraryDialog, el, button } from './ui';
import { readImage } from './export';
import { loadBrandManifest } from './brand-manifest';
import { listAssets, describeAsset, addAsset } from './storage';

type AssetPickerOptions = {
  signal?: AbortSignal;
  initialCategory?: string;
  confirmLabel?: string;
};

/** Shared content for a standalone picker and the catalog's Materials tab. */
export function mountAssetPicker(
  host: HTMLElement,
  apply: (src: string) => void,
  options: AssetPickerOptions = {},
) {
  const body = el('div', 'asset-picker'),
    grid = el('div', 'asset-grid'),
    filter = el('select', 'af-select'),
    error = el('p', 'af-error'),
    status = el('p'),
    search = el('input', 'af-input'),
    sort = el('select', 'af-select');
  host.append(body);
  filter.setAttribute('aria-label', 'Категория материалов');
  search.type = 'search';
  search.placeholder = 'Найти по названию и описанию';
  search.setAttribute('aria-label', 'Поиск материалов');
  sort.setAttribute('aria-label', 'Сортировка материалов');
  status.setAttribute('role', 'status');
  error.setAttribute('role', 'alert');
  for (const [value, label] of [
    ['', 'Все материалы'],
    ['background', 'Фоны'],
    ['logo', 'Логотипы'],
    ['photo', 'Фотографии'],
    ['decoration', 'Графика'],
    ['local', 'Материалы моих проектов'],
  ]) {
    const o = el('option', '', label);
    o.value = value;
    filter.append(o);
  }
  filter.value = options.initialCategory ?? 'background';
  for (const [value, label] of [
    ['name', 'По названию'],
    ['reverse', 'В обратном порядке'],
  ]) {
    const o = el('option', '', label);
    o.value = value;
    sort.append(o);
  }
  const upload = el('input', 'af-input');
  upload.type = 'file';
  upload.accept = 'image/png,image/jpeg,image/webp,image/gif';
  upload.setAttribute('aria-label', 'Загрузить свой материал');
  type Item = {
    id: string;
    name: string;
    description: string;
    src: string;
    thumbnail: string;
    category: string;
    details?: string;
  };
  let items: Item[] = [],
    request = 0,
    closed = false,
    selected: Item | undefined;
  const lifetime = new AbortController();
  const confirm = button(
    options.confirmLabel ?? 'Выбрать материал',
    () => {
      if (selected) pick(selected.src);
    },
    'af-btn',
  );
  confirm.disabled = true;
  const selection = el('p', 'af-help', 'Материал не выбран'),
    selectionPreview = el('img'),
    selectionBar = el('div', 'asset-picker-confirm');
  selectionPreview.alt = '';
  selectionPreview.hidden = true;
  selectionBar.setAttribute('aria-live', 'polite');
  selectionBar.append(selectionPreview, selection, confirm);
  const choose = (item: Item) => {
    if (!options.confirmLabel) {
      pick(item.src);
      return;
    }
    selected = item;
    selection.textContent = 'Выбрано: ' + item.name;
    selectionPreview.src = item.thumbnail;
    selectionPreview.hidden = false;
    confirm.disabled = false;
    for (const card of grid.querySelectorAll<HTMLButtonElement>('.asset-card')) {
      const active = card.dataset.assetId === item.id;
      card.setAttribute('aria-pressed', String(active));
      card.closest('.asset-item')!.classList.toggle('is-selected', active);
    }
  };
  const pick = (src: string) => {
    if (closed || options.signal?.aborted) return;
    try {
      apply(src);
    } catch (e) {
      error.textContent = (e as Error).message;
    }
  };
  const draw = () => {
    grid.replaceChildren();
    const q = search.value.trim().toLocaleLowerCase();
    const visible = items
      .filter(
        (a) =>
          (!filter.value || a.category === filter.value) &&
          (!q || (a.name + ' ' + a.description).toLocaleLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ru') * (sort.value === 'reverse' ? -1 : 1));
    for (const a of visible) {
      const card = el('div', 'asset-item'),
        b = button('', () => choose(a), 'asset-card'),
        img = el('img');
      b.dataset.assetId = a.id;
      if (options.confirmLabel) {
        const active = selected?.id === a.id;
        b.setAttribute('aria-pressed', String(active));
        card.classList.toggle('is-selected', active);
      }
      img.src = a.thumbnail;
      img.alt = '';
      img.loading = 'lazy';
      b.append(img, el('strong', '', a.name), el('span', '', a.description));
      if (a.details) b.append(el('span', '', a.details));
      card.append(b);
      if (a.category === 'local') {
        const label = el('label', 'af-field'),
          description = el('input', 'af-input');
        description.value = a.description;
        description.maxLength = 200;
        description.setAttribute('aria-label', 'Описание ' + a.name);
        description.addEventListener('change', () => {
          void describeAsset(a.id, description.value)
            .then(() => {
              a.description = description.value;
              a.name = description.value || 'Без описания';
              status.textContent = 'Описание сохранено.';
            })
            .catch((e) => (error.textContent = (e as Error).message));
        });
        label.append(el('span', 'af-label', 'Описание'), description);
        card.append(label);
      }
      grid.append(card);
    }
    if (!visible.length)
      grid.append(
        el(
          'p',
          '',
          items.length
            ? 'Материалы не найдены. Измените запрос или загрузите изображение.'
            : 'Здесь пока нет материалов. Можно загрузить своё изображение.',
        ),
      );
  };
  const retry = button('Повторить загрузку', () => void load(), 'af-btn af-btn--secondary');
  retry.hidden = true;
  async function load() {
    const generation = ++request;
    status.textContent = 'Загружаем материалы…';
    error.textContent = '';
    retry.hidden = true;
    const results = await Promise.allSettled([loadBrandManifest(), listAssets()]);
    if (closed || generation !== request) return;
    items = [];
    const [brand, local] = results;
    if (brand.status === 'fulfilled')
      for (const a of brand.value.assets)
        if ('url' in a && a.url)
          items.push({
            id: a.id,
            name: a.name,
            description: a.usage,
            src: a.url,
            thumbnail: a.thumbnail,
            category: a.category,
            details: `${a.width} × ${a.height}`,
          });
    if (local.status === 'fulfilled')
      for (const a of local.value)
        items.push({
          id: a.id,
          name: a.description || 'Без описания',
          description: a.description ?? '',
          src: a.data,
          thumbnail: a.data,
          category: 'local',
        });
    const failed = results.some((r) => r.status === 'rejected');
    status.textContent = failed
      ? 'Доступна часть библиотеки. Загрузка своего изображения работает.'
      : 'Материалы загружены.';
    if (failed) {
      error.textContent =
        'Не удалось загрузить часть материалов. Проверьте подключение и повторите попытку.';
      retry.hidden = false;
    }
    draw();
  }
  upload.addEventListener('change', () => {
    void (async () => {
      try {
        const file = upload.files?.[0];
        if (!file) return;
        const src = await readImage(file);
        if (closed) return;
        const id = await addAsset(src, file.name);
        if (closed) return;
        if (options.confirmLabel) {
          const item = {
            id,
            name: file.name,
            description: file.name,
            src,
            thumbnail: src,
            category: 'local',
          };
          items = [item, ...items.filter((asset) => asset.id !== id)];
          search.value = '';
          filter.value = 'local';
          filter.dispatchEvent(new Event('change', { bubbles: true }));
          choose(item);
        } else pick(src);
      } catch (e) {
        error.textContent = (e as Error).message;
      } finally {
        upload.value = '';
      }
    })();
  });
  const uploadField = el('label', 'af-field');
  uploadField.append(el('span', 'af-label', 'Или загрузите своё изображение'), upload);
  const filters = el('div', 'asset-picker-filters');
  for (const [caption, control] of [
    ['Категория', filter],
    ['Поиск', search],
    ['Сортировка', sort],
  ] as const) {
    const field = el('label', 'af-field');
    field.append(el('span', 'af-label', caption), control);
    filters.append(field);
  }
  body.append(filters, uploadField, status, error, retry, grid);
  if (options.confirmLabel) body.append(selectionBar);
  function destroy() {
    if (closed) return;
    closed = true;
    request++;
    lifetime.abort();
    options.signal?.removeEventListener('abort', destroy);
    body.remove();
  }
  options.signal?.addEventListener('abort', destroy, { once: true });
  filter.addEventListener('change', draw, { signal: lifetime.signal });
  search.addEventListener('input', draw, { signal: lifetime.signal });
  sort.addEventListener('change', draw, { signal: lifetime.signal });
  if (options.signal?.aborted) destroy();
  else void load();
  return { destroy };
}

export async function chooseAsset(apply: (src: string) => void, signal?: AbortSignal) {
  if (signal?.aborted) return;
  const { dialog, body } = libraryDialog('Библиотека материалов', 'asset-library');
  dialog.setAttribute('aria-label', 'Библиотека материалов');
  const picker = mountAssetPicker(
    body,
    (src) => {
      apply(src);
      dialog.close();
    },
    { signal },
  );
  document.body.append(dialog);
  const abort = () => dialog.close();
  signal?.addEventListener('abort', abort, { once: true });
  dialog.addEventListener(
    'close',
    () => {
      picker.destroy();
      signal?.removeEventListener('abort', abort);
      dialog.remove();
    },
    { once: true },
  );
  showDialog(dialog);
}

export type FocalPoint = { x: number; y: number };
export function cropControl(
  host: HTMLElement,
  src: string,
  point: FocalPoint | undefined,
  change: (p: FocalPoint) => void,
  label: string,
  options: { fit?: 'cover' | 'contain'; aspectRatio?: number } = {},
) {
  const wrap = el('fieldset', 'crop-control');
  wrap.append(el('legend', '', label));
  const frame = el('div', 'crop-frame'),
    img = el('img');
  img.src = src;
  img.alt = 'Перетащите изображение для изменения кадра';
  img.draggable = false;
  frame.tabIndex = 0;
  frame.setAttribute('role', 'slider');
  frame.setAttribute('aria-label', label);
  frame.setAttribute('aria-valuemin', '0');
  frame.setAttribute('aria-valuemax', '100');
  let p = point ?? { x: 50, y: 50 };
  const paint = () => {
    img.style.objectPosition = `${p.x}% ${p.y}%`;
    frame.setAttribute('aria-valuenow', String(p.x));
    frame.setAttribute('aria-valuetext', `${p.x}% по горизонтали, ${p.y}% по вертикали`);
  };
  const disabled = options.fit === 'contain';
  img.style.objectFit = options.fit ?? 'cover';
  if (disabled) {
    frame.tabIndex = -1;
    frame.setAttribute('aria-disabled', 'true');
  }
  if (options.aspectRatio) {
    frame.style.cssText = `height:auto;aspect-ratio:${options.aspectRatio};position:relative`;
    img.style.position = 'absolute';
    img.style.inset = '0';
  }
  frame.append(img);
  wrap.append(
    frame,
    el(
      'p',
      'af-help',
      disabled
        ? 'Изображение показано целиком. Для кадрирования выберите «Заполнить блок» в поле «Размещение».'
        : 'Перетаскивайте или используйте стрелки. Если изображение точно совпадает с рамкой, сдвиг не меняет видимый кадр.',
    ),
  );
  host.append(wrap);
  paint();
  frame.addEventListener('keydown', (e) => {
    if (disabled) return;
    const d = (
      { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] } as Record<
        string,
        number[]
      >
    )[e.key];
    if (!d) return;
    e.preventDefault();
    p = { x: Math.max(0, Math.min(100, p.x + d[0])), y: Math.max(0, Math.min(100, p.y + d[1])) };
    paint();
    change(p);
  });
  frame.addEventListener('pointerdown', (e) => {
    if (disabled) return;
    frame.setPointerCapture(e.pointerId);
    const origin = { x: e.clientX, y: e.clientY, p: { ...p } },
      abort = new AbortController();
    frame.addEventListener(
      'pointermove',
      (ev) => {
        p = {
          x: Math.round(
            Math.max(
              0,
              Math.min(100, origin.p.x - ((ev.clientX - origin.x) / frame.clientWidth) * 100),
            ),
          ),
          y: Math.round(
            Math.max(
              0,
              Math.min(100, origin.p.y - ((ev.clientY - origin.y) / frame.clientHeight) * 100),
            ),
          ),
        };
        paint();
      },
      { signal: abort.signal },
    );
    frame.addEventListener(
      'pointerup',
      () => {
        abort.abort();
        if (p.x !== origin.p.x || p.y !== origin.p.y) change(p);
      },
      { once: true, signal: abort.signal },
    );
    frame.addEventListener(
      'pointercancel',
      () => {
        abort.abort();
        p = origin.p;
        paint();
      },
      { once: true, signal: abort.signal },
    );
  });
}
