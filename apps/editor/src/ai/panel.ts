import {showDialog,el,button,alert} from '../ui';
import {disposeControls} from '../component-lifecycle';
import {renderDocument} from '../framework-adapter';
import {type DocumentController} from '@alabuga/framework/runtime';
import {validateDocument,type AFDocument} from '@alabuga/framework/schema';
import {loadBrandManifest} from '../brand-manifest';
import {brandAssets} from '@alabuga/framework/brand';
import {bindInline} from '../inline';
import {properties} from '../properties';
import {findSpace} from '../model';
import {readImage} from '../export';
import {listAssets,addAsset,describeAsset,loadDraftSetting,saveDraftSetting} from '../storage';
import {newDraft,generateDraft} from './generation';
import {OllamaProvider} from '@alabuga/ai/provider';
import {draftDocument,type DraftResult,type Material,type GenerationRequest} from '@alabuga/ai/contracts';
import {checkSection} from './quality';
import {reviewDraftContent} from '@alabuga/ai/content-review';
import './style.css';
import {productFacts,demoPrompts} from '@alabuga/ai/demo-facts';
type Context={projectId:string;anchorId:string;kind:AFDocument['kind'];newDocument?:boolean;demo?:boolean};
export async function openAI(context:Context,apply:(draft:DraftResult)=>Promise<void>){
 if(document.querySelector('.ai-dialog'))return;
 const dialog=el('dialog','ai-dialog');dialog.setAttribute('aria-label','Создать с ИИ');
 dialog.innerHTML=`<header class="ai-header"><div><strong>Создать с ИИ</strong><small>Qwen3.5-2B · локально на вашем устройстве</small></div><button type="button" class="af-btn af-btn--ghost" data-close>Закрыть</button></header>
 <div class="ai-workspace"><form class="ai-form">
 <label class="af-field"><span class="af-label">Результат</span><select class="af-select" name="target" aria-label="Результат"><option value="section">Секция сайта</option><option value="slide">Слайд</option><option value="page">Сайт</option><option value="presentation">Презентация</option></select></label>
 <label class="af-field"><span class="af-label">Количество</span><input class="af-input" name="count" type="number" min="1" max="6" value="1"></label>
 <label class="af-field"><span class="af-label">Аудитория</span><input class="af-input" name="audience" maxlength="200" placeholder="Для кого создаём документ"></label>
 <label class="af-field"><span class="af-label">Запрос</span><textarea class="af-textarea" name="prompt" rows="4" required minlength="3" maxlength="1800" placeholder="Создай секцию о визуальном конструкторе"></textarea></label>
 <label class="af-field"><span class="af-label">Исходные сведения</span><textarea class="af-textarea" name="sources" rows="6" maxlength="6000" placeholder="Факты, описание, показатели и ссылки"></textarea></label>
 <details><summary class="af-btn af-btn--clear af-btn--sm">Материалы для ИИ</summary><p class="af-help">До шести материалов. ИИ видит описания изображений.</p><div class="ai-assets"></div><label class="af-field"><span class="af-label">Загрузить изображение</span><input class="af-input" name="upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label></details>
 <div class="ai-form-actions"><button class="af-btn" type="submit">Создать черновик</button><button class="af-btn af-btn--secondary" type="button" data-resume>Продолжить</button><button class="af-btn af-btn--ghost" type="button" data-cancel>Остановить</button></div>
 <button type="button" class="af-btn af-btn--ghost" data-diagnostics>Проверить подключение</button><p class="ai-diagnostics af-help"></p></form>
 <section class="ai-result"><p class="ai-progress" role="status" aria-live="polite">Введите запрос. Текущий проект не изменится до применения.</p><p class="ai-save af-help"></p>
 <div class="ai-toolbar"><select class="af-select" aria-label="Секция черновика" data-section></select><select class="af-select" aria-label="Экран черновика" data-device><option value="1440">Компьютер</option><option value="820">Планшет</option><option value="390">Телефон</option></select><button type="button" class="af-btn af-btn--secondary" data-repeat>Повторить секцию</button><button type="button" class="af-btn af-btn--secondary" data-fit>Подобрать оформление</button><button type="button" class="af-btn af-btn--ghost" data-check>Проверить черновик</button></div>
 <p class="af-help">Текст редактируется прямо в черновике. Для остальных свойств выберите элемент ниже.</p>
 <div class="ai-preview-scroll"><div class="ai-preview"></div></div><div class="ai-elements"></div><div class="ai-issues" role="region" aria-label="Замечания к черновику" tabindex="-1"></div><div class="ai-properties af-card af-card--inner"></div>
 <footer><label class="af-check"><input class="af-checkbox" type="checkbox" data-ack> Содержание и замечания проверены</label><button type="button" class="af-btn" data-apply>Применить черновик</button><button type="button" class="af-btn af-btn--ghost" data-anchor>Вставлять после текущей секции</button></footer></section></div>`;
 const $=<T extends HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
 const form=$<HTMLFormElement>('form'),field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
 const preview=$<HTMLElement>('.ai-preview'),progress=$<HTMLElement>('.ai-progress'),saveState=$<HTMLElement>('.ai-save'),issues=$<HTMLElement>('.ai-issues'),picker=$<HTMLSelectElement>('[data-section]');
 const provider=new OllamaProvider();let d:DraftResult|undefined,controller:DocumentController|undefined,abort:AbortController|undefined,busy=false,initializing=true,selectedIndex=0,queue=Promise.resolve(),flush=()=>true,persistFailed=false,applying=false;
 const materials:Material[]=[],chosen=new Set<string>();
 const friendly=(e:unknown)=>String(e).replace(/^Error:\s*/,'').replace(/Выполните\s+.*npm\s+run\s+[\w:-]+\.?/gi,'Попросите администратора проверить подготовку сервиса.').replace(/npm\s+run\s+[\w:-]+/gi,'подготовка сервиса');
 const showError=(e:unknown)=>{progress.textContent=friendly(e);if(dialog.isConnected){progress.scrollIntoView({block:'center'});progress.focus({preventScroll:true})}};
 progress.tabIndex=-1;
 let readiness:'checking'|'preparing'|'ready'|'unavailable'='checking';
 const protect=(fn:()=>Promise<void>|void)=>()=>{void Promise.resolve().then(fn).catch(showError)};
 const persist=async(value:DraftResult)=>{
  value.materialIds=[...chosen];const snapshot=structuredClone(value);saveState.textContent='Сохраняем черновик…';
  queue=queue.catch(()=>{}).then(()=>saveDraftSetting(snapshot));
  try{await queue;persistFailed=false;saveState.textContent='Черновик сохранён в браузере'}catch(e){persistFailed=true;saveState.textContent='Черновик не сохранён: '+String(e);throw e}
 };
 function controls(){form.setAttribute('aria-busy',String(initializing||busy));const example=form.querySelector<HTMLButtonElement>('.ai-example');if(example)example.disabled=initializing||busy;
  const ready=!!d&&d.sections.length===d.request.count&&d.sections.every(Boolean)&&!Object.keys(d.errors).length;
  const hasResult=!!d?.sections.some(Boolean);for(const hint of dialog.querySelectorAll<HTMLElement>('.ai-result>.af-help'))hint.hidden=!hasResult;$<HTMLElement>('.ai-toolbar').hidden=!hasResult;$<HTMLElement>('.ai-preview-scroll').hidden=!hasResult;$<HTMLElement>('.ai-result footer').hidden=!d;
  $<HTMLElement>('[data-resume]').hidden=!d;$<HTMLElement>('[data-cancel]').hidden=!busy;
  $<HTMLButtonElement>('[data-apply]').disabled=busy||applying||!ready||!$<HTMLInputElement>('[data-ack]').checked||persistFailed;
  $<HTMLButtonElement>('[data-repeat]').disabled=busy||readiness!=='ready'||!d?.outline[selectedIndex];$<HTMLButtonElement>('[data-check]').disabled=busy||!d?.sections.some(Boolean);
  $<HTMLButtonElement>('[data-fit]').hidden=d?.request.kind!=='presentation';$<HTMLButtonElement>('[data-fit]').disabled=busy||!d?.sections[selectedIndex];
  $<HTMLButtonElement>('[data-resume]').disabled=busy||readiness!=='ready'||!d;$<HTMLButtonElement>('[data-cancel]').disabled=!busy;form.querySelector<HTMLButtonElement>('[type=submit]')!.disabled=initializing||busy||readiness!=='ready';
  if(dialog.querySelector<HTMLElement>('.ai-outline'))dialog.querySelector<HTMLElement>('.ai-outline')!.inert=busy;
  picker.disabled=busy;$<HTMLElement>('.ai-properties').inert=busy;preview.inert=busy;$<HTMLElement>('.ai-elements').inert=busy;
  for(const n of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea'))n.disabled=initializing||busy||n.name==='count'&&['section','slide'].includes(field('target').value);
 }
 function messages(){issues.replaceChildren();if(!d)return;for(const [index,error]of Object.entries(d.errors)){const row=alert(error,'danger');row.prepend(button('Секция '+(+index+1),()=>{selectedIndex=+index;draw()}));issues.append(row)}for(const warning of d.warnings)issues.append(alert(warning,'warning'));if(d.projectId!==context.projectId)issues.append(alert('Черновик начат в другом проекте. Для одиночной секции выберите новое место вставки.','danger'));}
 function revealIssues(){if(dialog.isConnected&&d&&Object.keys(d.errors).length){issues.scrollIntoView({block:'center'});issues.focus({preventScroll:true})}}
 function updateDraft(doc:AFDocument){
  if(!d)return false;const checked=validateDocument(doc);if(!checked.success){showError(checked.issues[0].message);return false}
  let n=0;d.sections=d.sections.map(p=>p?checked.data.pages[n++]:null);d.updated=Date.now();$<HTMLInputElement>('[data-ack]').checked=false;void persist(d).catch(showError);controls();return true;
 }
 function bind(){if(!d)return;const doc=draftDocument(d);for(const [pi,p]of doc.pages.entries())for(const w of p.widgets){const box=preview.querySelector<HTMLElement>(`[data-widget-id="${w.id}"]`);if(!box)continue;bindInline(box,w,pi,(edit)=>{const next=draftDocument(d!);edit(next);if(!updateDraft(next))return false;controller?.synchronize(next);return true},()=>{});}}
 function editWidget(id:string){
  if(!d||busy||!flush())return;const doc=draftDocument(d),pi=doc.pages.findIndex(p=>p.widgets.some(w=>w.id===id)),original=doc.pages[pi].widgets.find(w=>w.id===id)!;const host=$<HTMLElement>('.ai-properties');
  flush=properties(host,original,{document:doc,current:()=>draftDocument(d!).pages[pi].widgets.find(w=>w.id===id)!,columns:doc.pages[pi].grid.columns,error:showError,pending:()=>{},settled:()=>{},
   apply:w=>{const next=draftDocument(d!);next.pages[pi].widgets[next.pages[pi].widgets.findIndex(w=>w.id===id)]=w;if(!updateDraft(next))return false;paintPreview();return true},
   remove:()=>{const next=draftDocument(d!);next.pages[pi].widgets=next.pages[pi].widgets.filter(w=>w.id!==id);if(updateDraft(next)){flush=()=>true;disposeControls(host);host.replaceChildren();paintPreview()}},
   duplicate:()=>{try{const next=draftDocument(d!),copy=structuredClone(next.pages[pi].widgets.find(w=>w.id===id)!);copy.id='block-'+crypto.randomUUID();copy.position=findSpace(next,pi,copy.position.width,copy.position.height);next.pages[pi].widgets.push(copy);if(updateDraft(next))paintPreview()}catch(e){showError(e)}}});
 }
 function paintPreview(){
  controller?.destroy();controller=undefined;preview.replaceChildren();$('.ai-elements').replaceChildren();if(!d?.sections.some(Boolean))return;
  const doc=draftDocument(d);controller=renderDocument(preview,doc,{editing:true});
  if(doc.kind==='presentation'){const index=d.sections.slice(0,selectedIndex).filter(Boolean).length;controller.goToSlide(Math.min(index,doc.pages.length-1))}
  sizePreview();bind();for(const w of d.sections[selectedIndex]?.widgets??[])$('.ai-elements').append(button('Свойства: '+(w.title||w.type),()=>editWidget(w.id),'af-btn af-btn--ghost af-btn--sm'));
 }
 function draw(){drawOutline();const state=d;if(!state)return;progress.textContent=busy&&state.status.stage==='ready'?'Завершаем черновик…':state.status.message;picker.replaceChildren();state.outline.forEach((o,i)=>{const option=el('option','',`${i+1}. ${o.title}${state.sections[i]?'':' — ожидает'}`);option.value=String(i);picker.append(option)});picker.value=String(selectedIndex);messages();paintPreview();controls();}
 function drawOutline(){
  dialog.querySelector('.ai-outline')?.remove();if(!d?.awaitingOutline)return;
  const panel=el('section','ai-outline');panel.append(el('h3','','Проверьте структуру перед наполнением'));
  d.outline.forEach((o,i)=>{const group=el('fieldset','block-editor');for(const key of ['title','purpose'] as const){const label=el('label','af-field'),input=key==='title'?el('input','af-input'):el('textarea','af-textarea');input.value=o[key];input.maxLength=key==='title'?40:6000;input.required=true;input.setAttribute('aria-label',key+' '+(i+1));input.addEventListener('change',()=>{if(!input.value.trim())return;o[key]=input.value.trim();void persist(d!).catch(showError)});label.append(el('span','',key==='title'?'Заголовок':'Содержание'),input);group.append(label)}panel.append(group)});
  $('.ai-result').prepend(panel);
 }
 async function saveProgress(next:DraftResult){d=next;await persist(next);if(dialog.isConnected)draw()}
 async function start(mode:'new'|'resume'|'repeat'){
  if(busy||!flush())return;if(d?.awaitingOutline&&Array.from(dialog.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('.ai-outline input,.ai-outline textarea')).some(n=>!n.reportValidity()||!n.value.trim()))return;if(mode!=='resume'&&!form.reportValidity())return;
  if(mode==='new'){
   const target=field('target').value,request:GenerationRequest={kind:target==='slide'||target==='presentation'?'presentation':'page',scope:target==='slide'||target==='section'?'section':'document',count:Number(field('count').value),prompt:field('prompt').value,audience:field('audience').value,sources:field('sources').value};
   d=newDraft(request,context.projectId,context.anchorId);selectedIndex=0;
  }else if(mode==='repeat'&&d){d.request.prompt=field('prompt').value;d.request.sources=field('sources').value;d.request.audience=field('audience').value;}
  if(!d)return;flush=()=>true;disposeControls($('.ai-properties'));$<HTMLElement>('.ai-properties').replaceChildren();$<HTMLInputElement>('[data-ack]').checked=false;abort=new AbortController();busy=true;controls();
  try{await generateDraft(d,provider,materials.filter(m=>chosen.has(m.id)),abort.signal,saveProgress,p=>checkSection(p,d!.request.kind),mode==='repeat'?selectedIndex:undefined,{outlineOnly:mode==='new'&&d.request.scope==='document'})}finally{busy=false;controls();if(d&&dialog.isConnected)progress.textContent=d.status.message;revealIssues()}
 }
 async function verify(){
  if(!d||!flush())return;busy=true;controls();try{
   for(let i=0;i<d.sections.length;i++){const p=d.sections[i];if(!p){d.errors[i]='Секция ещё не создана';continue}const problems=[...reviewDraftContent(p,d.request,d.outline[i],materials.filter(m=>chosen.has(m.id)).map(m=>m.name)),...await checkSection(p,d.request.kind)];if(problems.length)d.errors[i]=problems.join('; ');else delete d.errors[i]}
   d.status.message=Object.keys(d.errors).length?'Исправьте замечания перед применением.':'Проверка пройдена. Проверьте факты и подтвердите применение.';await persist(d);draw();
  }finally{busy=false;controls();if(d&&dialog.isConnected)progress.textContent=d.status.message;revealIssues()}
 }
 async function fitPreview(){
  if(!d||busy||d.request.kind!=='presentation'||!d.sections[selectedIndex]||!flush())return;
  busy=true;abort=new AbortController();controls();progress.textContent='Подбираем оформление слайда…';$<HTMLInputElement>('[data-ack]').checked=false;
  try{
   const {fitSlide}=await import('../framework-adapter'),i=selectedIndex,result=await fitSlide(d.sections[i]!,{documentTitle:d.title,index:i,signal:abort.signal});abort.signal.throwIfAborted();
   if(result.success){d.sections[i]=result.slide;const problems=[...reviewDraftContent(result.slide,d.request,d.outline[i],materials.filter(m=>chosen.has(m.id)).map(m=>m.name)),...await checkSection(result.slide,'presentation')];if(problems.length)d.errors[i]=problems.join('; ');else delete d.errors[i]}else d.errors[i]=result.issues.join('; ');
   d.updated=Date.now();d.status.message=Object.keys(d.errors).length?'Проверьте замечания к черновику.':'Оформление подобрано. Текст сохранён — проверьте результат перед применением.';
   await persist(d);if(dialog.isConnected)draw();
  }finally{busy=false;controls();if(d&&dialog.isConnected)progress.textContent=d.status.message;revealIssues()}
 }
 function targets(){const target=field('target').value,single=['section','slide'].includes(target);field('count').max=target==='page'?'5':'6';field('count').disabled=single;field('count').value=single?'1':String(Math.min(Number(field('count').value)||1,Number(field('count').max)));}
 form.addEventListener('submit',e=>{e.preventDefault();protect(()=>start('new'))()});field('target').addEventListener('change',targets);
 $('[data-resume]').addEventListener('click',protect(()=>start('resume')));$('[data-repeat]').addEventListener('click',protect(()=>start('repeat')));$('[data-cancel]').addEventListener('click',()=>abort?.abort());$('[data-check]').addEventListener('click',protect(verify));$('[data-ack]').addEventListener('change',controls);
 $('[data-fit]').addEventListener('click',protect(fitPreview));
 $('[data-apply]').addEventListener('click',protect(async()=>{if(!d||busy||applying||!flush())return;applying=true;controls();try{await verify();if(Object.keys(d.errors).length||!d.sections.every(Boolean))return;await queue;await apply(d);dialog.close()}finally{applying=false;controls()}}));
 $('[data-anchor]').addEventListener('click',protect(async()=>{if(!d)return;d.projectId=context.projectId;d.anchorId=context.anchorId;await persist(d);messages()}));
 picker.addEventListener('change',()=>{if(!flush())return;flush=()=>true;disposeControls($('.ai-properties'));$('.ai-properties').replaceChildren();selectedIndex=Number(picker.value);paintPreview();if(d?.request.kind==='page')preview.querySelector(`[data-section-id="${d.sections[selectedIndex]?.id}"]`)?.scrollIntoView({block:'start'})});
 function sizePreview(){const width=$<HTMLSelectElement>('[data-device]').value+'px';preview.dataset.kind=d?.request.kind;preview.style.width=d?.request.kind==='presentation'?'100%':width;preview.style.maxWidth=d?.request.kind==='presentation'?'100%':width}
 $('[data-device]').addEventListener('change',sizePreview);
 $('[data-diagnostics]').addEventListener('click',()=>void preparation());
 $('[data-close]').addEventListener('click',()=>{if(flush())dialog.close()});dialog.addEventListener('cancel',e=>{if(!flush())e.preventDefault()});dialog.addEventListener('close',()=>{abort?.abort();disposeControls(dialog);controller?.destroy();dialog.remove()});
 function materialRow(m:Material,local=false){
  materials.push(m);const row=el('div','ai-material'),label=el('label','af-check'),checkbox=el('input','af-checkbox'),img=el('img');checkbox.type='checkbox';checkbox.dataset.material=m.id;checkbox.checked=chosen.has(m.id);checkbox.addEventListener('change',()=>{if(checkbox.checked&&chosen.size>=6){checkbox.checked=false;showError('Выберите не более шести материалов.');return}if(checkbox.checked)chosen.add(m.id);else chosen.delete(m.id)});img.src=m.src;img.alt='';label.append(checkbox,img,document.createTextNode(m.name));row.append(label);
  if(local){const description=el('input','af-input');description.value=m.description;description.placeholder='Что изображено и для чего использовать';description.setAttribute('aria-label','Описание '+m.name);description.maxLength=200;description.addEventListener('change',protect(async()=>{m.description=description.value;await describeAsset(m.id.replace('asset:',''),description.value)}));row.append(description)}$('.ai-assets').append(row);
 }
 form.prepend(button('Заполнить пример о продукте',()=>{field('sources').value=productFacts;field('audience').value='Авторы контента';field('prompt').value=demoPrompts[context.kind]},'af-btn af-btn--secondary ai-example'));
 document.body.append(dialog);showDialog(dialog);
 const header=dialog.querySelector<HTMLElement>('.ai-header')!,headerSize=new ResizeObserver(()=>dialog.style.setProperty('--ai-header-height',header.offsetHeight+'px'));
 headerSize.observe(header);dialog.addEventListener('close',()=>headerSize.disconnect(),{once:true});
 const readinessAbort=new AbortController();let readinessTimer:ReturnType<typeof setTimeout>|undefined,readinessRequest=0;
 const connection=el('p','ai-readiness');connection.setAttribute('role','status');connection.setAttribute('aria-live','polite');dialog.querySelector('.ai-header')!.after(connection);
 const retry=button('Повторить проверку',()=>void preparation(),'af-btn af-btn--secondary af-btn--sm');retry.hidden=true;connection.after(retry);
 const jump=button('К результату и замечаниям',()=>{progress.scrollIntoView({block:'start'});progress.focus({preventScroll:true})},'af-btn af-btn--ghost ai-jump');form.prepend(jump);
 async function preparation(){const request=++readinessRequest;clearTimeout(readinessTimer);readiness='checking';connection.textContent='Проверяем готовность ИИ…';retry.hidden=true;controls();try{
  const response=await fetch('/api/ai/readiness',{signal:AbortSignal.any([readinessAbort.signal,AbortSignal.timeout(8000)])});if(!response.ok)throw new Error('Сервис ИИ не отвечает. Проверьте подключение и повторите проверку.');const state=await response.json();if(readinessAbort.signal.aborted||request!==readinessRequest)return;
  if(state.ready){readiness='ready';connection.textContent='ИИ готов к созданию черновика.'}
  else if(state.preparation&&state.preparation.stage!=='error'&&state.preparation.stage!=='ready'){readiness='preparing';connection.textContent='Подготовка ИИ: '+friendly(state.preparation.message);readinessTimer=setTimeout(()=>void preparation(),3000)}
  else{readiness='unavailable';connection.textContent='ИИ недоступен. '+friendly(state.error||state.preparation?.message||'Попросите администратора проверить подготовку модели.');retry.hidden=false}
 }catch(e){if(readinessAbort.signal.aborted||request!==readinessRequest)return;readiness='unavailable';connection.textContent='ИИ недоступен. '+friendly(e);retry.hidden=false}finally{if(!readinessAbort.signal.aborted&&request===readinessRequest)controls()}}
 void preparation();dialog.addEventListener('close',()=>{readinessAbort.abort();clearTimeout(readinessTimer)},{once:true});
 try{
  const manifest=await loadBrandManifest().catch(e=>{showError('Библиотека материалов недоступна. Можно загрузить своё изображение. '+friendly(e));return undefined});
  if(!dialog.isConnected)return;
  const defaults:string[]=Object.values(brandAssets);for(const a of manifest?.assets.filter(a=>'url'in a)??[]){if(!a.url)continue;const m={id:a.id,name:a.name,description:a.usage,src:a.url,category:a.category};if(defaults.includes(a.url)&&chosen.size<4)chosen.add(m.id);materialRow(m)}
  for(const a of await listAssets())materialRow({id:'asset:'+a.id,name:'Свой материал '+a.id.slice(0,6),description:a.description??'',src:a.data,category:'local'},true);
  d=await loadDraftSetting();if(context.newDocument&&d?.projectId!==context.projectId)d=undefined;if(d){field('target').value=d.request.scope==='document'?d.request.kind:d.request.kind==='page'?'section':'slide';field('count').value=String(d.request.count);field('prompt').value=d.request.prompt;field('audience').value=d.request.audience;field('sources').value=d.request.sources;
   if(d.materialIds){chosen.clear();d.materialIds.forEach(id=>chosen.add(id));dialog.querySelectorAll<HTMLInputElement>('[data-material]').forEach(n=>n.checked=chosen.has(n.dataset.material!))}
   if(!['ready','error','cancelled'].includes(d.status.stage)){d.status.stage='cancelled';d.status.message='Восстановлен черновик. Нажмите «Продолжить».'}draw();
  }else field('target').value=context.newDocument?context.kind:context.kind==='page'?'section':'slide';if(context.newDocument){for(const o of Array.from((field('target') as unknown as HTMLSelectElement).options))if(o.value!==context.kind)o.remove();if(!d)field('count').value=context.kind==='page'?'5':'6'}targets();if(context.demo&&!d){field('sources').value=productFacts;field('audience').value='Авторы контента';field('prompt').value=demoPrompts[context.kind]}controls();
 }catch(e){showError(e)}finally{initializing=false;controls()}
 field('upload').addEventListener('change',protect(async()=>{const file=field('upload').files?.[0];if(!file)return;const data=await readImage(file),id=await addAsset(data,file.name);materialRow({id:'asset:'+id,name:file.name,description:file.name,src:data,category:'local'},true)}));
}
