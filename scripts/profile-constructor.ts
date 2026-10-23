import {performance} from 'node:perf_hooks';
import {mkdir,writeFile} from 'node:fs/promises';
import {EditorModel,emptyDocument} from '../apps/editor/src/model';
const cases=[];
for(const count of [10,100,500]){
 const doc=emptyDocument('page');doc.pages=[];
 for(let p=0;p<Math.ceil(count/10);p++)doc.pages.push({id:'page-'+p,title:'Раздел '+p,grid:{columns:12,rowHeight:64,gap:16},widgets:Array.from({length:Math.min(10,count-p*10)},(_,i)=>({id:`w-${p}-${i}`,type:'text' as const,title:'Текст',position:{col:1,row:i*4+1,width:12,height:3},content:[{type:'paragraph' as const,text:'Содержательный текст для измерения '.repeat(20),dropCap:false}]}))});
 const model=new EditorModel(doc),samples:number[]=[];const before=process.memoryUsage().heapUsed;
 for(let i=0;i<50;i++){const start=performance.now();model.change(d=>{const w=d.pages[0].widgets[0];if(w.type==='text'&&w.content[0].type==='paragraph')w.content[0].text+='а'},'typing');samples.push(performance.now()-start)}
 samples.sort((a,b)=>a-b);cases.push({widgets:count,documentBytes:Buffer.byteLength(JSON.stringify(doc)),medianMs:samples[25],p95Ms:samples[47],heapDelta:process.memoryUsage().heapUsed-before});
}
const name=process.argv[2]||'current';await mkdir('artifacts/remediation',{recursive:true});const report={environment:{node:process.version,platform:process.platform,arch:process.arch},operation:'50 validated inline edits in one undo group; Node.js model benchmark, not browser rendering',cases};await writeFile(`artifacts/remediation/model-${name}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
