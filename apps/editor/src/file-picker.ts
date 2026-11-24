import { el, button } from '@alabuga/framework/dom';
import { actionIcon } from './action-icons';
type FilePicker = { references: number; dispose: () => void };
const pickers = new WeakMap<HTMLInputElement, FilePicker>();
function releasePicker(input: HTMLInputElement, picker: FilePicker) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--picker.references === 0) {
      picker.dispose();
      pickers.delete(input);
    }
  };
}
/** Keep the real file input and its events; Framework owns the visible button. */
export function enhanceFilePicker(input: HTMLInputElement) {
  // The editor and an open dialog can both own the same control.
  const existing = pickers.get(input);
  if (existing) {
    existing.references++;
    return releasePicker(input, existing);
  }
  const label = input.closest('.af-field');
  if (!label) return () => {};
  const caption = label.querySelector<HTMLElement>('.af-label'),
    picker = el('span', 'constructor-file-picker'),
    name = el('span', 'af-help constructor-file-name'),
    choose = button('Выбрать файл', () => input.click(), 'af-btn af-btn--secondary');
  const wasHidden = input.hidden,
    oldLabel = input.getAttribute('aria-label'),
    field = el('div');
  for (const attribute of label.attributes)
    if (attribute.name !== 'for') field.setAttribute(attribute.name, attribute.value);
  label.replaceWith(field);
  field.append(...label.childNodes);
  if (!oldLabel && caption) input.setAttribute('aria-label', caption.textContent ?? 'Выбрать файл');
  name.id = 'file-name-' + crypto.randomUUID();
  name.setAttribute('aria-live', 'polite');
  choose.prepend(actionIcon('upload'));
  choose.setAttribute('aria-label', 'Выбрать файл');
  choose.title = input.getAttribute('aria-label') ?? caption?.textContent ?? 'Выбрать файл';
  if (caption) {
    caption.id ||= 'file-label-' + crypto.randomUUID();
    choose.setAttribute('aria-describedby', caption.id + ' ' + name.id);
  } else choose.setAttribute('aria-describedby', name.id);
  const sync = () => {
    choose.disabled = input.disabled;
    name.textContent =
      Array.from(input.files ?? [], (file) => file.name).join(', ') || 'Файл не выбран';
  };
  input.before(picker);
  picker.append(input, choose, name);
  input.hidden = true;
  input.classList.add('constructor-file-native');
  input.addEventListener('change', sync);
  choose.addEventListener('focus', sync);
  const observer = new MutationObserver(sync);
  observer.observe(input, { attributes: true, attributeFilter: ['disabled'] });
  sync();
  const dispose = () => {
    observer.disconnect();
    input.removeEventListener('change', sync);
    choose.removeEventListener('focus', sync);
    picker.before(input);
    picker.remove();
    input.hidden = wasHidden;
    input.classList.remove('constructor-file-native');
    if (oldLabel === null) input.removeAttribute('aria-label');
    label.append(...field.childNodes);
    field.replaceWith(label);
  };
  const state = { references: 1, dispose };
  pickers.set(input, state);
  return releasePicker(input, state);
}
