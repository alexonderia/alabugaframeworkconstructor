import {frameworkDom as dom} from './framework-adapter';
import {el,button} from '@alabuga/framework/dom';
import type {AFDocument} from '@alabuga/framework/schema';
export type QualityIssue={section:number;widget?:string;message:string;fix:string};
export function inspectQuality(doc:AFDocument,canvas:HTMLElement):QualityIssue[]{
 const issues:QualityIssue[]=[];const targets=new Set(doc.pages.map(p=>p.id));
 const add=(section:number,widget:string|undefined,message:string,fix:string)=>issues.push({section,widget,message,fix});
 doc.pages.forEach((p,index)=>{
  const background=canvas.querySelector<HTMLImageElement>(dom.sectionBackground(p.id));if(background?.complete&&!background.naturalWidth)add(index,undefined,'Не удалось загрузить фон','Выберите фоновое изображение из библиотеки.');
  if(p.appearance?.background&&/^https?:/i.test(p.appearance.background))add(index,undefined,'Внешний фон требует сети: '+p.appearance.background,'Загрузите файл в библиотеку для автономного экспорта.');
  if(p.appearance?.theme==='image'&&p.appearance.shade!=='strong')add(index,undefined,'Текст поверх изображения требует визуальной проверки','Выберите сильное затемнение в настройках фона.');
  p.widgets.forEach(w=>{const box=canvas.querySelector<HTMLElement>(dom.widgetById(w.id));
   const urls=w.type==='image'?[w.src]:w.type==='gallery'?w.items.map(i=>i.src):[];for(const src of new Set(urls.filter(s=>/^https?:/i.test(s))))add(index,w.id,'Внешнее изображение требует сети: '+src,'Загрузите файл для автономного экспорта.');
   for(const n of box?.querySelectorAll<HTMLElement>(dom.overflow)??[])if(n.clientWidth&&n.clientHeight&&(n.scrollWidth>n.clientWidth+2||n.scrollHeight>n.clientHeight+2))add(index,doc.kind==='presentation'?undefined:w.id,'Содержимое выходит за рамку',doc.kind==='presentation'?'В свойствах слайда нажмите «Подобрать оформление». Если текст не помещается, разделите слайд вручную.':'Увеличьте блок или выберите более просторную композицию.');
   for(const img of box?.querySelectorAll('img')??[])if(img.complete&&!img.naturalWidth)add(index,w.id,'Не удалось загрузить изображение','Выберите материал из библиотеки или загрузите файл.');
   if(w.type==='text')for(const b of w.content)if(b.type==='link'&&b.href.startsWith('#')&&b.href.length>1&&!targets.has(b.href.slice(1)))add(index,w.id,'Ссылка ведёт к отсутствующей секции','Выберите существующую секцию в настройках ссылки.');
   if(w.type==='button'&&'target'in w.action&&!((w.action.type==='modal'?doc.modals??[]:doc.pages).some(p=>p.id===('target'in w.action?w.action.target:''))))add(index,w.id,'Цель действия отсутствует','Выберите существующую цель действия.');
   if(p.appearance?.theme!=='image'&&box){const sample=box.querySelector<HTMLElement>(dom.copy);if(sample){const color=getComputedStyle(sample).color;let parent:HTMLElement|null=sample,bg='';while(parent&&parent!==canvas){const c=getComputedStyle(parent).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){bg=c;break}parent=parent.parentElement}const ratio=contrast(color,bg||'rgb(255,255,255)'),large=parseFloat(getComputedStyle(sample).fontSize)>=24;if(ratio!==null&&ratio<(large?3:4.5))add(index,w.id,'Недостаточный контраст текста на однотонном фоне','Выберите светлую или контрастную фирменную тему.')}}
  });
 });return issues;
}
function contrast(a:string,b:string){const lum=(s:string)=>{const rgb=s.match(/[\d.]+/g)?.slice(0,3).map(Number);if(!rgb||rgb.length!==3)return null;return rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)};const x=lum(a),y=lum(b);return x===null||y===null?null:(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
export function qualityDialog(doc:AFDocument,canvas:HTMLElement,go:(issue:QualityIssue)=>void){const dialog=el('dialog','project-library');dialog.append(el('h2','','Проверка качества'),button('Закрыть',()=>dialog.close()));const issues=inspectQuality(doc,canvas);if(!issues.length)dialog.append(el('p','','Автоматических замечаний нет. Проверьте композицию и читаемость фотографий в предпросмотре.'));for(const issue of issues){const row=el('div','quality-issue');row.append(el('h3','',`Секция ${issue.section+1}: ${issue.message}`),el('p','',issue.fix),button('Перейти к настройкам',()=>{dialog.close();go(issue)}));dialog.append(row)}document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal()}
