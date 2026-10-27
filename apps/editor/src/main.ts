import {showDialog,libraryDialog,el,button,iconButton,invocationTarget} from './ui';
import {compositionPreview} from './composition-preview';
import {editorMarkup} from './editor-shell';
import {editorCommands,labelEditorCommands} from './editor-commands';
import {canvasAffordances} from './canvas-affordances';
import {bindWidgetHandle} from './widget-handles';
import {widgetLayout} from './widget-layout';
import {inspectorLayout} from './inspector-layout';
import {compactToolbar} from './toolbar';
import {loadSectionNames,renameSection} from './section-labels';
import {storageDialog} from './storage-dialog';
import {mountControls,disposeControls} from './component-lifecycle';
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

export async function mountEditor(root:HTMLElement,projectId:string,initial:AFDocument,navigate:(route:string)=>void,changed:(id:string)=>void,initialVersion=projectVersion(projectId),beforeMount:()=>void=()=>{}){
const lifecycle=new AbortController();
let storedVersion=initialVersion;
const learning=await tutorialState(projectId);let sectionNames=await loadSectionNames(projectId);
const initialMessage='';
function fitCurrent(all:boolean){if(!flush())return;openSlideFit(()=>({id:projectId,document:model.document}),pageIndex,doc=>commit(d=>{d.pages=doc.pages}),all)}
let model=new EditorModel(initial);let pageIndex=Math.min(readViewState(projectId)?.section??learning?.section??0,initial.pages.length-1),selected='',preview=false,documentMode=false,controller:DocumentController|undefined,flush=()=>true,catalogMode:'section'|'widget'='widget',insertAt=0;

// Keep the outgoing surface intact through all asynchronous preparation.
beforeMount();root.className='';root.innerHTML=editorMarkup;
const get=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=get('canvas'),inspector=get('properties'),drawer=get('inspector'),catalog=get<HTMLDialogElement>('catalog');
const drawerAccess=responsiveDrawer(root,drawer,closeInspector,lifecycle.signal);
inspectorLayout(drawer,lifecycle.signal);canvasAffordances(canvas,lifecycle.signal);
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
 const {dialog,body}=libraryDialog('Конфликт сохранения','product-dialog save-conflict'),status=el('p');status.setAttribute('role','status');let resolving=false;
 const actions=el('div','af-dialog__actions library-dialog-actions save-conflict-actions');
 dialog.addEventListener('cancel',e=>{if(resolving)e.preventDefault()});
 const perform=(work:()=>Promise<void>)=>async()=>{if(resolving)return;resolving=true;const trigger=invocationTarget(),controls=dialog.querySelectorAll('button');controls.forEach(b=>b.disabled=true);status.setAttribute('role','status');status.textContent='Выполняем выбранное действие…';try{await autosave.queue;await work();dialog.close()}catch(e){status.setAttribute('role','alert');status.textContent=(e as Error).message}finally{resolving=false;controls.forEach(b=>b.disabled=false);if(dialog.open)trigger?.focus({preventScroll:true})}};
 body.append(el('p','','Проект изменён в другой вкладке. Ваши правки остались в редакторе. Сохраните их отдельной копией или откройте версию из браузерного хранилища.'),status);dialog.append(actions);
 actions.append(button('Сохранить мою копию',perform(async()=>{const doc=model.document,suffix=' — копия';doc.title=doc.title.slice(0,200-suffix.length)+suffix;const id=crypto.randomUUID();await saveProject(id,doc);projectId=id;storedVersion=projectVersion(id);model=new EditorModel(doc);autosave.acknowledge();changed(id);draw();message('Ваша копия сохранена. Исходный проект не изменён.')}),'af-btn'),button('Открыть сохранённую версию',perform(async()=>{const latest=await getProject(projectId);if(latest.deletedAt)throw new Error('Проект в корзине. Сначала восстановите его или сохраните свою копию.');model=new EditorModel(await hydrate(latest.document));storedVersion=latest.version??0;autosave.acknowledge();draw();message('Открыта сохранённая версия.')}),'af-btn af-btn--secondary'),button('Продолжить редактирование',()=>dialog.close(),'af-btn af-btn--ghost'));
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());showDialog(dialog);
}

