import {el,button as frameworkButton} from '@alabuga/framework/dom';
import './settings-groups.css';
import './editor-layout.css';
import {mountControls,disposeControls} from './component-lifecycle';
import {actionIcon,type ActionIcon} from './action-icons';

export {el};

// WebKit does not always focus a button on click. Track the actual invocation.
let invocation:HTMLElement|undefined;
const interactionEvents=new AbortController();
if(typeof document!=='undefined'){
 document.addEventListener('click',event=>{if(event.target instanceof Element)invocation=event.target.closest<HTMLElement>('button,summary,a,input,select,textarea,[tabindex]')??undefined},{capture:true,signal:interactionEvents.signal});
 document.addEventListener('keydown',()=>{invocation=document.activeElement instanceof HTMLElement?document.activeElement:undefined},{capture:true,signal:interactionEvents.signal});
}
import.meta.hot?.dispose(()=>interactionEvents.abort());
export function invocationTarget(){return invocation?.isConnected?invocation:document.activeElement instanceof HTMLElement?document.activeElement:undefined}

/** Domain components keep their layout class and inherit the public button contract. */
export function button(text:string,action:()=>void,className='af-btn af-btn--secondary af-btn--sm',icon?:ActionIcon){
 const control=frameworkButton(text,action,/(^|\s)af-btn(\s|$)/.test(className)?className:'af-btn af-btn--ghost af-btn--sm '+className);if(icon)control.prepend(actionIcon(icon));return control;
}
export function iconButton(title:string,action:()=>void,icon:ActionIcon,className='af-btn af-btn--ghost'){
 const control=button('',action,className+' af-btn--icon',icon);control.setAttribute('aria-label',title);control.title=title;return control;
}

export function alert(text:string,tone:'info'|'success'|'warning'|'danger'='info'){
 const message=el('p',`af-alert af-alert--${tone} af-alert--accessible`);
 message.append(el('span','af-alert__text',text));return message;
}

/** One spacing owner for inspector groups; native disclosure semantics remain. */
export function settingsGroup(title:string,className:string){
 const group=el('details',className),summary=el('summary','af-btn af-btn--ghost',title),body=el('div','settings-group-body');
 const icon=el('span','af-icon af-icon--expand');icon.setAttribute('aria-hidden','true');summary.append(icon);group.append(summary,body);
 return {group,body};
}

/** Native dialog behavior, shared Framework visuals and an explicit accessible name. */
export function showDialog(dialog:HTMLDialogElement,returnFocus?:()=>HTMLElement|null|undefined){
 const opener=invocationTarget();
 // Applying a dialog can recreate its initiating inspector control.
 const regionId=opener?.closest('[id]')?.id,tag=opener?.tagName,label=opener?.getAttribute('aria-label'),text=opener?.textContent;
 const matches=(node:Element)=>node.tagName===tag&&(label?node.getAttribute('aria-label')===label:node.textContent===text);
 const peers=opener?Array.from((regionId?document.getElementById(regionId):document)?.querySelectorAll<HTMLElement>(opener.tagName)??[]).filter(matches):[];
 const occurrence=Math.max(0,peers.indexOf(opener!));
 const restoreOpener=()=>{
  if(opener?.isConnected)return opener;
  const region=regionId?document.getElementById(regionId):document;
  return region&&matches(region as Element)?region as HTMLElement:tag?Array.from(region?.querySelectorAll<HTMLElement>(tag)??[]).filter(matches)[occurrence]:undefined;
 };
 dialog.classList.add('af-dialog');
 const heading=dialog.querySelector<HTMLElement>('h1,h2,.ai-header strong');
 if(heading){
  heading.id||='dialog-title-'+crypto.randomUUID();
  heading.classList.add('af-dialog__title');
  if(!dialog.hasAttribute('aria-label'))dialog.setAttribute('aria-labelledby',heading.id);
 }
 dialog.querySelector(':scope > header,:scope > .catalog-header')?.classList.add('af-dialog__header');
 for(const control of dialog.querySelectorAll('.af-dialog__header .af-btn,.af-dialog__actions .af-btn'))control.classList.remove('af-btn--sm');
 for(const control of dialog.querySelectorAll<HTMLButtonElement>('.af-dialog__header button'))if(/^Закрыть/.test(control.getAttribute('aria-label')??control.textContent??'')){const title=control.getAttribute('aria-label')??control.textContent!;control.setAttribute('aria-label',title);control.title=title;control.classList.add('af-btn--icon');control.replaceChildren(actionIcon('close'))}
 const keyboard=new AbortController();
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||event.defaultPrevented||!dialog.open||Array.from(document.querySelectorAll('dialog[open]')).at(-1)!==dialog)return;
  const controls=Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable]')).filter(node=>(node.tabIndex>=0||node.isContentEditable)&&!node.matches(':disabled')&&!node.closest('[inert]')&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');
  const first=controls[0],last=controls.at(-1),active=document.activeElement;
  if(!first){event.preventDefault();dialog.focus();return}
  if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last!.focus()}
  else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus()}
 },{signal:keyboard.signal});
 dialog.addEventListener('close',()=>{
  keyboard.abort();
  disposeControls(dialog);
  const target=returnFocus?.()??restoreOpener();
  if(target?.isConnected&&target.getClientRects().length&&!target.closest('[inert]')&&!document.querySelector('dialog[open]'))target.focus({preventScroll:true});
 },{once:true});
 dialog.showModal();
 mountControls(dialog);
}

export function dialogFrame(title:string,className='product-dialog',returnFocus?:()=>HTMLElement|null|undefined){
 const {dialog,body}=libraryDialog(title,className);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);
 showDialog(dialog,returnFocus);
 return {dialog,body};
}

export function dialogHeader(title:string,close:()=>void){
 const header=el('header','af-dialog__header');
 header.append(el('h2','af-dialog__title',title),iconButton('Закрыть',close,'close'));
 return header;
}

/** Keep navigation outside long lists; callers show the completed dialog. */
export function libraryDialog(title:string,className:string){
 const dialog=el('dialog',className+' library-dialog'),body=el('div','library-dialog-body');
 body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-label','Содержимое окна: '+title);
 dialog.append(dialogHeader(title,()=>dialog.close()),body);
 return {dialog,body};
}
