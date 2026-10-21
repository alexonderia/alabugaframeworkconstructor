import type {AFDocument} from '@alabuga/framework/schema';
import {hydrate} from './storage';
import {checked} from './model';
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
 const [{default:css},{default:script},{exportHTML:renderExport}]=await Promise.all([import('@alabuga/framework/standalone.css?raw'),import('@alabuga/framework/standalone.js?raw'),import('@alabuga/framework/export')]);
 return renderExport(await hydrate(input),{runtime:{css,script},assetsBaseUrl:new URL('../assets/',location.href).href});
}