function historyButtons(){get<HTMLButtonElement>('undo').disabled=!model.canUndo;get<HTMLButtonElement>('redo').disabled=!model.canRedo}
function commit(edit:(d:AFDocument)=>void,success='Изменения применены.',keepProperties=false){if(lifecycle.signal.aborted)return false;const restoreFocus=captureFocus(drawer);try{model.change(edit);saveLocal();preserveWidgetViewport(()=>{draw(keepProperties);if(!keepProperties)restoreFocus()});message(success.replace('Сохранено.','Изменения применены.').replace('сохранены.','применены.'));return true}catch(e){message((e as Error).message,true);return false}}
let inlinePropertiesFrame=0;
lifecycle.signal.addEventListener('abort',()=>cancelAnimationFrame(inlinePropertiesFrame),{once:true});
const inlineCommit:InlineCommit=(edit,group)=>{try{model.change(edit,group);controller?.synchronize(model.document);renderedSignature=JSON.stringify(model.document);saveLocal();historyButtons();suggestFit();
 cancelAnimationFrame(inlinePropertiesFrame);inlinePropertiesFrame=requestAnimationFrame(()=>{
  if(drawer.hidden||draftState!=='valid'||drawer.contains(document.activeElement))return;
  const body=drawer.querySelector<HTMLElement>('.inspector-body')!,scroll=body.scrollTop,opened=new Map(Array.from(inspector.querySelectorAll('details')).map(group=>[group.querySelector('summary')?.textContent,group.open]));
  renderProperties(model.document,model.document.pages[pageIndex]);
  inspector.querySelectorAll('details').forEach(group=>{const value=opened.get(group.querySelector('summary')?.textContent);if(value!==undefined)group.open=value});body.scrollTop=scroll;
 });return true}catch(e){message((e as Error).message,true);return false}};
