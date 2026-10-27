import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contentFormat,contentCommands} from '@alabuga/ai/content-format';
import {executeCommands} from '@alabuga/ai/commands';
import {newDraft,generateDraft} from '@alabuga/ai/generate';
import {fixtureCommands} from './ai-fixtures';
import {contentPrompt,contentContract} from '@alabuga/ai/prompt-policy';
import {requestedComposition,sourceFacts,sourceEvidence} from '@alabuga/ai/planning';
import {reviewContent,reviewDraftContent} from '@alabuga/ai/content-review';
import {rankedFacts,topicGuidance,hasSourceCards} from '@alabuga/ai/topic-guidance';
test('card evidence refers to stable source IDs, independent of their order in the prompt',()=>{
 const sources='Изображения можно загрузить.\nЭкспортированный HTML работает без модели.\nТекст редактируется на холсте.';
 const format=contentFormat('features','presentation',undefined,[],sources,'Возможности: текст, изображения, экспорт',sources) as any;
 const items=format.properties.content.properties.slot1.properties.items.properties;
 assert.deepEqual(items.item0.properties.sourceId.enum,['F3']);assert.deepEqual(items.item1.properties.sourceId.enum,['F1']);assert.deepEqual(items.item2.properties.sourceId.enum,['F2']);
 assert.ok(hasSourceCards(format));assert.equal(hasSourceCards(contentFormat('text','page',undefined,[],sources)),false);
 const raw={composition:'features',content:{slot0:{heading:'Возможности',text:''},slot1:{items:{item0:{title:'текст',sourceId:'F3'},item1:{title:'изображения',sourceId:'F1'},item2:{title:'экспорт',sourceId:'F2'}}}}};
 const before=structuredClone(raw),result=executeCommands(contentCommands(raw,'features','presentation','light',sources,format),'presentation','features',[],sources);
 assert.deepEqual(raw,before);const cards=result.section.widgets.find(w=>w.type==='cards')!;assert.equal(cards.type,'cards');if(cards.type==='cards')assert.deepEqual(cards.items.map(i=>i.text),['Текст редактируется на холсте.','Изображения можно загрузить.','Экспортированный HTML работает без модели.']);
 for(const invalid of [{title:'экспорт',sourceId:'F99'},{title:'экспорт',sourceId:'F3'},{title:'экспорт',sourceId:'F2',text:'Выдумка'},{title:'Выдумка',sourceId:'F2'}]){const bad=structuredClone(raw);bad.content.slot1.items.item2=invalid;assert.throws(()=>contentCommands(bad,'features','presentation','light',sources,format));}
 const prompt='ЗАДАНИЕ: Экспорт\nФАКТЫ ДЛЯ ЭТОЙ СЕКЦИИ:\nselected';
 assert.match(contentPrompt(prompt,sources,true),/F2: Экспортированный HTML/);
 assert.doesNotMatch(contentPrompt(prompt,sources),/F[123]:/);
 assert.ok(contentPrompt(prompt,sources).includes(sources));
});

test('comparison cells select same-property source facts and reject swapped formats',()=>{
 const sources='Проекты сохраняются в браузере.\nСайт адаптируется к экрану.\nПрезентация сохраняет формат 16:9.\nЭкспортированный HTML работает без модели.';
 const format=contentFormat('table','page',undefined,[],sources,'Таблица сравнения сайта и презентации',sources) as any;
 const spec=format.properties.content.properties.slot1.properties,rows=Object.fromEntries(Object.entries(spec.rows.properties).map(([key,row]:[string,any])=>[key,{feature:row.properties.feature.const,siteSourceId:row.properties.siteSourceId.enum[0],presentationSourceId:row.properties.presentationSourceId.enum[0]}]));
 const raw={composition:'table',content:{slot0:{heading:'Форматы',text:''},slot1:{columns:spec.columns.const,rows}}};
 const result=executeCommands(contentCommands(raw,'table','page','light',sources,format),'page','table',[],sources),table=result.section.widgets.find(w=>w.type==='table')!;
 assert.deepEqual(table.type==='table'?table.rows.map(r=>[r.c0,r.c1,r.c2]):[],[['Отображение','Сайт адаптируется к экрану.','Презентация сохраняет формат 16:9.'],['Хранение','Проекты сохраняются в браузере.','Проекты сохраняются в браузере.'],['Экспорт','Экспортированный HTML работает без модели.','Экспортированный HTML работает без модели.']]);
 const bad=structuredClone(raw);bad.content.slot1.rows.row0.siteSourceId='F3';assert.throws(()=>contentCommands(bad,'table','page','light',sources,format),/свойству и формату/);
 const unknown=structuredClone(raw);unknown.content.slot1.rows.row0.presentationSourceId='F99';assert.throws(()=>contentCommands(unknown,'table','page','light',sources,format));
 assert.match(contentContract(format),/row0: Отображение; siteSourceId=F2; presentationSourceId=F3/);
});

