/** The desktop inspector is nonmodal; its full-screen phone presentation is modal. */
export function responsiveDrawer(root:HTMLElement,drawer:HTMLElement,close:()=>void,signal:AbortSignal){
 const media=matchMedia('(max-width:767px)'),previous=new Map<HTMLElement,boolean>();
 const sync=()=>{
  const modal=media.matches&&!drawer.hidden;
  if(modal){drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');for(const sibling of Array.from(root.children))if(sibling instanceof HTMLElement&&sibling!==drawer&&sibling.tagName!=='DIALOG'){if(!previous.has(sibling))previous.set(sibling,sibling.inert);sibling.inert=true}}
  else{drawer.removeAttribute('role');drawer.removeAttribute('aria-modal');for(const [node,inert]of previous)node.inert=inert;previous.clear()}
 };
 const observer=new MutationObserver(sync);observer.observe(drawer,{attributes:true,attributeFilter:['hidden']});
 media.addEventListener('change',sync,{signal});
 window.addEventListener('keydown',event=>{
  if(!media.matches||drawer.hidden||document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return}
  if(event.key!=='Tab')return;
  const fields=Array.from(drawer.querySelectorAll<HTMLElement>('button,input,textarea,select,summary,[tabindex]')).filter(n=>n.tabIndex>=0&&!n.matches(':disabled')&&n.getClientRects().length);
  const first=fields[0],last=fields.at(-1);if(!first)return;
  if(event.shiftKey&&(document.activeElement===first||!drawer.contains(document.activeElement))){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||!drawer.contains(document.activeElement))){event.preventDefault();first.focus()}
 },{capture:true,signal});
 signal.addEventListener('abort',()=>{observer.disconnect();for(const [node,inert]of previous)node.inert=inert;previous.clear()},{once:true});
 return {sync};
}