function focusWidget(id:string,index:number){const changed=selected!==id||pageIndex!==index||documentMode;selected=id;pageIndex=index;documentMode=false;get<HTMLSelectElement>('pages').value=String(index);canvas.querySelectorAll<HTMLElement>(dom.widgets).forEach(b=>b.classList.toggle('is-selected',b.dataset.widgetId===id));if(changed&&!drawer.hidden){const doc=model.document;renderProperties(doc,doc.pages[index]);drawer.querySelector('.inspector-body')!.scrollTop=0;get('inspector-title').textContent='Настройки блока'}}
let viewportFrame=0;
lifecycle.signal.addEventListener('abort',()=>cancelAnimationFrame(viewportFrame),{once:true});
for(const type of ['wheel','touchmove','pointerdown','keydown'])window.addEventListener(type,()=>cancelAnimationFrame(viewportFrame),{capture:true,passive:true,signal:lifecycle.signal});
function preserveWidgetViewport(work:()=>void){
 cancelAnimationFrame(viewportFrame);
 const id=selected,box=id?canvas.querySelector<HTMLElement>(dom.widgetById(id)):null,rect=box?.getBoundingClientRect();
 const visible=rect&&rect.bottom>0&&rect.top<innerHeight;
 work();
 if(visible){
  const restore=()=>{const current=canvas.querySelector<HTMLElement>(dom.widgetById(id));if(current)window.scrollBy({top:current.getBoundingClientRect().top-rect.top,behavior:'instant'})};
  restore();
  // Flow widgets are reordered by the Framework ResizeObserver. WebKit can
  // scroll a focused widget while it is reinserted; restore after that layout.
  viewportFrame=requestAnimationFrame(()=>{viewportFrame=requestAnimationFrame(restore)});
 }
}
function selectWidget(id:string){if(!flush())return;documentMode=false;const index=model.document.pages.findIndex(p=>p.widgets.some(w=>w.id===id));if(index<0)return;selected=id;pageIndex=index;preserveWidgetViewport(()=>draw())}
let inspectorTrigger:HTMLElement|undefined;
function rememberInspectorTrigger(){const trigger=invocationTarget();if(trigger&&!drawer.contains(trigger))inspectorTrigger=trigger}
function openInspector(id='',index=pageIndex){if(!flush())return;rememberInspectorTrigger();root.classList.remove('outline-open');documentMode=false;selected=id;pageIndex=index;preserveWidgetViewport(()=>{drawer.hidden=false;draw()});drawer.querySelector('.inspector-body')!.scrollTop=0;(id?Array.from(drawer.querySelectorAll<HTMLElement>('input,textarea')).find(n=>n.getClientRects().length):drawer.querySelector<HTMLElement>('[role=tab][aria-selected=true]')??Array.from(drawer.querySelectorAll<HTMLElement>('input,textarea')).find(n=>n.getClientRects().length))?.focus({preventScroll:true})}
function closeInspector(){if(!flush())return;preserveWidgetViewport(()=>{drawer.hidden=true;root.classList.remove('has-inspector')});canvas.inert=false;drawerAccess.sync();(inspectorTrigger?.isConnected&&inspectorTrigger.getClientRects().length?inspectorTrigger:canvas.querySelector<HTMLElement>('.af-widget.is-selected')??get('page-settings-open')).focus({preventScroll:true})}
function openCatalog(mode:'section'|'widget',index:number){if(!flush())return;catalogMode=mode;insertAt=index;get('catalog-theme-field').hidden=mode!=='section';if(mode==='section')drawCatalog();if(mode==='widget')pageIndex=index;get('templates').hidden=mode!=='section';get('palette').hidden=mode!=='widget';get('catalog-title').textContent=mode==='section'?'Добавить секцию':'Добавить блок';get('catalog-description').textContent=mode==='section'?'Выберите композицию. Всё содержимое можно изменить прямо на странице.':'Блок займёт свободное место в сетке выбранной секции.';showDialog(catalog)}
function scrollSection(index=pageIndex){const id=model.document.pages[index]?.id;if(id)canvas.querySelector<HTMLElement>(dom.sectionById(id))?.scrollIntoView({block:'start',behavior:'instant'})}
function openPreview(){if(!flush())return;writeViewState(projectId,{section:pageIndex,device:get<HTMLSelectElement>('device').value as ViewState['device'],scroll:window.scrollY});navigate('/view/'+projectId)}
function duplicateWidget(id=selected,index=pageIndex){if(!flush())return;try{const d=model.document,copy=structuredClone(d.pages[index].widgets.find(w=>w.id===id)!);copy.id=uid();copy.position=findSpace(d,index,copy.position.width,copy.position.height);selected=copy.id;pageIndex=index;commit(doc=>doc.pages[index].widgets.push(copy),'Блок скопирован.')}catch(e){message((e as Error).message,true)}}
function removeWidget(id=selected,index=pageIndex){selected='';flush=()=>true;commit(d=>{d.pages[index].widgets=d.pages[index].widgets.filter(w=>w.id!==id)},'Блок удалён. Можно отменить действие.')}
function sectionAction(action:'copy'|'delete'|'up'|'down'|'rename',index:number){if(!flush())return;if(action==='rename'){const doc=model.document;renameSection(projectId,doc.pages[index].id,sectionDisplayName(doc.pages[index],doc.kind,index),sectionNames,()=>draw());return;}const d=model.document;if(action==='delete'&&d.pages.length===1)return;let next=index;if(action==='copy'){const p=copySection(d.pages[index]);d.pages.splice(index+1,0,p);next=index+1}else if(action==='delete'){d.pages.splice(index,1);next=Math.min(index,d.pages.length-1)}else{next=index+(action==='up'?-1:1);if(next<0||next>=d.pages.length)return;[d.pages[index],d.pages[next]]=[d.pages[next],d.pages[index]]}try{model.replace(d);pageIndex=next;selected='';saveLocal();draw();scrollSection();message('Структура обновлена.')}catch(e){message((e as Error).message,true)}}
const commands=editorCommands(root,lifecycle.signal,text=>message(text,true));
const run=commands.bind;
const symbols:Record<Widget['type'],string>={text:'T',image:'▧',metric:'24',calendar:'▦',table:'☷',button:'↗',quote:'❞',cards:'▥',gallery:'▧'};
for(const type of Object.keys(widgetRegistry) as Widget['type'][]){const b=button('',()=>{try{const w=createWidget(type,model.document,pageIndex);selected=w.id;if(commit(d=>d.pages[pageIndex].widgets.push(w),'Блок добавлен. Нажмите на текст, чтобы изменить его.')){catalog.close();scrollSection()}}catch(e){message((e as Error).message,true);get('catalog-description').textContent=(e as Error).message}},'palette-button');b.dataset.add=type;const icon=el('span','palette-icon',symbols[type]);icon.setAttribute('aria-hidden','true');b.append(icon,el('strong','',widgetRegistry[type].title),el('span','','Добавить в секцию'));get('palette').append(b)}
function drawCatalog(){thumbnailControllers.splice(0).forEach(c=>c.destroy());get('templates').replaceChildren();for(const [type,title,description]of compositionCatalog(model.document.kind)){const b=button('',()=>{const section=catalogComposition(type);if(commit(d=>d.pages.splice(insertAt,0,section),'Композиция добавлена.')){pageIndex=insertAt;selected='';catalog.close();draw();scrollSection()}},'template-card');b.dataset.template=type;const visual=el('div','composition-thumbnail');const c=compositionPreview(visual,{schemaVersion:2,kind:model.document.kind,title,pages:[catalogComposition(type)]});thumbnailControllers.push(c);b.append(visual,el('strong','',title),el('span','',description));get('templates').append(b)}}
const thumbnailControllers:DocumentController[]=[];
function catalogComposition(type:string){const section=makeComposition(type,model.document.kind),theme=get<HTMLSelectElement>('catalog-theme').value;if(theme!=='default'){section.appearance!.theme=theme as NonNullable<typeof section.appearance>['theme'];if(theme==='image')section.appearance!.background='../assets/brand-landscape.svg'}return section}
get('catalog-theme').addEventListener('change',drawCatalog);
const small=(title:string,action:()=>void)=>button(title,action,'af-btn af-btn--ghost af-btn--sm context-button');
function insertion(index:number){const bar=el('div','section-insert');bar.append(button('+ Добавить секцию',()=>openCatalog('section',index),'insert-button'));return bar}

