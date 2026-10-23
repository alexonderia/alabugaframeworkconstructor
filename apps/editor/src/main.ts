import {compactToolbar} from './toolbar';
import {loadSectionNames,renameSection} from './section-labels';
import {storageDialog} from './storage-dialog';
import {disposeControls} from './component-lifecycle';
import {frameworkDom as dom} from './framework-adapter';
import {EditorSaveQueue} from './editor-save';
import {createZoomControls,bindEditorShortcuts} from './editor-controls';
import {downloadEditorHTML} from './editor-export';
import {tutorial,tutorialState} from './tutorial';
import {openSlideFit} from './slide-fit';
import {captureFocus} from './focus';
import {responsiveDrawer} from './responsive-drawer';
import {readProjectFile} from './project-file';
import {readViewState,writeViewState,type ViewState} from './view-state';
const openAI:typeof import('./ai/panel').openAI=(...args)=>import('./ai/panel').then(m=>m.openAI(...args));
import {insertDraft} from '@alabuga/ai/commands';
import {draftDocument} from '@alabuga/ai/contracts';
import {qualityDialog} from './quality';
import {renderDocument} from './framework-adapter';
import {type DocumentController,type AFDocument,type Widget,widgetRegistry} from '@alabuga/framework';
import {el,button} from '@alabuga/framework/dom';
import {EditorModel,emptyDocument,createWidget,findSpace,uid,checked,copySection} from './model';
import {sectionDisplayName} from './section-name';
import {properties} from './properties';
import {download,projectFilename} from './export';
import {bindInline,editable,type InlineCommit} from './inline';
import {compositionCatalog,makeComposition,showcase} from '@alabuga/framework/compositions';
import {sectionDesign} from './design';
import {saveProject,saveRevision,hydrate,portableProject,getProject,projectVersion,ProjectConflictError,subscribeProjectChanges} from './storage';
import {projectDialog} from './projects';
import {createOutline} from './outline';

