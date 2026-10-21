import {el,button} from '@alabuga/framework/dom';
import {layoutVariants,applyLayoutVariant} from '@alabuga/framework/layout-variants';
import {renderDocument} from './framework-adapter';

import type {AFDocument,Section} from '@alabuga/framework/schema';
export function layoutChooser(host:HTMLElement,page:Section,kind:AFDocument['kind'],apply:(page:Section)=>void){
 host.append(button('Изменить компоновку',()=>{
  const dialog=el('dialog','asset-library'),grid=el('div','variant-grid'),controllers:ReturnType<typeof renderDocument>[]=[];let closed=false;
  dialog.setAttribute('aria-label','Компоновка текущего содержания');dialog.append(el('h2','','Компоновка текущего содержания'),el('p','','Содержание и действия сохранятся. Выберите расположение элементов.'),button('Закрыть',()=>dialog.close()),grid);
  for(const [variant,title]of layoutVariants){const card=el('article','variant-card'),visual=el('div','composition-thumbnail'),inner=el('div'),status=el('p','af-help');visual.inert=true;visual.append(inner);card.append(visual,el('h3','',title),status);grid.append(card);
   try{const next=applyLayoutVariant(page,variant,kind),isolated=structuredClone(next);isolated.widgets.forEach(w=>{if(w.type==='button')w.action={type:'link',href:'#'}});const c=renderDocument(inner,{schemaVersion:3,kind,title:'Предпросмотр',pages:[isolated]},{editing:true});controllers.push(c);const b=button('Применить: '+title,()=>{apply(next);dialog.close()},'af-btn af-btn--secondary');b.disabled=true;card.append(b);status.textContent='Проверяем содержание…';void Promise.all([document.fonts.ready,...Array.from(inner.querySelectorAll('img'),i=>i.decode().catch(()=>{}))]).then(()=>{if(closed)return;const problems=c.checkOverflow();b.disabled=!!problems.length;status.textContent=problems.length?'Содержание не помещается. Выберите другой вариант или измените текст.':'Все элементы сохранены.'})}catch(e){status.textContent=(e as Error).message}
  }
  dialog.addEventListener('close',()=>{closed=true;controllers.forEach(c=>c.destroy());dialog.remove()});document.body.append(dialog);dialog.showModal();
 },'af-btn af-btn--secondary'));
}
