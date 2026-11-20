import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.AF_AI_REPEAT_DIR||'artifacts/demo/ai-repeat';await mkdir(out,{recursive:true});const server=await createServer({server:{host:'127.0.0.1',port:4187,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[];
try{
 await page.goto('http://127.0.0.1:4187/demo/');await page.getByRole('button',{name:'Редактировать образец сайта',exact:true}).click();await page.locator('#project-name').waitFor();
 for(const kind of ['page','presentation'])for(let repeat=1;repeat<=3;repeat++){
  const result=await page.evaluate(async({kind,repeat})=>{const {newDraft,generateDraft}=await import('/apps/editor/src/ai/generation.ts'),{OllamaProvider}=await import('/packages/ai/src/provider.ts'),{productFacts,demoPrompts}=await import('/packages/ai/src/demo-facts.ts'),{checkSection}=await import('/apps/editor/src/ai/quality.ts');const start=performance.now(),d=newDraft({kind,scope:'section',count:1,prompt:demoPrompts[kind],sources:productFacts,audience:'Авторы контента'},'repeat','');const draft=await generateDraft(d,new OllamaProvider(),[],new AbortController().signal,async()=>{},p=>checkSection(p,kind));return {kind,repeat,elapsedMs:Math.round(performance.now()-start),draft}}, {kind,repeat});
  results.push(result);await writeFile(`${out}/${kind}-${repeat}.json`,JSON.stringify(result,null,2));console.log(kind,repeat,result.draft.status.stage,result.elapsedMs);
 }
 await writeFile(out+'/report.json',JSON.stringify({results,loaded:await (await fetch('http://127.0.0.1:11434/api/ps')).json()},null,2));
}finally{await browser.close();await server.close()}
