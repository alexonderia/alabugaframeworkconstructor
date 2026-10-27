import {renderDocument,type AFDocument} from './framework-adapter';
import {el} from '@alabuga/framework/dom';
/** Fit the complete composition into a padded preview without changing its layout. */
export function compositionPreview(host:HTMLElement,doc:AFDocument){
 const inner=el('div');host.classList.add('composition-thumbnail');host.inert=true;host.setAttribute('aria-hidden','true');host.append(inner);
 const controller=renderDocument(inner,doc,{editing:true});let frame=0,disposed=false;
 const fit=()=>{frame=0;if(disposed)return;const padding=parseFloat(getComputedStyle(host).paddingLeft)||0,width=host.clientWidth,height=host.clientHeight,sourceWidth=inner.offsetWidth,sourceHeight=inner.scrollHeight;if(!sourceWidth||!sourceHeight)return;const scale=Math.max(0,Math.min((width-2*padding)/sourceWidth,(height-2*padding)/sourceHeight));inner.style.transform=`scale(${scale})`;inner.style.left=(width-sourceWidth*scale)/2+'px';inner.style.top=(height-sourceHeight*scale)/2+'px'};
 const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(fit)},observer=new ResizeObserver(schedule);observer.observe(host);observer.observe(inner);inner.addEventListener('load',schedule,true);void document.fonts.ready.then(schedule);schedule();
 return {...controller,destroy(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();inner.removeEventListener('load',schedule,true);controller.destroy()}};
}
