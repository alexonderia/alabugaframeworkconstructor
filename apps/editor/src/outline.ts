import {el,button} from '@alabuga/framework/dom';
import {renderDocument} from './framework-adapter';
import {type DocumentController} from '@alabuga/framework/runtime';
import type {AFDocument} from '@alabuga/framework/schema';
import {compositionCatalog} from '@alabuga/framework/compositions';
export function createOutline(root:HTMLElement,select:(index:number)=>void,action:(action:'copy'|'up'|'down'|'delete',index:number)=>void,reorder:(from:number,to:number)=>void,add?:()=>void){
 const host=el('aside','editor-outline');host.setAttribute('aria-label','Структура документа');const heading=el('h2');host.append(heading);root.append(host);
 const rows=new Map<string,{row:HTMLElement;button:HTMLButtonElement;inner:HTMLElement;signature:string;controller?:DocumentController;index:number}>();
 const update=(doc:AFDocument,active:number)=>{
 heading.textContent=doc.kind==='page'?'Секции':'Слайды';
 if(add){const plus=button('+',add,'outline-add');plus.setAttribute('aria-label',doc.kind==='page'?'Добавить секцию':'Добавить слайд');heading.append(plus)}
 const close=button('✕',()=>root.classList.remove('outline-open'),'outline-close');close.setAttribute('aria-label','Закрыть структуру');heading.append(close);
 for(const [id,item]of rows)if(!doc.pages.some(p=>p.id===id)){item.controller?.destroy();item.row.remove();rows.delete(id)}
 doc.pages.forEach((p,index)=>{let item=rows.get(p.id);const signature=JSON.stringify([doc.kind,p]);const title=p.title||p.widgets.find(w=>w.title)?.title||compositionCatalog(doc.kind).find(([id])=>id===p.composition)?.[1]||'Без названия';
 if(!item){const row=el('div','outline-row'),b=button('',()=>select(rows.get(p.id)!.index),'outline-select'),visual=el('div','outline-visual'),inner=el('div');visual.setAttribute('aria-hidden','true');visual.inert=true;visual.append(inner);b.append(visual,el('span'));row.append(b);const controls=el('div','outline-actions');for(const [a,label]of [['copy','Копия'],['up','↑'],['down','↓'],['delete','×']] as const){const control=button(label,()=>action(a,rows.get(p.id)!.index),'context-button');control.dataset.action=a;controls.append(control)}row.append(controls);row.draggable=true;row.addEventListener('dragstart',e=>e.dataTransfer!.setData('text/plain',String(rows.get(p.id)!.index)));row.addEventListener('dragover',e=>e.preventDefault());row.addEventListener('drop',e=>{e.preventDefault();const from=Number(e.dataTransfer!.getData('text/plain'));if(Number.isInteger(from)&&from>=0&&from<rows.size)reorder(from,rows.get(p.id)!.index)});b.addEventListener('keydown',e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();action(e.key==='ArrowUp'?'up':'down',rows.get(p.id)!.index);rows.get(p.id)?.button.focus({preventScroll:true})}});item={row,button:b,inner,signature:'',index};rows.set(p.id,item)}
 item.index=index;item.button.dataset.outlineIndex=String(index);item.button.setAttribute('aria-current',String(index===active));item.button.setAttribute('aria-label',`${index+1}. ${title}`);item.button.querySelector(':scope > span')!.textContent=`${index+1}. ${title}`;
 item.row.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>{b.disabled=b.dataset.action==='up'?index===0:b.dataset.action==='down'?index===doc.pages.length-1:b.dataset.action==='delete'?doc.pages.length===1:false;b.setAttribute('aria-label',`${b.textContent} ${index+1}`)});
 if(signature!==item.signature){item.controller?.destroy();const isolated=structuredClone(p);isolated.widgets.forEach(w=>{if(w.type==='button'&&'target'in w.action)w.action={type:'link',href:'#'}});item.controller=renderDocument(item.inner,{...doc,pages:[isolated]},{editing:true});item.signature=signature}
 if(host.children[index+1]!==item.row)host.insertBefore(item.row,host.children[index+1]??null);
 });
 };
 return Object.assign(update,{destroy(){rows.forEach(r=>r.controller?.destroy());rows.clear();host.remove()}});
}
