import {elementDesign} from './element-design';
import {layoutChooser} from './layout-chooser';
import {motionScenarios} from './scenarios';
import {compositionChooser} from './variants';
import {settingsGroup,el,button} from './ui';
import {inputField,textareaField,selectField as select} from './ui-fields';
import {widgetRegistry,type AFDocument,type Widget,type Section} from '@alabuga/framework/schema';
import {makeComposition,changeComposition,compositionCatalog} from '@alabuga/framework/compositions';
import {chooseAsset,cropControl} from './assets';
import {readImage} from './export';
type Change=()=>void;
function input(host:HTMLElement,label:string,value:string,update:(v:string)=>void,multi=false){return multi?textareaField(host,label,value,update):inputField(host,label,value,update)}
function upload(host:HTMLElement,label:string,update:(src:string)=>void,error:(s:string)=>void){host.append(button('Выбрать из библиотеки',()=>void chooseAsset(update),'af-btn af-btn--secondary af-btn--sm'));const i=inputField(host,label,'',()=>{},'file');i.accept='image/png,image/jpeg,image/webp,image/gif';i.addEventListener('change',async()=>{try{if(i.files?.[0])update(await readImage(i.files[0]))}catch(e){error((e as Error).message)}});}
export function widgetDesign(host:HTMLElement,w:Widget,doc:AFDocument,changed:Change,error:(s:string)=>void,refresh:Change=changed){
 const update=(fn:()=>void)=>{fn();changed()};
 elementDesign(host,w,doc,changed,refresh);
 select(host,'Поверхность',w.surface??'card',{plain:'Без рамки',card:'Карточка'},v=>update(()=>w.surface=v as 'plain'|'card'));
 for(const [key,title]of [['tabletOrder','Порядок на планшете'],['mobileOrder','Порядок на телефоне']] as const){const i=input(host,title,String(w[key]??0),v=>update(()=>w[key]=Number(v))) as HTMLInputElement;i.type='number';i.min='0';i.max='100'}
 const motionDetails=el('details','settings-disclosure');motionDetails.dataset.propertyGroup='behavior';motionDetails.append(el('summary','af-btn af-btn--clear af-btn--sm','Дополнительно: движение'));const motionHost=el('div','af-stack');motionDetails.append(motionHost);host.append(motionDetails);
 const motion=w.motion??{effect:'none',speed:'normal',intensity:'subtle',step:0};
 select(motionHost,'Эффект',motion.effect,{none:'Без эффекта',fade:'Появление',rise:'Мягкий сдвиг',scale:'Масштаб',sequence:'Последовательность'},v=>update(()=>{motion.effect=v as typeof motion.effect;w.motion=motion}));
 select(motionHost,'Темп',motion.speed,{fast:'Быстрый',normal:'Обычный',slow:'Спокойный'},v=>update(()=>{motion.speed=v as typeof motion.speed;w.motion=motion}));
 select(motionHost,'Интенсивность',motion.intensity,{subtle:'Сдержанная',expressive:'Выразительная'},v=>update(()=>{motion.intensity=v as typeof motion.intensity;w.motion=motion}));
 if(doc.kind==='presentation'){const i=input(motionHost,'Шаг появления',String(motion.step),v=>update(()=>{motion.step=Number(v);w.motion=motion})) as HTMLInputElement;i.type='number';i.min='0';i.max='20';motionHost.append(el('p','af-help','0 — сразу; одинаковый номер — показ вместе по команде «Далее».'))}
 if(w.type==='image'){
  host.append(button('Выбрать изображение',()=>void chooseAsset(src=>{w.src=src;refresh()}),'af-btn af-btn--secondary'));
  const crops=el('div');host.append(crops);
  const points={center:{x:50,y:50},top:{x:50,y:0},bottom:{x:50,y:100},left:{x:0,y:50},right:{x:100,y:50}};
  const drawCrops=()=>{crops.replaceChildren();const image=document.querySelector<HTMLImageElement>(`#canvas [data-widget-id="${w.id}"] img,.ai-preview [data-widget-id="${w.id}"] img`),rect=image?.getBoundingClientRect(),ratio=rect?.height?rect.width/rect.height:4/3;
   cropControl(crops,w.src,w.focalPoint??points[w.focal??'center'],p=>update(()=>w.focalPoint=p),'Кадр на компьютере',{fit:w.fit,aspectRatio:ratio});
   if(doc.kind==='page')cropControl(crops,w.src,w.mobileFocalPoint??w.focalPoint??points[w.focal??'center'],p=>update(()=>w.mobileFocalPoint=p),'Кадр на телефоне',{fit:w.fit,aspectRatio:4/3});
   else crops.append(el('p','af-help','У презентации один кадр на всех экранах: слайд масштабируется целиком.'));
  };drawCrops();
  select(host,'Точка кадрирования',w.focal??'center',{center:'Центр',top:'Верх',bottom:'Низ',left:'Слева',right:'Справа'},v=>{w.focal=v as typeof w.focal;delete w.focalPoint;changed();drawCrops()});
 }
 if(w.type==='table')select(host,'Оформление таблицы',w.variant??'legacy',{legacy:'Исходная',corporate:'Фирменная',striped:'Полосы',minimal:'Минимальная'},v=>update(()=>w.variant=v==='legacy'?undefined:v as typeof w.variant));
 if(w.type==='quote'){input(host,'Цитата',w.text,v=>update(()=>w.text=v),true);input(host,'Автор',w.author,v=>update(()=>w.author=v))}
 if(w.type==='button'){
  input(host,'Текст кнопки',w.label,v=>update(()=>w.label=v));select(host,'Вариант кнопки',w.variant,{primary:'Основная',secondary:'Вторичная'},v=>update(()=>w.variant=v as typeof w.variant));
  const targets=el('div');
  const draw=()=>{targets.replaceChildren();const a=w.action;if(a.type==='link')input(targets,'Адрес действия',a.href,v=>update(()=>a.href=v));else if('target'in a){const options=Object.fromEntries((a.type==='modal'?doc.modals??[]:doc.pages).map((p,i)=>[p.id,p.title||`Секция ${i+1}`]));select(targets,'Цель действия',a.target,options,v=>update(()=>a.target=v));}};
  select(host,'Действие',w.action.type,{link:'Открыть ссылку',[doc.kind==='page'?'section':'slide']:doc.kind==='page'?'К секции':'К слайду',modal:'Открыть окно'},v=>{if(v==='link')w.action={type:'link',href:'https://example.com'};else{const target=v==='modal'?doc.modals?.[0]?.id:doc.pages[0].id;if(!target){error('Сначала создайте окно в настройках секции.');return}w.action={type:v as 'modal'|'section'|'slide',target}}draw();changed()});(host.lastElementChild as HTMLElement).dataset.propertyGroup='behavior';targets.dataset.propertyGroup='behavior';host.append(targets);draw();
 }
 if(w.type==='cards'||w.type==='gallery'){
  const list=el('div');list.dataset.propertyGroup='content';host.append(list);const draw=()=>{list.replaceChildren();w.items.forEach((item,i)=>{const group=el('fieldset','block-editor');group.append(el('legend','',`Элемент ${i+1}`));if('title'in item){input(group,'Заголовок карточки',item.title,v=>update(()=>item.title=v));input(group,'Текст карточки',item.text,v=>update(()=>item.text=v),true)}else{input(group,'Адрес изображения галереи',item.src.startsWith('data:')?'':item.src,v=>update(()=>item.src=v));upload(group,'Загрузить в галерею',src=>update(()=>item.src=src),error);input(group,'Описание изображения галереи',item.alt,v=>update(()=>item.alt=v));input(group,'Подпись галереи',item.caption,v=>update(()=>item.caption=v))}const remove=button('Удалить элемент',()=>{w.items.splice(i,1);draw();changed()},'af-btn af-btn--ghost af-btn--sm');remove.disabled=w.items.length===1;group.append(remove);list.append(group)});const add=button('Добавить элемент',()=>{if(w.type==='cards')w.items.push({title:'Новый аргумент',text:'Описание'});else w.items.push({src:'../assets/brand-landscape.svg',alt:'Изображение',caption:''});draw();changed()},'af-btn af-btn--ghost af-btn--sm');add.disabled=w.items.length>=6;list.append(add)};draw();
 }
}