test('comparison grounding does not invent missing common properties or shorten long evidence',()=>{
 const sources='Сайт адаптируется к экрану.\nПрезентация сохраняет формат 16:9.';
 const sparse=contentFormat('table','page',undefined,[],sources,'Сравни сайт и презентацию',sources) as any;assert.equal(sparse.properties.content.properties.slot1.properties.rows.type,'array');
 const long=sources+'\nПроекты сохраняются в браузере '+ 'целиком без изменения '.repeat(10)+'.';
 const format=contentFormat('table','page',undefined,[],long,'Сравни сайт и презентацию',long) as any;assert.equal(format.properties.content.properties.slot1.properties.rows.type,'array');
});

test('unreviewed fragment headings can improve while reviewed and quoted headings stay fixed',async()=>{
 for(const mode of ['direct','reviewed','quoted']){
  const request={kind:'page' as const,scope:'section' as const,count:1,prompt:mode==='quoted'?'Создай текстовую секцию «Точное название» о заметках':'Создай текстовую секцию о заметках',audience:'',sources:'Заметки можно редактировать.'};
  let calls=0;const provider={contentOnly:true,status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async(_system:string,_prompt:string,format:any)=>{
   if(++calls===1)return {title:'Заметки',sections:[{composition:'text',title:'Черновой вариант',purpose:'F1'}]};
   const field=format.properties.content.properties.slot0.properties;assert.equal(field.heading.const,mode==='direct'?undefined:mode==='quoted'?'Точное название':'Авторский заголовок');
   return {composition:'text',content:{slot0:{heading:field.heading.const??'Работайте с заметками',sourceId:'F1'}}};
  }};
  let draft=newDraft(request,'p','a');if(mode==='reviewed'){draft=await generateDraft(draft,provider,[],new AbortController().signal,async()=>{},async()=>[],undefined,{outlineOnly:true});draft.outline[0].title='Авторский заголовок'}
  const result=await generateDraft(draft,provider,[],new AbortController().signal,async()=>{},async()=>[]);assert.equal(result.status.stage,'ready');assert.equal(calls,2);
 }
});

test('repairing a copied material name returns to the planned heading without removing the illustration',async()=>{
 const request={kind:'page' as const,scope:'section' as const,count:1,prompt:'Создай секцию с фирменной иллюстрацией',audience:'',sources:'Автор выбирает фирменную композицию.'},material={id:'art',name:'Световая геометрия',description:'Графика',category:'decoration',src:'art.svg'};
 let calls=0;const provider={contentOnly:true,status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async(_system:string,_prompt:string,format:any)=>{
  if(++calls===1)return {title:'Проект',sections:[{composition:'split',title:'Наша история',purpose:'F1'}]};
  const heading=format.properties.content.properties.slot0.properties.heading;assert.equal(heading.const,calls===2?undefined:'Наша история');
  return {composition:'split',content:{slot0:{heading:heading.const??material.name,sourceId:'F1'},slot1:{asset:'art',alt:'Графика'}}};
 }};
 const result=await generateDraft(newDraft(request,'p','a'),provider,[material],new AbortController().signal,async()=>{},async()=>[]);assert.equal(result.status.stage,'ready');assert.equal(calls,3);assert.ok(result.sections[0]?.widgets.some(w=>w.type==='image'&&w.src==='art.svg'));
});

test('new outlines align their premise to the topic before review without replacing author edits',async()=>{
 const request={kind:'page' as const,scope:'document' as const,count:1,prompt:'Создай страницу: экспорт.',audience:'',sources:'Проекты сохраняются в браузере.\nЭкспортированный HTML работает без редактора.'};
 const provider={contentOnly:true,status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async()=>({title:'Проект',sections:[{composition:'text',title:'Экспорт',purpose:'F1'}]})};
 const draft=await generateDraft(newDraft(request,'p','a'),provider,[],new AbortController().signal,async()=>{},async()=>[],undefined,{outlineOnly:true});assert.equal(draft.outline[0].purpose,'Экспортированный HTML работает без редактора.');
 draft.outline[0].purpose='Авторское уточнение';const again=await generateDraft(draft,provider,[],new AbortController().signal,async()=>{},async()=>[],undefined,{outlineOnly:true});assert.equal(again.outline[0].purpose,'Авторское уточнение');
});

