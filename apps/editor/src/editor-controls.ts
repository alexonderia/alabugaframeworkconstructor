import {el,button} from '@alabuga/framework/dom';
export function createZoomControls(canvas:HTMLElement){
 let zoom=1,baseWidth=0;const bar=el('div','canvas-zoom'),label=el('span','','100%');
 const apply=()=>{if(zoom===1){canvas.style.width='';canvas.style.maxWidth='';baseWidth=0}else{if(!baseWidth)baseWidth=canvas.offsetWidth;canvas.style.width=baseWidth+'px';canvas.style.maxWidth='none'}canvas.style.zoom=String(zoom);label.textContent=Math.round(zoom*100)+'%'};
 const reset=()=>{zoom=1;apply()};
 bar.append(button('−',()=>{zoom=Math.max(.25,zoom-.1);apply()},'af-btn af-btn--ghost af-btn--sm'),label,button('+',()=>{zoom=Math.min(2,zoom+.1);apply()},'af-btn af-btn--ghost af-btn--sm'),button('Вписать',reset,'af-btn af-btn--ghost af-btn--sm'));
 return {bar,reset};
}
export function bindEditorShortcuts(signal:AbortSignal,actions:{close:()=>boolean;undo:()=>void;redo:()=>void;save:()=>void}){
 window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();actions.save();return}if(e.key==='Escape'&&document.querySelector('dialog[open]'))return;if(e.key==='Escape'&&actions.close())return;if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?actions.redo:actions.undo)()}},{signal,capture:true});
}
