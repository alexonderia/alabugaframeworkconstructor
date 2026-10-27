import {writeFile,rename} from 'node:fs/promises';

/** Windows readers and virus scanners can briefly hold the published state open. */
export async function writeBootstrapState(file:string,data:unknown,replace:typeof rename=rename){
 const pending=file+'.tmp';await writeFile(pending,JSON.stringify(data));
 for(let attempt=0;;attempt++){
  try{await replace(pending,file);return}catch(error){
   if(attempt===5||!['EPERM','EACCES','EBUSY'].includes((error as NodeJS.ErrnoException).code??''))throw error;
   await new Promise(resolve=>setTimeout(resolve,25*2**attempt));
  }
 }
}
