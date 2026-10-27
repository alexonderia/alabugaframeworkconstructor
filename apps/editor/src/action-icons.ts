import {el} from '@alabuga/framework/dom';
export type ActionIcon='close'|'copy'|'delete'|'settings'|'upload'|'rename'|'up'|'down';
/** Application actions use the public Framework button icon slot. */
export function actionIcon(name:ActionIcon){
 if(name==='close'){const icon=el('span','af-btn__icon af-icon af-icon--close');icon.setAttribute('aria-hidden','true');return icon}
 const paths={copy:['M9 9h11v12H9z','M5 16H3V3h12v2'],delete:['M3 6h18','M8 6V3h8v3','M5 6l1 15h12l1-15','M10 10v7','M14 10v7'],settings:['M10 3h4l.6 2.5 2 .9 2.2-1.2 2 3.5-1.8 1.8v2.9l1.8 1.8-2 3.5-2.2-1.2-2 .9L14 21h-4l-.6-2.6-2-.9-2.2 1.2-2-3.5L5 13.4v-2.9L3.2 8.7l2-3.5 2.2 1.2 2-.9z','M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],upload:['M12 16V3','M7 8l5-5 5 5','M4 16v5h16v-5'],rename:['M14 5l5 5','M4 20l5-1L21 7l-5-5L4 14z'],up:['M12 20V4','M5 11l7-7 7 7'],down:['M12 4v16','M5 13l7 7 7-7']};
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','af-btn__icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.75');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 for(const d of paths[name]){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path)}return svg;
}
