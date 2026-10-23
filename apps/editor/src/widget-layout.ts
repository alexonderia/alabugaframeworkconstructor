import type {AFDocument} from '@alabuga/framework/schema';
export type WidgetLayout='grid'|'tablet'|'stack';
/** Use the rendered layout, including container queries and simulated devices. */
export function widgetLayout(box:HTMLElement):WidgetLayout{
 if(box.closest('.af-slide'))return 'grid';
 const panel=box.parentElement!,style=getComputedStyle(panel);
 if(style.display==='flex')return 'stack';
 const columns=style.gridTemplateColumns.split(' ').filter(Boolean).length;
 if(box.closest('.af-flow')&&columns===2)return 'tablet';
 if(columns===1)return 'stack';
 return 'grid';
}
export const layoutNote=(mode:WidgetLayout)=>mode==='tablet'?'Планшет: ширина — половина или вся строка. Высота зависит от содержимого; ручка перемещения меняет порядок.':mode==='stack'?'Одна колонка: ширина и высота зависят от содержимого. Ручка перемещения меняет порядок.':'';
export function orderedWidgets(page:AFDocument['pages'][number],mode:WidgetLayout){
 const key=mode==='stack'?'mobileOrder':'tabletOrder';
 return page.widgets.map((widget,index)=>({widget,index})).sort((a,b)=>(a.widget[key]??a.index)-(b.widget[key]??b.index)||a.index-b.index).map(({widget})=>widget);
}
export function reorderWidget(page:AFDocument['pages'][number],mode:WidgetLayout,id:string,target:number){
 const key=mode==='stack'?'mobileOrder':'tabletOrder',widgets=orderedWidgets(page,mode),from=widgets.findIndex(widget=>widget.id===id);
 const [widget]=widgets.splice(from,1);widgets.splice(Math.max(0,Math.min(widgets.length,target)),0,widget);widgets.forEach((entry,index)=>entry[key]=index);
}
