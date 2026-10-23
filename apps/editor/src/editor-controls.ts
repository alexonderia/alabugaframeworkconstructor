import {el,button} from './ui';
export function createZoomControls(canvas:HTMLElement){
 let zoom=1,baseWidth=0,fitting=false;
 const bar=el('div','canvas-zoom'),label=button('100%',()=>reset(),'af-btn af-btn--ghost af-btn--sm');
 bar.setAttribute('role','group');bar.setAttribute('aria-label','Масштаб холста');label.setAttribute('aria-label','Масштаб 100%');
 const apply=()=>{canvas.style.width=baseWidth?baseWidth+'px':'';canvas.style.maxWidth=baseWidth?'none':'';canvas.style.zoom=String(zoom);canvas.style.setProperty('--constructor-ui-scale',String(1/zoom));label.textContent=Math.round(zoom*100)+'%'};
 const reset=()=>{fitting=false;zoom=1;baseWidth=0;apply()};
 const fit=()=>{
  fitting=true;canvas.style.zoom='1';canvas.style.width='';canvas.style.maxWidth='';
  const viewport=canvas.parentElement!;
  baseWidth=canvas.offsetWidth;
  const slide=canvas.querySelector<HTMLElement>('.af-slide--active');
  const width=Math.max(baseWidth,canvas.scrollWidth),availableWidth=viewport.clientWidth;
  let scale=availableWidth/Math.max(1,width);
  if(slide){const availableHeight=Math.max(160,window.innerHeight-viewport.getBoundingClientRect().top-32);scale=Math.min(scale,availableHeight/Math.max(1,slide.getBoundingClientRect().height))}
  baseWidth=width;zoom=Math.min(1,Math.max(.1,scale));apply();
 };
 const change=(delta:number)=>{fitting=false;if(!baseWidth)baseWidth=canvas.offsetWidth;zoom=Math.max(.1,Math.min(2,zoom+delta));apply()};
 const less=button('−',()=>change(-.1),'af-btn af-btn--ghost af-btn--sm'),more=button('+',()=>change(.1),'af-btn af-btn--ghost af-btn--sm');
 less.setAttribute('aria-label','Уменьшить масштаб');more.setAttribute('aria-label','Увеличить масштаб');
 bar.append(less,label,more,button('Вписать',fit,'af-btn af-btn--ghost af-btn--sm'));
 const observer=new ResizeObserver(()=>{if(fitting)fit()});observer.observe(canvas.parentElement!);
 const resized=()=>{if(fitting)fit()};window.addEventListener('resize',resized);
 return {bar,reset,fit,destroy(){observer.disconnect();window.removeEventListener('resize',resized)}};
}
export function bindEditorShortcuts(signal:AbortSignal,actions:{close:()=>boolean;undo:()=>void;redo:()=>void;save:()=>void}){
 window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();actions.save();return}if(e.key==='Escape'&&(document.querySelector('dialog[open]')||(e.target as HTMLElement).closest('.outline-menu[open],.project-menu[open],.editor-more[open]')))return;if(e.key==='Escape'&&actions.close())return;if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?actions.redo:actions.undo)()}},{signal,capture:true});
}
