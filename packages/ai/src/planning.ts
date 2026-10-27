import type {Material} from './contracts';
export function imageChoices(id:string,task:string,materials:Material[]){
 const logo=id==='brand-cover'||/логотип/i.test(task),choices=materials.filter(m=>logo?m.category==='logo':m.category!=='logo');
 return choices.length?choices:materials;
}
/** Classify the requested presentation form, not words inside its topic list. */
export function sourceFacts(source:string){return source.split(/(?:\r?\n)+|(?<=[\p{L}\p{N}»][.!?])\s+(?=[А-ЯA-Z])/u).map(text=>text.trim()).filter(Boolean).map((text,index)=>({id:'F'+(index+1),text}));}
/** Keep original sentences and derive independent, affirmative actor/action clauses. */
export function sourceEvidence(source:string){
 const facts: {id:string;text:string;parentId?:string}[]=sourceFacts(source),clauses:typeof facts=[];
 const verb='(?:выбирает|редактирует|просматривает|экспортирует|сохраняет|добавляет|проверяет|создаёт|создает|пишет)';
 for(const fact of facts){
  if(/(?:^|\s)(?:не|если|только|после|до|при|кроме|пока)(?:\s|[,.])/i.test(fact.text))continue;
  const first=fact.text.match(new RegExp('^(.+?)\\s+('+verb+'\\s.+)$','i'));if(!first||!/^(?:пользователь|автор|команда|клиент|редактор|сервис|инструмент)$/i.test(first[1]))continue;
  const parts=first[2].split(new RegExp(',\\s*(?='+verb+'\\s)','i'));if(parts.length<2)continue;
  parts.forEach((part,i)=>clauses.push({id:fact.id+'C'+(i+1),parentId:fact.id,text:first[1]+' '+part.replace(/[.!?]$/,'')+'.'}));
 }
 return [...facts,...clauses];
}
export function requestedComposition(prompt:string){
 const form=prompt.split(/[:«]/,1)[0];
 if(/три возможности|преимуществ|аргумент/i.test(form))return 'features';
 if(/таблиц/i.test(form))return 'table';
 if(/сравн/i.test(form))return 'comparison';
 if(/разделител/i.test(form))return 'divider';
 if(/этап/i.test(form))return 'steps';
 if(/показател|метрик/i.test(form))return 'metrics';
 if(/иллюстрац|текст.*изображ/i.test(form))return 'split';
 if(/шапк/i.test(form))return 'header';
 if(/подвал/i.test(form))return 'footer';
 if(/тезис/i.test(form))return 'thesis';
 if(/финальн/i.test(form))return 'hero';
 if(/текстов|объясни/i.test(form))return 'text';
 return undefined;
}