export async function mountEditor(root:HTMLElement,projectId:string,initial:AFDocument,navigate:(route:string)=>void,changed:(id:string)=>void,initialVersion=projectVersion(projectId)){
const lifecycle=new AbortController();
let storedVersion=initialVersion;
const learning=await tutorialState(projectId);let sectionNames=await loadSectionNames(projectId);
const initialMessage='';
function fitCurrent(all:boolean){if(!flush())return;openSlideFit(()=>({id:projectId,document:model.document}),pageIndex,doc=>commit(d=>{d.pages=doc.pages}),all)}
let model=new EditorModel(initial);let pageIndex=Math.min(readViewState(projectId)?.section??learning?.section??0,initial.pages.length-1),selected='',preview=false,documentMode=false,controller:DocumentController|undefined,flush=()=>true,catalogMode:'section'|'widget'='widget',insertAt=0;

root.innerHTML=`<header class="editor-header"><a class="editor-brand" href="../index.html">a<span>alabuga<small>КОНСТРУКТОР</small></span></a><label class="document-name"><span class="af-sr-only">Название проекта</span><input id="project-name" class="af-input" maxlength="200"></label><div class="editor-history"><button id="undo" class="af-btn af-btn--ghost af-btn--sm" aria-label="Отменить действие" title="Ctrl+Z">↶</button><button id="redo" class="af-btn af-btn--ghost af-btn--sm" aria-label="Повторить действие" title="Ctrl+Shift+Z">↷</button></div><details class="project-menu"><summary>Проект</summary><div><button id="new-page">Новый сайт</button><button id="new-deck">Новая презентация</button><button id="demo-page">Эталонный лендинг</button><button id="demo-deck">Эталонная презентация</button><button id="save">Скачать проект</button><label class="file-open">Открыть проект<input id="open" type="file" accept=".json,application/json" aria-label="Открыть проект"></label></div></details><div class="editor-file-actions"><button id="add-widget" class="af-btn af-btn--ghost af-btn--sm">+ Блок</button><button id="page-settings-open" class="af-btn af-btn--ghost af-btn--sm">Настройки секции</button><button id="preview" class="af-btn af-btn--secondary af-btn--sm">Предпросмотр</button><button id="export" class="af-btn af-btn--sm">Скачать HTML</button></div></header>
<div class="editor-status" role="region" aria-label="Состояние проекта"><span id="status" role="status" aria-live="polite"></span><span id="save-state">Изменения сохраняются в браузере</span></div>
<main class="editor-workspace"><h1 class="af-sr-only">Конструктор документов</h1><div class="canvas-toolbar"><label class="page-picker"><span id="page-kind">Секция</span><select id="pages" class="af-select" aria-label="Выбрать секцию или слайд"></select></label><div id="slide-actions" class="af-row"><button id="slide-settings-open" class="af-btn af-btn--secondary af-btn--sm">Оформление и показ</button><button id="add-slide" class="af-btn af-btn--ghost af-btn--sm">+ Слайд</button><button id="copy-slide" class="af-btn af-btn--ghost af-btn--sm">Копия</button><button id="up-slide" class="af-btn af-btn--ghost af-btn--sm" aria-label="Переместить слайд раньше">←</button><button id="down-slide" class="af-btn af-btn--ghost af-btn--sm" aria-label="Переместить слайд позже">→</button><button id="delete-slide" class="af-btn af-btn--ghost af-btn--sm">Удалить слайд</button></div><label class="page-picker">Экран<select id="device" class="af-select" aria-label="Размер экрана"><option value="desktop">Компьютер</option><option value="tablet">Планшет</option><option value="mobile">Телефон</option></select></label><button id="play-motion" class="af-btn af-btn--ghost af-btn--sm">Проверить эффекты</button><span class="canvas-mode">СТРАНИЦА — ЭТО И ЕСТЬ РЕДАКТОР</span></div><div id="canvas-scroll" class="canvas-scroll"><div id="canvas" class="editor-canvas"></div></div><div id="end-add"></div></main>
<aside id="inspector" class="editor-inspector" aria-label="Настройки" hidden><div class="drawer-header"><span id="inspector-title">Настройки</span><button id="close-inspector" class="af-btn af-btn--clear af-btn--sm" aria-label="Закрыть настройки">✕</button></div><details class="page-settings" open><summary>Настройки секции</summary><form id="settings" class="af-stack"><label class="af-field"><span class="af-label">Заголовок секции</span><input id="page-title" class="af-input af-input--sm" maxlength="200"></label><div class="settings-grid"><label class="af-field"><span class="af-label">Колонки</span><input id="columns" class="af-input af-input--sm" type="number" min="1" max="24" required></label><label class="af-field"><span class="af-label">Строка, px</span><input id="row-height" class="af-input af-input--sm" type="number" min="32" max="160" required></label><label class="af-field"><span class="af-label">Отступ, px</span><input id="gap" class="af-input af-input--sm" type="number" min="0" max="48" required></label></div><button type="submit" class="af-btn af-btn--ghost af-btn--sm">Обновить секцию</button></form></details><div id="design-settings"></div><div id="properties"></div></aside>
<dialog id="catalog" class="block-catalog" aria-labelledby="catalog-title"><div class="catalog-header"><div><span class="editor-kicker">БИБЛИОТЕКА БЛОКОВ</span><h2 id="catalog-title">Добавить блок</h2></div><button id="close-catalog" class="af-btn af-btn--clear" aria-label="Закрыть библиотеку">✕</button></div><p id="catalog-description"></p><label id="catalog-theme-field" class="af-field"><span class="af-label">Оформление композиции</span><select id="catalog-theme" class="af-select" aria-label="Оформление композиции"><option value="default">Авторский вариант</option><option value="light">Светлая</option><option value="contrast">Контрастная</option><option value="accent">Акцентная</option><option value="image">С изображением</option></select></label><div id="templates"></div><div id="palette"></div></dialog>`;
const get=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=get('canvas'),inspector=get('properties'),drawer=get('inspector'),catalog=get<HTMLDialogElement>('catalog');
const drawerAccess=responsiveDrawer(root,drawer,closeInspector,lifecycle.signal);
const fitHint=button('Текст не помещается — подобрать оформление',()=>fitCurrent(false));fitHint.hidden=true;root.querySelector('.canvas-toolbar')!.append(fitHint);
let fitHintTimer:ReturnType<typeof setTimeout>|undefined;
function suggestFit(){clearTimeout(fitHintTimer);fitHintTimer=setTimeout(()=>{const slide=canvas.querySelector<HTMLElement>(dom.activeSlide),panel=slide?.querySelector<HTMLElement>(dom.panel);fitHint.hidden=preview||!slide||!((panel&&panel.offsetTop+panel.offsetHeight>slide.clientHeight-48)||[...slide.querySelectorAll<HTMLElement>(dom.overflow)].some(n=>n.scrollWidth>n.clientWidth+2||n.scrollHeight>n.clientHeight+2))},350)}
const message=(text:string,error=false)=>{if(lifecycle.signal.aborted)return;get('status').textContent=text;get('status').classList.toggle('status-error',error)};
let lastSaveStatus='Сохранено в браузере';get('save-state').textContent=lastSaveStatus;
let draftState:'valid'|'pending'|'invalid'='valid';
const paintSaveState=()=>{get('save-state').textContent=draftState==='invalid'?'Изменения не применены — проверьте настройки':draftState==='pending'?'Проверяем изменения…':lastSaveStatus};
const writeCurrent=async(id:string,doc:AFDocument)=>{const value=await saveProject(id,doc,undefined,{expectedVersion:id===projectId?storedVersion:projectVersion(id)});if(id===projectId)storedVersion++;return value};
const autosave=new EditorSaveQueue({write:writeCurrent,revision:saveRevision,changed,revisionError:e=>message(String(e),true),state:(state,error)=>{
 lastSaveStatus=state==='saving'?'Сохраняем…':state==='saved'?'Сохранено в браузере':'Не сохранено — скачайте проект';root.classList.toggle('save-failed',state==='failed');paintSaveState();if(error)message(String(error),true);
 if(error instanceof ProjectConflictError)showConflict();
}});
const saveLocal=()=>autosave.save(projectId,model.document);
get('save-state').setAttribute('role','status');get('save-state').setAttribute('aria-live','polite');get('save-state').setAttribute('aria-atomic','true');
subscribeProjectChanges(change=>{if(change.id===projectId&&change.version>storedVersion)message(change.deleted?'Проект перемещён в корзину в другой вкладке. Сохраните свою копию.':'Проект изменён в другой вкладке. При сохранении мы предложим выбрать версию.',true)},lifecycle.signal);
function showConflict(){
 if(lifecycle.signal.aborted||document.querySelector('.save-conflict'))return;
 const dialog=el('dialog','product-dialog save-conflict'),status=el('p');dialog.setAttribute('aria-label','Конфликт сохранения');
 const actions=el('div','save-conflict-actions');
 const perform=(work:()=>Promise<void>)=>async()=>{actions.querySelectorAll('button').forEach(b=>b.disabled=true);try{await autosave.queue;await work();dialog.close()}catch(e){status.textContent=(e as Error).message}finally{actions.querySelectorAll('button').forEach(b=>b.disabled=false)}};
 dialog.append(el('h2','','Конфликт сохранения'),el('p','','Проект изменён в другой вкладке. Ваши правки остались в редакторе. Сохраните их отдельной копией или откройте версию из браузерного хранилища.'),status,actions);
 actions.append(button('Сохранить мою копию',perform(async()=>{const doc=model.document;doc.title=(doc.title+' — копия').slice(0,200);const id=crypto.randomUUID();await saveProject(id,doc);projectId=id;storedVersion=projectVersion(id);model=new EditorModel(doc);autosave.acknowledge();changed(id);draw();message('Ваша копия сохранена. Исходный проект не изменён.')})),button('Открыть сохранённую версию',perform(async()=>{const latest=await getProject(projectId);if(latest.deletedAt)throw new Error('Проект в корзине. Сначала восстановите его или сохраните свою копию.');model=new EditorModel(await hydrate(latest.document));storedVersion=latest.version??0;autosave.acknowledge();draw();message('Открыта сохранённая версия.')}),'af-btn af-btn--secondary'),button('Продолжить редактирование',()=>dialog.close(),'af-btn af-btn--ghost'));
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}

function historyButtons(){get<HTMLButtonElement>('undo').disabled=!model.canUndo;get<HTMLButtonElement>('redo').disabled=!model.canRedo}
function commit(edit:(d:AFDocument)=>void,success='Изменения применены.',keepProperties=false){if(lifecycle.signal.aborted)return false;const restoreFocus=captureFocus(drawer);try{model.change(edit);saveLocal();draw(keepProperties);if(!keepProperties)restoreFocus();message(success.replace('Сохранено.','Изменения применены.').replace('сохранены.','применены.'));return true}catch(e){message((e as Error).message,true);return false}}
const inlineCommit:InlineCommit=(edit,group)=>{try{model.change(edit,group);controller?.synchronize(model.document);saveLocal();historyButtons();suggestFit();return true}catch(e){message((e as Error).message,true);return false}};
function focusWidget(id:string,index:number){const changed=selected!==id||pageIndex!==index||documentMode;selected=id;pageIndex=index;documentMode=false;get<HTMLSelectElement>('pages').value=String(index);canvas.querySelectorAll<HTMLElement>(dom.widgets).forEach(b=>b.classList.toggle('is-selected',b.dataset.widgetId===id));if(changed&&!drawer.hidden){const doc=model.document;renderProperties(doc,doc.pages[index]);get('inspector-title').textContent='Настройки блока'}}
function selectWidget(id:string){if(!flush())return;documentMode=false;const index=model.document.pages.findIndex(p=>p.widgets.some(w=>w.id===id));if(index<0)return;selected=id;pageIndex=index;draw()}
function openInspector(id='',index=pageIndex){if(!flush())return;documentMode=false;selected=id;pageIndex=index;drawer.hidden=false;draw();(id?Array.from(drawer.querySelectorAll<HTMLElement>('input,textarea')).find(n=>n.getClientRects().length):drawer.querySelector<HTMLElement>('[role=tab][aria-selected=true]')??Array.from(drawer.querySelectorAll<HTMLElement>('input,textarea')).find(n=>n.getClientRects().length))?.focus({preventScroll:true})}
function closeInspector(){if(!flush())return;drawer.hidden=true;root.classList.remove('has-inspector');canvas.inert=false;drawerAccess.sync();get('page-settings-open').focus({preventScroll:true})}
function openCatalog(mode:'section'|'widget',index:number){if(!flush())return;catalogMode=mode;insertAt=index;get('catalog-theme-field').hidden=mode!=='section';if(mode==='section')drawCatalog();if(mode==='widget')pageIndex=index;get('templates').hidden=mode!=='section';get('palette').hidden=mode!=='widget';get('catalog-title').textContent=mode==='section'?'Добавить секцию':'Добавить блок';get('catalog-description').textContent=mode==='section'?'Выберите композицию. Всё содержимое можно изменить прямо на странице.':'Блок займёт свободное место в сетке выбранной секции.';catalog.showModal()}
function scrollSection(index=pageIndex){const id=model.document.pages[index]?.id;if(id)canvas.querySelector<HTMLElement>(dom.sectionById(id))?.scrollIntoView({block:'start',behavior:'instant'})}
function openPreview(){if(!flush())return;writeViewState(projectId,{section:pageIndex,device:get<HTMLSelectElement>('device').value as ViewState['device'],scroll:window.scrollY});navigate('/view/'+projectId)}
function duplicateWidget(id=selected,index=pageIndex){if(!flush())return;try{const d=model.document,copy=structuredClone(d.pages[index].widgets.find(w=>w.id===id)!);copy.id=uid();copy.position=findSpace(d,index,copy.position.width,copy.position.height);selected=copy.id;pageIndex=index;commit(doc=>doc.pages[index].widgets.push(copy),'Блок скопирован.')}catch(e){message((e as Error).message,true)}}
function removeWidget(id=selected,index=pageIndex){selected='';flush=()=>true;commit(d=>{d.pages[index].widgets=d.pages[index].widgets.filter(w=>w.id!==id)},'Блок удалён. Можно отменить действие.')}
function sectionAction(action:'copy'|'delete'|'up'|'down'|'rename',index:number){if(!flush())return;if(action==='rename'){const doc=model.document;renameSection(projectId,doc.pages[index].id,sectionDisplayName(doc.pages[index],doc.kind,index),sectionNames,()=>draw());return;}const d=model.document;if(action==='delete'&&d.pages.length===1)return;let next=index;if(action==='copy'){const p=copySection(d.pages[index]);d.pages.splice(index+1,0,p);next=index+1}else if(action==='delete'){d.pages.splice(index,1);next=Math.min(index,d.pages.length-1)}else{next=index+(action==='up'?-1:1);if(next<0||next>=d.pages.length)return;[d.pages[index],d.pages[next]]=[d.pages[next],d.pages[index]]}try{model.replace(d);pageIndex=next;selected='';saveLocal();draw();scrollSection();message('Структура обновлена.')}catch(e){message((e as Error).message,true)}}
const run=(id:string,action:()=>void|Promise<void>)=>get(id).addEventListener('click',()=>{void Promise.resolve().then(action).catch(e=>message(String(e),true))});
const symbols:Record<Widget['type'],string>={text:'T',image:'▧',metric:'24',calendar:'▦',table:'☷',button:'↗',quote:'❞',cards:'▥',gallery:'▧'};
for(const type of Object.keys(widgetRegistry) as Widget['type'][]){const b=button('',()=>{try{const w=createWidget(type,model.document,pageIndex);selected=w.id;if(commit(d=>d.pages[pageIndex].widgets.push(w),'Блок добавлен. Нажмите на текст, чтобы изменить его.')){catalog.close();scrollSection()}}catch(e){message((e as Error).message,true);get('catalog-description').textContent=(e as Error).message}},'palette-button');b.dataset.add=type;b.append(el('span','palette-icon',symbols[type]),el('strong','',widgetRegistry[type].title),el('span','af-caption','Добавить в секцию'));get('palette').append(b)}
function drawCatalog(){thumbnailControllers.splice(0).forEach(c=>c.destroy());get('templates').replaceChildren();for(const [type,title,description]of compositionCatalog(model.document.kind)){const b=button('',()=>{const section=catalogComposition(type);if(commit(d=>d.pages.splice(insertAt,0,section),'Композиция добавлена.')){pageIndex=insertAt;selected='';catalog.close();draw();scrollSection()}},'template-card');b.dataset.template=type;const visual=el('div','composition-thumbnail');visual.setAttribute('aria-hidden','true');visual.inert=true;const inner=el('div');visual.append(inner);const c=renderDocument(inner,{schemaVersion:2,kind:model.document.kind,title, pages:[catalogComposition(type)]},{editing:true});thumbnailControllers.push(c);b.append(visual,el('strong','',title),el('span','af-caption',description));get('templates').append(b)}}
const thumbnailControllers:DocumentController[]=[];
function catalogComposition(type:string){const section=makeComposition(type,model.document.kind),theme=get<HTMLSelectElement>('catalog-theme').value;if(theme!=='default'){section.appearance!.theme=theme as NonNullable<typeof section.appearance>['theme'];if(theme==='image')section.appearance!.background='../assets/brand-landscape.svg'}return section}
get('catalog-theme').addEventListener('change',drawCatalog);
const small=(title:string,action:()=>void)=>button(title,action,'context-button');
function insertion(index:number){const bar=el('div','section-insert');bar.append(button('+ Добавить секцию',()=>openCatalog('section',index),'insert-button'));return bar}

let renderedMode:boolean|undefined;const boundBoxes=new WeakSet<HTMLElement>(),boundHeadings=new WeakSet<HTMLElement>();
function draw(keepProperties=false){
  suggestFit();
  const doc=model.document;pageIndex=Math.max(0,Math.min(pageIndex,doc.pages.length-1));const active=doc.pages[pageIndex];if(!active.widgets.some(w=>w.id===selected))selected='';
  root.classList.toggle('is-preview',preview);root.classList.toggle('has-inspector',!drawer.hidden&&!preview);drawOutline(doc);get<HTMLInputElement>('project-name').value=doc.title;historyButtons();get('preview').textContent=preview?'Вернуться в редактор':'Предпросмотр';
  const picker=get<HTMLSelectElement>('pages');picker.replaceChildren();doc.pages.forEach((p,i)=>{const option=el('option','',(i+1)+'. '+(sectionNames[p.id]||sectionDisplayName(p,doc.kind,i)));option.value=String(i);picker.append(option)});picker.value=String(pageIndex);get('page-kind').textContent=doc.kind==='page'?'Секция':'Слайд';
  get('slide-actions').hidden=doc.kind!=='presentation';get<HTMLButtonElement>('delete-slide').disabled=doc.pages.length===1;get<HTMLButtonElement>('up-slide').disabled=pageIndex===0;get<HTMLButtonElement>('down-slide').disabled=pageIndex===doc.pages.length-1;
  get('page-settings-open').textContent=doc.kind==='presentation'?'Настройки слайда':'Настройки секции';get('inspector-title').textContent=selected?'Настройки блока':doc.kind==='presentation'?'Настройки слайда':'Настройки секции';
  if(!keepProperties){get<HTMLInputElement>('page-title').value=active.title;get<HTMLInputElement>('columns').value=String(active.grid.columns);get<HTMLInputElement>('row-height').value=String(active.grid.rowHeight);get<HTMLInputElement>('gap').value=String(active.grid.gap)}
  if(preview)drawer.hidden=true;
  canvas.inert=false;
  if(controller&&renderedMode===preview)controller.update(doc);else{controller?.destroy();controller=renderDocument(canvas,doc,{editing:!preview});renderedMode=preview}if(doc.kind==='presentation')controller.goToSlide(pageIndex);
  get('end-add').replaceChildren();if(!preview&&doc.kind==='page')get('end-add').append(insertion(doc.pages.length));
  if(!preview){
    canvas.querySelectorAll('.section-insert,.section-tools,.canvas-empty').forEach(n=>n.remove());const shells=canvas.querySelectorAll<HTMLElement>(dom.sections);
    shells.forEach(shell=>{
      const index=doc.pages.findIndex(p=>p.id===shell.dataset.sectionId),page=doc.pages[index],panel=shell.querySelector<HTMLElement>(dom.panel)!;
      if(doc.kind==='page')shell.before(insertion(index));
      const tools=el('div','section-tools');tools.setAttribute('aria-label','Действия секции '+(index+1));
      tools.append(el('span','section-number',String(index+1).padStart(2,'0')),small('+ Блок',()=>openCatalog('widget',index)),small('Настройки секции',()=>openInspector('',index)),small('Копия секции',()=>sectionAction('copy',index)),small('Название в структуре',()=>sectionAction('rename',index)));
      for(const [action,label]of [['up','↑'],['down','↓'],['delete','Удалить секцию']] as const){const b=small(label,()=>sectionAction(action,index));b.setAttribute('aria-label',action==='up'?'Поднять секцию':action==='down'?'Опустить секцию':label);b.disabled=action==='up'?index===0:action==='down'?index===doc.pages.length-1:doc.pages.length===1;tools.append(b)}shell.prepend(tools);
      const heading=shell.querySelector<HTMLElement>(dom.heading);if(heading&&!boundHeadings.has(heading)){boundHeadings.add(heading);editable(heading,'Заголовок секции на странице',(d,t)=>d.pages[index].title=t,inlineCommit,()=>{pageIndex=index;get<HTMLSelectElement>('pages').value=String(index)},false);}
      for(const box of panel.querySelectorAll<HTMLElement>(dom.widgets)){
        const w=page.widgets.find(w=>w.id===box.dataset.widgetId)!;box.tabIndex=0;box.setAttribute('role','group');box.setAttribute('aria-label','Блок: '+(w.title||widgetRegistry[w.type].title));box.classList.toggle('is-selected',w.id===selected);if(boundBoxes.has(box))continue;boundBoxes.add(box);
        // Renderer owns initial grid placement; do not override its mobile rules.
        const content=box.querySelector<HTMLElement>(dom.content)!;content.removeAttribute('tabindex');if(content.getAttribute('role')==='region')content.removeAttribute('role');content.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{if(w.type!=='button')b.disabled=true;b.tabIndex=-1});
        bindInline(box,w,index,inlineCommit,()=>focusWidget(w.id,index));
        const bar=el('div','widget-tools');bar.style.left=w.position.col>page.grid.columns/2?'auto':'0';bar.style.right=w.position.col>page.grid.columns/2?'0':'auto';bar.append(small('Настройки блока',()=>openInspector(w.id,index)),small('Копия',()=>duplicateWidget(w.id,index)),small('Удалить',()=>removeWidget(w.id,index)));box.append(bar);
        if(w.type==='image'){const change=small('Заменить изображение',()=>openInspector(w.id,index));change.classList.add('image-change');box.append(change)}
        box.addEventListener('click',e=>{if((e.target as HTMLElement).closest('button,[contenteditable]'))return;e.preventDefault();selectWidget(w.id)});
        box.addEventListener('keydown',e=>{if(e.target===box&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openInspector(w.id,index)}});
        {const move=button('↕',()=>{},'widget-handle move-handle'),resize=button('↘',()=>{},'widget-handle resize-handle');move.setAttribute('aria-label','Переместить блок');resize.setAttribute('aria-label','Изменить размер блока');box.append(move,resize);attachHandle(move,w,false,panel,index);attachHandle(resize,w,true,panel,index)}
      }
      if(!page.widgets.length){const empty=el('div','canvas-empty');empty.append(el('h2','','Начните с первого блока'),el('p','','Добавьте текст, изображение, таблицу или готовую секцию.'),button('+ Добавить блок',()=>openCatalog('widget',index),'af-btn'));panel.append(empty)}
    });
  }
  renderProperties(doc,active,keepProperties);
  drawerAccess.sync();
}
function renderProperties(doc:AFDocument,active:AFDocument['pages'][number],keepProperties=false){
  if(documentMode&&!preview){drawDocumentProperties(doc);return}
  get('design-settings').hidden=!!selected||preview;
  if(!keepProperties&&!selected)sectionDesign(get('design-settings'),doc,pageIndex,edit=>commit(edit,'Настройки сохранены.'),{fit:()=>fitCurrent(false),fitAll:()=>fitCurrent(true),editWidget:id=>openInspector(id,pageIndex),addTemplate:()=>openCatalog('section',pageIndex+1),preview:openPreview});
  if(keepProperties)return;
  draftState='valid';paintSaveState();flush=()=>true;const w=active.widgets.find(w=>w.id===selected);(drawer.querySelector('.page-settings') as HTMLElement).hidden=!!w||doc.kind==='presentation';
  if(w&&!preview)flush=properties(inspector,w,{document:doc,columns:active.grid.columns,apply:next=>commit(d=>{const i=d.pages[pageIndex].widgets.findIndex(x=>x.id===next.id);d.pages[pageIndex].widgets[i]=structuredClone(next)},'Сохранено.',true),remove:()=>removeWidget(),duplicate:()=>duplicateWidget(),error:t=>message(t,true),errorMessage:()=>get('status').textContent??'',settled:valid=>{draftState=valid?'valid':'invalid';paintSaveState();if(valid)message(lastSaveStatus==='Сохранено в браузере'?'Сохранено.':'Изменения применены.')},pending:()=>{draftState='pending';paintSaveState()}});
  else {disposeControls(inspector);inspector.replaceChildren(...(doc.kind==='presentation'?[]:[el('p','af-help','Сетка действует внутри этой секции. Изменения видны сразу.')]));}
}