test('reused source prose remains available for paraphrasing and exact duplicate paragraphs get one repair',async()=>{
 const first='Автор создаёт заметки и меняет их содержание в браузере.',second='Готовую заметку можно выгрузить в HTML для чтения.';
 const sources=first+'\n'+second,format=contentFormat('text','page',undefined,[],sources,'Заметки',sources,[first]) as any;assert.deepEqual(format.properties.content.properties.slot0.properties.sourceId.enum,['F2']);
 const exhausted=contentFormat('text','page',undefined,[],sources,'Заметки',sources,[first,second]) as any;assert.equal(exhausted.properties.content.properties.slot0.properties.sourceId,undefined);
 const draft=newDraft({kind:'page',scope:'document',count:2,prompt:'Собери страницу о заметках',audience:'',sources},'p','a');draft.outline=[{composition:'text',title:'Введение',purpose:first},{composition:'text',title:'Продолжение',purpose:second}];draft.sections=[null,null];
 let calls=0;const provider={status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async(_system:string,prompt:string)=>{calls++;if(calls===3)assert.match(prompt,/дословно повторяет другую секцию/);const result=fixtureCommands('text'),text=result.commands.find(c=>c.tool==='setText')!;text.text=calls<3?first:second;return result}};
 const result=await generateDraft(draft,provider,[],new AbortController().signal,async()=>{},async()=>[]);assert.equal(result.status.stage,'ready');assert.equal(calls,3);assert.deepEqual(draft.sections,[null,null]);
});

test('priority guidance keeps whole sources and describes the required reader action',()=>{
 const sources='Проекты хранятся в браузере.\nПользователь выбирает композицию и редактирует текст.';
 const prompt=contentPrompt('ЗАДАНИЕ: Покажи этапы работы\nФАКТЫ ДЛЯ ЭТОЙ СЕКЦИИ:\nselected',sources);
 assert.ok(prompt.includes(sources));assert.match(prompt,/consecutive reader actions/);assert.match(contentPrompt('ЗАДАНИЕ: Как открыть проект?\nФАКТЫ ДЛЯ ЭТОЙ СЕКЦИИ:\nselected',sources),/do not invent them/);
});

test('source action clauses retain their actor and never remove negation or conditions',()=>{
 const source='Пользователь выбирает структуру, редактирует текст, просматривает результат.';
 const evidence=sourceEvidence(source);assert.deepEqual(evidence[0],sourceFacts(source)[0]);assert.deepEqual(evidence.slice(1).map(f=>[f.id,f.parentId,f.text]),[['F1C1','F1','Пользователь выбирает структуру.'],['F1C2','F1','Пользователь редактирует текст.'],['F1C3','F1','Пользователь просматривает результат.']]);
 for(const guarded of ['Пользователь не выбирает структуру, редактирует текст.','Автор выбирает структуру, редактирует текст только после оплаты.','После проверки пользователь выбирает структуру, редактирует текст.','Наша команда выбирает структуру, редактирует текст.'])assert.deepEqual(sourceEvidence(guarded),sourceFacts(guarded));
});

test('benefit and workflow cards select supported action clauses rather than unrelated limits',()=>{
 const source='Пользователь выбирает фирменные композиции, редактирует текст, просматривает результат, экспортирует HTML.\nИИ создаёт до 5 секций сайта.';
 for(const [composition,task]of [['features','Три преимущества готовых композиций'],['steps','Процесс']] as const){
  const format=contentFormat(composition,'page',undefined,[],source,task,source) as any,items=format.properties.content.properties.slot1.properties.items.properties;
  assert.deepEqual(items.item0.properties.sourceId.enum,['F1C1']);assert.deepEqual(items.item1.properties.sourceId.enum,['F1C2','F1C3']);assert.deepEqual(items.item2.properties.sourceId.enum,['F1C4']);
  const raw={composition,content:{slot0:{heading:'Работа с содержанием',text:''},slot1:{items:Object.fromEntries([0,1,2].map(i=>['item'+i,{title:['Композиция','Редактирование','Экспорт'][i],sourceId:items['item'+i].properties.sourceId.enum[0]}]))}}};
  const result=executeCommands(contentCommands(raw,composition,'page','light',source,format),'page',composition,[],source);assert.deepEqual(reviewContent(result.section),[]);
  const repeated=structuredClone(raw);repeated.content.slot1.items.item1.sourceId='F1C1';assert.throws(()=>contentCommands(repeated,composition,'page','light',source,format));
  assert.match(contentContract(format),/distinct short title/);
 }
 const unrelated=contentFormat('features','page',undefined,[],source,'Преимущества доставки',source) as any;assert.equal(unrelated.properties.content.properties.slot1.properties.items.type,'array');
});

