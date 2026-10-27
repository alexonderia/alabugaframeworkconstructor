import {sourceEvidence} from './planning';
import {rankedFacts} from './topic-guidance';
/** Add evidence IDs only when card guidance refers to them; preserve the normal text prompt. */
export function contentPrompt(prompt:string,sources:string,evidenceIds=false){
 const task=prompt.match(/^ЗАДАНИЕ: [^\n]+/m)?.[0]??'';
 const requirements=prompt.match(/\nТРЕБОВАНИЯ К ПОДАЧЕ:[\s\S]*$/)?.[0]??'';
 const content=/ФАКТЫ ДЛЯ ЭТОЙ СЕКЦИИ:\n/.test(prompt),ranked=content?rankedFacts(sources,task):[],priority=ranked.filter(f=>f.score>0).slice(0,evidenceIds?3:1).map(f=>evidenceIds?f.id:f.text);
 const delivery=!content?'':/как\s|инструкц/i.test(task)?'Give actions the reader can follow. Keep source control labels exact. If no labels are supplied, do not invent them.'
  :/преимуществ/i.test(task)?'Every item explains a different benefit of the requested subject, not limits of another feature.'
  :/этап|ЗАДАНИЕ: (?:процесс|порядок работы|рабочий процесс)/i.test(task)?'Describe consecutive reader actions, not a list of unrelated product properties.'
  :/призыв|финальн|следующий шаг/i.test(task)?'Ask the reader to take one concrete supported action. Do not substitute a specification or aspect ratio.'
  :/автоном|без интернета/i.test(task)?'Distinguish installation from subsequent use. Claim only offline capabilities supported by the source.' :'';
 const context=prompt.replace(/(?:АУДИТОРИЯ|ЧИТАТЕЛЬ \(не включай название аудитории в текст\)):[^\n]*\n/g,'')
  .replace(/ФАКТЫ ДЛЯ ЭТОЙ СЕКЦИИ:\n[\s\S]*$/,'ИСХОДНЫЕ ФАКТЫ (выбери относящиеся к заданию):\n'+(evidenceIds?sourceEvidence(sources).map(f=>f.id+('parentId'in f?' (фрагмент '+f.parentId+')':'')+': '+f.text).join('\n'):sources))
  .replace(/^ЗАДАНИЕ: [^\n]+\n?/m,'');
 return context+'\n\n'+task+(priority.length?'\nПриоритетные факты для этой темы: '+priority.join(', ')+'.':'')+(delivery?'\n'+delivery:'')+'\nОтвет должен раскрывать именно это задание. Не пересказывай все факты подряд. Идентификаторы фактов не включай в текст читателю.'+requirements;
}

/** Put field meanings in the model context as well as the constrained grammar. */
export function contentContract(format:Record<string,unknown>){
 const fields=(format as any).properties?.content?.properties;if(!fields)return '';
 const lines:string[]=[];
 for(const [slot,field]of Object.entries(fields) as [string,any][]){
  const p=field.properties;
  lines.push(slot+': '+Object.keys(p).join(', ')+'.');
  if(p.sourceId)lines.push(slot+'.sourceId: '+p.sourceId.enum.join('|')+'; choose the fact answering the task.');
  if(p.items?.properties)for(const [key,item]of Object.entries(p.items.properties) as [string,any][]){const props=item.properties;lines.push(slot+'.items.'+key+': '+(props.title.const===undefined?'distinct short title':JSON.stringify(props.title.const))+'; '+(props.sourceId?'sourceId='+props.sourceId.enum.join('|'):'text explains this item only.'))}
  if(p.items?.items)lines.push(slot+'.items: distinct {title,text} items; each explains the requested benefit or step, not unrelated product limits.');
  if(p.rows)lines.push(slot+'.rows: compare the SAME property in each row; distinguish storage, display proportions and file format.');
  if(p.rows?.properties)for(const [key,row]of Object.entries(p.rows.properties) as [string,any][])lines.push(slot+'.rows.'+key+': '+row.properties.feature.const+'; siteSourceId='+row.properties.siteSourceId.enum.join('|')+'; presentationSourceId='+row.properties.presentationSourceId.enum.join('|'));
 }
 return '\nOutput fields:\n'+lines.join('\n');
}
