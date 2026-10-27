import {showDialog,libraryDialog,el,button} from './ui';
import {frameworkDom as dom} from './framework-adapter';
import type {AFDocument} from '@alabuga/framework/schema';
import {documentSurface} from './document-surface';
export type QualityIssue={section:number;widget?:string;message:string;fix:string;blocking?:boolean;screens?:string[]};
export function inspectQuality(doc:AFDocument,canvas:HTMLElement):QualityIssue[]{
 const issues:QualityIssue[]=[];const targets=new Set(doc.pages.map(p=>p.id));
 const add=(section:number,widget:string|undefined,message:string,fix:string)=>issues.push({section,widget,message,fix,blocking:message==='Содержимое выходит за рамку'||message.startsWith('Не удалось загрузить')});
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
export async function preflightDocument(doc:AFDocument):Promise<QualityIssue[]>{
 const host=el('div');host.style.cssText='position:fixed;left:-30000px;top:0;width:1600px;height:1100px;opacity:0;pointer-events:none';host.setAttribute('aria-hidden','true');document.body.append(host);
 const surface=documentSurface(host,doc,{autoHeight:false}),found=new Map<string,QualityIssue>();
 try{
  await surface.ready;
  const screens:readonly [string,number][]=doc.kind==='presentation'?[['Слайд',1600]]:[['Компьютер',1440],['Планшет',768],['Телефон',390]];
  for(const [screen,width]of screens){await surface.setWidth(width);const issues=inspectQuality(doc,surface.root!);
   if(doc.kind==='presentation')for(const problem of surface.controller!.checkOverflow()){const match=problem.match(/\d+/),section=Math.max(0,Number(match?.[0]??1)-1);issues.push({section,message:problem,fix:'Подберите оформление или увеличьте область содержимого.',blocking:true})}
   for(const issue of issues){const key=JSON.stringify([issue.section,issue.widget,issue.message]);const previous=found.get(key);if(previous)previous.screens!.push(screen);else found.set(key,{...issue,screens:[screen]})}
  }
  return [...found.values()];
 }finally{surface.destroy();host.remove()}
}
export function qualityDialog(doc:AFDocument,_canvas:HTMLElement,go:(issue:QualityIssue)=>void){
 const {dialog,body}=libraryDialog('Проверка качества','project-library'),status=el('p','','Проверяем документ на компьютере, планшете и телефоне…');status.setAttribute('role','status');body.append(status);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());showDialog(dialog);
 void preflightDocument(doc).then(issues=>{if(!dialog.isConnected)return;status.textContent=issues.length?'Найдены замечания. Перейдите к настройкам нужного блока.':'Автоматических замечаний нет. Проверьте композицию и читаемость фотографий в предпросмотре.';
  for(const issue of issues){const row=el('div','quality-issue');row.append(el('h3','',`Секция ${issue.section+1} · ${issue.screens?.join(', ')}: ${issue.message}`),el('p','',issue.fix),button('Перейти к настройкам',()=>{dialog.close();go(issue)}));body.append(row)}
 }).catch(error=>{if(dialog.isConnected)status.textContent='Проверка не завершена: '+(error as Error).message});
}
