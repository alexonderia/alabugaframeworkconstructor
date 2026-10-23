import type {AFDocument} from '@alabuga/framework/schema';
import {hydrate} from './storage';
import {checked} from './model';
import {standaloneRuntime} from './document-surface';
export function projectFilename(title:string,extension:'html'|'json'){return (title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').slice(0,120)||'alabuga-project')+'.'+extension}
export function download(name:string,body:string,type:string){
  const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function readImage(file:File):Promise<string>{
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('Выберите PNG, JPEG, WebP или GIF.');
  if(file.size>2*1024*1024)throw new Error('Изображение должно быть не больше 2 МБ.');
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=async()=>{const value=String(reader.result),image=new Image();image.src=value;try{await image.decode();resolve(value)}catch{reject(new Error('Файл не удалось распознать как изображение.'))}};reader.onerror=()=>reject(new Error('Не удалось прочитать изображение'));reader.readAsDataURL(file)});
}
export {embedLocalImage} from './framework-adapter';
export async function exportHTML(input:AFDocument){
 const [runtime,{exportHTML:renderExport}]=await Promise.all([standaloneRuntime(),import('@alabuga/framework/export')]);
 return renderExport(await hydrate(input),{runtime,assetsBaseUrl:new URL('../assets/',location.href).href});
}
