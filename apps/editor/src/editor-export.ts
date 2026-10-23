import type {AFDocument} from '@alabuga/framework';
import {exportHTML,download,projectFilename} from './export';
import {preflightDocument} from './quality';
export async function downloadEditorHTML(doc:AFDocument){
 const issues=(await preflightDocument(doc)).filter(issue=>issue.blocking);
 if(issues.length)throw new Error('Содержимое не помещается или материал недоступен: '+issues.map(i=>`Секция ${i.section+1} · ${i.screens?.join(', ')}: ${i.message}`).join('; '));
 download(projectFilename(doc.title,'html'),await exportHTML(doc),'text/html');
}
