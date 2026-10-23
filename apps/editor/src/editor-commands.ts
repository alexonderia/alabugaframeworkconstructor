type Scope='project'|'section'|'widget'|'view';
export const compactEditorQuery='(max-width:767px), (max-width:1023px) and (max-height:500px)';
const scopes:Record<string,Scope>={undo:'project',redo:'project',save:'project',preview:'view',export:'project','new-page':'project','new-deck':'project','demo-page':'project','demo-deck':'project','add-widget':'section','page-settings-open':'section','add-slide':'section','copy-slide':'section','up-slide':'section','down-slide':'section','delete-slide':'section'};
export function labelEditorCommands(root:HTMLElement,kind:'page'|'presentation'){
 const compact=matchMedia(compactEditorQuery).matches;root.dataset.documentKind=kind;
 for(const node of root.querySelectorAll('.editor-header .af-btn,.canvas-toolbar .af-btn,.editor-outline .outline-add,.author-tutorial .af-btn'))node.classList.remove('af-btn--sm');
 for(const node of root.querySelectorAll('.editor-header .af-input,.canvas-toolbar .af-select')){
  const variant=node.classList.contains('af-select')?'af-select--sm':'af-input--sm';node.classList.toggle(variant,compact);
 }
 if(compact)for(const node of root.querySelectorAll('.editor-header>.af-btn,.editor-history .af-btn,.project-menu>summary,.canvas-toolbar .af-btn'))node.classList.add('af-btn--sm');
 root.querySelector('#preview')!.textContent=compact?'Просмотр':kind==='presentation'?'Показать':'Предпросмотр';
 root.querySelector('#page-settings-open')!.textContent=compact?'Свойства':kind==='presentation'?'Настройки слайда':'Настройки секции';
}
/** Canonical controls and keyboard/mobile invocations share one handler. */
export function editorCommands(root:HTMLElement,signal:AbortSignal,error:(message:string)=>void){
 const commands=new Map<string,()=>void|Promise<void>>();
 const execute=(id:string)=>{const control=root.querySelector<HTMLButtonElement>('#'+CSS.escape(id));if(signal.aborted||control?.disabled)return;const action=commands.get(id);if(action)void Promise.resolve().then(action).catch(e=>error(e instanceof Error?e.message:String(e)))};
 return {execute,bind(id:string,action:()=>void|Promise<void>){const control=root.querySelector<HTMLElement>('#'+CSS.escape(id));if(!control)throw new Error('Unknown editor command: '+id);commands.set(id,action);control.dataset.command=id;control.dataset.scope=scopes[id]??'view';control.addEventListener('click',()=>execute(id),{signal})}};
}
