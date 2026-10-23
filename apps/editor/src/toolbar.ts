import {el} from '@alabuga/framework/dom';
import {compactEditorQuery,labelEditorCommands} from './editor-commands';
/** Move canonical controls, keeping handlers and state across breakpoints. */
export function compactToolbar(root:HTMLElement,signal:AbortSignal){
 const toolbar=root.querySelector<HTMLElement>('.canvas-toolbar')!,more=toolbar.querySelector<HTMLDetailsElement>('.editor-more')!,view=more.querySelector<HTMLElement>('.editor-more-body')!,section=toolbar.querySelector<HTMLElement>('.section-toolbar')!,menu=root.querySelector<HTMLElement>('.project-menu>div')!;
 const media=matchMedia(compactEditorQuery),mobile=el('nav','mobile-editor-actions');mobile.setAttribute('aria-label','Инструменты редактора');root.append(mobile);
 section.prepend(root.querySelector('.outline-toggle')!);
 const zoom=root.querySelector('.canvas-zoom');if(zoom)view.append(zoom);
 for(const selector of ['.document-settings-open','.quality-open']){const node=root.querySelector(selector);if(node)menu.append(node)}
 const ai=root.querySelector('.ai-open');if(ai)section.append(ai);
 const controls=['.outline-toggle','#add-widget','#page-settings-open','#preview','#export'].map(selector=>{const node=root.querySelector<HTMLElement>(selector)!,anchor=document.createComment(selector);node.before(anchor);return {node,anchor}});
 // CSS can hide the old control before matchMedia delivers its change event.
 let responsiveFocus:HTMLElement|undefined;
 root.addEventListener('focusin',event=>{const node=event.target as HTMLElement;responsiveFocus=controls.some(c=>c.node===node)||view.contains(node)?node:undefined},{signal});
 root.addEventListener('focusout',event=>{if(event.relatedTarget instanceof Node&&!root.contains(event.relatedTarget))responsiveFocus=undefined},{signal});
 document.addEventListener('pointerdown',()=>responsiveFocus=undefined,{capture:true,signal});
 const updateInset=()=>{if(media.matches)root.style.setProperty('--constructor-mobile-actions-height',Math.ceil(mobile.getBoundingClientRect().height)+'px');else root.style.removeProperty('--constructor-mobile-actions-height')};
 const sync=()=>{
  const active=document.activeElement instanceof HTMLElement&&root.contains(document.activeElement)?document.activeElement:document.activeElement===document.body&&responsiveFocus?.isConnected?responsiveFocus:undefined;
  more.open=!media.matches;labelEditorCommands(root,root.dataset.documentKind==='presentation'?'presentation':'page');
  for(const {node,anchor}of controls){if(media.matches)(node.id==='export'?menu:mobile).append(node);else anchor.after(node);if(node.id!=='export'){node.classList.remove('af-btn--sm');node.classList.toggle('af-btn--lg',media.matches)}}
  updateInset();
  if(active){
   const visible=(node:HTMLElement|undefined)=>node?.getClientRects().length&&!node.closest('[hidden],[inert],details:not([open]) > :not(summary)')&&!node.matches(':disabled');
   const target=visible(active)?active:menu.contains(active)?menu.parentElement?.querySelector<HTMLElement>('summary'):view.contains(active)?more.querySelector<HTMLElement>('summary'):active.classList.contains('outline-toggle')?root.querySelector<HTMLElement>('.outline-select[aria-current=true]'):undefined;
   if(target&&document.activeElement!==target)target.focus({preventScroll:true});
  }
 };
 sync();media.addEventListener('change',sync,{signal});
 const resize=new ResizeObserver(updateInset);resize.observe(mobile);
 root.querySelectorAll<HTMLDetailsElement>('.project-menu,.editor-more').forEach(details=>details.addEventListener('keydown',event=>{if(event.key==='Escape'&&details.open){event.preventDefault();details.open=false;details.querySelector<HTMLElement>('summary')?.focus()}},{signal}));
 signal.addEventListener('abort',()=>{resize.disconnect();root.style.removeProperty('--constructor-mobile-actions-height');mobile.remove()},{once:true});
}
