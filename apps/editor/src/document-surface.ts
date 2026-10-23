import type {AFDocument,DocumentController} from '@alabuga/framework';
import {assetsBaseUrl} from './framework-adapter';
import {hydrate} from './storage';

let runtime:Promise<{css:string;script:string}>|undefined;
export function standaloneRuntime(){return runtime??=Promise.all([import('@alabuga/framework/standalone.css?raw'),import('@alabuga/framework/standalone.js?raw')]).then(([css,script])=>({css:css.default,script:script.default})).catch(e=>{runtime=undefined;throw e})}
type SurfaceWindow=Window&{alabugaSurface:DocumentController};
const json=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export async function resourcesReady(root:HTMLElement,signal?:AbortSignal){
 const tasks=[root.ownerDocument.fonts.ready,...Array.from(root.querySelectorAll('img'),img=>img.decode().catch(()=>{}))];
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([Promise.all(tasks),new Promise<void>((_resolve,reject)=>timer=setTimeout(()=>reject(new Error('Шрифты или изображения не успели загрузиться. Проверьте подключение и повторите проверку.')),5000))]);signal?.throwIfAborted()}finally{clearTimeout(timer)}
}
export function documentSurface(host:HTMLElement,input:AFDocument,options:{width?:number;slide?:number;autoHeight?:boolean}={}){
 const abort=new AbortController(),frame=document.createElement('iframe');frame.className='document-surface';frame.title='Предпросмотр: '+input.title;frame.allowFullscreen=true;frame.setAttribute('allow','fullscreen');frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-modals allow-popups');frame.style.cssText='display:block;border:0;width:100%;height:1000px;background:white';host.append(frame);
 if(options.width)host.style.maxWidth=options.width+'px';
 let observer:ResizeObserver|undefined,root:HTMLElement|undefined,controller:DocumentController|undefined;
 const fitHeight=()=>{if(options.autoHeight===false||!root||abort.signal.aborted)return;const height=Math.ceil(Math.max(root.scrollHeight,root.getBoundingClientRect().height));if(height>0&&frame.height!==String(height)){frame.height=String(height);frame.style.height=height+'px'}};
 const ready=(async()=>{
  const [data,source]=await Promise.all([hydrate(input),standaloneRuntime()]);abort.signal.throwIfAborted();
  const title=document.createElement('title');title.textContent=input.title;
  const load=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(new Error('Предпросмотр не загрузился. Повторите открытие.'))},15000);const done=()=>{cleanup();resolve()};const cancelled=()=>{cleanup();reject(new DOMException('Предпросмотр закрыт','AbortError'))};function cleanup(){clearTimeout(timer);frame.removeEventListener('load',done);abort.signal.removeEventListener('abort',cancelled)}frame.addEventListener('load',done);abort.signal.addEventListener('abort',cancelled,{once:true})});
  frame.srcdoc=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${title.outerHTML}<style>${source.css.replace(/<\/style/gi,'<\\/style')}html,body{margin:0;padding:0;background:white}main{width:100%;margin:auto}</style></head><body><main id="document"></main><script>${source.script.replace(/<\/script/gi,'<\\/script')}</script><script>window.alabugaSurface=Alabuga.renderDocument(document.getElementById('document'),${json(data)},{assetsBaseUrl:${json(assetsBaseUrl())}});document.addEventListener('click',function(e){const a=e.target.closest('a[href]');if(!a)return;const href=a.getAttribute('href');if(href&&href.startsWith('#')){e.preventDefault();let id=href.slice(1);try{id=decodeURIComponent(id)}catch{}if(id)document.getElementById(id)?.scrollIntoView({block:'start',behavior:'instant'})}});</script></body></html>`;
  await load;abort.signal.throwIfAborted();root=frame.contentDocument!.getElementById('document')!;controller=(frame.contentWindow as SurfaceWindow).alabugaSurface;
  if(!controller)throw new Error('Не удалось запустить предпросмотр документа.');if(input.kind==='presentation')controller.goToSlide(options.slide??0);
  await resourcesReady(root,abort.signal);fitHeight();observer=new ResizeObserver(fitHeight);observer.observe(root);return root;
 })();
 // Hosts may close while the runtime chunk is loading. A closed surface is not a page error.
 void ready.catch(()=>{});
 return {frame,ready,get root(){return root},get controller(){return controller},async setWidth(width?:number){host.style.maxWidth=width?width+'px':'';if(options.autoHeight!==false)frame.style.height='1px';await ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));fitHeight()},destroy(){abort.abort();observer?.disconnect();controller?.destroy();frame.remove()}};
}
