import {el,button} from '@alabuga/framework/dom';
import {type AFDocument} from '@alabuga/framework/schema';
import {listProjects,listRevisions,getProject,hydrate,saveRevision} from './storage';

export async function projectDialog(current:string,doc:AFDocument,open:(id:string,doc:AFDocument)=>void,versions=false){
 const dialog=el('dialog','project-library');dialog.setAttribute('aria-label',versions?'История версий':'Мои проекты');const title=el('h2','',versions?'История версий':'Мои проекты'),list=el('div','af-stack'),status=el('p');
 dialog.append(title,button('Закрыть',()=>dialog.close()),list,status);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 try{if(versions){const revisions=await listRevisions(current);if(!revisions.length)list.append(el('p','','Версия появится при выходе или через 30 секунд без правок. Можно создать её вручную в меню проекта.'));for(const r of revisions)list.append(button(new Date(r.created).toLocaleString('ru')+' — восстановить',async()=>{try{await saveRevision(current,doc);open(current,await hydrate(r.document));dialog.close()}catch(e){status.textContent=String(e)}}))}else{for(const p of (await listProjects()).sort((a,b)=>b.updated-a.updated))list.append(button(p.title+' · '+new Date(p.updated).toLocaleString('ru'),async()=>{try{const next=await getProject(p.id);open(p.id,await hydrate(next.document));dialog.close()}catch(e){status.textContent=String(e)}}))}}catch(e){status.textContent='Не удалось открыть хранилище: '+String(e)}
}
