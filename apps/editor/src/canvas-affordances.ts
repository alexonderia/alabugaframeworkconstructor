import {widgetLayout,layoutNote} from './widget-layout';
/** Keep controls at a usable screen size inside the visible canvas viewport. */
export function canvasAffordances(canvas:HTMLElement,signal:AbortSignal){
 const viewport=canvas.parentElement!;let frame=0;
 const position=()=>{
  frame=0;const bounds=viewport.getBoundingClientRect(),left=Math.max(0,bounds.left)+4,right=Math.min(innerWidth,bounds.right)-4;
  const footer=canvas.closest('#builder')?.querySelector<HTMLElement>('.mobile-editor-actions'),footerTop=footer?.getClientRects().length?footer.getBoundingClientRect().top:innerHeight;
  const top=Math.max(0,bounds.top)+4,bottom=Math.min(innerHeight,bounds.bottom,footerTop)-4;
  const zoom=Number(canvas.style.zoom)||1;
  for(const box of canvas.querySelectorAll<HTMLElement>('.af-widget')){
   const rect=box.getBoundingClientRect();if(!rect.width||!rect.height)continue;
   const mode=widgetLayout(box),resizeControl=box.querySelector<HTMLButtonElement>(':scope>.resize-handle'),moveControl=box.querySelector<HTMLButtonElement>(':scope>.move-handle');
   box.dataset.editorLayout=mode;
   if(resizeControl){resizeControl.disabled=mode==='stack';resizeControl.title=mode==='grid'?'Изменить ширину и высоту блока':layoutNote(mode)}
   if(moveControl)moveControl.title=mode==='grid'?'Переместить блок по сетке':layoutNote(mode);
   const visibleLeft=Math.max(left,rect.left+4),visibleRight=Math.min(right,rect.right-4);
   const clipped=visibleRight<=visibleLeft||rect.bottom<top||rect.top>bottom;
   box.toggleAttribute('data-controls-clipped',clipped);if(clipped)continue;
   const move=box.querySelector<HTMLElement>(':scope>.move-handle'),resize=box.querySelector<HTMLElement>(':scope>.resize-handle'),bar=box.querySelector<HTMLElement>(':scope>.widget-tools');
   for(const handle of [move,resize])if(handle){
    if(rect.bottom<top||rect.top>bottom)handle.style.removeProperty('bottom');
    else{
     const size=handle.offsetHeight,target=Math.max(top+size,Math.min(rect.bottom+size/2,bottom));
     handle.style.bottom=(rect.bottom-target)/zoom+'px';
    }
   }
   if(move)move.style.left=((visibleLeft+visibleRight)/2-rect.left)/zoom+'px';
   if(resize)resize.style.right=Math.max(4,(rect.right-visibleRight)/zoom)+'px';
   if(bar){
    bar.style.maxWidth=Math.max(1,right-left)+'px';
    const target=Math.min(Math.max(visibleLeft,left),Math.max(left,right-bar.offsetWidth));
    bar.style.left=(target-rect.left)/zoom+'px';bar.style.right='auto';
   }
  }
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(position)};
 const resize=new ResizeObserver(schedule);resize.observe(viewport);
 const content=new MutationObserver(schedule);content.observe(canvas,{childList:true,subtree:true});
 const scale=new MutationObserver(schedule);scale.observe(canvas,{attributes:true,attributeFilter:['style']});
 window.addEventListener('resize',schedule,{signal});window.addEventListener('scroll',schedule,{capture:true,passive:true,signal});
 signal.addEventListener('abort',()=>{cancelAnimationFrame(frame);resize.disconnect();content.disconnect();scale.disconnect()},{once:true});schedule();
}
