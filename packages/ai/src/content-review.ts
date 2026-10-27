import type {Section} from '@alabuga/framework/schema';
import type {GenerationRequest,OutlineItem} from './contracts';
import {reviewClaims,sectionCopy} from './claims';
export function reviewDraftContent(section:Section,request:GenerationRequest,outline?:OutlineItem,materialNames:string[]=[]){
 const facts=request.prompt+'\n'+request.sources,task=request.scope==='section'?request.prompt:outline?.title??'';
 return [...new Set([...reviewClaims(sectionCopy(section),facts),...reviewContent(section,request.audience,materialNames,{task,sources:request.sources})])];
}
export function reviewContent(section:Section,audience='',materialNames:string[]=[],context?:{task:string;sources:string}){
 const problems:string[]=[];
 const body=section.widgets.filter(w=>w.type==='text').flatMap(w=>w.content.filter(b=>b.type!=='heading'&&'text'in b).map(b=>'text'in b?b.text:'')).join(' ');
 const copy=[body,...section.widgets.filter(w=>w.type==='cards').flatMap(w=>w.items.map(item=>item.title+' '+item.text))].join(' ').trim();
 if(context&&/следующий шаг|призыв/i.test(context.task)){
  const all=section.widgets.flatMap(w=>w.type==='text'?w.content.flatMap(b=>'text'in b?[b.text]:[]):w.type==='button'?[w.label]:[]).join(' ');
  if(!/(?:^|[\s,;:.])(?:начни|выбери|создай|открой|добавь|проверь|запусти|перейди)(?:те)?(?:[\s,.!?;:]|$)/i.test(all))problems.push('В следующем шаге нет призыва к действию. Назовите, что читатель должен сделать, используя возможности из источника.');
 }
 if(context&&copy){
  const topic=/фирмен|композ|стил/i.test(context.task)?/фирмен|композ|стил/i:/предпросмотр|просмотр|мобиль|телефон/i.test(context.task)?/предпросмотр|просмотр|просматр|мобиль|телефон|экран|адапт/i:/редакт|компонент/i.test(context.task)?/редакт|измен|компонент/i:/хран|сохран/i.test(context.task)?/хран|сохран|indexeddb/i:/экспорт/i.test(context.task)?/экспорт|html/i:undefined;
  if(topic&&!topic.test(copy))problems.push('Пояснение не раскрывает тему «'+context.task+'». Используйте относящиеся к ней факты вместо сведений о другой функции.');
  const action=/(?:^|[\s,;:.])(?:открой|нажми|выбери|проверь|переключи|перейди|запусти|добавь|введи|сохрани|скачай|посмотри)(?:те)?(?:[\s,.!?;:]|$)/i;
  if(body&&/как\s+(?:просмотр|посмотр|откры|созда|добав|измен|редакт|экспорт|сохран|запуст)|инструкц/i.test(context.task)&&!action.test(body))problems.push('Вместо инструкции дано описание. Укажите действия пользователя, не выдумывая названия команд.');
 }
 if(context&&/\bhow\b|как\s|инструкц/i.test(context.task)){
  const taskWords=(context.task.toLowerCase().match(/[а-яё]+/gu)??[]).filter(w=>w.length>4).map(w=>w.slice(0,5));
  const instructions=context.sources.split(/(?<=[.!?])\s+|\n/u).filter(s=>/нажмите|выберите|откройте/i.test(s)&&taskWords.some(w=>s.toLowerCase().includes(w)));
  const controls=instructions.flatMap(s=>[...s.matchAll(/«([^»]+)»/g)].map(m=>m[1]));
  const output=JSON.stringify(section.widgets).toLowerCase();
  const missing=[...new Set(controls)].filter(c=>!output.includes(c.toLowerCase()));
  if(missing.length)problems.push('В инструкции отсутствуют команды из источника: '+missing.map(c=>'«'+c+'»').join(', ')+'. Назовите их в порядке действий.');
 }
 for(const w of section.widgets){
  if(w.type==='table'){
   const rows=w.rows.map(row=>w.columns.map(c=>String(row[c.key]??'').trim().toLocaleLowerCase()).join('\u0000'));
   if(new Set(rows).size!==rows.length)problems.push('В таблице повторяются строки. Сравните разные свойства без повторов.');
   if(context)for(const row of w.rows){const cells=w.columns.map(c=>String(row[c.key]??''));if(/хран|сохран/i.test(cells[0]??'')&&cells.slice(1).some(cell=>[...context.sources.matchAll(/формат\s+(\d+:\d+)/gi)].some(m=>cell.includes(m[1]))))problems.push('В строке о хранении указан формат экрана. Сравните одно и то же свойство в каждой ячейке.');}
  }
  if(w.type==='text'&&w.content.some(b=>'text'in b&&materialNames.some(name=>name.length>10&&b.text.trim()===name)))problems.push('Вместо описания материала напишите текст по заданию.');
  if(w.type==='cards'){
   const normalized=w.items.map(i=>i.title.trim().toLocaleLowerCase());
   const explanations=w.items.map(i=>[...new Set(i.text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)??[])].sort().join(' '));
   if(new Set(normalized).size!==normalized.length||new Set(explanations).size!==w.items.length)problems.push('Пункты повторяются. Каждый аргумент или этап должен иметь отдельный заголовок и смысл.');
  }
  if(w.type==='text')for(const b of w.content)if(b.type==='paragraph'&&/^(?:исходные факты|исходные сведения)$/i.test(b.text.trim())&&!context?.task.toLowerCase().includes(b.text.trim().toLowerCase()))problems.push('Замените служебную подпись «'+b.text+'» содержанием для читателя.');
  if(w.type==='text')for(const b of w.content)if('text'in b&&audience&&b.text.trim().toLowerCase()===audience.trim().toLowerCase())problems.push('Название аудитории не является содержанием. Раскройте задачу пользователя вместо подписи аудитории.');
 }
 return problems;
}
