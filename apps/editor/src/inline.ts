import {frameworkDom as dom} from './framework-adapter';
import type {AFDocument,Widget} from '@alabuga/framework/schema';
import {uid} from './model';
export type InlineCommit=(edit:(d:AFDocument)=>void,group:string)=>boolean;
export function editable(node:HTMLElement,label:string,write:(d:AFDocument,text:string)=>void,commit:InlineCommit,onFocus:()=>void,multiline=true){
  // Authoring exposes a text field; native actions return through the shared renderer in preview/export.
  if(node.matches('button,a')){
    const shell=document.createElement('span');shell.className=node.className;shell.style.cssText=node.style.cssText;shell.id=node.id;shell.title=node.title;
    Object.assign(shell.dataset,node.dataset);shell.textContent=node.textContent;node.replaceWith(shell);node=shell;
  }
  const field=document.createElement('span');field.textContent=node.textContent;node.replaceChildren(field);node=field;
  node.contentEditable='plaintext-only';node.setAttribute('role','textbox');node.setAttribute('aria-label',label);node.setAttribute('aria-multiline',String(multiline));node.classList.add('inline-editable');node.tabIndex=0;
  // Editing engines may expose a terminal caret line through innerText.
  const plainText=()=>node.innerText.replace(/\r\n/g,'\n').replace(/\n$/,'');
  let group=uid('edit'),before=plainText();
  node.addEventListener('focus',()=>{group=uid('edit');before=plainText();onFocus()});
  node.addEventListener('input',()=>{const text=plainText();if(commit(d=>write(d,text),group))before=text;else node.textContent=before});
  node.addEventListener('paste',e=>{e.preventDefault();const text=e.clipboardData?.getData('text/plain')??'';document.execCommand('insertText',false,multiline?text:text.replace(/\n/g,' '))});
  node.addEventListener('click',e=>{e.stopPropagation();if(node.closest('a'))e.preventDefault()});
  node.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'||!multiline&&e.key==='Enter'){e.preventDefault();node.blur()}});
}
export function bindInline(box:HTMLElement,w:Widget,pageIndex:number,commit:InlineCommit,onFocus:()=>void){
  const widget=(d:AFDocument)=>d.pages[pageIndex].widgets.find(x=>x.id===w.id)!;
  const bind=(node:HTMLElement|null,label:string,write:(w:Widget,text:string)=>void,multiline=true)=>{if(node)editable(node,label,(d,text)=>write(widget(d),text),commit,onFocus,multiline)};
  bind(box.querySelector(dom.title),'Название блока на странице',(w,t)=>w.title=t,false);
  if(w.type==='text'){
    const nodes=box.querySelector(dom.prose)!.children;
    w.content.forEach((block,i)=>{
      if('text'in block)bind(nodes[i] as HTMLElement,block.type==='heading'?'Заголовок на странице':'Текст на странице',(w,t)=>{if(w.type==='text'){const b=w.content[i];if('text'in b)b.text=t}});
      if(block.type==='list')nodes[i].querySelectorAll<HTMLElement>('li').forEach((li,j)=>bind(li,'Пункт списка на странице',(w,t)=>{if(w.type==='text'&&w.content[i].type==='list')w.content[i].items[j]=t},false));
    });
  }
  if(w.type==='metric'){bind(box.querySelector(dom.metric),'Значение на странице',(w,t)=>{if(w.type==='metric')w.value=t},false);bind(box.querySelector(dom.caption),'Подпись на странице',(w,t)=>{if(w.type==='metric')w.note=t},false)}
  if(w.type==='button')bind(box.querySelector(dom.action),'Кнопка на странице',(w,t)=>{if(w.type==='button')w.label=t},false);
  if(w.type==='quote'){bind(box.querySelector(dom.quote),'Цитата на странице',(w,t)=>{if(w.type==='quote')w.text=t});bind(box.querySelector(dom.author),'Автор на странице',(w,t)=>{if(w.type==='quote')w.author=t},false)}
  if(w.type==='cards')box.querySelectorAll<HTMLElement>(dom.card).forEach((card,i)=>{bind(card.querySelector(dom.cardTitle),'Заголовок карточки на странице',(w,t)=>{if(w.type==='cards')w.items[i].title=t});bind(card.querySelector(dom.cardText),'Текст карточки на странице',(w,t)=>{if(w.type==='cards')w.items[i].text=t})});
  if(w.type==='gallery')box.querySelectorAll<HTMLElement>(dom.galleryCaption).forEach((caption,i)=>bind(caption,'Подпись галереи на странице',(w,t)=>{if(w.type==='gallery')w.items[i].caption=t}));
  if(w.type==='image')bind(box.querySelector(dom.caption),'Подпись изображения на странице',(w,t)=>{if(w.type==='image')w.caption=t});
  if(w.type==='table')box.querySelectorAll<HTMLElement>(dom.tableRows).forEach((row,i)=>row.querySelectorAll<HTMLElement>('td').forEach((cell,j)=>{if(w.rows[i])bind(cell,`Ячейка ${i+1}, ${j+1}`,(w,t)=>{if(w.type==='table')w.rows[i][w.columns[j].key]=t},false)}));
}
