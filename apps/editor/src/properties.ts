import {mountControls,disposeControls} from './component-lifecycle';
import {frameworkDom as dom} from './framework-adapter';
import {el,button,settingsGroup} from './ui';
import {inputField as field,textareaField as area,selectField as select,checkboxField as check} from './ui-fields';
import {widgetRegistry,type Widget,type TextBlock} from '@alabuga/framework/schema';
import {readImage} from './export';
import {widgetDesign} from './design';
import {mergePropertyDraft} from './property-patch';
import {type WidgetLayout,layoutNote} from './widget-layout';
import type {AFDocument} from '@alabuga/framework/schema';
type Callbacks={apply:(widget:Widget)=>boolean;current?:()=>Widget;layout?:()=>WidgetLayout;remove:()=>void;duplicate:()=>void;error:(message:string)=>void;errorMessage?:()=>string;pending:()=>void;settled:(valid:boolean)=>void;columns:number;document:AFDocument};
export function properties(host:HTMLElement,original:Widget,actions:Callbacks):()=>boolean {
  const draft=structuredClone(original);let saved=JSON.stringify(draft),tablePage=0;
  const form=el('form','property-form');disposeControls(host);host.replaceChildren(form);const opened=new Map<string,boolean>();
  const feedback=el('p','property-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const result=(text:string,error=false)=>{feedback.textContent=text;feedback.classList.toggle('af-error',error)};
  let timer:ReturnType<typeof setTimeout>;
  form.noValidate=true;
  const apply=(report=true)=>{clearTimeout(timer);if(!form.checkValidity()){const invalid=form.querySelector<HTMLInputElement>('input:invalid,textarea:invalid,select:invalid'),text=(invalid?.closest('label')?.querySelector(dom.label)?.textContent??'Поле')+': '+(invalid?.validationMessage??'Проверьте значение.');result(text,true);if(invalid){invalid.setAttribute('aria-invalid','true');let hint=invalid.parentElement?.querySelector<HTMLElement>('.field-error');if(!hint){hint=el('small','field-error af-error');hint.id='error-'+crypto.randomUUID();invalid.after(hint)}hint.textContent=invalid.validationMessage;invalid.setAttribute('aria-describedby',hint.id)}actions.error(text);actions.settled(false);if(report)form.reportValidity();return false;}if(JSON.stringify(draft)===saved){result('Все изменения уже применены.');actions.settled(true);return true;}try{if(!actions.apply(mergePropertyDraft(JSON.parse(saved),draft,actions.current?.()??draft))){result(actions.errorMessage?.()||'Изменения не применены. Проверьте положение и размеры блока.',true);actions.settled(false);return false;}saved=JSON.stringify(draft);result('Изменения применены. Состояние записи — в верхней панели.');actions.settled(true);return true;}catch(e){result((e as Error).message,true);actions.error((e as Error).message);actions.settled(false);return false;}};
  const schedule=()=>{for(const n of form.querySelectorAll<HTMLInputElement>('[aria-invalid=true]'))if(n.validity.valid){n.removeAttribute('aria-invalid');n.parentElement?.querySelector('.field-error')?.remove();n.removeAttribute('aria-describedby')}clearTimeout(timer);if(JSON.stringify(draft)===saved&&form.checkValidity()){if(feedback.classList.contains('af-error'))result('Все изменения уже применены.');actions.settled(true);return;}actions.pending();timer=setTimeout(()=>{if(form.isConnected)apply(false)},220)};
  form.addEventListener('submit',e=>{e.preventDefault();apply()});
  form.addEventListener('input',()=>{const slider=form.querySelector<HTMLInputElement>('[data-horizontal-position]');if(slider){slider.max=String(Math.max(1,actions.columns-draft.position.width+1));slider.value=String(draft.position.col)}schedule()});
  form.addEventListener('change',schedule);
  const small=(title:string,action:()=>void)=>button(title,action,'af-btn af-btn--ghost af-btn--sm');
  const draw=()=>{
    if(JSON.stringify(draft)!==saved)schedule();
    disposeControls(form);form.replaceChildren();form.append(el('h2','af-title inspector-heading',widgetRegistry[draft.type].title),el('p','af-help','Изменения сразу отображаются на странице.'));
    field(form,'Название блока',draft.title,v=>draft.title=v).maxLength=200;
    const mode=actions.layout?.()??'grid',geometry=el('fieldset','geometry');geometry.append(el('legend','',mode==='grid'?'Положение и размер':'Базовая сетка для компьютера'));
    if(mode!=='grid'){const note=el('p','af-help',layoutNote(mode)+' Поля ниже задают базовую сетку для компьютера.');note.style.gridColumn='1 / -1';geometry.append(note)}
    for(const [key,name]of [['col','Колонка'],['row','Строка'],['width','Ширина'],['height','Высота']] as const){const input=field(geometry,name,draft.position[key],v=>draft.position[key]=Number(v),'number');input.min=String(key==='width'?widgetRegistry[draft.type].minWidth:key==='height'?widgetRegistry[draft.type].minHeight:1);input.step='1';input.required=true}
    form.append(geometry);
    const placement=el('fieldset','block-editor');placement.append(el('legend','','Размещение по ширине'));
    const maximum=()=>Math.max(1,actions.columns-draft.position.width+1);
    const slider=field(placement,'Смещение блока по горизонтали',draft.position.col,v=>{draft.position.col=Number(v);const col=form.querySelector<HTMLInputElement>('.geometry input');if(col)col.value=v},'number');slider.dataset.horizontalPosition='';slider.min='1';slider.max=String(maximum());slider.step='1';
    const presets=el('div','af-row');for(const label of ['Слева','По центру','Справа'])presets.append(small(label,()=>{draft.position.col=label==='Слева'?1:label==='Справа'?maximum():Math.floor((maximum()+1)/2);draw()}));placement.append(presets,el('p','af-help','Сдвигается сам блок внутри секции. Для точной позиции задайте колонку или перетащите блок за ручку ↕.'));form.append(placement);
    select(form,'Выравнивание содержимого',draft.align??'left',{left:'По левому краю',center:'По центру',right:'По правому краю'},v=>draft.align=v as 'left'|'center'|'right');
    if(draft.type==='text'){
      draft.content.forEach((block,index)=>{
        const box=el('fieldset','block-editor');box.append(el('legend','',`${index+1}. ${{paragraph:'Абзац',heading:'Заголовок',list:'Список',divider:'Разделитель',callout:'Акцент',link:'Ссылка'}[block.type]}`));
        if('text'in block)area(box,'Текст',block.text,v=>block.text=v);
        if(block.type==='paragraph')check(box,'Буквица',block.dropCap,v=>block.dropCap=v);
        if(block.type==='list'){area(box,'Пункты — каждый с новой строки',block.items.join('\n'),v=>block.items=v.split('\n'));check(box,'Нумерованный список',block.ordered,v=>block.ordered=v)}
        if(block.type==='divider')check(box,'Декоративный разделитель',block.decorative,v=>block.decorative=v);
        if(block.type==='callout')select(box,'Тип акцента',block.tone,{info:'Информация',success:'Успех',warning:'Внимание',danger:'Ошибка'},v=>block.tone=v as typeof block.tone);
        if(block.type==='link'){field(box,'Адрес ссылки',block.href,v=>block.href=v);if(actions.document.kind==='page')select(box,'Переход к секции',block.href.startsWith('#')?block.href.slice(1):'',{'':'Внешняя ссылка',...Object.fromEntries(actions.document.pages.map((p,i)=>[p.id,p.title||`Секция ${i+1}`]))},v=>{if(v){block.href='#'+v;draw()}})}
        const controls=el('div','af-row');const up=small('↑',()=>{[draft.content[index-1],draft.content[index]]=[block,draft.content[index-1]];draw()});up.disabled=index===0;up.setAttribute('aria-label','Поднять фрагмент');const down=small('↓',()=>{[draft.content[index+1],draft.content[index]]=[block,draft.content[index+1]];draw()});down.disabled=index===draft.content.length-1;down.setAttribute('aria-label','Опустить фрагмент');controls.append(up,down,small('Удалить фрагмент',()=>{draft.content.splice(index,1);draw()}));box.append(controls);form.append(box);
      });
      let kind='paragraph';select(form,'Новый фрагмент',kind,{paragraph:'Абзац',heading:'Заголовок',list:'Список',divider:'Разделитель',callout:'Акцент',link:'Ссылка'},v=>kind=v);
      form.append(small('Добавить фрагмент',()=>{const blocks:Record<string,TextBlock>={paragraph:{type:'paragraph',text:'Новый абзац',dropCap:false},heading:{type:'heading',text:'Заголовок'},list:{type:'list',items:['Первый пункт'],ordered:false},divider:{type:'divider',decorative:false},callout:{type:'callout',text:'Важная мысль',tone:'info'},link:{type:'link',text:'Подробнее',href:'https://example.com'}};draft.content.push(blocks[kind]);draw()}));
    }
    if(draft.type==='metric'){field(form,'Значение',draft.value,v=>draft.value=v).maxLength=30;field(form,'Подпись',draft.note,v=>draft.note=v).maxLength=100}
    if(draft.type==='calendar'){const date=field(form,'Выбранная дата',draft.date,v=>draft.date=v,'date');date.required=true;date.classList.add('af-datepicker')}
    if(draft.type==='image'){
      if(draft.src.startsWith('data:')){form.append(el('p','af-help','Изображение встроено в проект.'),small('Использовать ссылку',()=>{draft.src='';draw()}))}else field(form,'Адрес изображения',draft.src,v=>draft.src=v);
      const upload=field(form,'Загрузить изображение','',()=>{},'file');upload.accept='image/png,image/jpeg,image/webp,image/gif';upload.addEventListener('change',async()=>{try{const file=upload.files?.[0];if(file){const result=await readImage(file);if(!form.isConnected)return;draft.src=result;if(!draft.alt)draft.alt=file.name;draw()}}catch(e){actions.error((e as Error).message)}});
      form.append(el('p','af-help','PNG, JPEG, WebP или GIF · до 2 МБ. Загруженные файлы сохраняются внутри проекта.'));
      field(form,'Описание изображения',draft.alt,v=>draft.alt=v).required=true;
      field(form,'Подпись',draft.caption,v=>draft.caption=v);
      select(form,'Размещение',draft.fit,{cover:'Заполнить блок',contain:'Показать целиком'},v=>{draft.fit=v as 'cover'|'contain';draw()});
    }
    if(draft.type==='table'){
      check(form,'Переносить текст в ячейках',draft.wrap??false,v=>draft.wrap=v);
      const columns=el('fieldset','block-editor');columns.append(el('legend','','Колонки'));
      draft.columns.forEach((col,i)=>{field(columns,`Колонка ${i+1}`,col.label,v=>col.label=v);const remove=small(`Удалить колонку ${i+1}`,()=>{draft.columns.splice(i,1);draft.rows.forEach(r=>delete r[col.key]);draw()});remove.disabled=draft.columns.length===1;columns.append(remove)});
      columns.append(small('Добавить колонку',()=>{if(draft.columns.length>=30)return actions.error('Максимум 30 колонок.');const key='c'+crypto.randomUUID();draft.columns.push({key,label:'Новая колонка'});draw()}));form.append(columns);
      tablePage=Math.max(0,Math.min(tablePage,Math.ceil(draft.rows.length/10)-1));
      const rows=el('div','table-editor');
      draft.rows.slice(tablePage*10,tablePage*10+10).forEach((row,j)=>{const i=tablePage*10+j,group=el('fieldset','block-editor');group.append(el('legend','',`Строка ${i+1}`));draft.columns.forEach(col=>field(group,col.label,String(row[col.key]??''),v=>row[col.key]=v));group.append(small('Удалить строку',()=>{draft.rows.splice(i,1);draw()}));rows.append(group)});form.append(rows);
      const pager=el('div','af-row'),prev=small('← Строки',()=>{tablePage--;draw()}),next=small('Строки →',()=>{tablePage++;draw()});prev.disabled=tablePage===0;next.disabled=(tablePage+1)*10>=draft.rows.length;pager.append(prev,el('span','af-caption',`${tablePage+1} / ${Math.max(1,Math.ceil(draft.rows.length/10))}`),next);form.append(pager,small('Добавить строку',()=>{if(draft.rows.length>=5000)return actions.error('Максимум 5000 строк.');draft.rows.push(Object.fromEntries(draft.columns.map(c=>[c.key,''])));tablePage=Math.floor((draft.rows.length-1)/10);draw()}));
      const size=field(form,'Записей на странице',draft.pageSize,v=>draft.pageSize=Number(v),'number');size.min='1';size.max='100';size.required=true;
    }
    const beforeDesign=new Set(form.children);
    widgetDesign(form,draft,actions.document,schedule,actions.error,draw);
    for(const node of Array.from(form.children))if(!beforeDesign.has(node)&&!node.hasAttribute('data-property-group'))(node as HTMLElement).dataset.propertyGroup='style';
    const groups=new Map<string,ReturnType<typeof settingsGroup>>();
    const labels={content:'Содержание',style:'Оформление',behavior:'Поведение',geometry:'Размеры и положение'};
    for(const key of ['content','style','behavior','geometry'] as const){const entry=settingsGroup(labels[key],'property-group');entry.group.open=opened.get(key)??key!=='geometry';entry.group.addEventListener('toggle',()=>opened.set(key,entry.group.open));groups.set(key,entry)}
    for(const node of Array.from(form.children).slice(2)){const key=(node as HTMLElement).dataset.propertyGroup??(node===geometry||node===placement?'geometry':'content');groups.get(key)!.body.append(node)}
    for(const {group,body} of groups.values())if(body.children.length)form.append(group);
    form.append(small('Сбросить неприменённые изменения',()=>{clearTimeout(timer);for(const key of Object.keys(draft))Reflect.deleteProperty(draft,key);Object.assign(draft,JSON.parse(saved));draw();actions.settled(true)}));
    const footer=el('div','property-actions');footer.append(feedback,small('Дублировать',()=>{if(apply())actions.duplicate()}),small('Удалить блок',actions.remove));form.append(footer);mountControls(form);
  };
  draw();return ()=>apply();
}
