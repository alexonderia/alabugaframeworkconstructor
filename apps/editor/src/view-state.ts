export type ViewState={section:number;device:'desktop'|'tablet'|'mobile';scroll:number};
const fallback=new Map<string,ViewState>();
export function readViewState(id:string):ViewState|undefined{try{const raw=sessionStorage.getItem('alabuga-view:'+id);if(raw){const value=JSON.parse(raw);if(Number.isInteger(value.section)&&value.section>=0&&['desktop','tablet','mobile'].includes(value.device))return {...value,scroll:Number(value.scroll)||0}}}catch{}return fallback.get(id)}
export function writeViewState(id:string,state:ViewState){fallback.set(id,state);try{sessionStorage.setItem('alabuga-view:'+id,JSON.stringify(state))}catch{}}
export const deviceWidth=(device:ViewState['device'])=>device==='mobile'?390:device==='tablet'?768:undefined;
