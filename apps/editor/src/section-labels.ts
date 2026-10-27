import {showDialog,libraryDialog,invocationTarget,el,button} from './ui';
import {inputField} from './ui-fields';
import {readSetting,writeSetting} from './storage';
export type SectionNames=Record<string,string>;
export async function loadSectionNames(project:string){return (await readSetting<{value:SectionNames}>('section-names:'+project))?.value??{}}
export function renameSection(project:string,id:string,current:string,names:SectionNames,changed:()=>void){
 const menu=invocationTarget()?.closest('details'),{dialog,body}=libraryDialog('Название в структуре','product-dialog'),form=el('form'),input=inputField(form,'Название в структуре',names[id]??current,()=>{}),status=el('p'),save=el('button','af-btn','Сохранить название'),actions=el('div','af-dialog__actions library-dialog-actions section-name-actions');let saving=false;
 input.maxLength=100;form.id='section-name-'+crypto.randomUUID();save.type='submit';save.setAttribute('form',form.id);status.setAttribute('role','status');
 body.append(el('p','','Это рабочая подпись в этом браузере. Заголовок опубликованной секции не изменится. Пустое значение вернёт название из содержимого.'),form,status);actions.append(save,button('Отмена',()=>dialog.close(),'af-btn af-btn--ghost'));dialog.append(actions);
 dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault()});
 form.addEventListener('submit',e=>{e.preventDefault();if(saving)return;const next={...names};if(input.value.trim())next[id]=input.value.trim();else delete next[id];saving=true;status.setAttribute('role','status');status.textContent='Сохраняем название…';const controls=dialog.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button');controls.forEach(n=>n.disabled=true);
  void writeSetting('section-names:'+project,next).then(()=>{for(const key of Object.keys(names))delete names[key];Object.assign(names,next);changed();dialog.close()}).catch(e=>{status.setAttribute('role','alert');status.textContent=(e as Error).message}).finally(()=>{saving=false;controls.forEach(n=>n.disabled=false);if(dialog.open)input.focus({preventScroll:true})});
 });
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});showDialog(dialog,()=>menu?.querySelector<HTMLElement>(':scope>summary'));input.select();
}
