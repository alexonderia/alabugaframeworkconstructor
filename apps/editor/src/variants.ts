import {showDialog,libraryDialog,el,button} from './ui';
import {makeComposition,changeComposition,compositionCatalog} from '@alabuga/framework/compositions';
import {compositionPreview} from './composition-preview';

import type {AFDocument,Section} from '@alabuga/framework/schema';
export function compositionChooser(host:HTMLElement,page:Section,kind:AFDocument['kind'],apply:(name:string)=>void){
 host.append(button('Выбрать композицию визуально',()=>{const {dialog,body}=libraryDialog('Композиции и совместимость','asset-library'),grid=el('div','variant-grid');const controllers:ReturnType<typeof compositionPreview>[]=[];body.append(grid);for(const [name,title]of compositionCatalog(kind)){let reason='';try{changeComposition(page,name,kind)}catch(e){reason=(e as Error).message}const card=el('div','af-card af-card--inner variant-card'),visual=el('div','composition-thumbnail');controllers.push(compositionPreview(visual,{schemaVersion:3,kind,title,pages:[makeComposition(name,kind)]}));const select=button(title,()=>{apply(name);dialog.close()},'af-btn af-btn--secondary');select.disabled=!!reason;card.append(visual,select,el('p','af-help',reason||'Содержимое сохранится.'));grid.append(card)}document.body.append(dialog);dialog.addEventListener('close',()=>{controllers.forEach(c=>c.destroy());dialog.remove()});showDialog(dialog)},'af-btn af-btn--secondary'));
}
