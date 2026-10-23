import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4397/builder/');await page.locator('.library-tools').waitFor();
 const report=await page.evaluate(async()=>{
  const storage=await import('/apps/editor/src/storage.ts');const c=document.createElement('canvas');c.width=128;c.height=128;const data=c.toDataURL();
  const doc={schemaVersion:3,kind:'page',title:'Profile',pages:[{id:'p',title:'',grid:{columns:12,rowHeight:64,gap:16},widgets:Array.from({length:100},(_,i)=>({id:'w'+i,type:'image',title:'',position:{col:1,row:i*2+1,width:4,height:2},src:data,alt:'Profile',fit:'cover',caption:''}))}]};
  await storage.saveProject('profile',doc);const project=await storage.getProject('profile');const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('alabuga-workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('revisions','readwrite');for(let i=0;i<2000;i++)tx.objectStore('revisions').put({id:'r'+i,project:'project-'+Math.floor(i/20),created:i,document:project.document});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
  const get=IDBObjectStore.prototype.get,getAll=IDBObjectStore.prototype.getAll;let requests=0;IDBObjectStore.prototype.get=function(...args){requests++;return get.apply(this,args)};IDBObjectStore.prototype.getAll=function(...args){requests++;return getAll.apply(this,args)};
  const times=[];for(let i=0;i<10;i++){const start=performance.now();await storage.listRevisions('project-50');times.push(performance.now()-start)}
  const start=performance.now();requests=0;await storage.hydrate(project.document);const hydrate={milliseconds:performance.now()-start,requests};times.sort((a,b)=>a-b);
  return {browser:navigator.userAgent,revisions:{projects:100,total:2000,widgetsPerDocument:100,medianMs:times[5],p90Ms:times[9]},hydrate};
 });
 await mkdir('artifacts/remediation',{recursive:true});await writeFile(`artifacts/remediation/storage-${process.argv[2]||'current'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
