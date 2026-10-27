import {sourceFacts} from './planning';

/** Constrain comparable cells to short source facts about the same property. */
export function comparisonRows(sources:string){
 const facts=sourceFacts(sources).filter(f=>f.text.length<=100),groups=[
  {name:'Отображение',pattern:/адаптир|экран|пропорц|формат\s+\d+[:/]\d+/i},
  {name:'Хранение',pattern:/хран|indexeddb|сохраня[^.]*браузер/i},
  {name:'Экспорт',pattern:/экспорт|html/i}
 ];
 return groups.flatMap(group=>{
  const candidates=facts.filter(f=>group.pattern.test(f.text));
  const scope=(text:string)=>({site:/сайт/i.test(text),presentation:/презентац/i.test(text)});
  const allowed=(side:'site'|'presentation')=>candidates.filter(f=>{const owner=scope(f.text);if(owner.site&&owner.presentation&&group.name==='Отображение')return false;return !owner.site&&!owner.presentation||owner[side]}).map(f=>f.id);
  const site=allowed('site'),presentation=allowed('presentation');
  return site.length&&presentation.length?[{name:group.name,site,presentation}]:[];
 });
}

export function resolveComparisonRows(value:unknown,spec:any,sources:string){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Сравнение должно выбрать исходные факты для каждой строки.');
 const data=value as Record<string,unknown>,keys=Object.keys(spec.properties);
 if(Object.keys(data).length!==keys.length||keys.some(key=>!Object.hasOwn(data,key)))throw new Error('Неверные строки сравнения.');
 const facts=sourceFacts(sources);
 return keys.map(key=>{
  const row=data[key] as Record<string,unknown>,fields=spec.properties[key].properties;
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['feature','siteSourceId','presentationSourceId'].includes(k))||row.feature!==fields.feature.const)throw new Error('Свойство строки сравнения изменено.');
  const cells=['siteSourceId','presentationSourceId'].map(side=>{
   if(!fields[side].enum.includes(row[side]))throw new Error('Факт не относится к этому свойству и формату.');
   const fact=facts.find(f=>f.id===row[side]);if(!fact||fact.text.length>100)throw new Error('Исходный факт сравнения отсутствует или не помещается целиком.');return fact.text;
  });
  return [fields.feature.const,...cells];
 });
}
