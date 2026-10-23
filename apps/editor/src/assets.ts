import {showDialog,el,button} from './ui';
import {readImage} from './export';
import {loadBrandManifest} from './brand-manifest';
import {listAssets,describeAsset,addAsset} from './storage';

export async function chooseAsset(apply:(src:string)=>void){
 const dialog=el('dialog','asset-library'),grid=el('div','asset-grid'),filter=el('select','af-select'),error=el('p','af-error'),status=el('p'),search=el('input','af-input'),sort=el('select','af-select');
 dialog.setAttribute('aria-label','Библиотека материалов');filter.setAttribute('aria-label','Категория материалов');search.type='search';search.placeholder='Найти по названию и описанию';search.setAttribute('aria-label','Поиск материалов');sort.setAttribute('aria-label','Сортировка материалов');status.setAttribute('role','status');error.setAttribute('role','alert');
 for(const [value,label] of [['background','Фоны'],['logo','Логотипы'],['photo','Фотографии'],['decoration','Графика'],['local','Материалы моих проектов']]){const o=el('option','',label);o.value=value;filter.append(o)}
 for(const [value,label]of [['name','По названию'],['reverse','В обратном порядке']]){const o=el('option','',label);o.value=value;sort.append(o)}
 const upload=el('input','af-input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp,image/gif';upload.setAttribute('aria-label','Загрузить свой материал');
 type Item={id:string;name:string;description:string;src:string;thumbnail:string;category:string;details?:string};let items:Item[]=[],request=0,closed=false;
 const pick=(src:string)=>{try{apply(src);dialog.close()}catch(e){error.textContent=(e as Error).message}};
 const draw=()=>{grid.replaceChildren();const q=search.value.trim().toLocaleLowerCase();const visible=items.filter(a=>a.category===filter.value&&(!q||(a.name+' '+a.description).toLocaleLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'ru')*(sort.value==='reverse'?-1:1));
  for(const a of visible){const card=el('div','asset-item'),b=button('',()=>pick(a.src),'asset-card'),img=el('img');img.src=a.thumbnail;img.alt='';img.loading='lazy';b.append(img,el('strong','',a.name),el('span','',a.description));if(a.details)b.append(el('span','',a.details));card.append(b);
   if(a.category==='local'){const label=el('label','af-field'),description=el('input','af-input');description.value=a.description;description.maxLength=200;description.setAttribute('aria-label','Описание '+a.name);description.addEventListener('change',()=>{void describeAsset(a.id,description.value).then(()=>{a.description=description.value;a.name=description.value||'Без описания';status.textContent='Описание сохранено.'}).catch(e=>error.textContent=(e as Error).message)});label.append(el('span','af-label','Описание'),description);card.append(label)}grid.append(card)}
  if(!visible.length)grid.append(el('p','',items.length?'Материалы не найдены. Измените запрос или загрузите изображение.':'Здесь пока нет материалов. Можно загрузить своё изображение.'));
 };
 const retry=button('Повторить загрузку',()=>void load(),'af-btn af-btn--secondary');retry.hidden=true;
 async function load(){const generation=++request;status.textContent='Загружаем материалы…';error.textContent='';retry.hidden=true;
  const results=await Promise.allSettled([loadBrandManifest(),listAssets()]);if(closed||generation!==request)return;items=[];
  const [brand,local]=results;if(brand.status==='fulfilled')for(const a of brand.value.assets)if('url'in a&&a.url)items.push({id:a.id,name:a.name,description:a.usage,src:a.url,thumbnail:a.thumbnail,category:a.category,details:`${a.width} × ${a.height}`});
  if(local.status==='fulfilled')for(const a of local.value)items.push({id:a.id,name:a.description||'Без описания',description:a.description??'',src:a.data,thumbnail:a.data,category:'local'});
  const failed=results.some(r=>r.status==='rejected');status.textContent=failed?'Доступна часть библиотеки. Загрузка своего изображения работает.':'Материалы загружены.';if(failed){error.textContent='Не удалось загрузить часть материалов. Проверьте подключение и повторите попытку.';retry.hidden=false}draw();
 }
 upload.addEventListener('change',()=>{void (async()=>{try{const file=upload.files?.[0];if(!file)return;const src=await readImage(file);if(closed)return;await addAsset(src,file.name);if(!closed)pick(src)}catch(e){error.textContent=(e as Error).message}finally{upload.value=''}})()});
 const uploadField=el('label','af-field');uploadField.append(el('span','af-label','Или загрузите своё изображение'),upload);
 dialog.append(el('h2','','Библиотека материалов'),button('Закрыть',()=>dialog.close()),filter,search,sort,uploadField,status,error,retry,grid);document.body.append(dialog);
 dialog.addEventListener('close',()=>{closed=true;request++;dialog.remove()},{once:true});filter.addEventListener('change',draw);search.addEventListener('input',draw);sort.addEventListener('change',draw);showDialog(dialog);void load();
}

export type FocalPoint={x:number;y:number};
export function cropControl(host:HTMLElement,src:string,point:FocalPoint|undefined,change:(p:FocalPoint)=>void,label:string,options:{fit?:'cover'|'contain';aspectRatio?:number}={}){
 const wrap=el('fieldset','crop-control');wrap.append(el('legend','',label));const frame=el('div','crop-frame'),img=el('img');img.src=src;img.alt='Перетащите изображение для изменения кадра';img.draggable=false;frame.tabIndex=0;frame.setAttribute('role','slider');frame.setAttribute('aria-label',label);frame.setAttribute('aria-valuemin','0');frame.setAttribute('aria-valuemax','100');let p=point??{x:50,y:50};
 const paint=()=>{img.style.objectPosition=`${p.x}% ${p.y}%`;frame.setAttribute('aria-valuenow',String(p.x));frame.setAttribute('aria-valuetext',`${p.x}% по горизонтали, ${p.y}% по вертикали`)};
 const disabled=options.fit==='contain';img.style.objectFit=options.fit??'cover';if(disabled){frame.tabIndex=-1;frame.setAttribute('aria-disabled','true')}
 if(options.aspectRatio){frame.style.cssText=`height:auto;aspect-ratio:${options.aspectRatio};position:relative`;img.style.position='absolute';img.style.inset='0'}
 frame.append(img);wrap.append(frame,el('p','af-help',disabled?'Изображение показано целиком. Для кадрирования выберите «Заполнить блок» в поле «Размещение».':'Перетаскивайте или используйте стрелки. Если изображение точно совпадает с рамкой, сдвиг не меняет видимый кадр.'));host.append(wrap);paint();
 frame.addEventListener('keydown',e=>{if(disabled)return;const d=({ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]} as Record<string,number[]>)[e.key];if(!d)return;e.preventDefault();p={x:Math.max(0,Math.min(100,p.x+d[0])),y:Math.max(0,Math.min(100,p.y+d[1]))};paint();change(p)});
 frame.addEventListener('pointerdown',e=>{if(disabled)return;frame.setPointerCapture(e.pointerId);const origin={x:e.clientX,y:e.clientY,p:{...p}},abort=new AbortController();frame.addEventListener('pointermove',ev=>{p={x:Math.round(Math.max(0,Math.min(100,origin.p.x-(ev.clientX-origin.x)/frame.clientWidth*100))),y:Math.round(Math.max(0,Math.min(100,origin.p.y-(ev.clientY-origin.y)/frame.clientHeight*100)))};paint()},{signal:abort.signal});frame.addEventListener('pointerup',()=>{abort.abort();change(p)},{once:true,signal:abort.signal});frame.addEventListener('pointercancel',()=>{abort.abort();p=origin.p;paint()},{once:true,signal:abort.signal})});
}
