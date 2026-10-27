"""Render evidence from one run; editorial scores must belong to that same run."""
import html
import json
import os
import pathlib


def render(root):
    def read(name, default):
        path = root / name
        return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else default

    def escape(value):
        return html.escape(str(value))

    report = read('acceptance.json', {})
    review = read('review.json', {})
    cases = report.get('cases', [])
    control = report.get('sourceSet') not in (None, 'original-acceptance', 'product-facts') and report.get('selection') == 'complete-set'
    expected = report.get('expectedCases', 20) if control else 20
    complete = (bool(report.get('finished')) and not report.get('error')
                and isinstance(expected, int) and expected > 0
                and len(cases) == expected and {c['index'] for c in cases} == set(range(1, expected + 1)))
    if not report.get('finished') or review.get('_runFinished') != report.get('finished'):
        review = {}
    reviewed = complete and all(isinstance(review.get(str(c['index']), {}).get('usable'), bool)
                                and review[str(c['index'])].get('note') for c in cases)
    technical = sum(bool(c.get('success')) for c in cases)
    usable = sum(bool(c.get('success')) and review.get(str(c['index']), {}).get('usable') is True for c in cases)
    loaded = report.get('loaded', {}).get('models', [])
    gpu = bool(loaded) and all(m.get('size', 0) > 0 and m.get('size_vram') == m['size'] for m in loaded)
    summary = f'{technical} / {len(cases)} технических сценариев · пик общей памяти GPU {report.get("peakMiB", "—")} МиБ · полностью на GPU: {"да" if gpu else "не подтверждено"}'
    if reviewed and control:
        assessment = f'Контрольная выборка: {usable} / {expected} пригодных черновиков по оценке агента. Она оценивается отдельно от критерия 18 / 20 основного набора.'
    elif reviewed:
        assessment = f'Проверка содержания агентом: {usable} / 20 пригодных черновиков. Критерий 18 / 20 {"достигнут" if usable >= 18 else "НЕ достигнут"}.'
    elif not complete:
        assessment = f'Протокол {expected} заданий неполный. Итоговая оценка содержания не выставлена.'
    else:
        assessment = 'Проверка содержания этого прогона ещё не зафиксирована полностью. Технические проверки не подтверждают пригодность текста.'

    rows = []
    for c in cases:
        n = c['index']
        item = review.get(str(n), {})
        links = []
        for extension, label in [('json', 'Данные'), ('png', 'Вид')]:
            name = f'case-{n:02}.{extension}'
            if (root / name).exists():
                links.append(f'<a href="{name}">{label}</a>')
        rows.append(f'<tr><td>{n}</td><td>{escape(c["prompt"])}</td><td>{"Пройдено" if c.get("success") else "Ошибка"}</td><td>{c.get("elapsedMs", 0)/1000:.1f} с</td><td>{escape(item.get("note", "Проверка содержания не зафиксирована"))}</td><td>{" · ".join(links)}</td></tr>')

    exports = read('exports.json', None)
    export_section = '' if exports is None else f'<h2>Автономный экспорт этого прогона</h2><pre>{escape(json.dumps(exports, ensure_ascii=False, indent=2))}</pre>'
    rubric_name = 'holdout-input.json' if control else 'rubric.json'
    rubric = f'<p><a href="../{rubric_name}">Критерии, зафиксированные до прогона</a></p>' if (root.parent / rubric_name).exists() else ''
    environment = {key: report[key] for key in ['mode', 'flow', 'base', 'api', 'sourceSet', 'gpu', 'environment', 'sourceHashes'] if key in report}
    text = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alabuga — проверка локального ИИ</title>
<style>body{{font:16px/1.6 system-ui;background:#f3f6fb;color:#000d3c;max-width:1200px;margin:40px auto;padding:24px}}h1{{font-size:36px}}.table{{overflow:auto}}table{{width:100%;border-collapse:collapse;background:white}}td,th{{padding:12px;text-align:left;border-bottom:1px solid #d9e4f0}}a{{color:#0c6ff1}}.lead{{font-size:22px}}pre{{white-space:pre-wrap;overflow-wrap:anywhere}}</style></head><body>
<h1>Локальный ИИ: проверка содержания</h1><p class="lead">{escape(summary)}</p><p>Техническое прохождение означает проверку схемы, команд и компоновки; содержание оценивается отдельно, до ручных правок.</p><p>Память измерена для всего устройства, не только весов модели. Время отдельных запросов — наблюдения этого запуска, не изолированный тест производительности.</p>
<h2>Содержание и границы результата</h2><p>{escape(assessment)}</p><p>Это оценка черновиков агентом, а не готовности к публикации и не исследование с пользователями. Неоценённые ответы и ответы с техническими ошибками не засчитываются как пригодные.</p>{rubric}
<div class="table"><table><thead><tr><th>№</th><th>Запрос</th><th>Техника</th><th>Время</th><th>Содержание</th><th>Артефакт</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>{export_section}
<h2>Исходные сведения</h2><pre>{escape(report.get('sources', 'Не сохранены в этом протоколе'))}</pre><h2>Окружение</h2><pre>{escape(json.dumps(environment, ensure_ascii=False, indent=2))}</pre><p><a href="acceptance.json">Полный протокол с замерами</a></p></body></html>'''
    (root / 'report.html').write_text(text, encoding='utf-8')
    return summary, assessment


if __name__ == '__main__':
    directory = pathlib.Path(os.environ.get('AF_AI_REPORT_DIR', pathlib.Path(__file__).resolve().parent.parent / 'artifacts' / 'ai'))
    for line in render(directory):
        print(line)
