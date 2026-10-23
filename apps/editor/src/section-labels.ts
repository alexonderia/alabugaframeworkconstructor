import {showDialog,el,button} from './ui';
import {readSetting,writeSetting} from './storage';
export type SectionNames=Record<string,string>;
export async function loadSectionNames(project:string){return (await readSetting<{value:SectionNames}>('section-names:'+project))?.value??{}}
export function renameSection(project:string,id:string,current:string,names:SectionNames,changed:()=>void){
 const dialog=el('dialog','product-dialog'),form=el('form'),input=el('input','af-input'),status=el('p'),save=el('button','af-btn','Сохранить название');input.value=names[id]??current;input.maxLength=100;input.setAttribute('aria-label','Название в структуре');save.type='submit';status.setAttribute('role','status');dialog.setAttribute('aria-label','Название в структуре');
 dialog.append(el('h2','','Название в структуре'),el('p','','Это рабочая подпись в этом браузере. Заголовок опубликованной секции не изменится. Пустое значение вернёт название из содержимого.'),form);form.append(input,status,save,button('Отмена',()=>dialog.close(),'af-btn af-btn--ghost'));
 form.addEventListener('submit',e=>{e.preventDefault();save.disabled=true;const next={...names};if(input.value.trim())next[id]=input.value.trim();else delete next[id];void writeSetting('section-names:'+project,next).then(()=>{for(const key of Object.keys(names))delete names[key];Object.assign(names,next);changed();dialog.close()}).catch(e=>status.textContent=(e as Error).message).finally(()=>save.disabled=false)});
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});showDialog(dialog);input.select();
}
