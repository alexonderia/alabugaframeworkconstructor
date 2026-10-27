import {widgetLayout,layoutNote} from './widget-layout';
/** Keep controls at a usable screen size inside the visible canvas viewport. */
export function canvasAffordances(canvas:HTMLElement,signal:AbortSignal){
 const viewport=canvas.parentElement!;let frame=0;
 const layer=document.createElement('div');layer.className='canvas-widget-tools';viewport.append(layer);const bars=new Map<HTMLElement,HTMLElement>();
 let active:HTMLElement|undefined;
 const clearActive=()=>{if(active){active=undefined;schedule()}};
 // Selection owns the controls; hovering another block never adds a second set.
 document.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  if(canvas.querySelector('.af-widget.is-selected'))return;
  const box=event.target instanceof Element?event.target.closest<HTMLElement>('.af-widget'):null;
  if(box&&canvas.contains(box)){if(active!==box){active=box;schedule()}return}
  if(!active)return;if(!active.isConnected){clearActive();return}
  const block=active.getBoundingClientRect(),bar=bars.get(active)?.getBoundingClientRect();
  if(!bar||event.clientX<Math.min(block.left,bar.left)||event.clientX>Math.max(block.right,bar.right)||event.clientY<Math.min(block.top,bar.top)||event.clientY>Math.max(block.bottom,bar.bottom))clearActive();
 },{signal});
 document.addEventListener('pointerleave',clearActive,{signal});window.addEventListener('blur',clearActive,{signal});signal.addEventListener('abort',clearActive,{once:true});
 document.addEventListener('focusin',()=>schedule(),{signal});document.addEventListener('focusout',()=>schedule(),{signal});
 const position=()=>{
  frame=0;const bounds=viewport.getBoundingClientRect(),left=Math.max(0,bounds.left)+4,right=Math.min(innerWidth,bounds.right)-4;
  const footer=canvas.closest('#builder')?.querySelector<HTMLElement>('.mobile-editor-actions'),footerTop=footer?.getClientRects().length?footer.getBoundingClientRect().top:innerHeight;
  const top=Math.max(0,bounds.top)+4,bottom=Math.min(innerHeight,bounds.bottom,footerTop)-4;
  const zoom=Number(canvas.style.zoom)||1;
  for(const [box,bar]of bars)if(!canvas.contains(box)){bar.remove();bars.delete(box)}
  const boxes=Array.from(canvas.querySelectorAll<HTMLElement>('.af-widget'));
  for(const box of boxes){const bar=box.querySelector<HTMLElement>(':scope>.widget-tools');if(bar){bar.dataset.controlsFor=box.dataset.widgetId;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label',box.getAttribute('aria-label')??'Действия блока');bars.set(box,bar);layer.append(bar)}}
  const focus=document.activeElement instanceof Element?document.activeElement:null,focused=focus?.closest<HTMLElement>('.af-widget:has(:focus-visible)')??boxes.find(box=>box.dataset.widgetId===focus?.closest<HTMLElement>('.widget-tools')?.dataset.controlsFor);
  const owner=boxes.find(box=>box.classList.contains('is-selected'))??(focused&&canvas.contains(focused)?focused:active?.isConnected?active:undefined);
  const obstacles=[...boxes,...canvas.querySelectorAll<HTMLElement>('.af-heading,.af-slide__title,.section-insert button')].map(box=>box.getBoundingClientRect()).filter(rect=>rect.width&&rect.height);
  for(const box of boxes){
   box.toggleAttribute('data-controls-active',box===owner);
   const rect=box.getBoundingClientRect();if(!rect.width||!rect.height){const hidden=bars.get(box);if(hidden)hidden.hidden=true;continue}
   const mode=widgetLayout(box),resizeControl=box.querySelector<HTMLButtonElement>(':scope>.resize-handle'),moveControl=box.querySelector<HTMLButtonElement>(':scope>.move-handle');
   box.dataset.editorLayout=mode;
   if(resizeControl){resizeControl.disabled=mode==='auto';resizeControl.title=mode==='grid'?'Изменить ширину и высоту блока':layoutNote(mode)}
   if(moveControl){moveControl.disabled=mode==='auto';moveControl.title=mode==='grid'?'Переместить блок по сетке':layoutNote(mode)}
   const visibleLeft=Math.max(left,rect.left+4),visibleRight=Math.min(right,rect.right-4);
   const clipped=visibleRight<=visibleLeft||rect.bottom<top||rect.top>bottom;
   const bar=bars.get(box);if(bar){bar.hidden=box!==owner||clipped;for(const control of bar.querySelectorAll<HTMLButtonElement>('button'))control.tabIndex=bar.hidden?-1:0}
   for(const control of box.querySelectorAll<HTMLButtonElement>(':scope>.widget-handle'))control.tabIndex=box===owner&&!clipped?0:-1;
   box.toggleAttribute('data-controls-clipped',clipped);if(clipped)continue;
   const move=box.querySelector<HTMLElement>(':scope>.move-handle'),resize=box.querySelector<HTMLElement>(':scope>.resize-handle');
   for(const handle of [move,resize])if(handle){
    if(rect.bottom<top||rect.top>bottom)handle.style.removeProperty('bottom');
    else{
     const size=handle.offsetHeight,target=Math.max(top+size,Math.min(rect.bottom+size/2,bottom));
     handle.style.bottom=(rect.bottom-target)/zoom+'px';
    }
   }
   if(move)move.style.left=((visibleLeft+visibleRight)/2-rect.left)/zoom+'px';
   if(resize)resize.style.right=Math.max(4,(rect.right-visibleRight)/zoom)+'px';
   if(box===owner){
    const neighbors=boxes.filter(other=>other!==box).map(other=>other.getBoundingClientRect()).filter(r=>r.width&&r.height),placed:{left:number;right:number;top:number;bottom:number}[]=[];
    for(const handle of [move,resize])if(handle){
     const current=handle.getBoundingClientRect(),size=handle.offsetHeight,options=[{x:current.left,y:current.top},{x:rect.left-size-12,y:rect.bottom-size},{x:rect.right+12,y:rect.bottom-size},{x:current.left,y:rect.bottom-size-4}];
     const target=options.find(p=>p.x>=left&&p.x+size<=right&&p.y>=top&&p.y+size<=bottom&&![...neighbors,...placed].some(r=>p.x<r.right+4&&p.x+size>r.left-4&&p.y<r.bottom+4&&p.y+size>r.top-4))??options[3];
     handle.style.bottom=(rect.bottom-target.y-size)/zoom+'px';
     if(handle===move)handle.style.left=(target.x+size/2-rect.left)/zoom+'px';else{handle.style.left='auto';handle.style.right=(rect.right-target.x-size)/zoom+'px'}
     placed.push({left:target.x,right:target.x+size,top:target.y,bottom:target.y+size});
    }
   }
   if(bar){
    if(box!==owner)continue;
    const areaLeft=left,areaRight=right,areaTop=top,areaBottom=bottom;
    bar.style.maxWidth=Math.max(1,areaRight-areaLeft)+'px';
    const width=bar.offsetWidth,height=bar.offsetHeight,gap=20,clampX=(x:number)=>Math.max(areaLeft,Math.min(x,areaRight-width)),x=clampX(rect.left),after=rect.bottom+(move?.offsetHeight??40)/2+gap;
    const candidates=[{x,y:rect.top-height-gap},{x,y:after},{x:clampX(rect.right+gap),y:rect.top},{x:clampX(rect.left-width-gap),y:rect.top}];
    for(const y of [areaTop,areaBottom-height])for(const column of [x,areaLeft,areaRight-width])candidates.push({x:column,y});
    // Narrow headers can leave free space between the insertion row and logo.
    // Search neighboring content edges before falling back above the document.
    const between=obstacles.flatMap(r=>[r.top-height-gap,r.bottom+gap]).flatMap(y=>[x,areaLeft,areaRight-width].map(column=>({x:column,y})));
    between.sort((a,b)=>Math.abs(a.y-rect.top)-Math.abs(b.y-rect.top));candidates.push(...between);
    const intersects=(point:{x:number;y:number})=>obstacles.some(r=>point.x<r.right+8&&point.x+width>r.left-8&&point.y<r.bottom+8&&point.y+height>r.top-8);
    const available=candidates.filter(p=>p.x>=areaLeft&&p.x+width<=areaRight+1&&p.y>=areaTop&&p.y+height<=areaBottom+1&&!intersects(p)),surface=box.closest('.af-page,.af-slide')?.getBoundingClientRect();
    const target=available.find(p=>surface&&p.y>=surface.top+4&&p.y+height<=surface.bottom-4)??available[0]??{x,y:Math.min(rect.top,...obstacles.map(r=>r.top))-height-gap};
    bar.style.left=target.x-bounds.left+viewport.scrollLeft+'px';bar.style.right='auto';bar.style.top=target.y-bounds.top+viewport.scrollTop+'px';bar.style.bottom='auto';
   }
  }
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(position)};
 const resize=new ResizeObserver(schedule);resize.observe(viewport);
 const content=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.attributeName==='class'||r.target instanceof Element&&r.target.matches('.af-widget,.af-panel,.af-page,.af-slide')))schedule()});content.observe(canvas,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
 const scale=new MutationObserver(schedule);scale.observe(canvas,{attributes:true,attributeFilter:['style']});
 window.addEventListener('resize',schedule,{signal});window.addEventListener('scroll',schedule,{capture:true,passive:true,signal});
 signal.addEventListener('abort',()=>{cancelAnimationFrame(frame);resize.disconnect();content.disconnect();scale.disconnect();bars.clear();layer.remove()},{once:true});schedule();
}
