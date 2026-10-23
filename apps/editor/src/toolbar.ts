import {el} from '@alabuga/framework/dom';
/** Keep one set of controls and preserve their event handlers across breakpoints. */
export function compactToolbar(root:HTMLElement,signal:AbortSignal){
 const toolbar=root.querySelector<HTMLElement>('.canvas-toolbar')!,more=el('details','editor-more'),summary=el('summary','','Ещё инструменты'),body=el('div','editor-more-body'),media=matchMedia('(max-width:767px)');
 more.append(summary,body);toolbar.append(more);
 for(const selector of ['.canvas-zoom','#device','#play-motion','.document-settings-open','.ai-open','.replay-current','.quality-open']){const control=root.querySelector<HTMLElement>(selector);if(control)body.append(selector==='#device'?control.closest('label')!:control)}
 const sync=()=>more.open=!media.matches;sync();media.addEventListener('change',sync,{signal});
}
