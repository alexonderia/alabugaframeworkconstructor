import {showDialog,libraryDialog,el,button} from './ui';
import {type AFDocument} from '@alabuga/framework/schema';
import {listProjects,listRevisions,getProject,hydrate,saveRevision} from './storage';

export async function projectDialog(current:string,doc:AFDocument,open:(id:string,doc:AFDocument)=>void,versions=false){
 const {dialog,body}=libraryDialog(versions?'История версий':'Мои проекты','project-library'),list=el('div','af-stack project-library-list'),status=el('p','','Загружаем…');status.setAttribute('role','status');
 body.append(status,list);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());showDialog(dialog);
 try{if(versions){const revisions=await listRevisions(current);if(!revisions.length)list.append(el('p','','Версия появится при выходе или через 30 секунд без правок. Можно создать её вручную в меню проекта.'));for(const r of revisions)list.append(button(new Date(r.created).toLocaleString('ru')+' — восстановить',async()=>{try{await saveRevision(current,doc);open(current,await hydrate(r.document));dialog.close()}catch(e){status.textContent=String(e)}}))}else{for(const p of (await listProjects()).sort((a,b)=>b.updated-a.updated))list.append(button(p.title+' · '+new Date(p.updated).toLocaleString('ru'),async()=>{try{const next=await getProject(p.id);open(p.id,await hydrate(next.document));dialog.close()}catch(e){status.textContent=String(e)}}))}status.textContent=''}catch(e){status.textContent='Не удалось открыть хранилище: '+String(e)}
}
