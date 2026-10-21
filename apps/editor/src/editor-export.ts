import {renderDocument} from './framework-adapter';
import {type DocumentController,type AFDocument} from '@alabuga/framework';
import {el} from '@alabuga/framework/dom';
import {exportHTML,download} from './export';
export async function downloadEditorHTML(doc:AFDocument){
 let controller:DocumentController|undefined;const host=el('div');
 try{
  if(doc.kind==='presentation'){host.style.cssText='position:fixed;left:-100000px;top:0;width:1600px';document.body.append(host);controller=renderDocument(host,doc);await document.fonts.ready;const issues=controller.checkOverflow();if(issues.length)throw new Error('Содержимое не помещается: '+[...new Set(issues)].join('; '))}
  download('alabuga-document.html',await exportHTML(doc),'text/html');
 }finally{controller?.destroy();host.remove()}
}