let renderedMode:boolean|undefined,renderedSignature='';const boundBoxes=new WeakSet<HTMLElement>(),boundHeadings=new WeakSet<HTMLElement>();
function draw(keepProperties=false){
  suggestFit();
  const doc=model.document;pageIndex=Math.max(0,Math.min(pageIndex,doc.pages.length-1));const active=doc.pages[pageIndex];if(!active.widgets.some(w=>w.id===selected))selected='';
  root.classList.toggle('is-preview',preview);root.classList.toggle('has-inspector',!drawer.hidden&&!preview);drawOutline(doc);get<HTMLInputElement>('project-name').value=doc.title;historyButtons();labelEditorCommands(root,doc.kind);
  const picker=get<HTMLSelectElement>('pages');picker.replaceChildren();doc.pages.forEach((p,i)=>{const option=el('option','',(i+1)+'. '+(sectionNames[p.id]||sectionDisplayName(p,doc.kind,i)));option.value=String(i);picker.append(option)});picker.value=String(pageIndex);get('page-kind').textContent=doc.kind==='page'?'Секция':'Слайд';
  get('slide-actions').hidden=doc.kind!=='presentation';
  get('inspector-title').textContent=selected?'Настройки блока':doc.kind==='presentation'?'Настройки слайда':'Настройки секции';
  if(!keepProperties){get<HTMLInputElement>('page-title').value=active.title;get<HTMLInputElement>('columns').value=String(active.grid.columns);get<HTMLInputElement>('row-height').value=String(active.grid.rowHeight);get<HTMLInputElement>('gap').value=String(active.grid.gap)}
  if(preview)drawer.hidden=true;
  canvas.inert=false;
  const signature=JSON.stringify(doc);
  if(controller&&renderedMode===preview){if(signature!==renderedSignature)controller.update(doc)}else{controller?.destroy();controller=renderDocument(canvas,doc,{editing:!preview});renderedMode=preview}renderedSignature=signature;if(doc.kind==='presentation')controller.goToSlide(pageIndex);
  get('end-add').replaceChildren();if(!preview&&doc.kind==='page')get('end-add').append(insertion(doc.pages.length));
  if(!preview){
    canvas.querySelectorAll('.section-insert,.section-tools,.canvas-empty').forEach(n=>n.remove());const shells=canvas.querySelectorAll<HTMLElement>(dom.sections);
    shells.forEach(shell=>{
      const index=doc.pages.findIndex(p=>p.id===shell.dataset.sectionId),page=doc.pages[index],panel=shell.querySelector<HTMLElement>(dom.panel)!;
      if(doc.kind==='page')shell.before(insertion(index));
      const tools=el('div','section-tools');tools.setAttribute('aria-label','Действия секции '+(index+1));
      tools.append(el('span','section-number',String(index+1).padStart(2,'0')),small('+ Блок',()=>openCatalog('widget',index)),small('Настройки секции',()=>openInspector('',index)));

      const heading=shell.querySelector<HTMLElement>(dom.heading);if(heading&&!boundHeadings.has(heading)){boundHeadings.add(heading);editable(heading,'Заголовок секции на странице',(d,t)=>d.pages[index].title=t,inlineCommit,()=>{pageIndex=index;get<HTMLSelectElement>('pages').value=String(index)},false);}
      for(const box of panel.querySelectorAll<HTMLElement>(dom.widgets)){
        const w=page.widgets.find(w=>w.id===box.dataset.widgetId)!;box.tabIndex=0;box.setAttribute('role','group');box.setAttribute('aria-label','Блок: '+(w.title||widgetRegistry[w.type].title));box.classList.toggle('is-selected',w.id===selected);if(boundBoxes.has(box))continue;boundBoxes.add(box);
        // Renderer owns initial grid placement; do not override its mobile rules.
        const content=box.querySelector<HTMLElement>(dom.content)!;content.removeAttribute('tabindex');if(content.getAttribute('role')==='region')content.removeAttribute('role');content.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{if(w.type!=='button')b.disabled=true;b.tabIndex=-1});
        bindInline(box,w,index,inlineCommit,()=>focusWidget(w.id,index));
        const bar=el('div','widget-tools');bar.style.left=w.position.col>page.grid.columns/2?'auto':'0';bar.style.right=w.position.col>page.grid.columns/2?'0':'auto';bar.append(iconButton('Настройки блока',()=>openInspector(w.id,index),'settings','af-btn af-btn--ghost af-btn--sm context-button'),iconButton('Копия',()=>duplicateWidget(w.id,index),'copy','af-btn af-btn--ghost af-btn--sm context-button'),iconButton('Удалить',()=>removeWidget(w.id,index),'delete','af-btn af-btn--ghost af-btn--sm context-button'));box.append(bar);
        if(w.type==='image'){const change=small('Заменить изображение',()=>openInspector(w.id,index));change.classList.add('image-change');box.append(change)}
        box.addEventListener('click',e=>{if((e.target as HTMLElement).closest('button,[contenteditable]'))return;e.preventDefault();selectWidget(w.id)});
        box.addEventListener('keydown',e=>{if(e.target===box&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openInspector(w.id,index)}});
        {const move=button('↕',()=>{},'af-btn af-btn--secondary af-btn--icon widget-handle move-handle'),resize=button('↘',()=>{},'af-btn af-btn--secondary af-btn--icon widget-handle resize-handle');move.setAttribute('aria-label','Переместить блок');resize.setAttribute('aria-label','Изменить размер блока');box.append(move,resize);attachHandle(move,w,false,panel,index);attachHandle(resize,w,true,panel,index)}
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
  if(w&&!preview)flush=properties(inspector,w,{document:doc,layout:()=>widgetLayout(canvas.querySelector<HTMLElement>(dom.widgetById(selected))!),current:()=>model.document.pages[pageIndex].widgets.find(widget=>widget.id===selected)!,columns:active.grid.columns,apply:next=>commit(d=>{const i=d.pages[pageIndex].widgets.findIndex(x=>x.id===next.id);d.pages[pageIndex].widgets[i]=structuredClone(next)},'Сохранено.',true),remove:()=>removeWidget(),duplicate:()=>duplicateWidget(),error:t=>message(t,true),errorMessage:()=>get('status').textContent??'',settled:valid=>{draftState=valid?'valid':'invalid';paintSaveState();if(valid)message(lastSaveStatus==='Сохранено в браузере'?'Сохранено.':'Изменения применены.')},pending:()=>{draftState='pending';paintSaveState()}});
  else {disposeControls(inspector);inspector.replaceChildren(...(doc.kind==='presentation'?[]:[el('p','af-help','Сетка действует внутри этой секции. Изменения видны сразу.')]));}
}

function attachHandle(handle:HTMLButtonElement,widget:Widget,resizing:boolean,_panel:HTMLElement,index:number){
 bindWidgetHandle(handle,widget.id,index,resizing,{canvas,signal:lifecycle.signal,document:()=>model.document,flush:()=>flush(),select:(id,index)=>{selected=id;pageIndex=index},change:commit,status:message});
}

run('undo',()=>{flush=()=>true;if(model.undo()){saveLocal();draw();message('Действие отменено.')}});
run('redo',()=>{flush=()=>true;if(model.redo()){saveLocal();draw();message('Действие повторено.')}});
run('add-widget',()=>openCatalog('widget',pageIndex));run('page-settings-open',()=>openInspector(matchMedia('(max-width:767px)').matches?selected:''));run('close-inspector',closeInspector);
run('close-catalog',()=>catalog.close());catalog.addEventListener('close',()=>{thumbnailControllers.splice(0).forEach(c=>c.destroy());get('templates').replaceChildren();get('add-widget').focus({preventScroll:true})},{signal:lifecycle.signal});
for(const [id,kind]of [['new-page','page'],['new-deck','presentation']] as const)run(id,async()=>{if(!flush())return;await startProject();model=new EditorModel(emptyDocument(kind));pageIndex=0;selected='';preview=false;drawer.hidden=true;(root.querySelector('.project-menu') as HTMLDetailsElement).open=false;saveLocal();draw();message('Новый документ. Добавьте блок или секцию.');});
get<HTMLInputElement>('project-name').addEventListener('change',e=>{const value=(e.target as HTMLInputElement).value;if(!flush()||!commit(d=>d.title=value.trim()))get<HTMLInputElement>('project-name').value=model.document.title});
get<HTMLSelectElement>('pages').addEventListener('change',e=>{const next=Number((e.target as HTMLSelectElement).value);if(!flush())return;pageIndex=next;selected='';documentMode=false;draw();scrollSection()});
const updateSettings=()=>{const title=get<HTMLInputElement>('page-title').value,columns=Number(get<HTMLInputElement>('columns').value),rowHeight=Number(get<HTMLInputElement>('row-height').value),gap=Number(get<HTMLInputElement>('gap').value);return commit(d=>{d.pages[pageIndex].title=title;d.pages[pageIndex].grid={columns,rowHeight,gap}},'Настройки секции сохранены.',true)};
get<HTMLFormElement>('settings').addEventListener('submit',e=>{e.preventDefault();updateSettings()});
get('settings').addEventListener('change',()=>{if(get<HTMLFormElement>('settings').checkValidity())updateSettings()});
run('add-slide',()=>openCatalog('section',pageIndex+1));

run('preview',openPreview);
run('save',async()=>{if(!flush())return;const control=get<HTMLButtonElement>('save');control.disabled=true;try{download(projectFilename(model.document.title,'json'),JSON.stringify(await portableProject(model.document),null,2),'application/json');message('Проект скачан.')}catch(e){message('Не удалось подготовить проект: '+String(e),true)}finally{control.disabled=false}});
get<HTMLInputElement>('open').addEventListener('change',async e=>{try{const parsed=await readProjectFile(e.target as HTMLInputElement);if(!parsed||!flush())return;await startProject();model=new EditorModel(parsed);pageIndex=0;selected='';preview=false;drawer.hidden=true;(root.querySelector('.project-menu') as HTMLDetailsElement).open=false;saveLocal();draw();message('Проект открыт.')}catch(error){message('Не удалось открыть проект. '+(error as Error).message,true)}});
run('export',async()=>{if(!flush())return;const control=get<HTMLButtonElement>('export');control.disabled=true;message('Подготовка HTML…');try{await downloadEditorHTML(model.document);message('HTML скачан. Внешние изображения по HTTP(S) требуют сети.')}catch(e){message((e as Error).message,true)}finally{control.disabled=false}});
bindEditorShortcuts(lifecycle.signal,{close:()=>{if(root.classList.contains('outline-open')){closeOutline();return true}if(drawer.hidden)return false;closeInspector();return true},undo:()=>get('undo').click(),redo:()=>get('redo').click(),save:()=>{if(document.activeElement instanceof HTMLElement&&root.contains(document.activeElement))document.activeElement.blur();get('save').click()}});
for(const [id,kind]of [['demo-page','page'],['demo-deck','presentation']] as const)run(id,async()=>{if(!flush())return;await startProject();model=new EditorModel(showcase(kind));pageIndex=0;selected='';preview=false;drawer.hidden=true;(root.querySelector('.project-menu') as HTMLDetailsElement).open=false;saveLocal();draw();message('Создан отдельный проект из эталона. Предыдущий доступен в «Мои проекты».')});
let restoringDevice=false;
get<HTMLSelectElement>('device').addEventListener('change',e=>{
 if(restoringDevice)return;const select=e.target as HTMLSelectElement;
 if(!flush()){restoringDevice=true;select.value=canvas.dataset.device??'desktop';select.dispatchEvent(new Event('change'));restoringDevice=false;return}
 canvas.dataset.device=select.value;zoomControls.reset();
 if(selected&&!drawer.hidden){const doc=model.document;renderProperties(doc,doc.pages[pageIndex])}
});

function drawDocumentProperties(doc:AFDocument){
 get('inspector-title').textContent='Настройки документа';get('design-settings').hidden=true;(drawer.querySelector('.page-settings') as HTMLElement).hidden=true;disposeControls(inspector);inspector.replaceChildren();flush=()=>true;draftState='valid';paintSaveState();
 const label=el('label','af-field'),name=el('input','af-input');name.id='document-properties-name';name.value=doc.title;name.maxLength=200;name.required=true;label.append(el('span','af-label','Название документа'),name);name.addEventListener('change',()=>{if(!commit(d=>d.title=name.value.trim()))name.value=model.document.title});
 inspector.append(label,el('p','af-help',`${doc.kind==='presentation'?'Презентация 16:9':'Адаптивный сайт'} · ${doc.pages.length} ${doc.kind==='presentation'?'слайдов':'секций'} · схема 3`),el('p','af-help','Проект и материалы сохраняются в этом браузере. Для резервной копии скачайте переносимый файл.'),button('Мои проекты',()=>void autosave.queue.then(()=>navigate('/projects'))),button('История версий',()=>void autosave.queue.then(()=>projectDialog(projectId,model.document,switchProject,true))),button('Скачать проект',()=>get('save').click()));
}
canvas.addEventListener('pointerdown',e=>{if(!drawer.hidden&&(e.target as HTMLElement).closest('[contenteditable]')&&!flush())e.preventDefault()},{capture:true});
root.querySelector('.project-menu > div')!.append(button('Документ',()=>{if(!flush())return;rememberInspectorTrigger();root.classList.remove('outline-open');documentMode=true;selected='';drawer.hidden=false;draw();get('document-properties-name').focus({preventScroll:true})},'af-btn af-btn--ghost af-btn--sm document-settings-open'));
async function startProject(){const id=projectId,doc=model.document;lastSaveStatus='Сохраняем…';paintSaveState();root.inert=true;message('Сохраняем текущую версию…');try{await autosave.queue;if(autosave.error)throw new Error(lastSaveStatus);await saveRevision(id,doc);projectId=crypto.randomUUID();storedVersion=0;sectionNames={}}catch(e){lastSaveStatus=autosave.error?'Не сохранено':'Сохранено в браузере';paintSaveState();throw e}finally{root.inert=false}}
const updateOutline=createOutline(root,index=>{if(!flush())return;root.classList.remove('outline-open');documentMode=false;pageIndex=index;selected='';draw();scrollSection()},sectionAction,(from,to)=>{if(!flush())return;commit(d=>{const [p]=d.pages.splice(from,1);d.pages.splice(to,0,p)});pageIndex=to;draw()},()=>openCatalog('section',model.document.pages.length),id=>sectionNames[id]);
function drawOutline(doc:AFDocument){if(!preview)updateOutline(doc,pageIndex)}

const zoomControls=createZoomControls(canvas);
root.querySelector('.canvas-toolbar')!.append(zoomControls.bar,button('Проверка качества',()=>qualityDialog(model.document,canvas,issue=>{openInspector(issue.widget??'',issue.section);scrollSection(issue.section)}),'af-btn af-btn--ghost af-btn--sm quality-open'));
const menu=root.querySelector('.project-menu > div')!;menu.append(button('Хранилище и материалы',storageDialog));
const switchProject=(id:string,doc:AFDocument)=>{flush=()=>true;if(projectId===id)model.replace(doc);else model=new EditorModel(doc);projectId=id;storedVersion=projectVersion(id);sectionNames={};void loadSectionNames(id).then(names=>{if(projectId===id){sectionNames=names;draw()}}).catch(e=>message(String(e),true));pageIndex=0;selected='';preview=false;saveLocal();draw()};
menu.append(button('Создать версию',async()=>{if(!flush())return;await autosave.queue;if(autosave.error){message('Сначала сохраните проект или разрешите конфликт.',true);return}try{await saveRevision(projectId,model.document);message('Точка восстановления создана.')}catch(e){message(String(e),true)}}));
menu.prepend(button('Мои проекты',()=>{if(flush())void autosave.queue.then(()=>navigate('/projects'))}),button('История версий',()=>{if(flush())void autosave.queue.then(()=>projectDialog(projectId,model.document,switchProject,true))}));
canvas.dataset.device=readViewState(projectId)?.device??'desktop';get<HTMLSelectElement>('device').value=canvas.dataset.device;draw();message(initialMessage);
root.querySelector('.section-toolbar')!.append(button('Создать с ИИ',async()=>{
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
let outlineTrigger:HTMLElement|undefined;
function closeOutline(){root.classList.remove('outline-open');outlineAccess.sync();outlineTrigger?.focus({preventScroll:true})}
const outlineAccess=responsiveDrawer(root,root.querySelector<HTMLElement>('.editor-outline')!,closeOutline,lifecycle.signal,()=>root.classList.contains('outline-open'));
root.addEventListener('click',event=>{if((event.target as HTMLElement).closest('.outline-close'))closeOutline()},{signal:lifecycle.signal});
root.querySelector('.canvas-toolbar')!.prepend(button('Структура',()=>{if(!flush())return;outlineTrigger=invocationTarget();drawer.hidden=true;root.classList.remove('has-inspector');drawerAccess.sync();root.classList.toggle('outline-open');outlineAccess.sync();if(root.classList.contains('outline-open'))root.querySelector<HTMLElement>('.outline-close')?.focus({preventScroll:true})},'af-btn af-btn--ghost outline-toggle'));


get('save-state').classList.add('header-save-state');root.querySelector('.document-name')!.after(get('save-state'));
const gridDetails=el('details','advanced-grid settings-disclosure');gridDetails.append(el('summary','af-btn af-btn--clear af-btn--sm','Дополнительно: сетка'),get('settings').querySelector('.settings-grid')!);get('settings').append(gridDetails);
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
mountControls(root);compactToolbar(root,lifecycle.signal);const returnScroll=readViewState(projectId)?.scroll;if(returnScroll)void document.fonts.ready.then(()=>{if(!lifecycle.signal.aborted)window.scrollTo(0,returnScroll)});
if(learning?.enabled){scrollSection(pageIndex);if(learning.section)openInspector(model.document.pages[pageIndex].widgets[0]?.id??'',pageIndex)}
window.addEventListener('beforeunload',e=>{if(autosave.error||lastSaveStatus==='Сохраняем…'||draftState!=='valid'){e.preventDefault();e.returnValue=''}},{signal:lifecycle.signal});
return {
 async beforeLeave(){if(document.activeElement instanceof HTMLElement&&root.contains(document.activeElement))document.activeElement.blur();if(!flush())return false;for(const form of drawer.querySelectorAll<HTMLFormElement>('form[data-grid-draft][data-dirty=true]')){if(!form.reportValidity())return false;form.requestSubmit();if(form.dataset.applied!=='true')return false;}const title=get<HTMLInputElement>('project-name').value.trim();if(title!==model.document.title&&!commit(d=>d.title=title))return false;if(!drawer.hidden&&!selected&&!documentMode&&model.document.kind==='page'){if(!get<HTMLFormElement>('settings').reportValidity())return false;const p=model.document.pages[pageIndex];if(get<HTMLInputElement>('page-title').value!==p.title||Number(get<HTMLInputElement>('columns').value)!==p.grid.columns||Number(get<HTMLInputElement>('row-height').value)!==p.grid.rowHeight||Number(get<HTMLInputElement>('gap').value)!==p.grid.gap){if(!updateSettings())return false}}root.inert=true;try{await autosave.queue;if(autosave.error){message('Не удалось сохранить. Повторите запись или скачайте проект.',true);return false}try{await saveRevision(projectId,model.document)}catch(e){message(String(e),true);return false}return true}finally{root.inert=false}},
 destroy(){zoomControls.destroy();disposeControls(root);lifecycle.abort();autosave.destroy();clearTimeout(fitHintTimer);controller?.destroy();thumbnailControllers.forEach(c=>c.destroy());updateOutline.destroy();document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>{d.close();d.remove()});root.replaceChildren();root.className=''}
};

}
// void boot().catch(e=>{document.querySelector('#builder')!.textContent='Не удалось запустить редактор: '+String(e)});
