import type {FitSlideOptions,FitSlideResult} from '@alabuga/framework/slide-fit';
export interface GenerationServices {fitSlide?:(section:Section,options:FitSlideOptions)=>Promise<FitSlideResult>}
import {z} from 'zod';
import {catalog,slots,sectionFormat,executeCommands,generationFormat} from './commands';
import {requestSchema,MODEL,type AIProvider,type GenerationRequest,type DraftResult,type Material,type OutlineItem} from './contracts';
import type {Section} from '@alabuga/framework/schema';
import {contentPrompt,contentContract} from './prompt-policy';
import {contentFormat,contentCommands} from './content-format';
import {reviewDraftContent} from './content-review';
import {relevantFacts} from './context';
import {requestedComposition,sourceFacts,imageChoices} from './planning';
import {topicGuidance,hasSourceContent,rankedFacts} from './topic-guidance';
import {reviewOutlineClaims} from './claims';
const system='Write finished Russian copy for the reader. Use ONLY supplied facts; answer the task, not the generation instructions. No invented claims, contacts or guarantees. Keep website and presentation properties distinct. Return schema JSON.';
export function newDraft(request:GenerationRequest,projectId:string,anchorId:string):DraftResult{return {id:crypto.randomUUID(),request:requestSchema.parse(request),projectId,anchorId,outline:[],sections:[],errors:{},warnings:[],title:'Черновик ИИ',updated:Date.now(),model:MODEL,status:{stage:'connection',current:0,total:request.count,message:'Подключение к Qwen3.5-2B…'}}}
export async function generateDraft(draft:DraftResult,provider:AIProvider,materials:Material[],signal:AbortSignal,save:(d:DraftResult)=>Promise<void>,check:(p:Section)=>Promise<string[]>,only?:number,options:{outlineOnly?:boolean;services?:GenerationServices}={}){
 const upstream=provider;provider={...upstream,contentOnly:upstream.contentOnly,status:signal=>upstream.status(signal),generate:(system,prompt,format,signal)=>upstream.generate(system,contentPrompt(prompt,draft.request.sources,hasSourceContent(format))+(upstream.contentOnly?contentContract(format):''),format,signal)};
 const d=structuredClone(draft),r=requestSchema.parse(d.request),facts=r.prompt+'\n'+r.sources;
 const notify=async(stage:DraftResult['status']['stage'],message:string,current=0)=>{signal.throwIfAborted();d.status={stage,message,current,total:r.count};d.updated=Date.now();await save(structuredClone(d))};
 const anchors=provider.contentOnly?sourceFacts(r.sources):[];
 const context='ЗАДАНИЕ: '+r.prompt+'\nАУДИТОРИЯ: '+r.audience+'\nФАКТЫ:\n'+(anchors.length?anchors.map(f=>f.id+': '+f.text).join('\n'):r.sources);
 try{
  await notify('connection','Подключение к Qwen3.5-2B…');await provider.status(signal);
  if(!d.outline.length){
   await notify('outline','Создаём структуру документа…');
   let names=catalog(r.kind).filter(c=>/показател|метрик|цифр/i.test(r.prompt)||c.id!=='metrics').filter(c=>/цитат/i.test(r.prompt)&&facts.includes('«')||c.id!=='quote');
   if(!materials.length)names=names.filter(n=>!slots(n.id,r.kind).some(s=>s.type==='image'||s.type==='gallery'));
   if(r.scope==='document')names=names.filter(n=>n.id!=='header'&&(n.id!=='footer'||/подвал/i.test(r.prompt)));
   if(r.scope==='section')names=names.filter(n=>!['header','footer'].includes(n.id)||n.id===requestedComposition(r.prompt));
   if(r.scope==='section'){const explicit=requestedComposition(r.prompt);if(explicit&&names.some(n=>n.id===explicit))names=names.filter(n=>n.id===explicit)}
   const purpose=anchors.length?z.enum(anchors.map(f=>f.id) as [string,...string[]]):z.string().min(1).max(160);
   const schema=z.object({title:z.string().min(1).max(100),sections:z.array(z.object({composition:z.enum(names.map(n=>n.id) as [string,...string[]]),title:z.string().min(1).max(40),purpose}).strict()).length(r.count)}).strict();
   let outline:z.infer<typeof schema>|undefined,last='';
   for(let attempt=0;attempt<2&&!outline;attempt++){signal.throwIfAborted();try{const candidate=schema.parse(await provider.generate(system,context+(anchors.length?'\nFor purpose, select the ID of the most relevant source fact. Do not invent a factual premise.':'')+'\nСоставь план: '+r.count+' '+(r.kind==='page'?'секций сайта':'слайдов')+'. Следуй темам задания в указанном порядке. Для каждой: title — заголовок до 24 символов, purpose — конкретное содержание до 8 слов. Композиции: '+JSON.stringify(names.map(n=>n.id))+'. Выбирай подходящие разные композиции, footer только в конце. Не смешивай свойства сайта и презентации.\n'+last,generationFormat(z.toJSONSchema(schema)),signal));if(candidate.sections.some(s=>/^(заголовок|основной контент|описание)/i.test(s.title)))throw new Error('Заголовки должны раскрывать тему пользователя, а не называться как шаблоны. Например: «Создавайте сайты».');const claims=reviewOutlineClaims(candidate.sections.map(s=>s.title),facts);if(claims.length)throw new Error(claims.join('; '));if(anchors.length)candidate.sections.forEach(s=>s.purpose=anchors.find(f=>f.id===s.purpose)!.text);outline=candidate}catch(e){if(signal.aborted)throw e;last='Исправь ошибку структуры: '+failureText(e);if(attempt)throw e}}
   const quoted=r.prompt.match(/[«]([^»]+)[»]/)?.[1];if(r.scope==='section'&&quoted&&quoted.length<=40)outline!.sections[0].title=quoted;
   const topics=r.scope==='document'?r.prompt.split(':').slice(1).join(':').replace(/[.!]$/, '').split(',').map(t=>t.trim()).filter(Boolean):[];if(topics.length===r.count)outline!.sections.forEach((section,i)=>{section.title=topics[i].slice(0,40);const role=topicGuidance(topics[i]);if(role&&names.some(n=>n.id===role.composition))section.composition=role.composition});
   if(anchors.length)for(const item of outline!.sections){const ranked=rankedFacts(r.sources,r.scope==='section'?r.prompt:item.title),best=ranked[0],chosen=ranked.find(f=>f.text===item.purpose);if(best?.score>0&&(chosen?.score??0)<best.score)item.purpose=best.text;}
   d.title=outline!.title;d.outline=outline!.sections;d.sections=Array(r.count).fill(null);await notify('outline','Структура готова');
  }
  if(options.outlineOnly){d.awaitingOutline=true;await notify('outline','Структура готова. Уточните заголовки и нажмите «Продолжить».');return d;}
  delete d.awaitingOutline;
  for(let i=0;i<d.outline.length;i++){
   if(only!==undefined?i!==only:!!d.sections[i]&&!d.errors[i])continue;
   const item=d.outline[i];let failure='';
   for(let attempt=0;attempt<2;attempt++){
    await notify('section',`${attempt?'Исправляем':'Создаём'} ${r.kind==='presentation'?'слайд':'секцию'} ${i+1} из ${r.count}`,i+1);
    let raw:unknown;try{
     const fields=slots(item.composition,r.kind),hasMedia=fields.some(s=>s.type==='image'||s.type==='gallery');
     const media=hasMedia?imageChoices(item.composition,r.scope==='section'?r.prompt:item.title+'. '+item.purpose,materials):[];
     const focus=r.scope==='section'?r.prompt:item.title,sectionContext='ЗАДАНИЕ: '+focus+'\nНАЗНАЧЕНИЕ СЕКЦИИ (дополняет тему, не заменяет её): '+item.purpose+'\nФАКТЫ ДЛЯ ЭТОЙ СЕКЦИИ:\n'+relevantFacts(r.sources,focus);
     const instructions=system+'\nFill each slot. Text: heading 2–4 words; body one sentence, 6–12 words. Cards: distinct arguments with 2–3 word titles and 5–9 word explanations. Table: distinct rows, cells 2–5 words. Empty href/value if no source. Assets are visual choices, not copy. '+JSON.stringify(media.map(({id,name,description,category})=>media.length===1?{id,category}:{id,name:category==='local'?description||name:name}))+'\nSlot character limits: '+JSON.stringify(fields.filter(f=>f.type==='text').map(({slot,headingMax,textMax})=>({slot,headingMax,textMax})));
     const fixedHeading=!!draft.outline.length||/«[^»]+»/.test(r.prompt)||hasMedia&&/Вместо описания материала/.test(failure),heading=fixedHeading&&item.title.length<=(fields.find(f=>f.type==='text')?.headingMax??0)?item.title:undefined;
     const usedProse=r.scope==='document'?d.sections.flatMap((p,j)=>j===i||!p?[]:paragraphs(p)):[];
     const format=provider.contentOnly?contentFormat(item.composition,r.kind,heading,media,facts,focus,r.sources,usedProse):sectionFormat(item.composition,r.kind,heading,media,facts);
     raw=await provider.generate(instructions+(hasSourceContent(format)?'\nFor sourceId select a relevant fact ID. The application inserts its exact text. IDs belong only in sourceId, never in prose.':''),sectionContext+'\nТРЕБОВАНИЯ К ПОДАЧЕ: короткий текст по фактам, без объяснения задания.'+(failure?'\nИСПРАВЛЕНИЕ: '+failure:''),format,signal);
     if(provider.contentOnly)raw=contentCommands(raw,item.composition,r.kind,i%2?'contrast':'light',r.sources,format);
     const result=executeCommands(raw,r.kind,item.composition,materials,facts);
     await notify('check',`Проверяем ${i+1} из ${r.count}`,i+1);
     if(r.kind==='presentation'&&options.services?.fitSlide){
      const fitted=await options.services.fitSlide(result.section,{documentTitle:d.title,signal,index:i,previousBackgrounds:d.sections.slice(0,i).map(p=>p?.appearance?.backgroundId??p?.appearance?.background??'')});
      d.sections[i]=result.section;
      if(!fitted.success)throw new Error(fitted.issues.join('; '));
      result.section=fitted.slide;
     }
     const problems=[...reviewDraftContent(result.section,r,item,media.map(m=>m.name)),...await check(result.section)];signal.throwIfAborted();d.sections[i]=result.section;
     if(paragraphs(result.section).some(text=>text.length>30&&usedProse.some(previous=>previous.trim().toLocaleLowerCase()===text.trim().toLocaleLowerCase())))problems.push('Пояснение дословно повторяет другую секцию. Раскройте текущую тему другим текстом по исходным сведениям.');
     if(problems.length)throw new Error(problems.join('; '));
     delete d.errors[i];d.warnings=[...new Set([...d.warnings,...result.warnings,...(hasSourceContent(format)?['Часть текста собрана из исходных сведений: ИИ выбирает факт, инструкцию или самостоятельный фрагмент предложения для нужной темы.']:[])])];failure='';break;
    }catch(e){if(signal.aborted)throw e;failure=failureText(e);if(e instanceof z.ZodError&&raw)failure+=' Сократи проблемные значения, сохрани смысл: '+e.issues.slice(0,2).map(issue=>{let v:any=raw;for(const key of issue.path)v=v?.[key];return JSON.stringify(v)}).join('; ').slice(0,260);d.errors[i]=failure;}
   }
   await notify('check',failure?'Нужна проверка секции '+(i+1):'Секция готова',i+1);
  }
  await notify(Object.keys(d.errors).length?'error':'ready',Object.keys(d.errors).length?'Некоторые секции требуют исправления.':'Черновик готов. Проверьте содержание перед применением.',r.count);return d;
 }catch(e){d.status={stage:signal.aborted?'cancelled':'error',current:d.status.current,total:r.count,message:signal.aborted?'Генерация отменена. Готовые части сохранены.':'Не удалось создать черновик: '+(e instanceof z.ZodError?'модель вернула некорректную структуру. Повторите запрос.':String(e))};d.updated=Date.now();await save(d);return d}
}
function failureText(e:unknown){return (e instanceof z.ZodError?e.issues.slice(0,3).map(i=>i.path.join('.')+': '+i.message).join('; '):String(e)).slice(0,650)}
function paragraphs(section:Section){return section.widgets.filter(w=>w.type==='text').flatMap(w=>w.content.flatMap(b=>b.type==='paragraph'?[b.text]:[]))}
