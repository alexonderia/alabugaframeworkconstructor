import type { AFDocument } from '@alabuga/framework/schema';
import { el, button } from './ui';
import { readSetting, writeSetting } from './storage';
import { tutorialOverlay, type TutorialSpot } from './tutorial-overlay';
import {
  initialTutorial,
  tutorialHeading,
  tutorialTarget,
  tutorialValue,
  type TutorialState,
  type TutorialTarget,
} from './tutorial-progress';
export type { TutorialState } from './tutorial-progress';

export async function tutorialState(id: string) {
  const stored = await readSetting<{ value: Partial<TutorialState> }>('tutorial:' + id);
  return initialTutorial(stored?.value);
}

/** Called only once the standalone preview has rendered successfully. */
export async function recordTutorialPreview(id: string) {
  const state = await tutorialState(id);
  if (!state.enabled || state.current !== 4 || state.previewed) return;
  state.previewed = true;
  await writeSetting('tutorial:' + id, state);
}

type TutorialActions = {
  projectId: () => string;
  document: () => AFDocument;
  section: () => number;
  flush: () => boolean;
  go: (step: number, target: TutorialTarget) => void;
  locate: (step: number, target: TutorialTarget) => HTMLElement | undefined;
  showResult: (target: TutorialTarget) => boolean;
  locateResult: (target: TutorialTarget) => HTMLElement | null | undefined;
  preview: () => void;
  export: () => void;
  quality: () => void;
};

