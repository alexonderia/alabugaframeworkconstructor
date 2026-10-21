import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/slide-fit';await mkdir(out,{recursive:true});const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1000}});
try{
 await page.goto('http://127.0.0.1:4175/builder/');
 const data=await page.evaluate(async()=>{
  const {slideFitFixtures}=await import('/tests/slide-fit-fixtures.ts'),{fitSlide}=await import('/tests/framework/slide-fit.ts');const before=slideFitFixtures(),after=[],report=[];
  for(const [index,p]of before.entries()){const r=await fitSlide(p,{index,previousBackgrounds:after.map(s=>s.appearance?.backgroundId??'')});after.push(r.slide);report.push({index,composition:p.composition,success:r.success,issues:r.issues,changes:r.changes,background:r.slide.appearance,typography:r.slide.widgets.map(w=>w.typography)})}return {before,after,report};
 });
 await writeFile(out+'/fixtures.json',JSON.stringify(data,null,2));
 for(let i=0;i<24;i++)for(const state of ['before','after']){
  await page.evaluate(async slide=>{window.fitCapture?.destroy();const {renderDocument}=await import('/tests/framework/runtime.ts');const host=document.createElement('main');document.body.replaceChildren(host);window.fitCapture=renderDocument(host,{schemaVersion:3,kind:'presentation',title:'Проверка',pages:[slide]},{editing:true});await document.fonts.ready;await Promise.all([...host.querySelectorAll('img')].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(r))},data[state][i]);
  await page.locator('.af-slide').screenshot({path:`${out}/${i+1}-${state}.png`});
 }
 const html=await page.evaluate(async pages=>{const {exportHTML}=await import('/apps/editor/src/export.ts');return exportHTML({schemaVersion:3,kind:'presentation',title:'24 примера автоматического оформления',pages})},data.after);
 await writeFile(out+'/presentation.html',html);await page.setContent(html);await page.evaluate(()=>document.fonts.ready);await page.pdf({path:out+'/presentation.pdf',preferCSSPageSize:true,printBackground:true});
 await writeFile(out+'/report.html',`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Автооформление — до и после</title><style>body{font:18px system-ui;margin:40px;background:#eef3fa;color:#000d3c}article{margin:48px 0}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%}figure{margin:0}a{color:inherit}</style><h1>24 фиксированных примера</h1><p>Содержание одинаковое. Меняются сетка, размеры текста и фирменный фон.</p><p><a href="presentation.html">Автономная презентация</a> · <a href="presentation.pdf">PDF</a></p>${data.report.map(r=>`<article><h2>${r.index+1}. ${r.composition} · ${r.success?'подобрано':'требует правки'}</h2><section><figure><img src="${r.index+1}-before.png"><figcaption>До</figcaption></figure><figure><img src="${r.index+1}-after.png"><figcaption>После</figcaption></figure></section></article>`).join('')}</html>`);
 console.log(JSON.stringify({passed:data.report.filter(r=>r.success).length,total:24,out}));
}finally{await browser.close()}