test('a next-step section needs a supported action and source pools cannot repeat a point',()=>{
 const make=(heading:string,text:string)=>{const raw=fixtureCommands('hero'),copy=raw.commands.find(c=>c.tool==='setText')!;copy.heading=heading;copy.text=text;return executeCommands(raw,'page','hero',[],'16:9').section};
 assert.match(reviewContent(make('Следующий шаг','Презентация сохраняет формат 16:9.'),'',[],{task:'Следующий шаг',sources:''}).join(' '),/нет призыва/);
 assert.deepEqual(reviewContent(make('Выберите композицию','Начните свой проект.'),'',[],{task:'Следующий шаг',sources:''}),[]);
 const sources='Название — редактор.\nПроекты хранятся локально.\nСайт адаптируется к экрану.\nHTML можно экспортировать.';
 const format=contentFormat('features','page',undefined,[],sources,'Возможности',sources) as any,items=format.properties.content.properties.slot1.properties.items.properties;
 assert.deepEqual(items.item0.properties.sourceId.enum,['F2']);assert.deepEqual(items.item1.properties.sourceId.enum,['F3']);assert.deepEqual(items.item2.properties.sourceId.enum,['F4']);
});

test('shared source sentences leave card explanations distinct and editable',()=>{
 const sources='Автор редактирует тексты и изображения в браузере.';
 const format=contentFormat('features','presentation',undefined,[],sources,'Три возможности: текст, изображения, таблицы',sources) as any;
 const items=format.properties.content.properties.slot1.properties.items.properties;
 assert.ok(items.item0.properties.text);assert.ok(items.item1.properties.text);assert.equal(items.item0.properties.sourceId,undefined);assert.equal(items.item1.properties.sourceId,undefined);
 const raw={composition:'features',content:{slot0:{heading:'Возможности',text:''},slot1:{items:{item0:{title:'текст',text:'Редактируйте текст в браузере.'},item1:{title:'изображения',text:'Меняйте изображения.'},item2:{title:'таблицы',text:'Добавьте свои данные.'}}}}};
 const result=executeCommands(contentCommands(raw,'features','presentation','light',sources,format),'presentation','features',[],sources);
 assert.deepEqual(reviewContent(result.section),[]);
});

test('requested measurements preserve their units and leave extra metric slots empty',()=>{
 const sources='Доступно до 5 секций сайта и до 6 слайдов.';
 const format=contentFormat('metrics','presentation','Возможности',[],sources,'Показатели: 5 секций и 6 слайдов',sources) as any;
 const content=Object.fromEntries(Object.entries(format.properties.content.properties).map(([key,field]:[string,any])=>[key,Object.fromEntries(Object.entries(field.properties).map(([name,value]:[string,any])=>[name,value.const??'']))]));
 const result=executeCommands(contentCommands({composition:'metrics',content},'metrics','presentation','light',sources,format),'presentation','metrics',[],sources);
 assert.deepEqual(result.section.widgets.filter(w=>w.type==='metric').map(w=>[w.value,w.note]),[['5','секций'],['6','слайдов']]);assert.ok(result.warnings.some(w=>w.includes('пустой показатель')));
 const count=contentFormat('metrics','presentation',undefined,[],sources,'Создай 1 слайд с 3 показателями') as any;assert.equal(count.properties.content.properties.slot1.properties.value.const,undefined);
});

test('short prose selects relevant whole evidence and respects slot capacity',()=>{
 const sources='Проекты сохраняются в браузере.\nФирменные композиции задают структуру.';
 const format=contentFormat('text','page','Композиции',[],sources,'Фирменные композиции',sources) as any;
 assert.deepEqual(format.properties.content.properties.slot0.properties.sourceId.enum,['F2']);
 const raw={composition:'text',content:{slot0:{heading:'Композиции',sourceId:'F2'}}},result=executeCommands(contentCommands(raw,'text','page','light',sources,format),'page','text',[],sources);
 assert.deepEqual(reviewDraftContent(result.section,{kind:'page',scope:'section',count:1,prompt:'Фирменные композиции',audience:'',sources}),[]);
 const long='Композиции '+ 'сохраняют полное исходное предложение '.repeat(20),large=contentFormat('text','page','Композиции',[],long,'Композиции',long) as any;assert.equal(large.properties.content.properties.slot0.properties.sourceId,undefined);
});

