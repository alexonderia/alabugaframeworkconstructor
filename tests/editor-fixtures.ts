import type { AFDocument, Widget } from '@alabuga/framework/schema';
import { emptyDocument, createWidget } from '../apps/editor/src/model';
export function makeSection(template: string): AFDocument['pages'][number] {
  const doc = emptyDocument(),
    page = doc.pages[0];
  page.title = '';
  const add = (type: Widget['type']) => {
    const w = createWidget(type, doc, 0);
    page.widgets.push(w);
    return w;
  };
  if (template === 'header' || template === 'footer') {
    page.role = template;
    if (template === 'header') page.grid.rowHeight = 40;
    const brand = add('text');
    brand.title = '';
    brand.position = { col: 1, row: 1, width: 4, height: template === 'header' ? 2 : 3 };
    if (brand.type === 'text')
      brand.content = [
        { type: 'heading', text: 'Название компании' },
        {
          type: 'paragraph',
          text: template === 'header' ? 'Коротко о главном' : '© Компания. Все права защищены.',
          dropCap: false,
        },
      ];
    const links = add('text');
    links.title = '';
    links.align = template === 'header' ? 'right' : 'left';
    links.position = {
      col: 5,
      row: 1,
      width: template === 'header' ? 8 : 4,
      height: template === 'header' ? 2 : 3,
    };
    if (links.type === 'text')
      links.content = [
        { type: 'link', text: 'Главная', href: '/' },
        { type: 'link', text: 'О компании', href: '/about' },
        { type: 'link', text: 'Контакты', href: '/contacts' },
      ];
    if (template === 'footer') {
      const contacts = add('text');
      contacts.title = '';
      contacts.position = { col: 9, row: 1, width: 4, height: 3 };
      if (contacts.type === 'text')
        contacts.content = [
          { type: 'heading', text: 'Свяжитесь с нами' },
          { type: 'paragraph', text: '+7 (000) 000-00-00\nhello@example.com', dropCap: false },
        ];
    }
  }
  if (template === 'text' || template === 'split') {
    const text = add('text');
    text.title = '';
    text.position = { col: 1, row: 1, width: template === 'text' ? 12 : 6, height: 4 };
    if (text.type === 'text')
      text.content = [
        { type: 'heading', text: 'Расскажите о главном' },
        {
          type: 'paragraph',
          text: 'Нажмите на этот текст и напишите свою историю. Изменения сразу видны на странице и сохраняются автоматически.',
          dropCap: false,
        },
      ];
    if (template === 'split') {
      const image = add('image');
      image.title = '';
      image.position = { col: 7, row: 1, width: 6, height: 4 };
    }
  }
  if (template === 'metrics')
    for (let i = 0; i < 3; i++) {
      const w = add('metric');
      w.position = { col: 1 + i * 4, row: 1, width: 4, height: 3 };
      w.title = ['Проекты', 'Участники', 'Направления'][i];
      if (w.type === 'metric') {
        w.value = ['24', '120', '08'][i];
        w.note = 'Добавьте пояснение';
      }
    }
  return page;
}
