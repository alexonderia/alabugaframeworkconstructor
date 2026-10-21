import {loadEnv} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const frameworkDemoPages=['panel','form','slides','showcase'] as const;
export function frameworkDocsBaseUrl(mode='production'){
 const env={...loadEnv(mode,process.cwd(),''),...process.env};
 const base=new URL(env.VITE_FRAMEWORK_DOCS_URL||'http://127.0.0.1:4391/');
 base.hash='';base.search='';if(!base.pathname.endsWith('/'))base.pathname+='/';
 return base.href;
}
/** Keep old entry URLs while serving Framework documentation independently. */
export function frameworkDocsRedirect(base:string,path=''){
 const target=new URL(path,base).href;
 const href=target.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
 const literal=JSON.stringify(target).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alabuga Framework — документация</title></head><body><a href="${href}">Открыть документацию Framework</a><script>const target=new URL(${literal});target.search=location.search;target.hash=location.hash;location.replace(target.href);</script></body></html>`;
}
export async function writeFrameworkDemoRedirects(output:string,base:string){
 await mkdir(resolve(output,'demos'),{recursive:true});
 for(const page of frameworkDemoPages)await writeFile(resolve(output,`demos/${page}.html`),frameworkDocsRedirect(base,`demos/${page}.html`));
}
