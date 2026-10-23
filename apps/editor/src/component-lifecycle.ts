import {initComponents} from '@alabuga/framework/components';
const mounted=new WeakMap<HTMLElement,()=>void>();
/** Enhance only editor controls. Never walk the author-controlled canvas. */
export function mountControls(root:HTMLElement){
 disposeControls(root);
 // Selects with changing option sets retain the platform keyboard and touch UI.
 root.querySelectorAll('select').forEach(n=>n.setAttribute('data-af-select-native',''));
 const cleanup=initComponents(root);mounted.set(root,cleanup);
 return ()=>disposeControls(root);
}
export function disposeControls(root:HTMLElement){
 for(const node of [root,...root.querySelectorAll<HTMLElement>('*')]){mounted.get(node)?.();mounted.delete(node)}
}
