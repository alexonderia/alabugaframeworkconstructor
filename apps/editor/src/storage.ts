import {type AFDocument} from '@alabuga/framework/schema';
import {validateDocument} from '@alabuga/framework/schema';
import {embedLocalImage} from './framework-adapter';
const checked=(input:unknown)=>{const r=validateDocument(input);if(!r.success)throw new Error(r.issues.map(i=>i.message).join('; '));return r.data};

export type Project={id:string;title:string;updated:number;document:AFDocument;version?:number;deletedAt?:number};
export type ProjectSummary={id:string;title:string;kind:AFDocument['kind'];updated:number;sectionCount:number;version?:number;deletedAt?:number};
const summary=(p:Project):ProjectSummary=>({id:p.id,title:p.title,kind:p.document.kind,updated:p.updated,sectionCount:p.document.pages.length,version:p.version??0,...(p.deletedAt?{deletedAt:p.deletedAt}:{})});
const knownVersions=new Map<string,number>();
export const projectVersion=(id:string)=>knownVersions.get(id)??0;
export const rememberProjectVersion=(id:string,version:number)=>knownVersions.set(id,version);
export class ProjectConflictError extends Error {
 constructor(readonly projectId:string){super('Проект изменён в другой вкладке. Ваши правки сохранены в редакторе — выберите, какую версию открыть.');this.name='ProjectConflictError'}
}
type ProjectChange={id:string;version:number;deleted?:boolean};
const changes=typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('alabuga-project-changes'):undefined;
const publish=(change:ProjectChange)=>changes?.postMessage(change);
export function subscribeProjectChanges(listener:(change:ProjectChange)=>void,signal:AbortSignal){changes?.addEventListener('message',event=>{const value=event.data;if(value&&typeof value.id==='string'&&Number.isInteger(value.version))listener(value)},{signal})}
export type Revision={id:string;project:string;created:number;document:AFDocument};
export type Asset={id:string;data:string;description?:string};
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('alabuga-workspace',3);r.onupgradeneeded=event=>{for(const name of ['projects','assets','revisions','settings','summaries'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});const revisions=r.transaction!.objectStore('revisions');if(!revisions.indexNames.contains('project'))revisions.createIndex('project','project');if(event.oldVersion<2){const cursor=r.transaction!.objectStore('projects').openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){r.transaction!.objectStore('summaries').put(summary(c.value));c.continue()}}}};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();database=undefined};resolve(r.result)};r.onerror=()=>{database=undefined;reject(r.error)};r.onblocked=()=>{database=undefined;reject(new Error('Закройте другие вкладки конструктора и повторите открытие.'))}}).catch(e=>{database=undefined;throw e})}
async function read<T>(store:string,id?:string):Promise<T>{const d=await db();return new Promise((resolve,reject)=>{const r=id===undefined?d.transaction(store).objectStore(store).getAll():d.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function write(stores:string[],work:(tx:IDBTransaction)=>void){const d=await db();await new Promise<void>((resolve,reject)=>{const tx=d.transaction(stores,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Запись отменена'));work(tx)})}
export const listProjects=()=>read<Project[]>('projects');
export const listProjectSummaries=()=>read<ProjectSummary[]>('summaries');
export const listAssets=async()=>{const assets=await read<Asset[]>('assets'),settings=await read<{id:string;value:unknown}[]>('settings'),descriptions=new Map(settings.map(s=>[s.id,s.value]));return assets.map(a=>({...a,description:descriptions.get('asset-description:'+a.id) as string|undefined??a.description}))};
export const readSetting=<T>(id:string)=>read<T|undefined>('settings',id);
export const writeSetting=(id:string,value:unknown)=>write(['settings'],tx=>tx.objectStore('settings').put({id,value}));
export async function describeAsset(id:string,description:string){const asset=await read<Asset|undefined>('assets',id);if(!asset)throw new Error('Материал не найден');await writeSetting('asset-description:'+id,description.slice(0,200))}
export async function addAsset(data:string,description:string){const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),b=>b.toString(16).padStart(2,'0')).join('');await write(['assets','settings'],tx=>{tx.objectStore('assets').put({id,data});tx.objectStore('settings').put({id:'asset-description:'+id,value:description.slice(0,200)})});return id}
export async function saveDraftSetting(value:import('@alabuga/ai/contracts').DraftResult){
 const copy=structuredClone(value),pages=copy.sections.filter((p):p is NonNullable<typeof p>=>!!p);let assets:Asset[]=[];
 if(pages.length){const normalized=await normalizeAssets({schemaVersion:3,kind:copy.request.kind,title:copy.title,pages});let i=0;copy.sections=copy.sections.map(p=>p?normalized.document.pages[i++]:null);assets=normalized.assets}
 let removed=false;await write(['assets','settings'],tx=>{const request=tx.objectStore('settings').get('removed:'+copy.projectId);request.onsuccess=()=>{if(request.result){removed=true;return}assets.forEach(a=>tx.objectStore('assets').put(a));tx.objectStore('settings').put({id:'ai-draft',value:copy})}});
 if(removed)throw new Error('Проект удалён. Черновик не сохранён.');
}

export async function loadDraftSetting(){const record=await readSetting<{value:import('@alabuga/ai/contracts').DraftResult}>('ai-draft');if(!record)return;const d=record.value,pages=d.sections.filter((p):p is NonNullable<typeof p>=>!!p);if(pages.length){const hydrated=await hydrate({schemaVersion:3,kind:d.request.kind,title:d.title,pages});let i=0;d.sections=d.sections.map(p=>p?hydrated.pages[i++]:null)}return d}
export async function listRevisions(id:string){const d=await db();return new Promise<Revision[]>((resolve,reject)=>{const r=d.transaction('revisions').objectStore('revisions').index('project').getAll(id);r.onsuccess=()=>resolve((r.result as Revision[]).sort((a,b)=>b.created-a.created));r.onerror=()=>reject(r.error)})}
export async function getProject(id:string){const p=await read<Project|undefined>('projects',id);if(!p)throw new Error('Проект не найден');knownVersions.set(id,p.version??0);return {...p,document:checked(p.document)}}
export async function currentProject(){const current=await read<{id:string;value:string}|undefined>('settings','current');if(!current)return;const p=await read<Project|undefined>('projects',current.value);return p&&!p.deletedAt?p:undefined}
export async function activateProject(id:string){await write(['settings'],tx=>tx.objectStore('settings').put({id:'current',value:id}))}
export async function saveRevision(project:string,input:AFDocument){const {document,assets}=await normalizeAssets(input);await write(['revisions','assets','projects'],tx=>{const projectRequest=tx.objectStore('projects').get(project);projectRequest.onsuccess=()=>{if(!projectRequest.result||projectRequest.result.deletedAt)return;assets.forEach(a=>tx.objectStore('assets').put(a));const s=tx.objectStore('revisions'),request=s.index('project').getAll(project);request.onsuccess=()=>{const existing=(request.result as Revision[]).sort((a,b)=>b.created-a.created);if(existing[0]&&JSON.stringify(existing[0].document)===JSON.stringify(document))return;s.put({id:crypto.randomUUID(),project,created:Math.max(Date.now(),(existing[0]?.created??0)+1),document});existing.slice(19).forEach(r=>s.delete(r.id))}}})}
export async function hydrate(document:AFDocument){const doc=structuredClone(document),ids=new Set<string>();await mapImages(doc,async src=>{if(src.startsWith('asset:'))ids.add(src.slice(6));return src});if(!ids.size)return doc;const d=await db(),assets=await new Promise<Map<string,Asset>>((resolve,reject)=>{const tx=d.transaction('assets'),values=new Map<string,Asset>();for(const id of ids){const r=tx.objectStore('assets').get(id);r.onsuccess=()=>{if(r.result)values.set(id,r.result)}}tx.oncomplete=()=>resolve(values);tx.onerror=()=>reject(tx.error)});await mapImages(doc,async src=>{if(!src.startsWith('asset:'))return src;const asset=assets.get(src.slice(6));if(!asset)throw new Error('Не найден материал '+src);return asset.data});return doc}
export async function mapImages(doc:AFDocument,mapper:(src:string)=>Promise<string>){for(const p of doc.pages){if(p.appearance?.background)p.appearance.background=await mapper(p.appearance.background);for(const w of p.widgets){if(w.type==='image')w.src=await mapper(w.src);if(w.type==='gallery')for(const item of w.items)item.src=await mapper(item.src)}}}
// Bound retained data URLs by approximate UTF-16 bytes, including keys and results.
const materialCache=new Map<string,{value:Promise<Asset>;bytes:number}>();let materialBytes=0;const materialLimit=16*1024*1024;
function forgetMaterial(key:string){const old=materialCache.get(key);if(old){materialBytes-=old.bytes;materialCache.delete(key)}}
export const materialCacheUsage=()=>({entries:materialCache.size,bytes:materialBytes,limit:materialLimit});
function imageReferences(doc:AFDocument){const ids=new Set<string>();const add=(src?:string)=>{if(src?.startsWith('asset:'))ids.add(src.slice(6))};for(const p of doc.pages){add(p.appearance?.background);for(const w of p.widgets){if(w.type==='image')add(w.src);if(w.type==='gallery')w.items.forEach(a=>add(a.src))}}return ids}
function verifyAssets(tx:IDBTransaction,doc:AFDocument,assets:Asset[],missing:(error:Error)=>void,commit:()=>void){
 const incoming=new Set(assets.map(a=>a.id)),ids=[...imageReferences(doc)].filter(id=>!incoming.has(id));if(!ids.length){commit();return}let remaining=ids.length,failed=false;
 for(const id of ids){const r=tx.objectStore('assets').get(id);r.onsuccess=()=>{if(!r.result){failed=true;missing(new Error('Не найден материал. Откройте сохранённую версию проекта или загрузите изображение заново.'))}if(--remaining===0&&!failed)commit()}}
}
async function normalizeAssets(input:AFDocument){
 const document=checked(input),assets=new Map<string,Asset>(),operation=new Map<string,Asset>();
 await mapImages(document,async src=>{
  if(src.startsWith('asset:')||/^https?:/i.test(src))return src;
  let asset=operation.get(src);
  if(!asset){let entry=materialCache.get(src);if(entry){materialCache.delete(src);materialCache.set(src,entry)}else{
   const value=(async()=>{const data=src.startsWith('data:')?src:await embedLocalImage(src);const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),b=>b.toString(16).padStart(2,'0')).join('');return {id,data}})();
   entry={value,bytes:src.length*4};if(entry.bytes<=materialLimit){materialCache.set(src,entry);materialBytes+=entry.bytes;while(materialBytes>materialLimit)forgetMaterial(materialCache.keys().next().value!)}value.catch(()=>forgetMaterial(src));
  }asset=await entry.value;if(materialCache.get(src)===entry){materialBytes-=entry.bytes;entry.bytes=(src.length+asset.data.length)*2;materialBytes+=entry.bytes;while(materialBytes>materialLimit)forgetMaterial(materialCache.keys().next().value!)}operation.set(src,asset)}
  assets.set(asset.id,asset);return 'asset:'+asset.id;
 });return {document,assets:[...assets.values()]};
}
export async function saveProject(id:string,input:AFDocument,draftId?:string,options:{expectedVersion?:number}={}){
 const expected=options.expectedVersion??projectVersion(id),{document:doc,assets}=await normalizeAssets(input);let failure:Error|undefined,version=0;
 await write(['projects','summaries','assets','settings'],tx=>{
  const projects=tx.objectStore('projects'),get=projects.get(id);
  get.onsuccess=()=>{const tombstone=tx.objectStore('settings').get('removed:'+id);tombstone.onsuccess=()=>{
   const existing=get.result as Project|undefined;
   if(existing?.deletedAt||tombstone.result){failure=new Error('Проект находится в корзине или удалён. Скачайте изменения или восстановите проект.');return}
   if((existing?.version??0)!==expected){failure=new ProjectConflictError(id);return}
   verifyAssets(tx,doc,assets,error=>failure=error,()=>{version=expected+1;for(const asset of assets)tx.objectStore('assets').put(asset);
   if(draftId){const draft=tx.objectStore('settings').get('ai-draft');draft.onsuccess=()=>{if(draft.result?.value.id===draftId){draft.result.value.projectId=id;tx.objectStore('settings').put(draft.result)}}}
   const p:Project={id,title:doc.title,updated:Date.now(),document:doc,version};projects.put(p);tx.objectStore('summaries').put(summary(p));tx.objectStore('settings').put({id:'current',value:id});});
  }};
 });
 if(failure)throw failure;knownVersions.set(id,version);publish({id,version});return doc;
}

async function updateProject(id:string,change:(p:Project)=>void,expectedVersion?:number){let failure:Error|undefined,updated:Project|undefined;await write(['projects','summaries','settings'],tx=>{const store=tx.objectStore('projects'),r=store.get(id);r.onsuccess=()=>{const p=r.result as Project|undefined;if(!p){failure=new Error('Проект не найден');return}if(expectedVersion!==undefined&&(p.version??0)!==expectedVersion){failure=new ProjectConflictError(id);return}change(p);p.version=(p.version??0)+1;updated=p;store.put(p);tx.objectStore('summaries').put(summary(p));if(p.deletedAt){const c=tx.objectStore('settings').get('current');c.onsuccess=()=>{if(c.result?.value===id)tx.objectStore('settings').delete('current')}}}});if(failure)throw failure;if(updated){knownVersions.set(id,updated.version!);publish({id,version:updated.version!,deleted:!!updated.deletedAt})}}
export async function renameProject(id:string,title:string,expectedVersion?:number){title=title.trim();if(!title||title.length>200)throw new Error('Название должно содержать от 1 до 200 символов.');await updateProject(id,p=>{p.title=title;p.document.title=title;p.updated=Date.now()},expectedVersion)}
export const trashProject=(id:string)=>updateProject(id,p=>{p.deletedAt=Date.now()});
export const restoreProject=(id:string)=>updateProject(id,p=>{delete p.deletedAt});
export async function deleteProject(id:string){let rejected=false;await write(['projects','summaries','revisions','settings'],tx=>{const r=tx.objectStore('projects').get(id);r.onsuccess=()=>{if(!r.result?.deletedAt){rejected=true;return}tx.objectStore('projects').delete(id);tx.objectStore('summaries').delete(id);tx.objectStore('settings').put({id:'removed:'+id,value:true});const revisions=tx.objectStore('revisions').index('project').openCursor(IDBKeyRange.only(id));revisions.onsuccess=()=>{const c=revisions.result;if(c){if(c.value.project===id)c.delete();c.continue()}};const draft=tx.objectStore('settings').get('ai-draft');draft.onsuccess=()=>{if(draft.result?.value.projectId===id)tx.objectStore('settings').delete('ai-draft')}}});if(rejected)throw new Error('Сначала переместите проект в корзину.')}
export async function migrateLegacy(){const marker=await readSetting('legacy-migrated');if(marker)return;const raw=localStorage.getItem('alabuga.builder.document.v1');if(!raw)return;const input=checked(JSON.parse(raw)),id='legacy-import';const normalized=await normalizeAssets(input),projects=await listProjects();const existing=projects.find(p=>p.id===id||JSON.stringify(checked(p.document))===JSON.stringify(normalized.document));if(!existing)await saveProject(id,input);await writeSetting('legacy-migrated',existing?.id??id)}
export async function portableProject(doc:AFDocument){const document=await hydrate(doc),assets:Asset[]=[];await mapImages(document,async src=>{if(/^https?:/i.test(src))return src;const data=await embedLocalImage(src),id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),b=>b.toString(16).padStart(2,'0')).join('');if(!assets.some(a=>a.id===id))assets.push({id,data});return 'asset:'+id});return {format:'alabuga-project',version:3,document,assets}}
export function importProject(input:unknown){if(!input||typeof input!=='object')throw new Error('Некорректный файл проекта');
 const obj=input as {format?:string;version?:unknown;document?:unknown;assets?:Asset[]};
 if(obj.format!==undefined&&obj.format!=='alabuga-project')throw new Error('Неизвестный формат проекта');
 if(obj.format==='alabuga-project'){if(obj.version!==undefined&&![1,2,3].includes(obj.version as number))throw new Error('Неподдерживаемая версия файла проекта');if(obj.assets!==undefined&&!Array.isArray(obj.assets))throw new Error('Некорректная библиотека материалов');}
const doc=checked(obj?.format==='alabuga-project'?obj.document:input);const resolve=(src:string)=>{if(!src.startsWith('asset:'))return src;const asset=obj.assets?.find(a=>a.id===src.slice(6));if(!asset||typeof asset.data!=='string')throw new Error('Отсутствует материал '+src);return asset.data};for(const p of doc.pages){if(p.appearance?.background)p.appearance.background=resolve(p.appearance.background);for(const w of p.widgets){if(w.type==='image')w.src=resolve(w.src);if(w.type==='gallery')w.items.forEach(i=>i.src=resolve(i.src))}}return checked(doc)}

type WorkspaceData={projects:Project[];revisions:Revision[];settings:{id:string;value:any}[];assets:Asset[]};
function readWorkspace(tx:IDBTransaction,done:(data:WorkspaceData)=>void){const data={} as WorkspaceData;let remaining=4;for(const name of ['projects','revisions','settings','assets'] as const){const r=tx.objectStore(name).getAll();r.onsuccess=()=>{data[name]=r.result;if(!--remaining)done(data)}}}
function assetUsage(data:WorkspaceData){
 const used=new Map<string,Set<string>>(),add=(doc:AFDocument,label:string)=>{for(const id of imageReferences(doc)){if(!used.has(id))used.set(id,new Set());used.get(id)!.add(label)}};
 for(const p of data.projects)add(p.document,p.title+(p.deletedAt?' (корзина)':''));for(const r of data.revisions)add(r.document,'История версий');
 const draft=data.settings.find(s=>s.id==='ai-draft')?.value;if(draft?.sections)add({pages:draft.sections.filter(Boolean)} as AFDocument,'Черновик ИИ');return used;
}
export async function inspectStorage(){
 const d=await db(),data=await new Promise<WorkspaceData>((resolve,reject)=>{const tx=d.transaction(['projects','revisions','settings','assets']);readWorkspace(tx,resolve);tx.onerror=()=>reject(tx.error)}),used=assetUsage(data),descriptions=new Map(data.settings.filter(s=>s.id.startsWith('asset-description:')).map(s=>[s.id.slice(18),String(s.value)]));
 const estimate=await navigator.storage?.estimate().catch(()=>undefined);return {usage:estimate?.usage,quota:estimate?.quota,assets:data.assets.map(a=>({id:a.id,description:descriptions.get(a.id)||a.description||'Без описания',bytes:a.data.length*2,usedBy:[...(used.get(a.id)??[])],library:descriptions.has(a.id)}))};
}
/** References are checked again while all referencing stores are locked for writing. */
export async function removeUnusedAssets(ids:string[]){let count=0;await write(['projects','revisions','settings','assets'],tx=>readWorkspace(tx,data=>{const used=assetUsage(data),exists=new Set(data.assets.map(a=>a.id));for(const id of new Set(ids))if(exists.has(id)&&!used.has(id)){tx.objectStore('assets').delete(id);tx.objectStore('settings').delete('asset-description:'+id);count++}}));return count}