test('prose and table checks catch a wrong topic, missing procedure and mixed comparison properties',()=>{
 const text=executeCommands({commands:[{tool:'createSection',composition:'text',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Мобильный просмотр',text:'Презентация сохраняет формат 16:9.'}]},'page','text',[],'16:9').section;
 assert.match(reviewContent(text,'',[],{task:'Объясни, как просмотреть сайт на мобильном экране.',sources:'Сайт адаптируется к экрану.'}).join(' '),/не раскрывает тему.*Вместо инструкции/);
 const table=executeCommands({commands:[{tool:'createSection',composition:'table',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Форматы',text:''},{tool:'setTable',slot:1,columns:['Свойство','Сайт','Презентация'],rows:[['Сохранение','IndexedDB','16:9']]}]},'page','table',[],'16:9').section;
 assert.match(reviewContent(table,'',[],{task:'Сравни форматы',sources:'Презентация сохраняет формат 16:9.'}).join(' '),/строке о хранении/);
});

test('document generation follows the reviewed topic even when its outline premise differs',async()=>{
 const draft=newDraft({kind:'page',scope:'document',count:1,prompt:'Создай страницу: экспорт.',audience:'',sources:'Проекты сохраняются в браузере.\nHTML экспортируется без модели.'},'p','a');draft.outline=[{composition:'text',title:'Экспорт',purpose:'Проекты сохраняются в браузере.'}];draft.sections=[null];
 const provider={contentOnly:true,status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async(_system:string,prompt:string,format:any)=>{assert.match(prompt,/ЗАДАНИЕ: Экспорт\n/);assert.doesNotMatch(prompt,/ЗАДАНИЕ: Экспорт\. Проекты/);assert.match(prompt,/НАЗНАЧЕНИЕ СЕКЦИИ.*Проекты сохраняются/);assert.deepEqual(format.properties.content.properties.slot0.properties.sourceId.enum,['F2']);return {composition:'text',content:{slot0:{heading:'Экспорт',sourceId:'F2'}}}}};
 const result=await generateDraft(draft,provider,[],new AbortController().signal,async()=>{},async()=>[]);assert.equal(result.status.stage,'ready');assert.equal(result.outline[0].purpose,'Проекты сохраняются в браузере.');
});

test('card checks catch reordered filler and headings cannot hide an unrelated body',()=>{
 const cards=executeCommands({commands:[{tool:'createSection',composition:'features',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Фирменный стиль',text:''},{tool:'setCards',slot:1,items:[{title:'Текст',text:'Текст и изображения'},{title:'Изображения',text:'Изображения и текст'},{title:'Таблицы',text:'Сохранение таблиц'}]}]},'page','features',[],'').section;
 const problems=reviewContent(cards,'',[],{task:'Фирменный стиль',sources:'Автор выбирает фирменные композиции.'}).join(' ');assert.match(problems,/не раскрывает тему/);assert.match(problems,/Пункты повторяются/);
 const text=executeCommands({commands:[{tool:'createSection',composition:'text',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Следующий шаг',text:'исходные факты'}]},'page','text',[],'').section;
 assert.match(reviewContent(text,'',[],{task:'Следующий шаг',sources:''}).join(' '),/служебную подпись/);
});
test('rechecking a generated section retains factual errors and ignores geometry numbers',()=>{
 const request={kind:'page' as const,scope:'section' as const,count:1,prompt:'Расскажи о презентации',audience:'',sources:'Презентация сохраняет формат 16:9.'};
 const section=executeCommands({commands:[{tool:'createSection',composition:'text',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Презентация',text:'Презентация включает 16 слайдов.'}]},'page','text',[],request.sources).section;
 assert.match(reviewDraftContent(section,request).join(' '),/16 слайдов/);
 const w=section.widgets[0];if(w.type==='text')w.content=[{type:'heading',text:'Презентация'},{type:'paragraph',dropCap:false,text:request.sources}];
 assert.deepEqual(reviewDraftContent(section,request),[]);
});
test('source instructions keep their controls verbatim and cannot inject a substitute paragraph',()=>{
 const sources='Чтобы просмотреть сайт, нажмите «Предпросмотр» и выберите «Телефон».',task='Объясни, как просмотреть сайт';
 const format=contentFormat('text','page','Просмотр',[],sources,task,sources) as any;
 assert.deepEqual(format.properties.content.properties.slot0.properties.sourceId.enum,['F1']);
 const raw={composition:'text',content:{slot0:{heading:'Просмотр',sourceId:'F1'}}};
 const result=executeCommands(contentCommands(raw,'text','page','light',sources,format),'page','text',[],sources);
 assert.deepEqual(reviewDraftContent(result.section,{kind:'page',scope:'section',count:1,prompt:task,audience:'',sources}),[]);
 assert.throws(()=>contentCommands({...raw,content:{slot0:{...raw.content.slot0,text:'Другая инструкция'}}},'text','page','light',sources,format));
 const long=sources.slice(0,-1)+', '+ 'полное исходное предложение '.repeat(20),large=contentFormat('text','page','Просмотр',[],long,task,long);
 assert.throws(()=>executeCommands(contentCommands(raw,'text','page','light',long,large),'page','text',[],long));
});
test('unsupported outline quantities are repaired before becoming a fixed heading',async()=>{
 let calls=0;const provider={contentOnly:true,status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async()=>({title:'Презентация',sections:[{composition:'text',title:++calls===1?'16 слайдов':'Формат презентации',purpose:'F1'}]})};
 const draft=await generateDraft(newDraft({kind:'page',scope:'section',count:1,prompt:'Расскажи о презентации',audience:'',sources:'Презентация сохраняет формат 16:9.'},'p','a'),provider,[],new AbortController().signal,async()=>{},async()=>[],undefined,{outlineOnly:true});
 assert.equal(calls,2);assert.equal(draft.outline[0].title,'Формат презентации');assert.equal(draft.awaitingOutline,true);
});
test('topic ordering preserves every whole fact and prioritizes the requested subject',()=>{
 const source='Экспорт доступен в HTML.\nАвтор выбирает фирменную композицию.\nСлайды имеют формат 16:9.\n! Обязательно сохранить последний факт.';
 const ordered=rankedFacts(source,'Фирменный стиль').map(f=>f.text).join('\n');
 assert.equal(ordered.split('\n')[0],'Автор выбирает фирменную композицию.');
 assert.deepEqual(new Set(ordered.split('\n')),new Set(source.split('\n')));
 assert.equal(topicGuidance('процесс')?.composition,'steps');
 assert.equal(topicGuidance('следующий шаг')?.composition,'hero');
 assert.equal(topicGuidance('Процессор и видеокарта'),undefined);
});
test('procedural copy retains source control labels without constraining ordinary prose',()=>{
 const make=(text:string)=>executeCommands({commands:[{tool:'createSection',composition:'text',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Просмотр',text}]},'page','text',[],'').section;
 const sources='Чтобы посмотреть сайт на телефоне, нажмите «Предпросмотр» и выберите «Телефон».';
 assert.match(reviewContent(make('Откройте меню устройств.'),'',[],{task:'Объясни, как просмотреть сайт на мобильном экране.',sources}).join(' '),/Предпросмотр.*Телефон/);
 assert.deepEqual(reviewContent(make('Нажмите «Предпросмотр» и выберите «Телефон».'),'',[],{task:'Как просмотреть сайт?',sources}),[]);
 assert.deepEqual(reviewContent(make('Выберите удобный экран.'),'',[],{task:'Расскажи о возможностях',sources}),[]);
});
test('a missing procedural control gets one repair and the draft stays isolated',async()=>{
 const request={kind:'page' as const,scope:'section' as const,count:1,prompt:'Объясни, как просмотреть сайт.',audience:'',sources:'Чтобы посмотреть сайт, нажмите «Предпросмотр» и выберите «Телефон».'};
 const draft=newDraft(request,'original','anchor');draft.outline=[{composition:'text',title:'Просмотр',purpose:'Просмотр сайта'}];draft.sections=[null];
 let calls=0;const provider={status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async()=>{calls++;return {commands:[{tool:'createSection',composition:'text',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Просмотр',text:calls===1?'Выберите экран в меню.':'Нажмите «Предпросмотр» и выберите «Телефон».'}]}}};
 const result=await generateDraft(draft,provider,[],new AbortController().signal,async()=>{},async()=>[]);
 assert.equal(calls,2);assert.equal(result.status.stage,'ready');assert.deepEqual(draft.sections,[null]);
});
test('document narrative roles are applied before outline review and remain editable',async()=>{
 const provider={contentOnly:true,status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async()=>({title:'Проект',sections:[{composition:'table',title:'Пункты',purpose:'F1'},{composition:'text',title:'Пункты',purpose:'F1'}]})};
 const draft=await generateDraft(newDraft({kind:'page',scope:'document',count:2,prompt:'Создай страницу: процесс, следующий шаг.',audience:'',sources:'Автор выбирает композицию и экспортирует HTML.'},'p','a'),provider,[],new AbortController().signal,async()=>{},async()=>[],undefined,{outlineOnly:true});
 assert.equal(draft.awaitingOutline,true);assert.deepEqual(draft.outline.map(s=>s.composition),['steps','hero']);
 assert.equal(draft.outline[0].purpose,'Автор выбирает композицию и экспортирует HTML.');assert.deepEqual(draft.sections,[null,null]);
});
test('source context retains every sentence, including facts beyond the first three',()=>{
 const facts=['Композиции задают структуру.','Композиции допускают замену текста.','Композиции сохраняют изображения.','Композиции можно перестроить.','Композиции доступны в каталоге.','Презентация имеет формат 16:9.','! Обязательно: проверяйте результат.'].join('\n');
 const prompt=contentPrompt('ЗАДАНИЕ: Преимущества готовых композиций\nФАКТЫ ДЛЯ ЭТОЙ СЕКЦИИ:\nselected',facts);
 assert.match(prompt,/доступны в каталоге/);assert.match(prompt,/Обязательно: проверяйте результат/);assert.match(prompt,/16:9/);
});
test('real-provider outline selects a source reference and persists its exact text',async()=>{
 let calls=0;const provider={contentOnly:true,status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async(_system:string,prompt:string,format:any)=>{
  calls++;assert.match(prompt,/Последний обязательный факт/);assert.deepEqual(format.properties.sections.items.properties.purpose.enum,['F1','F2']);
  return {title:'Проект',sections:[{composition:'text',title:'Факт',purpose:'F2'}]};
 }};
 const draft=await generateDraft(newDraft({kind:'page',scope:'document',count:1,prompt:'Создай страницу',audience:'',sources:'Первый факт\nПоследний обязательный факт'},'p','a'),provider,[],new AbortController().signal,async()=>{},async()=>[],undefined,{outlineOnly:true});
 assert.equal(calls,1);assert.equal(draft.outline[0].purpose,'Последний обязательный факт');assert.equal(draft.awaitingOutline,true);
});
test('grounded footer, illustration role and comparison columns have explicit contracts',()=>{
 const materials=[{id:'logo',name:'Logo',description:'',category:'logo',src:'logo.svg'},{id:'art',name:'Art',description:'',category:'decoration',src:'art.svg'}];
 const split=contentFormat('split','page',undefined,materials,'','Иллюстрация') as any;
 assert.deepEqual(split.properties.content.properties.slot1.properties.asset.enum,['art']);
 const logo=contentFormat('split','page',undefined,materials,'','Покажи логотип') as any;
 assert.deepEqual(logo.properties.content.properties.slot1.properties.asset.enum,['logo']);
 const footer=contentFormat('footer','page','Контакты',[],'Alabuga Framework — конструктор сайтов.','Подвал') as any;
 assert.equal(footer.properties.content.properties.slot0.properties.heading.const,'Alabuga Framework');
 const table=contentFormat('table','page',undefined,[],'Сайт и презентация','Таблица сравнения форматов') as any;
 assert.deepEqual(table.properties.content.properties.slot1.properties.columns.const,['Свойство','Сайт','Презентация']);
 const commands={commands:[{tool:'createSection',composition:'table',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Форматы',text:''},{tool:'setTable',slot:1,columns:['Формат','Размер'],rows:[['Слайд','16:9'],['Слайд','16:9']]}]};
 const result=executeCommands(commands,'page','table',[],'16:9');assert.match(reviewContent(result.section).join(' '),/повторяются строки/);
});
test('generation only exposes compatible media and omits metadata for a fixed single choice',async()=>{
 const draft=newDraft({kind:'page',scope:'section',count:1,prompt:'Текст с иллюстрацией',audience:'',sources:''},'p','a');draft.outline=[{composition:'split',title:'Идея',purpose:'Графика'}];draft.sections=[null];
 const provider={contentOnly:true,status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async(system:string,_prompt:string,format:any)=>{
  assert.doesNotMatch(system,/EXCLUDED LOGO|UNNECESSARY NAME/);assert.deepEqual(format.properties.content.properties.slot1.properties.asset.enum,['art']);
  return {composition:'split',content:{slot0:{heading:'Идея',text:'Добавьте свои материалы.'},slot1:{asset:'art',alt:'Графика'}}};
 }};
 const result=await generateDraft(draft,provider,[{id:'logo',name:'EXCLUDED LOGO',description:'',category:'logo',src:'logo.svg'},{id:'art',name:'UNNECESSARY NAME',description:'',category:'decoration',src:'art.svg'}],new AbortController().signal,async()=>{},async()=>[]);
 assert.equal(result.status.stage,'ready');
});
test('unsupported numbers trigger one repair instead of being silently accepted',async()=>{
 let calls=0;const provider={status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async()=>{
  calls++;if(calls===1)return {title:'Слайды',sections:[{composition:'text',title:'Презентация',purpose:'Формат'}]};
  return {commands:[{tool:'createSection',composition:'text',theme:'light',motion:'none'},{tool:'setText',slot:0,heading:'Презентация',text:calls===2?'Презентация включает 16 слайдов.':'Презентация сохраняет формат 16:9.'}]};
 }};
 const draft=await generateDraft(newDraft({kind:'page',scope:'section',count:1,prompt:'Расскажи о слайдах',audience:'',sources:'Презентация сохраняет формат 16:9.'},'p','a'),provider,[],new AbortController().signal,async()=>{},async()=>[]);
 assert.equal(calls,3);assert.equal(draft.status.stage,'ready');
});
test('composition classification follows requested form instead of listed content types',()=>{
 assert.equal(requestedComposition('Покажи три возможности: текст, изображения, таблицы.'),'features');
 assert.equal(requestedComposition('Покажи таблицу сравнения форматов.'),'table');
 assert.equal(requestedComposition('Сделай тезис о редактируемых компонентах.'),'thesis');
 assert.equal(requestedComposition('Создай секцию с текстом и фирменной иллюстрацией.'),'split');
});
test('requested card topics stay in their slots and unknown keys are rejected',()=>{
 const format=contentFormat('features','presentation',undefined,[],'Факты','Три возможности: композиции, элементы, экспорт') as any;
 const fields=format.properties.content.properties.slot1.properties.items;
 assert.deepEqual(fields.required,['item0','item1','item2']);assert.equal(fields.properties.item2.properties.title.const,'экспорт');
 const raw={composition:'features',content:{slot0:{heading:'Возможности',text:''},slot1:{items:{item0:{title:'композиции',text:'Выберите шаблон'},item1:{title:'элементы',text:'Настройте текст'},item2:{title:'экспорт',text:'Сохраните HTML'}}}}};
 const result=executeCommands(contentCommands(raw,'features','presentation','light'),'presentation','features',[],'');
 assert.equal(result.section.widgets[1].type,'cards');
 assert.throws(()=>contentCommands({...raw,content:{...raw.content,slot1:{items:{item0:{},extra:{}}}}},'features','presentation','light'));
});
test('all facts and final delivery requirements survive prompt preparation',()=>{
 const prompt=contentPrompt('ЗАДАНИЕ: Три возможности\nЧИТАТЕЛЬ (не включай название аудитории в текст): Авторы\nФАКТЫ ДЛЯ ЭТОЙ СЕКЦИИ:\nЧасть фактов\nТРЕБОВАНИЯ К ПОДАЧЕ: коротко','Первый факт\nПоследний обязательный факт');
 assert.match(prompt,/Последний обязательный факт/);assert.match(prompt,/ТРЕБОВАНИЯ К ПОДАЧЕ: коротко$/);assert.doesNotMatch(prompt,/Авторы/);
});
test('compact content cannot select tools or add unrecognized slots',()=>{
 const raw={composition:'text',content:{slot0:{heading:'Идея',text:'Своя история'}}};
 assert.equal(executeCommands(contentCommands(raw,'text','page','light'),'page','text',[],'').section.widgets[0].type,'text');
 assert.throws(()=>contentCommands({...raw,content:{slot0:{tool:'eval',heading:'Идея',text:''}}},'text','page','light'));
 assert.throws(()=>contentCommands({...raw,content:{...raw.content,slot1:{heading:'Extra'}}},'text','page','light'));
 const format=contentFormat('hero','page','Идея',[],'Нет ссылок') as any;assert.equal(format.properties.content.properties.slot1.properties.href.const,'');assert.equal(format.properties.content.properties.slot1.properties.label.const,'');
});
test('outline review stops before filling and resumes the amended outline',async()=>{
 const draft=newDraft({kind:'page',scope:'document',count:1,prompt:'Создай страницу',audience:'Авторы',sources:''},'p','a');let calls=0;
 const provider={status:async()=>({model:'test',version:'test',digest:'test',context:4096}),generate:async()=>{calls++;return calls===1?{title:'История',sections:[{composition:'text',title:'Идея',purpose:'Введение'}]}:fixtureCommands('text')}};
 const planned=await generateDraft(draft,provider,[],new AbortController().signal,async()=>{},async()=>[],undefined,{outlineOnly:true});assert.equal(calls,1);assert.equal(planned.awaitingOutline,true);assert.deepEqual(planned.sections,[null]);planned.outline[0].title='Новая идея';
 const completed=await generateDraft(planned,provider,[],new AbortController().signal,async()=>{},async()=>[]);assert.equal(calls,2);assert.equal(completed.status.stage,'ready');assert.equal(completed.outline[0].title,'Новая идея');assert.equal(completed.awaitingOutline,undefined);
});
