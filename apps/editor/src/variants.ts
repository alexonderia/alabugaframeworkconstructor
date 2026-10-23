import {showDialog,el,button} from './ui';
import {makeComposition,changeComposition,compositionCatalog} from '@alabuga/framework/compositions';
import {renderDocument} from './framework-adapter';

import type {AFDocument,Section} from '@alabuga/framework/schema';
export function compositionChooser(host:HTMLElement,page:Section,kind:AFDocument['kind'],apply:(name:string)=>void){
 host.append(button('Выбрать композицию визуально',()=>{const dialog=el('dialog','asset-library'),grid=el('div','variant-grid');const controllers:ReturnType<typeof renderDocument>[]=[];dialog.append(el('h2','','Композиции и совместимость'),button('Закрыть',()=>dialog.close()),grid);for(const [name,title]of compositionCatalog(kind)){let reason='';try{changeComposition(page,name,kind)}catch(e){reason=(e as Error).message}const card=el('div','variant-card'),visual=el('div','composition-thumbnail'),inner=el('div');visual.inert=true;visual.setAttribute('aria-hidden','true');visual.append(inner);controllers.push(renderDocument(inner,{schemaVersion:3,kind,title,pages:[makeComposition(name,kind)]},{editing:true}));const select=button(title,()=>{apply(name);dialog.close()},'af-btn af-btn--secondary');select.disabled=!!reason;card.append(visual,select,el('p','af-help',reason||'Содержимое сохранится.'));grid.append(card)}document.body.append(dialog);dialog.addEventListener('close',()=>{controllers.forEach(c=>c.destroy());dialog.remove()});showDialog(dialog)},'af-btn af-btn--secondary'));
}
