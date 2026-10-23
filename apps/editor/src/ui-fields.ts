import {el} from './ui';

/** Labels and controls share the Framework contract in every Constructor form. */
function labelled<T extends HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>(host:HTMLElement,title:string,control:T){
 const label=el('label','af-field');
 control.setAttribute('aria-label',title);
 label.append(el('span','af-label',title),control);host.append(label);
 return control;
}

export function inputField(host:HTMLElement,title:string,value:string|number,update:(value:string)=>void,type='text'){
 const control=el('input','af-input');control.type=type;control.value=String(value);
 control.addEventListener('input',()=>update(control.value));
 return labelled(host,title,control);
}

export function textareaField(host:HTMLElement,title:string,value:string,update:(value:string)=>void){
 const control=el('textarea','af-textarea');control.value=value;control.rows=3;
 control.addEventListener('input',()=>update(control.value));
 return labelled(host,title,control);
}

export function selectField(host:HTMLElement,title:string,value:string,options:Record<string,string>,update:(value:string)=>void){
 const control=el('select','af-select');
 for(const [key,text]of Object.entries(options)){const option=el('option','',text);option.value=key;control.append(option)}
 control.value=value;control.addEventListener('change',()=>update(control.value));
 return labelled(host,title,control);
}

export function checkboxField(host:HTMLElement,title:string,value:boolean,update:(value:boolean)=>void){
 const label=el('label','af-check'),control=el('input','af-checkbox');control.type='checkbox';control.checked=value;
 control.addEventListener('change',()=>update(control.checked));
 label.append(control,document.createTextNode(title));host.append(label);return control;
}
