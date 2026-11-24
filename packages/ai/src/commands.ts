import {remapSectionGrid} from '@alabuga/document-core';
import {z} from 'zod';
import {compositionCatalog,makeComposition} from '@alabuga/framework/compositions';
import {validateDocument,isSafeUrl,type AFDocument,type Section} from '@alabuga/framework/schema';
import {batchSchema,commands,type AICommand,type Material,type GenerationRequest} from './contracts';
import {reviewClaims} from './claims';

export function catalog(kind:AFDocument['kind']){return [...compositionCatalog(kind).filter(([id])=>id!=='blank').map(([id,name,description])=>({id,name,description})),{id:'table',name:'Таблица',description:'Данные из исходных материалов, до 4 строк'}]}
export function template(id:string,kind:AFDocument['kind']):Section{
 if(!catalog(kind).some(c=>c.id===id))throw new Error('Неизвестная композиция: '+id);
 if(id!=='table')return makeComposition(id,kind);
 const p=makeComposition('features',kind);p.composition='text';p.widgets[1]={id:p.widgets[1].id,title:'',type:'table',surface:'plain',position:p.widgets[1].position,variant:'corporate',columns:[{key:'a',label:'Название'},{key:'b',label:'Описание'}],rows:[],pageSize:4};return p;
}
const toolFor={text:'setText',cards:'setCards',metric:'setMetric',image:'setImage',gallery:'setGallery',quote:'setQuote',button:'setButton',table:'setTable'} as const;
export function slots(id:string,kind:AFDocument['kind']){return template(id,kind).widgets.map((w,slot)=>({slot,type:w.type,tool:toolFor[w.type as keyof typeof toolFor],purpose:w.type==='image'&&id==='brand-cover'?'логотип':w.type==='text'?'заголовок и пояснение':w.type==='button'?'действие; пустой href убирает кнопку':w.type,headingMax:w.position.height<=2?(w.position.width<6?32:60):w.position.width<7?40:52,textMax:w.position.height<=2?0:kind==='presentation'?160:220}))}
function responseSchema(id:string,kind:AFDocument['kind'],heading?:string,materials?:Material[]){
 const fields:Record<string,z.ZodType>={create:commands.createSection.extend({composition:z.literal(id)})};
 let first=true;for(const s of slots(id,kind)){let field:z.ZodType=s.tool==='setText'?commands.setText.extend({slot:z.literal(s.slot),heading:first&&heading?z.literal(heading):z.string().max(s.headingMax),text:s.textMax===0?z.literal(''):z.string().max(s.textMax)}):commands[s.tool].extend({slot:z.literal(s.slot)});
  if(materials?.length){const asset=z.enum(materials.map(m=>m.id) as [string,...string[]]);if(s.tool==='setImage')field=commands.setImage.extend({slot:z.literal(s.slot),asset});if(s.tool==='setGallery')field=commands.setGallery.extend({slot:z.literal(s.slot),items:commands.setGallery.shape.items.element.extend({asset}).array().min(1).max(3)})}
  if(s.tool==='setCards')field=commands.setCards.extend({slot:z.literal(s.slot),items:commands.setCards.shape.items.length(id==='comparison'?2:3)});
  fields['slot'+s.slot]=field;if(s.tool==='setText')first=false}
 return z.object({commands:z.object(fields).strict()}).strict();
}
export function generationFormat(schema:Record<string,unknown>):Record<string,unknown>{
 // String ceilings are validated after generation; grammar-enforced maxLength can cut words in half.
 return JSON.parse(JSON.stringify(schema,(key,value)=>key==='maxLength'?undefined:value));
}
export function sectionFormat(id:string,kind:AFDocument['kind'],heading?:string,materials?:Material[],sources?:string){
 const format=generationFormat(z.toJSONSchema(responseSchema(id,kind,heading,materials)) as Record<string,unknown>);
 if(sources!==undefined){const fields=(format as any).properties.commands.properties;const urls=[...new Set(sources.match(/https?:\/\/[^\s<>"']+/g)??[])].filter(isSafeUrl);for(const s of slots(id,kind))if(s.tool==='setButton')fields['slot'+s.slot].properties.href={type:'string',enum:['',...urls]};}
 return format;
}
export function commandExample(id:string,kind:AFDocument['kind'],materials:Material[],theme:string){
 const fields:Record<string,unknown>={create:{tool:'createSection',composition:id,theme,motion:'none'}};
 for(const s of slots(id,kind)){
  const examples:Record<string,unknown>={setText:{heading:'Короткий заголовок',text:s.textMax?'Короткий абзац.':''},setCards:{items:Array.from({length:id==='comparison'?2:3},()=>({title:'Название пункта',text:'Короткое пояснение.'}))},setImage:{asset:materials[0]?.id??'',alt:'Описание изображения'},setGallery:{items:[{asset:materials[0]?.id??'',alt:'Описание изображения',caption:''}]},setMetric:{value:'',note:''},setQuote:{text:'Точная цитата из источника',author:'Автор из источника'},setButton:{label:'Название действия',href:''},setTable:{columns:['Название','Свойство'],rows:[['Название','Короткое значение'],['Название','Короткое значение']]}};
  fields['slot'+s.slot]={tool:s.tool,slot:s.slot,...examples[s.tool] as object};
 }
 return {commands:fields};
}
export function executeCommands(input:unknown,kind:AFDocument['kind'],expected:string,materials:Material[],sources:string):{section:Section;warnings:string[]}{
 const envelope=input as {commands?:unknown};
 if(envelope&&typeof envelope.commands==='object'&&!Array.isArray(envelope.commands)){
  const parsed=responseSchema(expected,kind).parse(input);input={commands:[parsed.commands.create,...slots(expected,kind).map(s=>parsed.commands['slot'+s.slot])]};
 }
 const {commands:batch}=batchSchema.parse(input),first=batch[0];
 if(first.tool!=='createSection'||first.composition!==expected)throw new Error('Первая команда должна создать выбранную композицию.');
 const section=template(first.composition,kind),warnings:string[]=[],seen=new Set<number>(),remove=new Set<string>();section.title='';
 section.appearance!.theme=first.theme;
 const material=(id:string)=>{const m=materials.find(m=>m.id===id);if(!m)throw new Error('Неизвестный материал: '+id);return m};
 for(const c of batch.slice(1)){
  if(c.tool==='createSection')throw new Error('Создавайте только одну секцию за запрос.');
  const w=section.widgets[c.slot];if(!w||seen.has(c.slot)||toolFor[w.type as keyof typeof toolFor]!==c.tool)throw new Error('Неверный или повторный слот '+c.slot);seen.add(c.slot);
  switch(c.tool){
   case 'setText':{const limits=slots(expected,kind)[c.slot];if(c.heading.length>limits.headingMax||c.text.length>limits.textMax)throw new Error(`Слот ${c.slot}: heading максимум ${limits.headingMax}, text максимум ${limits.textMax} символов.`);if(w.type==='text')w.content=[...(c.heading?[{type:'heading' as const,text:c.heading}]:[]),...(c.text?[{type:'paragraph' as const,text:c.text,dropCap:false}]:[])];if(!c.heading&&!c.text){if(c.slot>0&&['header','footer'].includes(expected))remove.add(w.id);else throw new Error('Текстовый слот пуст');};break;}
   case 'setCards':if(w.type==='cards')w.items=c.items;break;
   case 'setMetric':if(w.type==='metric'){if(!c.value){remove.add(w.id);warnings.push('Для одного из показателей нет данных; пустой показатель не добавлен.')}else{if(!sources.includes(c.value))throw new Error('Показатель отсутствует в исходных сведениях: '+c.value);w.value=c.value;w.note=c.note;}}break;
   case 'setImage':if(w.type==='image'){const selected=material(c.asset);w.src=selected.src;w.alt=c.alt;if(selected.category==='logo')w.fit='contain';}break;
   case 'setGallery':if(w.type==='gallery')w.items=c.items.map(i=>({src:material(i.asset).src,alt:i.alt,caption:i.caption}));break;
   case 'setQuote':if(w.type==='quote'){if(!sources.includes(c.text)||!sources.includes(c.author))throw new Error('Цитата и автор должны присутствовать в исходных сведениях.');w.text=c.text;w.author=c.author;}break;
   case 'setButton':if(w.type==='button'){if(!c.href){remove.add(w.id);warnings.push('Не задана ссылка для действия; кнопка не добавлена.')}else{if(!isSafeUrl(c.href)||!sources.includes(c.href))throw new Error('Ссылка должна быть взята из исходных сведений.');w.label=c.label;w.action={type:'link',href:c.href}}}break;
   case 'setTable':if(w.type==='table'){w.wrap=kind==='page';if(c.rows.some(r=>r.length!==c.columns.length))throw new Error('Число ячеек не совпадает с колонками.');w.columns=c.columns.map((label,i)=>({key:'c'+i,label}));w.rows=c.rows.map(r=>Object.fromEntries(r.map((v,i)=>['c'+i,v])))}break;
  }
 }
 if(seen.size!==section.widgets.length)throw new Error('Заполните каждый слот композиции ровно один раз.');
 section.widgets=section.widgets.filter(w=>!remove.has(w.id));section.widgets.forEach((w,i)=>{w.motion={effect:first.motion==='sequence'?'fade':first.motion,speed:'normal',intensity:'subtle',step:kind==='presentation'&&first.motion==='sequence'?i:0}});
 if(kind==='presentation'&&remove.size&&['brand-cover','asymmetric'].includes(expected))for(const w of section.widgets)if(w.type==='text'&&w.position.height===4)w.position.height=6;
 const checked=validateDocument({schemaVersion:3,kind,title:'Черновик',pages:[section]});if(!checked.success)throw new Error(checked.issues.map(i=>i.message).join('; '));
 const generated=batch.filter(c=>!['createSection','setImage','setGallery'].includes(c.tool)).map(c=>Object.entries(c).filter(([k])=>k!=='slot'&&k!=='tool').map(([,v])=>JSON.stringify(v)).join(' ')).join(' ');
 warnings.push(...reviewClaims(generated,sources));
 if(!sources.trim())warnings.push('Нет исходных сведений. Добавьте факты и проверьте содержание.');
 for(const phrase of ['Короткий заголовок','Короткий абзац.','Название пункта','Короткое пояснение.','Сохраняй названные','Не смешивай сайт'])if(generated.includes(phrase))warnings.push('Замените служебную фразу «'+phrase+'» содержанием по заданию.');
 return {section:checked.data.pages[0],warnings};
}
export function insertDraft(doc:AFDocument,sections:Section[],anchor:string,kind:AFDocument['kind']):AFDocument{
 if(doc.kind!==kind)throw new Error('Тип текущего документа изменился.');const index=doc.pages.findIndex(p=>p.id===anchor);if(index<0)throw new Error('Секция для вставки удалена. Откройте помощника заново из нужной секции.');
 const next=structuredClone(doc),added=sections.map(section=>doc.pages[index].grid.frame?remapSectionGrid(section,doc.pages[index].grid,kind):structuredClone(section));for(const p of added){p.id='section-'+crypto.randomUUID();p.widgets.forEach(w=>w.id='block-'+crypto.randomUUID())}next.pages.splice(index+1,0,...added);const result=validateDocument(next);if(!result.success)throw new Error(result.issues.map(i=>i.message).join('; '));return result.data;
}
