import {importProject} from './storage';
export const MAX_PROJECT_BYTES=100*1024*1024;
/** Both entry points use the same bounds, parser and reset behavior. */
export async function readProjectFile(input:HTMLInputElement){
 try{const file=input.files?.[0];if(!file)return;if(file.size>MAX_PROJECT_BYTES)throw new Error('Проект должен быть не больше 100 МБ.');let data:unknown;try{data=JSON.parse(await file.text())}catch{throw new Error('Файл проекта содержит некорректный JSON.')}return importProject(data)}finally{input.value=''}
}
