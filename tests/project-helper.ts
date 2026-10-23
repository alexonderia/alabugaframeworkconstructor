import {type Page,expect} from '@playwright/test';
export async function savedDocument(page:Page){
 await expect(page.locator('#save-state')).not.toContainText(/^(Сохраняем|Проверяем)/);
 return page.evaluate(async()=>{const database=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('alabuga-workspace',3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const get=(store:string,id:string)=>new Promise<any>((resolve,reject)=>{const r=database.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const current=await get('settings','current'),project=await get('projects',current.value);database.close();return project.document});
}
