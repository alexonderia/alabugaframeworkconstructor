import type {AFDocument,Widget,ResponsiveSize} from '@alabuga/framework/schema';
export type WidgetLayout='grid'|'tablet'|'stack'|'auto';
/** Use the rendered layout, including container queries and simulated devices. */
export function widgetLayout(box:HTMLElement):WidgetLayout{
 if(box.closest('.af-slide'))return 'grid';
 const panel=box.parentElement!,style=getComputedStyle(panel);
 if(style.display==='flex')return box.closest('.af-document--page')!.clientWidth<640?'stack':'tablet';
 const columns=style.gridTemplateColumns.split(' ').filter(Boolean).length;
 if(box.closest('.af-flow')&&columns===2)return 'tablet';
 if(columns===1)return box.closest('.af-flow')?'stack':'auto';
 return 'grid';
}
export const layoutNote=(mode:WidgetLayout)=>mode==='grid'?'':mode==='auto'?'На узком экране фиксированная секция располагает блоки автоматически. Для отдельных адаптивных размеров выберите в настройках секции высоту «По содержимому». Поля ниже меняют базовую сетку компьютера.':`${mode==='tablet'?'Планшет':'Телефон'}: ширина в процентах и минимальная высота задаются отдельно. Высота растёт вместе с содержимым; ручка перемещения меняет порядок.`;
export const responsiveKey=(mode:WidgetLayout)=>mode==='stack'?'mobile':'tablet';
export function responsiveSize(widget:Widget,mode:WidgetLayout):Required<ResponsiveSize>{
 const device=responsiveKey(mode);return {width:widget.responsive?.[device]?.width??(device==='tablet'&&widget.position.width<=6?50:100),minHeight:widget.responsive?.[device]?.minHeight??0};
}
export function setResponsiveSize(widget:Widget,mode:WidgetLayout,size:ResponsiveSize){
 widget.responsive??={};widget.responsive[responsiveKey(mode)]={...widget.responsive[responsiveKey(mode)],...size};
}
export function orderedWidgets(page:AFDocument['pages'][number],mode:WidgetLayout){
 const key=mode==='stack'?'mobileOrder':'tabletOrder';
 return page.widgets.map((widget,index)=>({widget,index})).sort((a,b)=>(a.widget[key]??a.index)-(b.widget[key]??b.index)||a.index-b.index).map(({widget})=>widget);
}
export function reorderWidget(page:AFDocument['pages'][number],mode:WidgetLayout,id:string,target:number){
 const key=mode==='stack'?'mobileOrder':'tabletOrder',widgets=orderedWidgets(page,mode),from=widgets.findIndex(widget=>widget.id===id);
 const [widget]=widgets.splice(from,1);widgets.splice(Math.max(0,Math.min(widgets.length,target)),0,widget);widgets.forEach((entry,index)=>entry[key]=index);
}
