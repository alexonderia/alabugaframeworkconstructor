import {widgetRegistry,type AFDocument,type Widget,validateDocument} from '@alabuga/framework/schema';
import {widgetLayout,layoutNote,orderedWidgets,reorderWidget} from './widget-layout';
type Options={canvas:HTMLElement;signal:AbortSignal;document:()=>AFDocument;flush:()=>boolean;select:(id:string,index:number)=>void;change:(edit:(doc:AFDocument)=>void,message:string)=>boolean;status:(message:string)=>void};
/** Grid handles edit geometry; responsive handles edit the layout actually shown. */
export function bindWidgetHandle(handle:HTMLButtonElement,id:string,index:number,resizing:boolean,options:Options){
 const boxNow=()=>options.canvas.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(id)}"]`)!;
 const current=()=>options.document().pages[index].widgets.find(widget=>widget.id===id)!;
 const focus=()=>boxNow()?.querySelector<HTMLElement>(resizing?'.resize-handle':'.move-handle')?.focus({preventScroll:true});
 const update=(position:Widget['position'])=>options.change(doc=>{doc.pages[index].widgets.find(widget=>widget.id===id)!.position=position},resizing?'Размер блока изменён.':'Блок перемещён.');
 const order=(mode:ReturnType<typeof widgetLayout>,target:number)=>options.change(doc=>reorderWidget(doc.pages[index],mode,id,target),'Порядок блоков изменён.');
 const tabletWidth=(delta:number)=>{const doc=options.document(),position={...current().position};position.width=delta<0?Math.max(widgetRegistry[current().type].minWidth,Math.min(6,doc.pages[index].grid.columns)):doc.pages[index].grid.columns;position.col=1;return position};
 handle.addEventListener('keydown',event=>{
  const delta=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[event.key];if(!delta)return;
  event.preventDefault();if(!options.flush())return;options.select(id,index);
  const mode=widgetLayout(boxNow());
  if(mode!=='grid'){
   if(resizing){if(mode==='tablet'&&delta[0])update(tabletWidth(delta[0]));else options.status(layoutNote(mode))}
   else{const widgets=orderedWidgets(options.document().pages[index],mode);order(mode,widgets.findIndex(widget=>widget.id===id)+(delta[1]||delta[0]))}
  }else{const position={...current().position};if(resizing){position.width+=delta[0];position.height+=delta[1]}else{position.col+=delta[0];position.row+=delta[1]}update(position)}
  focus();
 });
 handle.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;event.preventDefault();event.stopPropagation();
  // Firefox can cancel a pointer whose pressed target is removed by flush.
  // Capture on the stable canvas before a pending property edit redraws it.
  options.canvas.setPointerCapture(event.pointerId);
  if(!options.flush()){options.canvas.releasePointerCapture(event.pointerId);return}options.select(id,index);
  // A pending property edit can replace the original handle during flush.
  const box=boxNow(),panel=box.parentElement!,mode=widgetLayout(box);
  if(resizing&&mode==='stack'){options.canvas.releasePointerCapture(event.pointerId);options.status(layoutNote(mode));return}
  const doc=options.document(),page=doc.pages[index],initial={...current().position},g=page.grid,bounds=panel.getBoundingClientRect(),scale=bounds.width/panel.offsetWidth,start={x:event.clientX,y:event.clientY},rect=box.getBoundingClientRect();
  const stepX=(panel.clientWidth+g.gap)/g.columns*scale,stepY=(g.rowHeight+g.gap)*scale,flow=!!box.closest('.af-flow');
  const tracks=getComputedStyle(panel).gridTemplateRows.split(' ').map(parseFloat).filter(Number.isFinite),starts=[0];tracks.forEach(height=>starts.push(starts.at(-1)!+height+g.gap));
  const lineAt=(px:number)=>{if(px>=starts.at(-1)!)return starts.length+Math.round((px-starts.at(-1)!)/(24+g.gap));let best=0;starts.forEach((value,i)=>{if(Math.abs(value-px)<Math.abs(starts[best]-px))best=i});return best+1};
  const ordered=orderedWidgets(page,mode),initialOrder=ordered.findIndex(widget=>widget.id===id);let targetOrder=initialOrder,position={...initial},moved=false;
  const properties=['grid-column','grid-row','--af-tablet-span'];
  const original=properties.map(name=>({name,value:box.style.getPropertyValue(name),priority:box.style.getPropertyPriority(name)}));
  const siblings=Array.from(panel.children).filter((node):node is HTMLElement=>node instanceof HTMLElement&&node.matches('.af-widget')),orders=siblings.map(node=>({node,value:node.style.order}));
  const abort=new AbortController();const onExit=()=>finish(false);options.signal.addEventListener('abort',onExit,{once:true});
  const finish=(save:boolean)=>{
   if(abort.signal.aborted)return;abort.abort();options.signal.removeEventListener('abort',onExit);panel.classList.remove('is-positioning');box.classList.remove('invalid-position');
   for(const {name,value,priority}of original)if(value)box.style.setProperty(name,value,priority);else box.style.removeProperty(name);
   for(const {node,value}of orders)node.style.order=value;
   if(options.canvas.hasPointerCapture(event.pointerId))options.canvas.releasePointerCapture(event.pointerId);
   if(save&&moved){if(mode!=='grid'&&!resizing)order(mode,targetOrder);else update(position)}
   focus();
  };
  if(box.contains(document.activeElement))(document.activeElement as HTMLElement).blur();
  // Capture on the stable canvas: responsive reordering reinserts widget nodes.
  panel.classList.toggle('is-positioning',mode==='grid');options.canvas.setPointerCapture(event.pointerId);
  options.canvas.addEventListener('pointermove',move=>{
   const dx=move.clientX-start.x,dy=move.clientY-start.y;
   if(mode!=='grid'){
    if(resizing){position=Math.abs(dx)>12?tabletWidth(dx):{...initial};box.style.setProperty('--af-tablet-span',position.width>6?'2':'1')}
    else{const delta=Math.round(dy/Math.max(48,rect.height/2))||Math.round(dx/Math.max(48,bounds.width/2));targetOrder=Math.max(0,Math.min(ordered.length-1,initialOrder+delta));const preview=[...ordered];const [widget]=preview.splice(initialOrder,1);preview.splice(targetOrder,0,widget);preview.forEach((widget,i)=>siblings.find(node=>node.dataset.widgetId===widget.id)!.style.order=String(i))}
    moved=resizing?position.width!==initial.width:targetOrder!==initialOrder;return;
   }
   position={...initial};const x=Math.round(dx/stepX),y=Math.round(dy/stepY);
   if(resizing){position.width=Math.max(widgetRegistry[current().type].minWidth,Math.min(g.columns-position.col+1,position.width+x));position.height=Math.max(widgetRegistry[current().type].minHeight,Math.min(100,position.height+y))}
   else{position.col=Math.max(1,Math.min(g.columns-position.width+1,position.col+x));position.row=Math.max(1,Math.min(1000,position.row+y))}
   if(flow){const line=resizing?initial.row+initial.height-1:initial.row-1,row=lineAt((starts[line]??line*(24+g.gap))+dy/scale);if(resizing)position.height=Math.max(widgetRegistry[current().type].minHeight,Math.min(100,row-initial.row));else position.row=Math.max(1,Math.min(1000,row))}
   moved=JSON.stringify(position)!==JSON.stringify(initial);box.style.setProperty('grid-column',`${position.col} / span ${position.width}`,'important');box.style.setProperty('grid-row',`${position.row} / span ${position.height}`,'important');
   const candidate=options.document();candidate.pages[index].widgets.find(widget=>widget.id===id)!.position=position;box.classList.toggle('invalid-position',!validateDocument(candidate).success);
  },{signal:abort.signal});
  options.canvas.addEventListener('pointerup',()=>finish(true),{signal:abort.signal});options.canvas.addEventListener('pointercancel',()=>finish(false),{signal:abort.signal});options.canvas.addEventListener('lostpointercapture',()=>finish(false),{signal:abort.signal});
  window.addEventListener('keydown',key=>{if(key.key==='Escape'){key.preventDefault();key.stopImmediatePropagation();finish(false)}},{capture:true,signal:abort.signal});
 });
}
