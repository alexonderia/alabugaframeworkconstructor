import {el,button} from './ui';
import {selectField} from './ui-fields';
import type {AFDocument,Widget,SlideTypography} from '@alabuga/framework/schema';
import {slideTypeDefaults} from '@alabuga/framework/element-style';
export function elementDesign(host:HTMLElement,w:Widget,doc:AFDocument,changed:()=>void,refresh:()=>void){
 const group=el('fieldset','block-editor');group.append(el('legend','','Фирменное оформление элемента'));host.append(group);
 const select=(label:string,value:string,options:Record<string,string>,set:(v:string)=>void)=>selectField(group,label,value,options,v=>{set(v);w.style={...w.style,locked:true};changed()});
 if(doc.kind==='presentation'){
  const roles:Record<keyof SlideTypography,[string,number[]]>={heading:['Размер заголовка',[64,80,96,112]],body:['Размер основного текста',[32,36,40]],caption:['Размер подписи',[24,28]],cardTitle:['Заголовки карточек',[36,40,44]],table:['Текст таблицы',[28,32]],metric:['Размер показателя',[96,120,144]]};
  const keys:(keyof SlideTypography)[]=w.type==='text'||w.type==='quote'?['heading','body','caption']:w.type==='cards'?['cardTitle','body']:w.type==='metric'?['metric','caption']:w.type==='table'?['table']:['caption'];
  for(const key of keys){const [label,values]=roles[key];select(label,String(w.typography?.[key]??''),{'':'Из композиции',...Object.fromEntries(values.map(v=>[String(v),v+' px']))},v=>{w.typography={...slideTypeDefaults,...w.typography,[key]:v?Number(v):slideTypeDefaults[key]}})}
 }else select('Масштаб текста',w.style?.size??'',{'':'Из композиции',compact:'Компактный',normal:'Обычный',large:'Крупный'},v=>{w.style={...w.style,size:v?v as 'compact'|'normal'|'large':undefined}});
 select('Цвет текста',w.style?.color??'inherit',{inherit:'Из темы',ink:'Тёмно-синий',blue:'Фирменный синий',white:'Белый',muted:'Второстепенный'},v=>{w.style={...w.style,color:v as NonNullable<Widget['style']>['color']}});
 select('Внутренние отступы',w.style?.padding??'',{'':'Из композиции',none:'Без отступа',compact:'Компактные',normal:'Обычные',spacious:'Просторные'},v=>{w.style={...w.style,padding:v?v as NonNullable<Widget['style']>['padding']:undefined}});
 group.append(el('p','af-help','Ручное оформление закреплено: автоподбор сохранит выбранные параметры.'),button('Вернуть оформление композиции',()=>{delete w.style;if(doc.kind==='presentation')w.typography={...slideTypeDefaults};else delete w.typography;delete w.align;delete w.surface;refresh()},'af-btn af-btn--ghost'));
}
