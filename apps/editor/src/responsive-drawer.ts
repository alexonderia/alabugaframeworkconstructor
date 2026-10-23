import {compactEditorQuery} from './editor-commands';
/** The desktop inspector is nonmodal; its compact presentation is modal. */
export function responsiveDrawer(root:HTMLElement,drawer:HTMLElement,close:()=>void,signal:AbortSignal,isOpen=()=>!drawer.hidden){
 const media=matchMedia(compactEditorQuery),previous=new Map<HTMLElement,boolean>(),originalRole=drawer.getAttribute('role');
 const restoreRole=()=>{if(originalRole)drawer.setAttribute('role',originalRole);else drawer.removeAttribute('role')};
 const sync=()=>{
  const modal=media.matches&&isOpen();
  if(modal){drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');for(const sibling of Array.from(root.children))if(sibling instanceof HTMLElement&&sibling!==drawer&&sibling.tagName!=='DIALOG'){if(!previous.has(sibling))previous.set(sibling,sibling.inert);sibling.inert=true}}
  else{restoreRole();drawer.removeAttribute('aria-modal');for(const [node,inert]of previous)node.inert=inert;previous.clear()}
 };
 const observer=new MutationObserver(sync);observer.observe(drawer,{attributes:true,attributeFilter:['hidden']});
 observer.observe(root,{attributes:true,attributeFilter:['class']});
 media.addEventListener('change',sync,{signal});
 window.addEventListener('keydown',event=>{
  if(!media.matches||!isOpen()||document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){if((event.target as HTMLElement).closest('.outline-menu[open]'))return;event.preventDefault();event.stopImmediatePropagation();close();return}
  if(event.key!=='Tab')return;
  const fields=Array.from(drawer.querySelectorAll<HTMLElement>('button,input,textarea,select,summary,[tabindex]')).filter(n=>n.tabIndex>=0&&!n.matches(':disabled')&&n.getClientRects().length);
  const first=fields[0],last=fields.at(-1);if(!first)return;
  if(event.shiftKey&&(document.activeElement===first||!drawer.contains(document.activeElement))){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||!drawer.contains(document.activeElement))){event.preventDefault();first.focus()}
 },{capture:true,signal});
 signal.addEventListener('abort',()=>{observer.disconnect();restoreRole();drawer.removeAttribute('aria-modal');for(const [node,inert]of previous)node.inert=inert;previous.clear()},{once:true});
 return {sync};
}
