export const downloadCopyLabel = 'Скачать копию (.json)';

/** Stable command groups; responsive layout moves the same controls. */
export const editorMarkup = `
<header class="editor-header">
 <a class="editor-brand" href="../index.html">Constructor</a>
 <label class="document-name"><span class="af-sr-only">Название проекта</span><input id="project-name" class="af-input" maxlength="200"></label>
 <div class="editor-history" role="group" aria-label="История изменений"><button id="undo" class="af-btn af-btn--ghost af-btn--sm" aria-label="Отменить действие" title="Ctrl+Z">↶</button><button id="redo" class="af-btn af-btn--ghost af-btn--sm" aria-label="Повторить действие" title="Ctrl+Shift+Z">↷</button></div>
 <details class="project-menu"><summary class="af-btn af-btn--ghost af-btn--sm">Проект</summary><div class="af-card af-card--inner command-menu">
  <button id="new-page" class="af-btn af-btn--clear af-btn--sm">Новый сайт</button><button id="new-deck" class="af-btn af-btn--clear af-btn--sm">Новая презентация</button>
  <button id="demo-page" class="af-btn af-btn--clear af-btn--sm">Эталонный лендинг</button><button id="demo-deck" class="af-btn af-btn--clear af-btn--sm">Эталонная презентация</button>
  <label class="file-open af-btn af-btn--clear af-btn--sm">Открыть проект<input id="open" class="af-input" type="file" accept=".json,application/json" aria-label="Открыть проект"></label>
 </div></details>
 <div class="editor-file-actions"><button id="preview" class="af-btn af-btn--secondary af-btn--sm">Предпросмотр</button><button id="save" class="af-btn af-btn--secondary af-btn--sm">${downloadCopyLabel}</button><button id="export" class="af-btn af-btn--sm">Скачать HTML</button></div>
</header>
<div class="editor-status" role="region" aria-label="Состояние проекта"><span id="status" role="status" aria-live="polite"></span><span id="save-state" tabindex="-1">Изменения сохраняются в браузере</span><div id="backup-tip" class="backup-tip" hidden><p class="af-help">Проект сохранён в этом браузере. Чтобы перенести его, скачайте копию (.json) и импортируйте её в другом браузере.</p><button id="dismiss-backup-tip" class="af-btn af-btn--ghost af-btn--sm">Понятно</button></div></div>
<main class="editor-workspace"><h1 class="af-sr-only">Конструктор документов</h1>
 <div class="canvas-toolbar">
  <div class="section-toolbar" role="group" aria-label="Текущая секция"><label class="af-field page-picker"><span id="page-kind" class="af-label">Секция</span><select id="pages" class="af-select af-select--sm" aria-label="Выбрать секцию или слайд"></select></label><button id="add-widget" class="af-btn af-btn--secondary af-btn--sm">+ Блок</button><button id="page-settings-open" class="af-btn af-btn--ghost af-btn--sm">Настройки секции</button></div>
  <div id="slide-actions" hidden><button id="add-slide" class="af-btn af-btn--ghost af-btn--sm">+ Слайд</button></div>
  <details class="editor-more"><summary class="af-btn af-btn--ghost af-btn--sm">Вид холста</summary><div class="editor-more-body" role="group" aria-label="Вид холста"><label class="af-field page-picker"><span class="af-label">Экран</span><select id="device" class="af-select af-select--sm" aria-label="Размер экрана"><option value="desktop">Компьютер</option><option value="tablet">Планшет</option><option value="mobile">Телефон</option></select></label></div></details>
 </div>
 <div id="canvas-scroll" class="canvas-scroll"><div id="canvas" class="editor-canvas"></div></div><div id="end-add"></div>
</main>
<div id="inspector" class="editor-inspector" role="complementary" aria-labelledby="inspector-title" hidden><div class="drawer-header"><h2 id="inspector-title" class="af-title">Настройки</h2><button id="close-inspector" class="af-btn af-btn--clear af-btn--icon" aria-label="Закрыть настройки" title="Закрыть настройки"><span class="af-btn__icon af-icon af-icon--close" aria-hidden="true"></span></button></div><div class="inspector-body"><details class="page-settings" open><summary class="af-btn af-btn--clear af-btn--sm">Настройки секции<span class="af-icon af-icon--expand" aria-hidden="true"></span></summary><form id="settings" class="af-stack settings-group-body"><label class="af-field"><span class="af-label">Заголовок секции</span><input id="page-title" class="af-input af-input--sm" maxlength="200"></label><div class="settings-grid" data-advanced-setting><label class="af-field"><span class="af-label">Колонки</span><input id="columns" class="af-input af-input--sm" type="number" min="1" max="24" required></label><label class="af-field"><span class="af-label">Строка, px</span><input id="row-height" class="af-input af-input--sm" type="number" min="32" max="160" required></label><label class="af-field"><span class="af-label">Отступ, px</span><input id="gap" class="af-input af-input--sm" type="number" min="0" max="48" required></label></div><p class="af-help">Изменения применяются автоматически.</p></form></details><div id="design-settings"></div><div id="properties"></div></div></div>
<dialog id="catalog" class="af-dialog block-catalog library-dialog" aria-labelledby="catalog-title"><div class="catalog-header af-dialog__header"><h2 id="catalog-title" class="af-dialog__title">Добавить блок</h2><button id="close-catalog" class="af-btn af-btn--clear af-btn--icon" aria-label="Закрыть библиотеку" title="Закрыть библиотеку"><span class="af-btn__icon af-icon af-icon--close" aria-hidden="true"></span></button></div><div class="library-dialog-body">
  <div class="af-row" role="group" aria-label="Раздел каталога">
    <button id="catalog-sections" type="button" class="af-btn af-btn--secondary af-btn--sm">Шаблоны и композиции</button>
    <button id="catalog-components" type="button" class="af-btn af-btn--secondary af-btn--sm">Компоненты</button>
    <button id="catalog-materials" type="button" class="af-btn af-btn--secondary af-btn--sm">Материалы</button>
  </div>
  <p id="catalog-description" class="af-help" role="status"></p>
  <div id="catalog-filters" class="af-row">
    <label class="af-field"><span class="af-label">Поиск по каталогу</span><input id="catalog-search" type="search" class="af-input"></label>
    <label id="catalog-category-field" class="af-field"><span class="af-label">Категория шаблона</span><select id="catalog-category" class="af-select" aria-label="Категория шаблона"></select></label>
    <label id="catalog-theme-field" class="af-field"><span class="af-label">Оформление композиции</span><select id="catalog-theme" class="af-select" aria-label="Оформление композиции"></select></label>
  </div>
  <p id="catalog-empty" class="af-help" hidden>Ничего не найдено. Измените запрос или категорию.</p>
  <div id="templates"></div><div id="palette"></div><div id="catalog-materials-pane" hidden></div>
</div></dialog>`;
