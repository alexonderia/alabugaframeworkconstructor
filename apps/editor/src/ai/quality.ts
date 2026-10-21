import {reviewContent} from '@alabuga/ai/content-review';
import {renderDocument} from '../framework-adapter';

import {validateDocument,type AFDocument,type Section} from '@alabuga/framework/schema';
import {inspectQuality} from '../quality';
export async function checkSection(section:Section,kind:AFDocument['kind']):Promise<string[]>{
 const doc:AFDocument={schemaVersion:3,kind,title:'Черновик',pages:[section]},valid=validateDocument(doc);if(!valid.success)return valid.issues.map(i=>i.message);
 const host=document.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;width:1440px;visibility:hidden';document.body.append(host);const c=renderDocument(host,doc,{editing:true});
 try{
  await document.fonts.ready;await Promise.all(Array.from(host.querySelectorAll('img')).map(img=>Promise.race([img.decode().catch(()=>{}),new Promise<void>(resolve=>setTimeout(resolve,5000))])));
  const text=JSON.stringify(section.widgets),placeholders=['Короткий заголовок','Короткий абзац.','Название пункта','Короткое пояснение.','Сохраняй названные','Не смешивай сайт'];
  const contentIssues=placeholders.filter(p=>text.includes(p)).map(p=>'Замените служебную фразу «'+p+'» содержанием по заданию.');
  const issues=()=>[...reviewContent(section),...contentIssues,...inspectQuality(doc,host).map(i=>i.message),...(kind==='presentation'?c.checkOverflow():[])];
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));const result=issues();
  if(kind==='page'){host.style.width='390px';await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));result.push(...issues().map(i=>'Телефон: '+i))}
  return [...new Set(result)];
 }finally{c.destroy();host.remove()}
}
