import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const dir='artifacts/demo';await mkdir(dir,{recursive:true});const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.goto('http://127.0.0.1:4175/demo/');await page.evaluate(()=>document.fonts.ready);
 for(const width of [390,768,1440,1920]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${dir}/start-${width}.png`,fullPage:true})}
 await page.setViewportSize({width:1440,height:1000});
 for(const kind of ['page','presentation']){
  const result=await page.evaluate(async kind=>{const {demoDocument}=await import('/tests/framework/demo-documents.ts'),{exportHTML}=await import('/apps/editor/src/export.ts'),{portableProject}=await import('/apps/editor/src/storage.ts');const doc=demoDocument(kind);return {html:await exportHTML(doc),project:await portableProject(doc)}},kind);
  await writeFile(`${dir}/${kind}.html`,result.html.replace('Alabuga.renderDocument(document','window.previewController=Alabuga.renderDocument(document'));await writeFile(`${dir}/${kind}.project.json`,JSON.stringify(result.project,null,2));
  const preview=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});await preview.route(/^https?:\/\//,r=>r.abort());await preview.goto(pathToFileURL(resolve(`${dir}/${kind}.html`)).href);await preview.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});
  if(kind==='presentation'){for(let i=0;i<11;i++){await preview.evaluate(i=>window.previewController.goToSlide(i),i);while(await preview.locator('.af-slide--active .af-step-hidden').count())await preview.getByRole('button',{name:'Далее →',exact:true}).click();await preview.screenshot({path:`${dir}/slide-${i+1}.png`})}await preview.pdf({path:`${dir}/presentation.pdf`,printBackground:true,preferCSSPageSize:true})}
  else{for(const width of [390,768,1440]){await preview.setViewportSize({width,height:1000});await preview.screenshot({path:`${dir}/site-${width}.png`,fullPage:true})}}
  await preview.close();
 }
 await page.getByRole('button',{name:'Настроить элементы',exact:true}).click();await page.locator('#project-name').waitFor();await page.screenshot({path:dir+'/editor.png',fullPage:true});
}finally{await browser.close()}