export function tutorial(
  root: HTMLElement,
  state: TutorialState,
  actions: TutorialActions,
  signal: AbortSignal,
) {
  const host = root.querySelector<HTMLElement>('.editor-workspace')!,
    drawer = root.querySelector<HTMLElement>('#inspector')!,
    panel = el('section', 'author-tutorial'),
    launcher = button(
      'Режим знакомства',
      () => {
        introduction.hidden = !introduction.hidden;
      },
      'af-btn af-btn--clear tutorial-launch',
    ),
    introduction = el('div', 'af-card af-card--inner tutorial-introduction'),
    content = el('div', 'af-card af-card--inner tutorial-content'),
    header = el('div', 'tutorial-header'),
    heading = el('h2', 'af-title tutorial-title'),
    progress = el('p', 'af-help tutorial-progress'),
    description = el('p', 'af-help tutorial-description'),
    feedback = el('p', 'af-help tutorial-feedback'),
    storageFeedback = el('p', 'af-error'),
    controls = el('div', 'tutorial-actions'),
    navigation = el('div', 'tutorial-navigation');
  let id = actions.projectId(),
    data = structuredClone(state),
    queue = Promise.resolve(),
    loading = false,
    operationError = '',
    baseDescription = '',
    showingResult = false,
    resultFrame = 0,
    observedValue = '',
    highlighted: HTMLElement | undefined,
    described = false;
  heading.id = 'tutorial-title';
  heading.tabIndex = -1;
  panel.setAttribute('aria-label', 'Режим знакомства');
  content.setAttribute('aria-labelledby', heading.id);
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  storageFeedback.setAttribute('role', 'status');
  introduction.hidden = true;
  const clearHighlight = () => {
    highlighted?.classList.remove('tutorial-target');
    if (described && highlighted?.getAttribute('aria-describedby') === description.id)
      highlighted.removeAttribute('aria-describedby');
    highlighted = undefined;
    described = false;
  };
  description.id = 'tutorial-description';
  const highlight = (target?: HTMLElement) => {
    clearHighlight();
    if (target) {
      highlighted = target;
      target.classList.add('tutorial-target');
      // Preserve a field's existing validation or help relationship.
      if (!target.hasAttribute('aria-describedby')) {
        target.setAttribute('aria-describedby', description.id);
        described = true;
      }
    }
  };
  const save = () => {
    const key = 'tutorial:' + id,
      snapshot = structuredClone(data);
    queue = queue
      .then(() => writeSetting(key, snapshot))
      .then(() => {
        storageFeedback.textContent = '';
      })
      .catch(() => {
        storageFeedback.textContent =
          'Не удалось сохранить прогресс знакомства. Повторите действие.';
      });
  };
  const place = () => {
    overlay.setActive(data.enabled && !loading);
    if (!data.enabled || loading) {
      if (panel.parentElement !== host)
        host.insertBefore(panel, host.querySelector('.canvas-scroll'));
      for (const property of ['width', 'max-height', 'left', 'top'])
        panel.style.removeProperty(property);
    }
  };
  const stop = () => {
    cancelAnimationFrame(resultFrame);
    resultFrame = 0;
    showingResult = false;
    data.enabled = false;
    data.dismissed = true;
    save();
    clearHighlight();
    render();
    root
      .querySelector<HTMLElement>(!drawer.hidden ? '#close-inspector' : '.project-menu > summary')
      ?.focus({ preventScroll: true });
  };
  function prepare() {
    if (!data.enabled || data.current >= 4) return;
    const step = data.current,
      doc = actions.document(),
      task = (data.tasks[step] ??= {}),
      previous = task.target,
      value = previous ? tutorialValue(doc, step, previous) : undefined;
    if (value === undefined) {
      const target = tutorialTarget(doc, step, data.section),
        baseline = tutorialValue(doc, step, target);
      if (JSON.stringify(previous) !== JSON.stringify(target) || task.baseline !== baseline) {
        task.target = target;
        task.baseline = baseline;
        task.complete = false;
        save();
      }
    } else if (!task.complete && task.baseline === undefined) {
      task.baseline = value;
      save();
    } else {
      const complete = value !== task.baseline && (step !== 0 || value.length > 0);
      if (complete !== !!task.complete) {
        task.complete = complete;
        save();
      }
    }
    const nextValue = JSON.stringify([
      id,
      step,
      task.target,
      task.target ? tutorialValue(doc, step, task.target) : undefined,
    ]);
    if (!task.complete) showingResult = false;
    else if (nextValue !== observedValue) queueResult();
    observedValue = nextValue;
  }
  function queueResult() {
    cancelAnimationFrame(resultFrame);
    const project = id,
      step = data.current;
    resultFrame = requestAnimationFrame(() => {
      resultFrame = 0;
      const task = data.tasks[step];
      if (
        signal.aborted ||
        !data.enabled ||
        project !== id ||
        step !== data.current ||
        !task?.complete ||
        !task.target
      )
        return;
      showingResult = true;
      if (!actions.showResult(task.target)) showingResult = false;
      render();
      heading.focus({ preventScroll: true });
    });
  }
  function showTool() {
    if (!actions.flush()) return;
    cancelAnimationFrame(resultFrame);
    resultFrame = 0;
    showingResult = false;
    prepare();
    const target = data.tasks[data.current]?.target;
    if (target) {
      const section = actions.document().pages.findIndex(({ id }) => id === target.sectionId);
      if (section >= 0 && data.section !== section) {
        data.section = section;
        save();
      }
      actions.go(data.current, target);
    }
    render();
    place();
  }
  const show = button('Показать, где изменить', showTool);
  const previous = button('Назад', () => move(-1), 'af-btn af-btn--ghost');
  const next = button(
    'Далее',
    () => {
      if (!actions.flush()) return;
      prepare();
      if (data.current < 4 ? data.tasks[data.current]?.complete : data.previewed && data.exported)
        move(1);
    },
    'af-btn',
  );
  const skip = button(
    'Пропустить шаг',
    () => {
      if (!actions.flush()) return;
      (data.tasks[data.current] ??= {}).skipped = true;
      move(1);
    },
    'af-btn af-btn--ghost',
  );
  const exit = button('Выйти из режима', stop, 'af-btn af-btn--ghost tutorial-dismiss');
  const preview = button('Открыть предпросмотр', actions.preview);
  const exportHTML = button('Скачать HTML', actions.export);
  const quality = button('Проверить проект', actions.quality);
  const restart = button('Пройти заново', () => {
    if (!actions.flush()) return;
    data = initialTutorial({ version: 2, enabled: true, section: actions.section() });
    activate();
  });
  function move(offset: number) {
    if (!actions.flush()) return;
    cancelAnimationFrame(resultFrame);
    resultFrame = 0;
    showingResult = false;
    observedValue = '';
    data.current = Math.max(0, Math.min(5, data.current + offset));
    operationError = '';
    clearHighlight();
    activate();
    heading.focus({ preventScroll: true });
  }
  function activate() {
    prepare();
    save();
    render();
    if (data.current < 4) {
      if (data.tasks[data.current]?.complete) queueResult();
      else showTool();
    }
  }
  function start() {
    if (loading || !actions.flush()) return;
    data.enabled = true;
    data.dismissed = false;
    data.section = Math.min(actions.section(), actions.document().pages.length - 1);
    root.querySelector<HTMLDetailsElement>('.project-menu')!.open = false;
    activate();
  }
  introduction.append(
    el(
      'p',
      'af-help',
      'Пять заданий с подсказками: текст, компоновка, изображение, оформление и готовый результат. Режим проверяет изменения автоматически. Вы работаете в текущем проекте; изменения можно отменить.',
    ),
    button('Начать знакомство', start, 'af-btn'),
    button('Скрыть подсказки', stop, 'af-btn af-btn--ghost'),
  );
  controls.append(show, preview, exportHTML, quality);
  navigation.append(previous, next, skip, restart);
  header.append(el('span', 'af-badge', 'Режим знакомства'), progress, exit);
  content.append(header, heading, description, feedback, controls, navigation);
  panel.append(launcher, introduction, content, storageFeedback);
  const overlay = tutorialOverlay(
    root,
    panel,
    locateSpot,
    (text) => {
      const value = text ?? baseDescription;
      if (description.textContent !== value) description.textContent = value;
    },
    stop,
    signal,
  );
  function locateSpot(): TutorialSpot {
    const step = data.current,
      target = data.tasks[step]?.target,
      dialog = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1),
      close = dialog?.querySelector<HTMLElement>('.af-dialog__header button');
    if (showingResult && target && !dialog) {
      const doc = actions.document(),
        index = doc.pages.findIndex((page) => page.id === target.sectionId),
        section = doc.pages[index],
        label = doc.kind === 'presentation' ? 'слайд' : 'секция';
      return {
        target: actions.locateResult(target),
        interactive: false,
        instruction: `Показан результат: ${label} ${index + 1}${section?.title ? ' «' + section.title + '»' : ''}. Изменение выделено на холсте.`,
      };
    }
    if (dialog?.id === 'catalog') {
      const selector =
        step === 1 ? '[data-template="text"]' : `[data-add="${step === 2 ? 'image' : 'text'}"]`;
      return {
        target: dialog.querySelector<HTMLElement>(selector) ?? close,
        allowed: close ? [close] : [],
        instruction:
          step === 1
            ? 'Добавьте выделенную секцию «Текст». Затем смените её компоновку.'
            : `Нажмите выделенный блок «${step === 2 ? 'Изображение' : 'Текст'}», чтобы добавить его в проект.`,
      };
    }
    if (dialog?.querySelector('.variant-grid')) {
      const page = actions.document().pages.find((page) => page.id === target?.sectionId),
        variant = page?.layoutVariant === 'asymmetric' ? 'primary' : 'asymmetric',
        choice =
          dialog.querySelector<HTMLElement>(`button[data-layout-variant="${variant}"]`) ??
          dialog.querySelector<HTMLElement>('.variant-grid button:not(:disabled)');
      return {
        target: choice ?? close,
        allowed: close ? [close] : [],
        instruction: choice
          ? `Нажмите «${choice.textContent}». Вариант применится к выбранной секции или слайду.`
          : 'Дождитесь проверки вариантов компоновки.',
      };
    }
    const picker = dialog?.querySelector<HTMLElement>('.asset-picker');
    if (picker)
      return {
        target:
          picker.querySelector<HTMLElement>('.asset-card') ??
          picker.querySelector<HTMLElement>('input[type=search]'),
        allowed: [picker, ...(close ? [close] : [])],
        instruction:
          'Выберите другое изображение в библиотеке. Для поиска и загрузки своего файла используйте поля этого окна.',
      };
    if (dialog)
      return {
        target: close,
        allowed: Array.from(dialog.querySelectorAll<HTMLElement>('.library-dialog-body')),
        instruction:
          'Проверьте замечания в окне. Можно закрыть окно и продолжить задание или выйти из режима.',
      };
    const control = target && step < 4 ? actions.locate(step, target) : undefined;
    const upload =
      step === 2
        ? root.querySelector<HTMLInputElement>(
            '#properties input[aria-label="Загрузить изображение"]',
          )?.parentElement
        : undefined;
    return { target: control, allowed: upload ? [upload] : [] };
  }
  function render() {
    panel.hidden = loading || (!data.enabled && data.dismissed);
    root.classList.toggle('is-learning', data.enabled);
    launcher.hidden = data.enabled;
    content.hidden = !data.enabled;
    if (data.enabled) introduction.hidden = true;
    const step = data.current,
      task = data.tasks[step],
      missing = step < 4 && task?.baseline === undefined,
      complete = step === 4 ? data.previewed && data.exported : !!task?.complete,
      isHeading = tutorialHeading(actions.document(), task?.target);
    progress.textContent = step < 5 ? `Шаг ${step + 1} из 5` : 'Знакомство завершено';
    heading.textContent = [
      isHeading ? 'Измените заголовок' : 'Измените текст',
      'Смените компоновку',
      'Замените изображение',
      'Настройте оформление элемента',
      'Проверьте и скачайте результат',
      'Вы освоили основные инструменты',
    ][step];
    baseDescription = [
      missing
        ? 'В проекте пока нет текста. Добавьте блок «Текст», затем измените его содержание. Кнопка ниже откроет библиотеку.'
        : 'Введите новый заголовок в выделенное поле «Текст». Изменение будет проверено автоматически.',
      missing
        ? 'Для этой свободной сетки нет готовых вариантов компоновки. Добавьте секцию или слайд из шаблона с текстом, затем измените её компоновку. Кнопка ниже откроет каталог.'
        : 'В настройках выбранной секции или слайда нажмите «Изменить компоновку» и примените другой вариант. Содержание сохранится.',
      missing
        ? 'В проекте пока нет изображения. Добавьте блок «Изображение», затем выберите для него другой материал из библиотеки или загрузите свой файл.'
        : 'Нажмите «Выбрать изображение» в настройках блока и выберите другой материал или загрузите свой файл. Изменение подписи не засчитывается.',
      missing
        ? 'Добавьте текстовый блок, затем измените его оформление.'
        : 'Откройте выделенное поле «Цвет текста» и выберите другой цвет.',
      'Откройте предпросмотр, проверьте результат и вернитесь через «Редактировать». Затем скачайте HTML. Прогресс сохранится при переходе.',
      `Выполнено заданий: ${data.tasks.filter((task) => task.complete).length + Number(data.previewed && data.exported)} из 5. ${data.tasks.some((task) => task.skipped && !task.complete) ? 'Пропущенные задания можно пройти заново.' : 'Продолжайте работу с проектом.'}`,
    ][step];
    if (description.textContent !== baseDescription) description.textContent = baseDescription;
    feedback.textContent =
      step >= 5
        ? ''
        : complete
          ? 'Готово — можно перейти дальше.'
          : step === 4
            ? `${data.previewed ? 'Предпросмотр проверен.' : 'Откройте предпросмотр.'} ${data.exported ? 'HTML скачан.' : 'Скачайте HTML.'}`
            : 'Ожидаем изменение в проекте.';
    if (step === 4 && operationError) feedback.textContent = operationError;
    feedback.hidden = showingResult;
    quality.hidden = step !== 4 || !operationError;
    show.hidden = step >= 4;
    show.textContent = missing
      ? step === 1
        ? 'Добавить подходящую секцию'
        : 'Добавить нужный блок'
      : showingResult
        ? 'Изменить ещё'
        : 'Показать, где изменить';
    if (showingResult) {
      if (show.parentElement !== navigation) navigation.insertBefore(show, next);
    } else if (show.parentElement !== controls) controls.prepend(show);
    controls.hidden = showingResult;
    preview.hidden = exportHTML.hidden = step !== 4;
    previous.hidden = step === 0 || step === 5;
    next.hidden = step === 5;
    skip.hidden = step === 5 || complete;
    next.disabled = !complete || (step < 4 && resultFrame !== 0);
    next.textContent = step === 4 ? 'Завершить знакомство' : 'Далее';
    restart.hidden = step !== 5;
    exit.textContent = step === 5 ? 'Вернуться к работе' : 'Выйти';
    exit.setAttribute('aria-label', step === 5 ? 'Вернуться к работе' : 'Выйти из режима');
    if (data.enabled && step < 4 && task?.target && !showingResult)
      highlight(actions.locate(step, task.target));
    else clearHighlight();
    place();
  }
  function update() {
    if (signal.aborted) return;
    if (id !== actions.projectId()) {
      id = actions.projectId();
      const nextId = id;
      data = initialTutorial();
      loading = true;
      cancelAnimationFrame(resultFrame);
      resultFrame = 0;
      showingResult = false;
      observedValue = '';
      operationError = '';
      clearHighlight();
      render();
      void queue
        .then(() => tutorialState(nextId))
        .then((stored) => {
          if (signal.aborted || id !== nextId) return;
          data = stored;
          loading = false;
          prepare();
          render();
        })
        .catch(() => {
          if (id !== nextId || signal.aborted) return;
          loading = false;
          render();
          storageFeedback.textContent = 'Не удалось загрузить прогресс знакомства.';
        });
      return;
    }
    if (loading) return;
    prepare();
    render();
  }
  signal.addEventListener(
    'abort',
    () => {
      cancelAnimationFrame(resultFrame);
      clearHighlight();
      panel.remove();
      root.classList.remove('is-learning');
    },
    { once: true },
  );
  prepare();
  render();
  return {
    start,
    update,
    resume() {
      if (data.enabled && data.current < 4) {
        if (data.tasks[data.current]?.complete) queueResult();
        else showTool();
      }
    },
    exported() {
      if (!data.enabled || data.current !== 4) return;
      data.exported = true;
      operationError = '';
      save();
      render();
    },
    failed(error: string) {
      if (!data.enabled || data.current !== 4) return;
      operationError = 'HTML не скачан. ' + error;
      render();
    },
    settled: () => queue,
  };
}
