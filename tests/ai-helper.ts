import type {Page} from '@playwright/test';
import {fixtureCommands} from './ai-fixtures';
export async function mockAI(page:Page,delay=0){
 await page.route('**/api/ai/readiness',route=>route.fulfill({json:{ready:true}}));
 await page.route('**/api/ai/status',route=>route.fulfill({json:{model:'qwen3.5:2b',version:'test-double',digest:'fixture-only',context:4096}}));
 await page.route('**/api/ai/generate',async route=>{
  if(delay)await new Promise(r=>setTimeout(r,delay));
  const body=route.request().postDataJSON();let data;
  if(body.format.properties.sections){const count=body.format.properties.sections.minItems;const names=['text','features','split','steps','comparison','thesis'],titles=['Идея','Возможности','Графика','Процесс','Форматы','Итог'];data={title:'История конструктора',sections:Array.from({length:count},(_,i)=>({composition:names[i],title:titles[i],purpose:body.format.properties.sections.items.properties.purpose.enum?.[0]??'Показать возможности'}))}}
  else{const fields=body.format.properties.content?.properties??body.format.properties.commands.properties,composition=body.format.properties.composition?.const??fields.create.properties.composition.const;data=fixtureCommands(composition,['thesis','divider','final'].includes(composition)?'presentation':'page');for(const command of data.commands){if(command.tool==='setImage')command.asset=fields['slot'+command.slot].properties.asset.enum?.[0]??fields['slot'+command.slot].properties.asset.const;if(command.tool==='setGallery')command.items.forEach(i=>i.asset=fields['slot'+command.slot].properties.items.items.properties.asset.enum?.[0]??fields['slot'+command.slot].properties.items.items.properties.asset.const)}}
  if(data.commands&&body.format.properties.content){data={composition:body.format.properties.composition.const,content:Object.fromEntries(data.commands.filter((c:any)=>c.tool!=='createSection').map(({tool,slot,...value}:any)=>{const properties=body.format.properties.content.properties['slot'+slot].properties;if(properties.sourceId){delete value.text;value.sourceId=properties.sourceId.enum[0]}else if(value.text){if(body.format.properties.composition.const==='split')value.text='Добавляйте свои тексты и изображения к фирменной композиции.';if(body.format.properties.composition.const==='thesis')value.text='Проверьте готовый материал перед экспортом и показом.'}for(const [key,field]of Object.entries(properties) as [string,any][])if(Object.hasOwn(field,'const'))value[key]=field.const;return ['slot'+slot,value]}))}}
  if(data.commands)data={commands:Object.fromEntries(data.commands.map((c:any)=>[c.tool==='createSection'?'create':'slot'+c.slot,c]))};
  await route.fulfill({json:{data}});
 });
}
