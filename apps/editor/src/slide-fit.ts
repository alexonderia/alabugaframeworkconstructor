import {showDialog,el,button,dialogHeader} from './ui';
import {fitSlide} from './framework-adapter';
import {slideBackgrounds,type FitSlideOptions} from '@alabuga/framework/slide-fit';
import {renderDocument} from './framework-adapter';

import type {AFDocument} from '@alabuga/framework/schema';

/** A detached preview; applying never overwrites edits made during calculation. */
export function openSlideFit(read:()=>{id:string;document:AFDocument},index:number,apply:(doc:AFDocument)=>boolean,all=false){
 const initial=read();if(initial.document.kind!=='presentation')return;
 const snapshot=JSON.stringify(initial),source=structuredClone(initial.document);
 const dialog=el('dialog','af-dialog fit-dialog'),body=el('div','fit-body'),form=el('div','fit-options'),preview=el('div','fit-preview'),status=el('p','af-help'),results=el('ul');
 dialog.setAttribute('aria-label',all?'Оформить презентацию':'Подобрать оформление');status.setAttribute('role','status');
 const options:FitSlideOptions={},controls:HTMLInputElement[]=[];let abort:AbortController|undefined,ready:AFDocument|undefined,renderer:ReturnType<typeof renderDocument>|undefined;
 dialog.append(dialogHeader(all?'Оформить презентацию':'Подобрать оформление',()=>close()));
 const invalidate=()=>{abort?.abort();ready=undefined;accept.disabled=true;status.textContent='Настройки изменены. Запустите подбор.'};
 for(const [key,label]of [['keepLayout','Сохранить композицию'],['keepBackground','Сохранить фон'],['keepTypography','Сохранить размеры текста']] as const){const wrap=el('label','af-check'),input=el('input','af-checkbox');input.type='checkbox';input.addEventListener('change',()=>{options[key]=input.checked;invalidate()});wrap.append(input,document.createTextNode(label));form.append(wrap);controls.push(input)}
 const placement=el('div','fit-placement');placement.setAttribute('aria-label','Размещение фона');
 for(const [key,label]of [['auto','Автоматически'],['none','Однотонный'],['full','Полный фон'],['left-quarter','¼ слева'],['right-quarter','¼ справа'],['left-third','⅓ слева'],['right-third','⅓ справа']]){const b=button(label,()=>{options.placement=key==='auto'?undefined:key as FitSlideOptions['placement'];placement.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));invalidate()});b.dataset.placement=key;b.setAttribute('aria-pressed',String(key==='auto'));const icon=el('span','fit-placement-icon');b.prepend(icon);placement.append(b)}
 form.append(placement);
 const media=el('details'),catalog=el('div','fit-backgrounds');media.append(el('summary','af-btn af-btn--clear af-btn--sm','Фирменные фоны'),catalog);const choose=(id?:string)=>{options.backgroundId=id;catalog.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===(id??''))));invalidate()};
 const automatic=button('Автоматически',()=>choose());automatic.dataset.id='';automatic.setAttribute('aria-pressed','true');catalog.append(automatic);
 for(const bg of slideBackgrounds){const b=button(bg.name,()=>choose(bg.id));b.dataset.id=bg.id;b.setAttribute('aria-pressed','false');b.title=bg.note;const img=el('img');img.src=bg.src;img.alt='';img.loading='lazy';b.prepend(img);catalog.append(b)}form.append(media);
 const close=()=>{abort?.abort();renderer?.destroy();dialog.close();dialog.remove()};
 const accept=button('Применить оформление',()=>{if(!ready)return;if(JSON.stringify(read())!==snapshot){ready=undefined;accept.disabled=true;status.textContent='Проект изменился. Закройте окно и запустите подбор заново.';return}if(apply(ready))close()},'af-btn');accept.disabled=true;
 const run=button('Рассчитать оформление',()=>void calculate()),cancel=button('Отменить расчёт',()=>{abort?.abort();ready=undefined;accept.disabled=true;status.textContent='Расчёт отменён. Изменения не применены.'});
 async function calculate(){abort?.abort();const current=new AbortController();abort=current;ready=undefined;accept.disabled=true;run.disabled=true;cancel.hidden=false;results.replaceChildren();const draft=structuredClone(source),indices=all?draft.pages.map((_,i)=>i):[index];
  try{for(const i of indices){status.textContent=`Подбор слайда ${i+1} из ${draft.pages.length}…`;const r=await fitSlide(source.pages[i],{...options,documentTitle:draft.title,index:i,signal:current.signal,previousBackgrounds:draft.pages.slice(0,i).map(p=>p.appearance?.backgroundId??p.appearance?.background??'')});current.signal.throwIfAborted();if(!r.success)throw new Error(`Слайд ${i+1}: ${r.issues.join(' ')}`);draft.pages[i]=r.slide;for(const note of [...r.changes,...r.issues])results.append(el('li','',`Слайд ${i+1}: ${note}`))}
   renderer?.destroy();renderer=renderDocument(preview,draft,{editing:true});renderer.goToSlide(index);ready=draft;accept.disabled=false;status.textContent='Предпросмотр готов. Исходный проект не изменён.';
  }catch(e){if(abort===current&&dialog.isConnected)status.textContent=current.signal.aborted?'Расчёт отменён. Изменения не применены.':String(e)}finally{if(abort===current){run.disabled=false;cancel.hidden=true}}
 }
 const actions=el('div','af-dialog__actions fit-actions');actions.append(run,cancel,accept);body.append(form,status,preview,results);dialog.append(body,actions);dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('close',()=>{abort?.abort();renderer?.destroy();dialog.remove()});document.body.append(dialog);showDialog(dialog);void calculate();
}
