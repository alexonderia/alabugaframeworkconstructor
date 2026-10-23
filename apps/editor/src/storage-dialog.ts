import {el,button} from '@alabuga/framework/dom';
import {inspectStorage,removeUnusedAssets} from './storage';
export function storageDialog(){
 const dialog=el('dialog','product-dialog'),status=el('p'),list=el('div'),actions=el('div','af-row');dialog.setAttribute('aria-label','Хранилище и материалы');status.setAttribute('role','status');
 const format=(bytes:number)=>`${(bytes/1024/1024).toLocaleString('ru-RU',{maximumFractionDigits:1})} МБ`;
 const remove=button('Удалить выбранные',async()=>{remove.disabled=true;try{const ids=[...list.querySelectorAll<HTMLInputElement>('input:checked')].map(n=>n.value);const count=await removeUnusedAssets(ids);if(dialog.isConnected){await draw();status.textContent=`Удалено материалов: ${count}. Используемые материалы сохранены.`}}catch(e){status.textContent=(e as Error).message}finally{remove.disabled=false}},'af-btn af-btn--secondary');
 async function draw(){status.textContent='Проверяем хранилище…';const data=await inspectStorage();if(!dialog.isConnected)return;list.replaceChildren();status.textContent=data.usage!==undefined?`Занято ${format(data.usage)}${data.quota?' из '+format(data.quota):''}.`:'Материалов: '+data.assets.length;
  for(const a of data.assets){const row=el('label','storage-asset'),check=el('input');check.type='checkbox';check.value=a.id;check.disabled=!!a.usedBy.length;check.setAttribute('aria-label','Удалить '+a.description);row.append(check,el('span','',`${a.description} · ${format(a.bytes)} · ${a.usedBy.length?'Используется: '+a.usedBy.join(', '):'Не используется'}`));list.append(row)}
  remove.disabled=true;list.onchange=()=>remove.disabled=!list.querySelector('input:checked');
 }
 actions.append(remove,button('Закрыть',()=>dialog.close(),'af-btn af-btn--ghost'));dialog.append(el('h2','','Хранилище и материалы'),status,el('p','','Выберите неиспользуемые изображения для окончательного удаления. Учитываются все проекты, корзина, история версий и черновик ИИ. Перед удалением использование проверяется повторно.'),list,actions);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();void draw().catch(e=>status.textContent=(e as Error).message);
}
