import {sectionFormat,slots} from './commands';
import type {AFDocument} from '@alabuga/framework/schema';
import type {Material} from './contracts';
import {imageChoices,sourceFacts,sourceEvidence} from './planning';
import {rankedFacts,resolveSourceCards} from './topic-guidance';
import {comparisonRows,resolveComparisonRows} from './source-table';
/** The model fills content; trusted code supplies tool names, layout and identity. */
export function contentFormat(id:string,kind:AFDocument['kind'],heading:string|undefined,materials:Material[],sources:string,task='',evidenceSources?:string,usedProse:readonly string[]=[]){
 const source=sectionFormat(id,kind,heading,materials,sources) as any,properties:Record<string,unknown>={};
 const measureText=/показател|метрик|цифр/i.test(task)&&task.includes(':')?task.slice(task.indexOf(':')+1):'';
 const measurements=[...measureText.matchAll(/(?<![\p{L}\p{N}.,:/])(\d+(?:[.,]\d+)?)\s+([\p{L}%]+)/gu)].filter(m=>!/^(и|или|на|до|по|из|для)$/i.test(m[2])).map(m=>({value:m[1],unit:m[2]}));
 const metrics=slots(id,kind).filter(s=>s.type==='metric');
 for(const s of slots(id,kind)){
  const field=structuredClone(source.properties.commands.properties['slot'+s.slot]);delete field.properties.tool;delete field.properties.slot;field.required=field.required.filter((k:string)=>k!=='tool'&&k!=='slot');
  if(s.type==='metric'){
   field.properties.value={type:'string',enum:['',...new Set(sources.match(/\d+(?:[.,]\d+)?(?:[:/]\d+)?%?/g)??[])]};
   if(measurements.length&&measurements.length<=metrics.length){const measurement=measurements[metrics.findIndex(m=>m.slot===s.slot)];field.properties.value={type:'string',const:measurement?.value??''};field.properties.note={type:'string',const:measurement?.unit??''}}
  }
  if(s.type==='button'&&(field.properties.href.enum?.length===1||/без ссылк/i.test(task))){
   field.properties.href={type:'string',const:''};field.properties.label={type:'string',const:''};
  }
  if(s.type==='image'){
   const choices=imageChoices(id,task,materials);
   if(choices.length)field.properties.asset={type:'string',enum:choices.map(m=>m.id)};
  }
  if(s.type==='table'&&/сравн/i.test(task)&&/сайт/i.test(sources)&&/презентац/i.test(sources)){
   field.properties.columns={type:'array',const:['Свойство','Сайт','Презентация']};
   field.properties.rows.items.minItems=3;field.properties.rows.items.maxItems=3;
   field.description='Each row: shared feature name, website value, presentation value. Compare the same property across formats.';
   const rows=comparisonRows(evidenceSources??sources);
   if(rows.length>=2)field.properties.rows={type:'object',additionalProperties:false,properties:Object.fromEntries(rows.map((row,i)=>['row'+i,{type:'object',additionalProperties:false,properties:{feature:{type:'string',const:row.name},siteSourceId:{type:'string',enum:row.site},presentationSourceId:{type:'string',enum:row.presentation}},required:['feature','siteSourceId','presentationSourceId']}])),required:rows.map((_,i)=>'row'+i)};
  }
  if(s.type==='text'&&s.slot===0&&['header','footer'].includes(id)){
   const entity=sources.split('\n').map(line=>line.match(/^([^—\n]{2,40})\s+—/)?.[1]?.trim()).find(Boolean);
   if(entity)field.properties.heading={type:'string',const:entity};
  }
  if(s.type==='cards'){
   const explicit=task.split(':').slice(1).join(':').replace(/[.!]$/,'').split(',').map(s=>s.trim()).filter(Boolean);
   const titles=explicit.length>=2&&explicit.length<=3&&explicit.every(t=>t.length<=40)?explicit:id==='comparison'&&/сайт.*презентац/i.test(task)?['Сайт','Презентация']:[];
   if(titles.length){const item=field.properties.items.items;field.properties.items={type:'object',additionalProperties:false,properties:Object.fromEntries(titles.map((title,i)=>['item'+i,{...structuredClone(item),properties:{...structuredClone(item.properties),title:{type:'string',const:title}}}])),required:titles.map((_,i)=>'item'+i)};}
   if(!titles.length&&(id==='features'&&/преимуществ|^(?:возможности|функции)$/i.test(task)||id==='steps'&&/этап|процесс|порядок работы/i.test(task))&&evidenceSources){
    const best=rankedFacts(evidenceSources,task).find(f=>f.score>0),parent=best&&('parentId'in best?best.parentId:best.id),choices=parent?sourceEvidence(evidenceSources).filter(f=>f.parentId===parent&&f.text.length<=160):[];
    const points=id==='features'&&/^(возможности|функции)$/i.test(task.trim())?sourceFacts(evidenceSources).filter(f=>f.text.length<=160&&!/—/.test(f.text)):choices;
    if(points.length>=3){const item=field.properties.items.items,pools=[points.slice(0,1),points.slice(1,-1),points.slice(-1)];field.properties.items={type:'object',additionalProperties:false,properties:Object.fromEntries(pools.map((pool,i)=>['item'+i,{type:'object',additionalProperties:false,properties:{title:item.properties.title,sourceId:{type:'string',enum:pool.map(f=>f.id)}},required:['title','sourceId']}])),required:['item0','item1','item2']}}
   }
   const evidence=titles.map(title=>{const ranked=evidenceSources?rankedFacts(evidenceSources,title).filter(f=>f.score>0):[],top=ranked[0]?.score;return top===undefined?[]:ranked.filter(f=>f.score>=top-1).slice(0,3).map(f=>f.id)});
   if(titles.length&&evidenceSources?.trim())for(const [i]of titles.entries()){
    const choices=evidence[i];
    // A sentence covering several subjects cannot be pasted into distinct cards.
    if(!choices.length||evidence.some((other,j)=>j!==i&&other.some(id=>choices.includes(id))))continue;
    const item=field.properties.items.properties['item'+i];
    delete item.properties.text;item.properties.sourceId={type:'string',enum:choices};item.required=['title','sourceId'];
   }
  }
  if(s.type==='text'&&s.textMax>0&&!['header','footer'].includes(id)&&evidenceSources&&/как\s|инструкц/i.test(task)){
   const words=(task.toLowerCase().match(/[а-яё]+/gu)??[]).filter(w=>w.length>4).map(w=>w.slice(0,5));
   const instructions=sourceFacts(evidenceSources).filter(f=>/нажмите|выберите|откройте/i.test(f.text)&&/«[^»]+»/.test(f.text)&&words.some(w=>f.text.toLowerCase().includes(w)));
   if(instructions.length){delete field.properties.text;field.properties.sourceId={type:'string',enum:instructions.map(f=>f.id)};field.required=['heading','sourceId']}
  }
  if(s.type==='text'&&s.textMax>0&&!['header','footer','divider'].includes(id)&&evidenceSources&&!/как\s|инструкц|призыв|финальн|следующий шаг/i.test(task)){
   const ranked=rankedFacts(evidenceSources,task).filter(f=>f.score>0&&f.text.length<=s.textMax&&!usedProse.some(text=>text.trim().toLocaleLowerCase()===f.text.toLocaleLowerCase())),top=ranked[0]?.score;
   if(top!==undefined){delete field.properties.text;field.properties.sourceId={type:'string',enum:ranked.filter(f=>f.score>=top-1).slice(0,3).map(f=>f.id)};field.required=['heading','sourceId']}
  }
  if(s.type==='text'&&s.slot>0&&['header','footer'].includes(id)){field.properties.heading={type:'string',const:''};field.properties.text={type:'string',const:''}}
  field.description??=s.purpose;properties['slot'+s.slot]=field;
 }
 return {type:'object',additionalProperties:false,properties:{composition:{type:'string',const:id},content:{type:'object',additionalProperties:false,properties,required:Object.keys(properties)}},required:['composition','content']};
}
export function contentCommands(raw:unknown,id:string,kind:AFDocument['kind'],theme:string,evidenceSources='',format?:Record<string,unknown>){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Нужен объект содержания.');
 const response=raw as {composition?:string;content?:Record<string,unknown>};
 const expected=slots(id,kind),content=response.content;
 if(response.composition!==id||Object.keys(response).some(k=>!['composition','content'].includes(k))||!content||typeof content!=='object'||Array.isArray(content)||Object.keys(content).length!==expected.length||expected.some(s=>!Object.hasOwn(content,'slot'+s.slot)))throw new Error('Содержание не соответствует местам композиции.');
 const filled=expected.map(s=>{
  const value=content['slot'+s.slot];
  if(!value||typeof value!=='object'||Array.isArray(value)||'tool'in value||'slot'in value)throw new Error('Поля инструментов задаёт конструктор.');
  const data={...value} as Record<string,unknown>,spec=(format as any)?.properties?.content?.properties?.['slot'+s.slot]?.properties;
  if(s.type==='cards'){
   if(data.items&&typeof data.items==='object'&&!Array.isArray(data.items)){
    const entries=data.items as Record<string,unknown>,keys=Object.keys(entries);
    if(keys.length<2||keys.length>3||keys.some((_,i)=>!Object.hasOwn(entries,'item'+i)))throw new Error('Неверные пункты содержания.');
    data.items=keys.map((_,i)=>entries['item'+i]);
   }
   if(Array.isArray(data.items))data.items=resolveSourceCards(data.items,spec?.items?.properties,evidenceSources);
  }
  if(s.type==='text'&&spec?.sourceId){
   if(Object.keys(data).some(k=>!['heading','sourceId'].includes(k))||!spec.sourceId.enum.includes(data.sourceId))throw new Error('Выберите исходную инструкцию по допустимому идентификатору.');
   const fact=sourceEvidence(evidenceSources).find(f=>f.id===data.sourceId);if(!fact)throw new Error('Исходный факт не найден.');
   delete data.sourceId;data.text=fact.text;
  }
  if(s.type==='table'&&spec?.rows?.properties){
   if(JSON.stringify(data.columns)!==JSON.stringify(spec.columns.const))throw new Error('Заголовки сравнения должны соответствовать форматам.');
   data.rows=resolveComparisonRows(data.rows,spec.rows,evidenceSources);
  }
  return ['slot'+s.slot,{...data,tool:s.tool,slot:s.slot}];
 });
 return {commands:{create:{tool:'createSection',composition:id,theme,motion:'none'},...Object.fromEntries(filled)}};
}
