# Справочник API и форматов

## Публичные точки входа

| Импорт | Основные возможности |
| --- | --- |
| `@alabuga/framework/schema` | AFDocument, Section, Widget, validateDocument, isSafeUrl |
| `@alabuga/framework/runtime` | renderDocument, DocumentController |
| `@alabuga/framework/compositions` | compositionCatalog, makeComposition, changeComposition |
| `@alabuga/framework/layout-variants` | semanticSlots, applyLayoutVariant |
| `@alabuga/framework/slide-fit` | fitSlide, measureSlide, FitSlideOptions, FitSlideResult |
| `@alabuga/framework/export` | exportHTML, ExportOptions |
| `@alabuga/ai` | AIProvider, GenerationRequest, DraftResult, AICommand, generateDraft |

CSS подключается явно: import '@alabuga/framework/standalone.css'; корневой JS-импорт не подключает стили; точка schema пригодна для проверки данных в Node.js. Структура exports в package.json является разрешённым списком точек входа. Не импортируйте соседние src или dist напрямую.

```ts
import {validateDocument} from '@alabuga/framework/schema';
import {renderDocument} from '@alabuga/framework/runtime';
const result = validateDocument(input);
if (!result.success) throw new Error(result.issues.map(i => i.message).join('; '));
const controller = renderDocument(host, result.data, {editing: true});
// При закрытии документа:
controller.destroy();
```

Экспорт получает `{runtime: {css, script}, resolveAsset?}`. Материалы `asset:<id>` разрешаются асинхронно. Отсутствующий материал вызывает ошибку, а не тихую подмену. Полученная строка HTML не зависит от Ollama или API. Сборка пакета framework предоставляет `standalone.css` и `standalone.js` для упаковки экспорта.

## Форматы и совместимость

Документ: `schemaVersion: 3`, `kind: page | presentation`, название и массив `pages`. Переносимый проект: `format: alabuga-project`, `version: 3`, документ и материалы. Импорт проходит общую валидацию. Не создавайте новый номер версии только из-за перемещения исходников.

GenerationRequest содержит kind, scope, count, prompt, audience и sources. DraftResult хранится отдельно от документа. GenerationServices передаётся через options генератора; браузерный адаптер предоставляет fitSlide. Сигнал отмены обязателен для запросов модели.

## HTTP локального сервиса

| Метод и путь | Назначение |
| --- | --- |
| GET `/api/ai/health` | Жив ли процесс API; модель не требуется |
| GET `/api/ai/readiness` | Готовность закреплённой модели и состояние подготовки |
| GET `/api/ai/status` | Версия, digest, контекст, размещение модели |
| GET `/api/ai/diagnostics` | Состояние сервиса и доступные сведения GPU |
| POST `/api/ai/generate` | JSON с system, prompt и format |

Генерация допускает один запрос одновременно; занятость возвращает 409, превышение бюджета — 413, ошибка модели — 502. Серверный таймаут — 120 секунд. Пользовательский JavaScript или HTML API не выполняет.

## Классы и живые примеры

Примеры кнопок, форм, панельной сетки и презентаций доступны в [интерактивном справочнике]({{FRAMEWORK_DOCS_URL}}). Базовые классы: `.af-btn`, `.af-field`, `.af-input`, `.af-panel`, `.af-widget`. Фирменные варианты выбираются через документ и каталог композиций, а не произвольный CSS в проекте автора.

## Версии оболочки и материалы

Принимаются bare-документы схем 1–3 и оболочки alabuga-project версий 1–3, а также прежняя оболочка без version. Запись создаёт оболочку 3. Неизвестная будущая версия и отсутствующий asset:<sha256> отклоняются до записи в БД. Версия npm-пакета, schemaVersion документа и версия оболочки независимы.

В renderer, fit и export доступен assetsBaseUrl. Встроенные материалы принадлежат пакету; Constructor публикует совместимые URL /assets/. asset: разрешается адаптером хранилища. Подробный [публичный контракт Framework]({{FRAMEWORK_DOCS_URL}}docs/ru/reference.html).
