import type manifestType from '@alabuga/framework/assets/brand/manifest.json';
let pending:Promise<typeof manifestType>|undefined;
export function loadBrandManifest(){return pending??=fetch(new URL('../assets/brand/manifest.json',location.href),{signal:AbortSignal.timeout(8000)}).then(async response=>{if(!response.ok)throw new Error('Не удалось загрузить библиотеку материалов');return await response.json() as typeof manifestType}).catch(error=>{pending=undefined;throw error})}