type SlideTools={editWidget:(id:string)=>void;addTemplate:()=>void;preview:()=>void;fit?:()=>void;fitAll?:()=>void};
export function sectionDesign(host:HTMLElement,doc:AFDocument,index:number,commit:(edit:(d:AFDocument)=>void)=>boolean,tools?:SlideTools){
 if(doc.kind==='presentation'&&tools){slideDesign(host,doc,index,commit,tools);return;}
 host.replaceChildren();const page=doc.pages[index];layoutChooser(host,page,doc.kind,next=>commit(d=>d.pages[index]=next));compositionChooser(host,page,doc.kind,name=>commit(d=>d.pages[index]=changeComposition(d.pages[index],name,d.kind)));motionScenarios(host,doc,index,commit);host.append(el('h3','','Оформление секции'));
 const appearance=structuredClone(page.appearance??makeComposition('blank',doc.kind).appearance!);
 const apply=()=>commit(d=>d.pages[index].appearance=structuredClone(appearance));if(appearance.background){cropControl(host,appearance.background,appearance.focalPoint,p=>{appearance.focalPoint=p;apply()},'Кадр фона');cropControl(host,appearance.background,appearance.mobileFocalPoint,p=>{appearance.mobileFocalPoint=p;apply()},'Кадр фона на телефоне')}
 select(host,'Фирменная тема',page.appearance?.theme??'light',{light:'Светлая',contrast:'Контрастная',accent:'Акцентная',image:'С изображением'},v=>{appearance.theme=v as typeof appearance.theme;if(appearance.backgroundPlacement)appearance.backgroundPlacement=v==='image'?'full':'none';apply()});
 select(host,'Высота секции',page.appearance?.layout??'fixed',{flow:'По содержимому',fixed:'Фиксированная сетка'},v=>{appearance.layout=v as typeof appearance.layout;apply()});
 select(host,'Воздух',appearance.spacing,{compact:'Компактно',normal:'Обычно',generous:'Просторно'},v=>{appearance.spacing=v as typeof appearance.spacing;apply()});
 select(host,'Ширина содержимого',appearance.width,{wide:'Широкая',narrow:'Узкая'},v=>{appearance.width=v as typeof appearance.width;apply()});
 select(host,'Декор',appearance.decoration,{none:'Нет',orbit:'Окружность',lines:'Линии'},v=>{appearance.decoration=v as typeof appearance.decoration;apply()});
 const bg=input(host,'Фоновое изображение',appearance.background?.startsWith('data:')?'':appearance.background??'',v=>{appearance.background=v||undefined});bg.addEventListener('change',apply);
 upload(host,'Загрузить фон',src=>{appearance.background=src;delete appearance.backgroundId;appearance.backgroundPlacement='full';appearance.theme='image';apply()},s=>{const error=el('p','af-error',s);host.append(error)});
 select(host,'Кадрирование фона',appearance.focal,{center:'Центр',top:'Верх',bottom:'Низ',left:'Слева',right:'Справа'},v=>{appearance.focal=v as typeof appearance.focal;apply()});
 select(host,'Затемнение',appearance.shade,{medium:'Среднее',strong:'Сильное'},v=>{appearance.shade=v as typeof appearance.shade;apply()});
 select(host,'Композиция',page.composition??'blank',Object.fromEntries(compositionCatalog(doc.kind).map(([id,title])=>[id,title])),v=>commit(d=>{d.pages[index]=changeComposition(d.pages[index],v,d.kind)}));
 if(doc.kind==='presentation')select(host,'Переход слайда',page.transition??'none',{none:'Без эффекта',fade:'Растворение',slide:'Сдвиг'},v=>commit(d=>d.pages[index].transition=v as Section['transition']));
 modalSettings(host,doc,commit);
 const groups=new Map<string,ReturnType<typeof settingsGroup>>();for(const title of ['Структура','Оформление','Поведение']){const entry=settingsGroup(title,'section-property-group');entry.group.open=true;groups.set(title,entry)}
 let modals=false;for(const child of Array.from(host.children)){const text=child.textContent??'';if(text==='Оформление секции'){child.remove();continue}if(text==='Модальные окна проекта')modals=true;const target=modals||child.classList.contains('motion-scenarios')?'Поведение':/^(Выбрать композицию|Композиция|Высота секции|Воздух|Ширина содержимого)/.test(text)?'Структура':'Оформление';groups.get(target)!.body.append(child)}host.append(...[...groups.values()].map(entry=>entry.group));
}
function modalSettings(host:HTMLElement,doc:AFDocument,commit:(edit:(d:AFDocument)=>void)=>boolean){
 host.append(el('h3','','Модальные окна проекта'));
 for(const modal of doc.modals??[]){const title=input(host,'Название окна',modal.title,()=>{}),text=input(host,'Текст окна',modal.text,()=>{},true);const save=()=>commit(d=>{const m=d.modals!.find(m=>m.id===modal.id)!;m.title=title.value;m.text=text.value});title.addEventListener('change',save);text.addEventListener('change',save);host.append(button('Удалить окно',()=>commit(d=>{d.modals=d.modals?.filter(m=>m.id!==modal.id)}),'af-btn af-btn--ghost af-btn--sm'))}
 host.append(button('Добавить окно',()=>commit(d=>{(d.modals??=[]).push({id:'modal-'+crypto.randomUUID(),title:'Новое окно',text:'Добавьте содержание.'})}),'af-btn af-btn--ghost af-btn--sm'));
}