function attachHandle(handle:HTMLButtonElement,widget:Widget,resizing:boolean,panel:HTMLElement,index:number){
  const update=(position:Widget['position'])=>commit(d=>{d.pages[index].widgets.find(w=>w.id===widget.id)!.position=position},resizing?'Размер блока изменён.':'Блок перемещён.');
  const focus=()=>canvas.querySelector<HTMLElement>(dom.widgetById(widget.id))?.querySelector<HTMLButtonElement>(resizing?'.resize-handle':'.move-handle')?.focus({preventScroll:true});
  handle.addEventListener('keydown',e=>{const delta=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[e.key];if(!delta)return;e.preventDefault();if(!flush())return;selected=widget.id;pageIndex=index;const p={...model.document.pages[index].widgets.find(w=>w.id===widget.id)!.position};if(resizing){p.width+=delta[0];p.height+=delta[1]}else{p.col+=delta[0];p.row+=delta[1]}update(p);focus()});
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();
    // Apply drafts before acquiring pointer capture; applying redraws the handles.
    if(!flush()||!handle.isConnected)return;selected=widget.id;pageIndex=index;panel.classList.add('is-positioning');
    const start={x:e.clientX,y:e.clientY},g=model.document.pages[index].grid,bounds=panel.getBoundingClientRect(),scale=bounds.width/panel.offsetWidth;
    const stepX=(panel.clientWidth+g.gap)/g.columns*scale,stepY=(g.rowHeight+g.gap)*scale;
    const flow=model.document.pages[index].appearance?.layout==='flow';
    const tracks=getComputedStyle(panel).gridTemplateRows.split(' ').map(parseFloat).filter(Number.isFinite),starts=[0];tracks.forEach(h=>starts.push(starts.at(-1)!+h+g.gap));
    const lineAt=(px:number)=>{if(!flow)return Math.max(1,Math.round(px/(g.rowHeight+g.gap))+1);if(px>=starts.at(-1)!)return starts.length+Math.round((px-starts.at(-1)!)/(24+g.gap));let best=0;starts.forEach((v,i)=>{if(Math.abs(v-px)<Math.abs(starts[best]-px))best=i});return best+1};
    const box=handle.closest<HTMLElement>(dom.widgets)!;let position={...widget.position},moved=false;
    handle.setPointerCapture(e.pointerId);
    const abort=new AbortController();lifecycle.signal.addEventListener('abort',()=>abort.abort(),{once:true});
    const cancel=()=>{abort.abort();draw();focus()};
    handle.addEventListener('pointermove',event=>{
      const dx=Math.round((event.clientX-start.x)/stepX),dy=Math.round((event.clientY-start.y)/stepY);moved=dx!==0||dy!==0;position={...widget.position};
      const startLine=resizing?widget.position.row+widget.position.height-1:widget.position.row-1;
      const flowRow=lineAt((starts[startLine]??startLine*(24+g.gap))+(event.clientY-start.y)/scale);
      if(resizing){position.width=Math.max(widgetRegistry[widget.type].minWidth,Math.min(g.columns-position.col+1,position.width+dx));position.height=Math.max(widgetRegistry[widget.type].minHeight,Math.min(100,position.height+dy))}else{position.col=Math.max(1,Math.min(g.columns-position.width+1,position.col+dx));position.row=Math.max(1,Math.min(1000,position.row+dy))}
      if(flow){if(resizing)position.height=Math.max(widgetRegistry[widget.type].minHeight,Math.min(100,flowRow-position.row));else position.row=Math.max(1,Math.min(1000,flowRow));moved=position.col!==widget.position.col||position.row!==widget.position.row||position.width!==widget.position.width||position.height!==widget.position.height;}
      box.style.setProperty('grid-column',`${position.col} / span ${position.width}`,'important');box.style.setProperty('grid-row',`${position.row} / span ${position.height}`,'important');
      const d=model.document;d.pages[index].widgets.find(w=>w.id===widget.id)!.position=position;try{checked(d);box.classList.remove('invalid-position')}catch{box.classList.add('invalid-position')}
    },{signal:abort.signal});
    handle.addEventListener('pointerup',()=>{abort.abort();if(moved){if(!update(position))draw()}else draw();focus()},{signal:abort.signal});
    handle.addEventListener('pointercancel',cancel,{signal:abort.signal});
    handle.addEventListener('lostpointercapture',cancel,{signal:abort.signal});
    window.addEventListener('keydown',event=>{if(event.key==='Escape')cancel()},{signal:abort.signal});
  });
}

