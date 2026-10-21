import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const out='artifacts/slide-fit/ai-final';
const notes=[
 [true,'Секция соответствует заданию и исходным сведениям.'],
 [false,'Остались служебные заголовок и абзац.'],
 [true,'Титульный слайд с названием и назначением продукта.'],
 [false,'Гарантия качества и проверенные шаблоны не подтверждены исходными сведениями.'],
 [false,'Последовательность не соответствует заданию: добавление содержания не выделено отдельным этапом.'],
 [false,'Служебный заголовок; содержание не раскрывает тему.'],
 [true,'Корректно сопоставлены адаптивность сайта и формат презентации.'],
 [false,'Не объяснено, что именно работает автономно после установки.'],
 [true,'Есть призыв начать проект; выдуманная ссылка отсутствует.'],
 [false,'Таблица содержит только формат презентации, сравнения с сайтом нет.'],
 [false,'Название продукта заменено служебными заголовками.'],
 [true,'Сохранён заданный заголовок разделителя; пояснение опирается на сведения.'],
 [false,'В подвале остался служебный заголовок.'],
 [false,'Тезис заменён служебным заголовком.'],
 [true,'Правильно описано локальное хранение в IndexedDB.'],
 [false,'Три возможности присутствуют, но есть языковая ошибка «экспорция» и технический жаргон для авторов.'],
 [false,'Вместо инструкции просмотра — только утверждение об адаптивности.'],
 [true,'Оба ограничения 5 и 6 переданы верно, единицы не перепутаны.'],
 [false,'Служебные фразы, отсутствующая секция и неподтверждённое обещание «несколько секунд».'],
 [false,'Служебный заголовок, нарушен порядок заданных тем; фирменный стиль подменён хранением и экспортом.'],
];
const acceptance=JSON.parse(await readFile(out+'/acceptance.json','utf8'));if(acceptance.cases.length!==20)throw new Error('Дождитесь завершения всех 20 запросов');
const browser=await chromium.launch(),page=await browser.newPage();await page.goto('http://127.0.0.1:4175/builder/');const reviews=[];
try{for(const entry of acceptance.cases){const data=JSON.parse(await readFile(`${out}/case-${String(entry.index).padStart(2,'0')}.json`,'utf8'));
 const formatting=data.draft.request.kind==='presentation'?await page.evaluate(async draft=>{const {measureSlide}=await import('/tests/framework/slide-fit.ts');const result=[];for(const [i,p]of draft.sections.entries())result.push({slide:i+1,available:!!p,fitted:!!p?.appearance?.fitted,issues:p?await measureSlide(p,{documentTitle:draft.title}):['Слайд не создан']});return result},data.draft):null;
 reviews.push({...entry,content:{pass:notes[entry.index-1][0],note:notes[entry.index-1][1]},formatting});
}}finally{await browser.close()}
const report={model:acceptance.model,environment:acceptance.environment,technicalPassed:acceptance.passed,contentPassed:reviews.filter(r=>r.content.pass).length,total:20,peakMiB:acceptance.peakMiB,reviews};await writeFile(out+'/review.json',JSON.stringify(report,null,2));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await writeFile(out+'/review.html',`<!doctype html><html lang="ru"><meta charset="utf-8"><title>20 запросов: содержание и оформление</title><style>body{font:17px system-ui;margin:36px;color:#000d3c}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd7e5;padding:12px;text-align:left;vertical-align:top}th{background:#eef3fa}img{width:220px}a{color:inherit}</style><h1>Qwen3.5-2B: 20 реальных запросов</h1><p>Технически готово: ${report.technicalPassed}/20. Редакторская проверка содержания: ${report.contentPassed}/20. Оформление оценивается отдельно, только для презентаций. Красивый слайд со служебным текстом не считается пригодным результатом.</p><p>Один прогон не измеряет общую надёжность модели. Проверка содержания выполнена по заданию, исходным сведениям, связности и языку. Максимум памяти всей GPU во время прогона: ${report.peakMiB} МиБ.</p><table><tr><th>Запрос</th><th>Техническая проверка</th><th>Содержание</th><th>Оформление</th><th>Результат</th></tr>${reviews.map(r=>`<tr><td>${r.index}. ${esc(r.prompt)}</td><td>${r.success?'Готово':'Требует правки'}</td><td>${r.content.pass?'Принято':'Не принято'}: ${esc(r.content.note)}</td><td>${r.formatting?r.formatting.map(f=>`Слайд ${f.slide}: ${f.fitted&&!f.issues.length?'подобран, переполнения нет':esc(f.issues.join('; ')||'не подобран')}`).join('<br>'):'Сайт — вне области автооформления'}</td><td><a href="case-${String(r.index).padStart(2,'0')}.json">Исходный JSON</a><br><img src="case-${String(r.index).padStart(2,'0')}.png" alt="Результат ${r.index}"></td></tr>`).join('')}</table></html>`);
console.log(JSON.stringify({technical:report.technicalPassed,content:report.contentPassed,total:20,slides:reviews.flatMap(r=>r.formatting??[])}));
