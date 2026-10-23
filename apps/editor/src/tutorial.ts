import {el,button} from '@alabuga/framework/dom';
import {readSetting,writeSetting} from './storage';
export type TutorialState={enabled:boolean;section:number;done:number[]};
export async function tutorialState(id:string){return (await readSetting<{value:TutorialState}>('tutorial:'+id))?.value}
export function tutorial(host:HTMLElement,id:string,state:TutorialState|undefined,go:(step:number)=>void){
 const panel=el('details','author-tutorial');panel.open=!!state?.enabled;panel.hidden=state?.enabled===false;panel.append(el('summary','','Попробуйте пять действий'));
 const data=state??{enabled:true,section:0,done:[]};const list=el('ol');
 const names=['Изменить заголовок','Сменить компоновку','Заменить изображение','Настроить оформление элемента','Предпросмотр и экспорт'];
 const save=()=>void writeSetting('tutorial:'+id,data).catch(()=>{feedback.textContent='Не удалось сохранить отметки обучения.'});
 const feedback=el('p');feedback.setAttribute('role','status');
 names.forEach((name,i)=>{const row=el('li'),check=el('input');check.type='checkbox';check.checked=data.done.includes(i);check.setAttribute('aria-label','Выполнено: '+name);check.addEventListener('change',()=>{data.done=check.checked?[...data.done.filter(x=>x!==i),i]:data.done.filter(x=>x!==i);save()});row.append(check,button(name,()=>go(i),'af-btn af-btn--ghost af-btn--sm'));list.append(row)});
 panel.append(el('p','','Откройте нужный инструмент, выполните действие и отметьте результат. Отметки не изменяют документ.'),list,feedback,button('Скрыть подсказки',()=>{panel.hidden=true;data.enabled=false;save()},'af-btn af-btn--ghost af-btn--sm'));host.insertBefore(panel,host.querySelector('.canvas-scroll'));
 return ()=>{panel.hidden=false;panel.open=true;data.enabled=true;save()};
}