run('undo',()=>{flush=()=>true;if(model.undo()){saveLocal();draw();message('Действие отменено.')}});
run('redo',()=>{flush=()=>true;if(model.redo()){saveLocal();draw();message('Действие повторено.')}});
run('add-widget',()=>openCatalog('widget',pageIndex));run('page-settings-open',()=>openInspector());run('slide-settings-open',()=>openInspector());run('close-inspector',closeInspector);
run('close-catalog',()=>catalog.close());catalog.addEventListener('close',()=>{thumbnailControllers.splice(0).forEach(c=>c.destroy());get('templates').replaceChildren();get('add-widget').focus({preventScroll:true})},{signal:lifecycle.signal});
for(const [id,kind]of [['new-page','page'],['new-deck','presentation']] as const)run(id,async()=>{if(!flush())return;await startProject();model=new EditorModel(emptyDocument(kind));pageIndex=0;selected='';preview=false;drawer.hidden=true;(root.querySelector('.project-menu') as HTMLDetailsElement).open=false;saveLocal();draw();message('Новый документ. Добавьте блок или секцию.');});
get<HTMLInputElement>('project-name').addEventListener('change',e=>{const value=(e.target as HTMLInputElement).value;if(!flush()||!commit(d=>d.title=value.trim()))get<HTMLInputElement>('project-name').value=model.document.title});
get<HTMLSelectElement>('pages').addEventListener('change',e=>{const next=Number((e.target as HTMLSelectElement).value);if(!flush())return;pageIndex=next;selected='';documentMode=false;draw();scrollSection()});
const updateSettings=()=>{const title=get<HTMLInputElement>('page-title').value,columns=Number(get<HTMLInputElement>('columns').value),rowHeight=Number(get<HTMLInputElement>('row-height').value),gap=Number(get<HTMLInputElement>('gap').value);return commit(d=>{d.pages[pageIndex].title=title;d.pages[pageIndex].grid={columns,rowHeight,gap}},'Настройки секции сохранены.',true)};
get<HTMLFormElement>('settings').addEventListener('submit',e=>{e.preventDefault();updateSettings()});
get('settings').addEventListener('change',()=>{if(get<HTMLFormElement>('settings').checkValidity())updateSettings()});
run('add-slide',()=>openCatalog('section',pageIndex+1));
run('copy-slide',()=>sectionAction('copy',pageIndex));run('delete-slide',()=>sectionAction('delete',pageIndex));run('up-slide',()=>sectionAction('up',pageIndex));run('down-slide',()=>sectionAction('down',pageIndex));
run('preview',openPreview);
run('save',async()=>{if(!flush())return;const control=get<HTMLButtonElement>('save');control.disabled=true;try{download(projectFilename(model.document.title,'json'),JSON.stringify(await portableProject(model.document),null,2),'application/json');message('Проект скачан.')}catch(e){message('Не удалось подготовить проект: '+String(e),true)}finally{control.disabled=false}});
get<HTMLInputElement>('open').addEventListener('change',async e=>{try{const parsed=await readProjectFile(e.target as HTMLInputElement);if(!parsed||!flush())return;await startProject();model=new EditorModel(parsed);pageIndex=0;selected='';preview=false;drawer.hidden=true;(root.querySelector('.project-menu') as HTMLDetailsElement).open=false;saveLocal();draw();message('Проект открыт.')}catch(error){message('Не удалось открыть проект. '+(error as Error).message,true)}});
run('export',async()=>{if(!flush())return;const control=get<HTMLButtonElement>('export');control.disabled=true;message('Подготовка HTML…');try{await downloadEditorHTML(model.document);message('HTML скачан. Внешние изображения по HTTP(S) требуют сети.')}catch(e){message((e as Error).message,true)}finally{control.disabled=false}});
bindEditorShortcuts(lifecycle.signal,{close:()=>{if(drawer.hidden)return false;closeInspector();return true},undo:()=>get('undo').click(),redo:()=>get('redo').click(),save:()=>{if(document.activeElement instanceof HTMLElement&&root.contains(document.activeElement))document.activeElement.blur();get('save').click()}});
for(const [id,kind]of [['demo-page','page'],['demo-deck','presentation']] as const)run(id,async()=>{if(!flush())return;await startProject();model=new EditorModel(showcase(kind));pageIndex=0;selected='';preview=false;drawer.hidden=true;(root.querySelector('.project-menu') as HTMLDetailsElement).open=false;saveLocal();draw();message('Создан отдельный проект из эталона. Предыдущий доступен в «Мои проекты».')});
get<HTMLSelectElement>('device').addEventListener('change',e=>{canvas.dataset.device=(e.target as HTMLSelectElement).value;zoomControls.reset()});
run('play-motion',openPreview);
function drawDocumentProperties(doc:AFDocument){
 get('inspector-title').textContent='Настройки документа';get('design-settings').hidden=true;(drawer.querySelector('.page-settings') as HTMLElement).hidden=true;disposeControls(inspector);inspector.replaceChildren();flush=()=>true;draftState='valid';paintSaveState();
 const label=el('label','af-field'),name=el('input','af-input');name.id='document-properties-name';name.value=doc.title;name.maxLength=200;name.required=true;label.append(el('span','af-label','Название документа'),name);name.addEventListener('change',()=>{if(!commit(d=>d.title=name.value.trim()))name.value=model.document.title});
 inspector.append(label,el('p','af-help',`${doc.kind==='presentation'?'Презентация 16:9':'Адаптивный сайт'} · ${doc.pages.length} ${doc.kind==='presentation'?'слайдов':'секций'} · схема 3`),el('p','af-help','Проект и материалы сохраняются в этом браузере. Для резервной копии скачайте переносимый файл.'),button('Мои проекты',()=>void autosave.queue.then(()=>navigate('/projects'))),button('История версий',()=>void autosave.queue.then(()=>projectDialog(projectId,model.document,switchProject,true))),button('Скачать проект',()=>get('save').click()));
}
canvas.addEventListener('pointerdown',e=>{if(!drawer.hidden&&(e.target as HTMLElement).closest('[contenteditable]')&&!flush())e.preventDefault()},{capture:true});
root.querySelector('.editor-file-actions')!.prepend(button('Документ',()=>{if(!flush())return;documentMode=true;selected='';drawer.hidden=false;draw();get('document-properties-name').focus({preventScroll:true})},'af-btn af-btn--ghost af-btn--sm document-settings-open'));
async function startProject(){const id=projectId,doc=model.document;lastSaveStatus='Сохраняем…';paintSaveState();root.inert=true;message('Сохраняем текущую версию…');try{await autosave.queue;if(autosave.error)throw new Error(lastSaveStatus);await saveRevision(id,doc);projectId=crypto.randomUUID();storedVersion=0;sectionNames={}}catch(e){lastSaveStatus=autosave.error?'Не сохранено':'Сохранено в браузере';paintSaveState();throw e}finally{root.inert=false}}
const updateOutline=createOutline(root,index=>{if(!flush())return;documentMode=false;pageIndex=index;selected='';draw();scrollSection()},sectionAction,(from,to)=>{if(!flush())return;commit(d=>{const [p]=d.pages.splice(from,1);d.pages.splice(to,0,p)});pageIndex=to;draw()},()=>openCatalog('section',model.document.pages.length),id=>sectionNames[id]);
function drawOutline(doc:AFDocument){if(!preview)updateOutline(doc,pageIndex)}
root.querySelector('.editor-file-actions')!.append(button('Повторить показ',()=>get('play-motion').click(),'af-btn af-btn--secondary af-btn--sm replay-current'));
const zoomControls=createZoomControls(canvas);
root.querySelector('.canvas-toolbar')!.append(zoomControls.bar,button('Проверка качества',()=>qualityDialog(model.document,canvas,issue=>{openInspector(issue.widget??'',issue.section);scrollSection(issue.section)}),'af-btn af-btn--ghost af-btn--sm quality-open'));
const menu=root.querySelector('.project-menu > div')!;menu.append(button('Хранилище и материалы',storageDialog));
const switchProject=(id:string,doc:AFDocument)=>{flush=()=>true;if(projectId===id)model.replace(doc);else model=new EditorModel(doc);projectId=id;storedVersion=projectVersion(id);sectionNames={};void loadSectionNames(id).then(names=>{if(projectId===id){sectionNames=names;draw()}}).catch(e=>message(String(e),true));pageIndex=0;selected='';preview=false;saveLocal();draw()};
menu.append(button('Создать версию',async()=>{if(!flush())return;await autosave.queue;if(autosave.error){message('Сначала сохраните проект или разрешите конфликт.',true);return}try{await saveRevision(projectId,model.document);message('Точка восстановления создана.')}catch(e){message(String(e),true)}}));
menu.prepend(button('Мои проекты',()=>{if(flush())void autosave.queue.then(()=>navigate('/projects'))}),button('История версий',()=>{if(flush())void autosave.queue.then(()=>projectDialog(projectId,model.document,switchProject,true))}));
canvas.dataset.device=readViewState(projectId)?.device??'desktop';get<HTMLSelectElement>('device').value=canvas.dataset.device;draw();message(initialMessage);
root.querySelector('.editor-file-actions')!.prepend(button('Создать с ИИ',async()=>{
 if(!flush())return;
 try{await openAI({projectId,anchorId:model.document.pages[pageIndex].id,kind:model.document.kind},async draft=>{
  if(!flush())throw new Error('Сначала исправьте настройки текущего проекта.');
  if(draft.request.scope==='section'){
   if(projectId!==draft.projectId)throw new Error('Текущий проект изменился. Выберите место вставки заново.');
   await autosave.queue;const next=insertDraft(model.document,draftDocument(draft).pages,draft.anchorId,draft.request.kind);
   await writeCurrent(projectId,next);model.replace(next);pageIndex=next.pages.findIndex(p=>p.id===draft.anchorId)+1;selected='';lastSaveStatus='Сохранено в браузере';paintSaveState();draw();scrollSection();message('Черновик добавлен. Можно отменить одним действием.');
  }else{
   await autosave.queue;await saveRevision(projectId,model.document);const next=draftDocument(draft),id=crypto.randomUUID();await saveProject(id,next,draft.id);switchProject(id,next);message('Создан отдельный проект из черновика ИИ.');
  }
 })}catch(e){message(String(e),true)}
},'af-btn af-btn--secondary af-btn--sm ai-open'));
const back=button('← Проекты',()=>navigate('/projects'),'af-btn af-btn--ghost');
root.querySelector('.editor-brand')!.replaceWith(back);
const retry=button('Повторить сохранение',()=>saveLocal(),'af-btn af-btn--ghost af-btn--sm');retry.classList.add('retry-save');get('save-state').after(retry);
root.querySelector('.canvas-toolbar')!.prepend(button('Структура',()=>{drawer.hidden=true;root.classList.remove('has-inspector');root.classList.toggle('outline-open')},'af-btn af-btn--ghost outline-toggle'));
const toolbar=root.querySelector('.canvas-toolbar')!;
for(const selector of ['.document-settings-open','.ai-open','#add-widget','#page-settings-open'])toolbar.append(root.querySelector(selector)!);
get('slide-settings-open').hidden=true;
get('save-state').classList.add('header-save-state');root.querySelector('.document-name')!.after(get('save-state'));
const gridDetails=el('details','advanced-grid');gridDetails.append(el('summary','','Дополнительно: сетка'),get('settings').querySelector('.settings-grid')!);get('settings').append(gridDetails);
const showLearning=tutorial(root.querySelector('.editor-workspace')!,projectId,learning,step=>{
 if(!flush())return;
 const doc=model.document;const current=doc.pages[pageIndex];
 if(step===1){openInspector('',pageIndex);return}
 if(step===4){get('preview').click();return}
 const desired=step===2?'image':'text';const index=current.widgets.some(w=>w.type===desired)?pageIndex:doc.pages.findIndex(p=>p.widgets.some(w=>w.type===desired));
 if(index<0){get('add-widget').click();return}
 const w=doc.pages[index].widgets.find(w=>w.type===desired)!;openInspector(w.id,index);scrollSection(index);
 if(step===0)canvas.querySelector<HTMLElement>(dom.editableWidget(w.id))?.focus();
});
menu.append(button('Пять действий для знакомства',showLearning));
compactToolbar(root,lifecycle.signal);const returnScroll=readViewState(projectId)?.scroll;if(returnScroll)void document.fonts.ready.then(()=>{if(!lifecycle.signal.aborted)window.scrollTo(0,returnScroll)});
if(learning?.enabled){scrollSection(pageIndex);if(learning.section)openInspector(model.document.pages[pageIndex].widgets[0]?.id??'',pageIndex)}
window.addEventListener('beforeunload',e=>{if(autosave.error||lastSaveStatus==='Сохраняем…'||draftState!=='valid'){e.preventDefault();e.returnValue=''}},{signal:lifecycle.signal});
return {
 async beforeLeave(){if(document.activeElement instanceof HTMLElement&&root.contains(document.activeElement))document.activeElement.blur();if(!flush())return false;for(const form of drawer.querySelectorAll<HTMLFormElement>('form[data-grid-draft][data-dirty=true]')){if(!form.reportValidity())return false;form.requestSubmit();if(form.dataset.applied!=='true')return false;}const title=get<HTMLInputElement>('project-name').value.trim();if(title!==model.document.title&&!commit(d=>d.title=title))return false;if(!drawer.hidden&&!selected&&!documentMode&&model.document.kind==='page'){if(!get<HTMLFormElement>('settings').reportValidity())return false;const p=model.document.pages[pageIndex];if(get<HTMLInputElement>('page-title').value!==p.title||Number(get<HTMLInputElement>('columns').value)!==p.grid.columns||Number(get<HTMLInputElement>('row-height').value)!==p.grid.rowHeight||Number(get<HTMLInputElement>('gap').value)!==p.grid.gap){if(!updateSettings())return false}}root.inert=true;try{await autosave.queue;if(autosave.error){message('Не удалось сохранить. Повторите запись или скачайте проект.',true);return false}try{await saveRevision(projectId,model.document)}catch(e){message(String(e),true);return false}return true}finally{root.inert=false}},
 destroy(){disposeControls(root);lifecycle.abort();autosave.destroy();clearTimeout(fitHintTimer);controller?.destroy();thumbnailControllers.forEach(c=>c.destroy());updateOutline.destroy();document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>{d.close();d.remove()});root.replaceChildren();root.className=''}
};

}
// void boot().catch(e=>{document.querySelector('#builder')!.textContent='Не удалось запустить редактор: '+String(e)});