function slideDesign(host:HTMLElement,doc:AFDocument,index:number,commit:(edit:(d:AFDocument)=>void)=>boolean,tools:SlideTools){
 const page=doc.pages[index],active=host.dataset.slideTab??'structure';host.replaceChildren();
 host.append(el('h2','af-title inspector-heading',`Слайд ${index+1}`),el('p','af-help','Формат 16:9. Изменения применяются к текущему слайду.'));
 const nav=el('div','slide-settings-tabs');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Настройки слайда');host.append(nav);
 const tabs=new Map<string,HTMLButtonElement>(),panels=new Map<string,HTMLElement>();
 const activate=(id:string)=>{host.dataset.slideTab=id;tabs.forEach((b,key)=>{b.setAttribute('aria-selected',String(key===id));b.classList.toggle('af-btn--ghost',key!==id);b.tabIndex=key===id?0:-1});panels.forEach((p,key)=>p.hidden=key!==id)};
 for(const [id,title]of [['structure','Структура'],['background','Оформление'],['behavior','Поведение']]){const tab=button(title,()=>activate(id),'slide-settings-tab');tab.id='slide-tab-'+id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','slide-panel-'+id);nav.append(tab);tabs.set(id,tab);const panel=el('div','slide-settings-panel');panel.id='slide-panel-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);host.append(panel);panels.set(id,panel);tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const keys=[...tabs.keys()],current=keys.indexOf(id),next=e.key==='Home'?0:e.key==='End'?keys.length-1:(current+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length;activate(keys[next]);tabs.get(keys[next])!.focus()})}
 activate(active);
 const structure=panels.get('structure')!,background=panels.get('background')!,behavior=panels.get('behavior')!;
 if(tools.fit)structure.append(button('Подобрать оформление',tools.fit));if(tools.fitAll)structure.append(button('Оформить презентацию',tools.fitAll));if(tools.fit)background.append(button('Подобрать фон и размещение',tools.fit));
 layoutChooser(structure,page,doc.kind,next=>commit(d=>d.pages[index]=next));
 compositionChooser(structure,page,doc.kind,name=>commit(d=>d.pages[index]=changeComposition(d.pages[index],name,d.kind)));
 const title=input(structure,'Заголовок слайда',page.title,()=>{});title.addEventListener('change',()=>commit(d=>d.pages[index].title=title.value));
 select(structure,'Шаблон слайда',page.composition??'blank',Object.fromEntries(compositionCatalog('presentation').map(([id,name])=>[id,name])),v=>commit(d=>d.pages[index]=changeComposition(d.pages[index],v,d.kind)));
 structure.append(el('p','af-help','Смена шаблона сохраняет содержимое и доступна для совместимой структуры. Для другой структуры добавьте новый слайд.'),button('Добавить слайд по шаблону',tools.addTemplate,'af-btn af-btn--secondary af-btn--sm'));
 const grid=el('details','slide-grid settings-disclosure');grid.append(el('summary','af-btn af-btn--clear af-btn--sm','Сетка и размеры'));const form=el('form','af-stack');form.dataset.gridDraft='true';form.addEventListener('input',()=>form.dataset.dirty='true');const draft={...page.grid};for(const [key,label,min,max]of [['columns','Колонки',1,24],['rowHeight','Строка, px',32,160],['gap','Отступ, px',0,48]] as const){const field=input(form,label,String(draft[key]),v=>draft[key]=Number(v)) as HTMLInputElement;field.type='number';field.min=String(min);field.max=String(max);field.required=true}const save=el('button','af-btn af-btn--ghost af-btn--sm','Применить сетку');save.type='submit';form.append(save);form.addEventListener('submit',e=>{e.preventDefault();form.dataset.applied=String(commit(d=>d.pages[index].grid=draft))});grid.append(form);structure.append(grid,el('h3','','Элементы слайда'));
 if(!page.widgets.length)structure.append(el('p','af-help','Слайд пока пуст. Выберите шаблон или добавьте блок.'));
 page.widgets.forEach((w,i)=>{const row=el('div','slide-element');row.append(button(`${i+1}. ${w.title||widgetRegistry[w.type].title}`,()=>tools.editWidget(w.id),'af-btn af-btn--ghost af-btn--sm'),el('span','af-help',`${w.position.width}×${w.position.height} · колонка ${w.position.col}, строка ${w.position.row}`));structure.append(row)});
 const appearance=structuredClone(page.appearance??makeComposition('blank','presentation').appearance!);appearance.layout='fixed';const apply=()=>commit(d=>d.pages[index].appearance=structuredClone(appearance));
 if(appearance.background)cropControl(background,appearance.background,appearance.focalPoint,p=>{appearance.focalPoint=p;apply()},'Кадр фона');
 select(background,'Фон слайда',appearance.theme,{light:'Светлый',contrast:'Тёмный фирменный',accent:'Синий фирменный',image:'Изображение'},v=>{appearance.theme=v as typeof appearance.theme;if(appearance.backgroundPlacement)appearance.backgroundPlacement=v==='image'?'full':'none';apply()});
 select(background,'Декор',appearance.decoration,{none:'Нет',orbit:'Окружность',lines:'Линии'},v=>{appearance.decoration=v as typeof appearance.decoration;apply()});
 const bg=input(background,'Фоновое изображение',appearance.background?.startsWith('data:')?'':appearance.background??'',()=>{});bg.addEventListener('change',()=>{appearance.background=bg.value||undefined;delete appearance.backgroundId;appearance.backgroundPlacement=bg.value?'full':'none';if(bg.value)appearance.theme='image';apply()});
 upload(background,'Загрузить фон',src=>{appearance.background=src;delete appearance.backgroundId;appearance.backgroundPlacement='full';appearance.theme='image';apply()},s=>background.append(el('p','af-error',s)));
 if(appearance.background){background.append(el('p','af-help',appearance.background.startsWith('data:')?'Изображение встроено в проект.':'Изображение задано ссылкой.'),button('Убрать изображение',()=>{delete appearance.background;delete appearance.backgroundId;appearance.backgroundPlacement='none';appearance.theme='light';apply()},'af-btn af-btn--ghost af-btn--sm'))}
 select(background,'Кадрирование фона',appearance.focal,{center:'Центр',top:'Верх',bottom:'Низ',left:'Слева',right:'Справа'},v=>{appearance.focal=v as typeof appearance.focal;apply()});
 select(background,'Затемнение',appearance.shade,{medium:'Среднее',strong:'Сильное'},v=>{appearance.shade=v as typeof appearance.shade;apply()});
 motionScenarios(behavior,doc,index,commit);
 select(behavior,'Переход слайда',page.transition??'none',{none:'Без эффекта',fade:'Растворение',slide:'Сдвиг'},v=>commit(d=>d.pages[index].transition=v as Section['transition']));
 select(behavior,'Показ элементов',page.widgets.some(w=>w.motion?.step)?'steps':'all',{all:'Все сразу',steps:'По шагам'},v=>commit(d=>d.pages[index].widgets.forEach((w,i)=>{w.motion={effect:w.motion?.effect??'fade',speed:w.motion?.speed??'normal',intensity:w.motion?.intensity??'subtle',step:v==='all'?0:i}})));
 behavior.append(el('p','af-help','«Далее» раскрывает следующий шаг, затем переключает слайд. «Назад» возвращает предыдущий шаг. Автоматического перелистывания нет.'));
 const advanced=el('details','settings-disclosure');advanced.append(el('summary','af-btn af-btn--clear af-btn--sm','Дополнительно: шаги и эффекты'));behavior.append(advanced);
 page.widgets.forEach((w,i)=>{const group=el('fieldset','block-editor');group.append(el('legend','',`${i+1}. ${w.title||widgetRegistry[w.type].title}`));const motion=w.motion??{effect:'none' as const,speed:'normal' as const,intensity:'subtle' as const,step:0};const step=input(group,'Шаг: '+(w.title||widgetRegistry[w.type].title),String(motion.step),()=>{}) as HTMLInputElement;step.type='number';step.min='0';step.max='20';step.required=true;step.addEventListener('change',()=>{if(step.reportValidity())commit(d=>{d.pages[index].widgets[i].motion={...motion,step:Number(step.value)}})});select(group,'Эффект: '+(w.title||widgetRegistry[w.type].title),motion.effect,{none:'Нет',fade:'Появление',rise:'Сдвиг',scale:'Масштаб',sequence:'Последовательность'},v=>commit(d=>{d.pages[index].widgets[i].motion={...motion,effect:v as NonNullable<Widget['motion']>['effect']}}));advanced.append(group)});
 behavior.append(el('p','af-help','Шаг 0 — сразу. Одинаковый номер — показ вместе. При печати видны все элементы.'),button('Посмотреть этот слайд',tools.preview,'af-btn'));
 const modals=el('details','settings-disclosure');modals.append(el('summary','af-btn af-btn--clear af-btn--sm','Окна презентации'));modalSettings(modals,doc,commit);behavior.append(modals);
}
