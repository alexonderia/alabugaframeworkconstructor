import {initComponents} from '@alabuga/framework/components';
import {enhanceFilePicker} from './file-picker';
const mounted=new WeakMap<HTMLElement,()=>void>();
/** Enhance only editor controls. Never walk the author-controlled canvas. */
export function mountControls(root:HTMLElement){
 disposeControls(root);
 const controls=new Map<HTMLElement,()=>void>();
 const sync=()=>{
  for(const [control,cleanup]of controls)if(!root.contains(control)){cleanup();controls.delete(control)}
  for(const control of root.querySelectorAll<HTMLElement>('select.af-select,input.af-datepicker[type=date],.af-field input[type=file]')){
   if(controls.has(control)||control.closest('.af-document--page,.af-document--presentation'))continue;
   // Framework observes option/value changes itself, including dynamic lists.
   controls.set(control,control instanceof HTMLInputElement&&control.type==='file'?enhanceFilePicker(control):initComponents(control));
  }
 };
 const observer=new MutationObserver(sync);
 observer.observe(root,{childList:true,subtree:true});sync();
 const cleanup=()=>{observer.disconnect();for(const dispose of controls.values())dispose();controls.clear()};mounted.set(root,cleanup);
 return ()=>disposeControls(root);
}
export function disposeControls(root:HTMLElement){
 for(const node of [root,...root.querySelectorAll<HTMLElement>('*')]){mounted.get(node)?.();mounted.delete(node)}
}
