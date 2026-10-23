import {compactEditorQuery} from './editor-commands';
/** Keep the header outside the scrolling fields and the panel inside the viewport. */
export function inspectorLayout(drawer:HTMLElement,signal:AbortSignal){
 let frame=0;
 const size=()=>{
  frame=0;if(drawer.hidden)return;
  drawer.querySelector('#close-inspector')?.classList.toggle('af-btn--lg',matchMedia(compactEditorQuery).matches);
  const available=Math.max(160,window.innerHeight-Math.max(12,drawer.getBoundingClientRect().top)-12);
  drawer.style.setProperty('--constructor-inspector-height',Math.floor(available)+'px');
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(size)};
 window.addEventListener('resize',schedule,{signal});window.addEventListener('scroll',schedule,{capture:true,passive:true,signal});
 const observer=new MutationObserver(()=>{
  for(const node of drawer.querySelectorAll('.af-btn--sm,.af-input--sm,.af-select--sm'))node.classList.remove('af-btn--sm','af-input--sm','af-select--sm');
  schedule();
 });observer.observe(drawer,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});
 const resize=new ResizeObserver(schedule);resize.observe(drawer.querySelector('.drawer-header')!);
 signal.addEventListener('abort',()=>{cancelAnimationFrame(frame);observer.disconnect();resize.disconnect()},{once:true});schedule();
}
