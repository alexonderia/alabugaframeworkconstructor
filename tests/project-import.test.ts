import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importProject} from '../apps/editor/src/storage';
const doc={schemaVersion:3,kind:'page',title:'Compatible',pages:[{id:'p',title:'',grid:{columns:12,rowHeight:64,gap:16},widgets:[]}]};
test('legacy bare documents and project envelopes 1–3 remain readable',()=>{
 for(const schemaVersion of [1,2,3])assert.equal(importProject({...doc,schemaVersion}).schemaVersion,3);
 for(const version of [undefined,1,2,3])assert.equal(importProject({format:'alabuga-project',version,document:doc,assets:[]}).title,'Compatible');
});
test('schema 4 responsive overrides survive the version 3 portable envelope',()=>{
 const widget={id:'responsive',type:'text',title:'',position:{col:1,row:1,width:6,height:2},responsive:{tablet:{width:73,minHeight:271},mobile:{width:91,minHeight:193}},content:[]};
 const input={...doc,schemaVersion:4,pages:[{...doc.pages[0],widgets:[widget]}]};
 for(const value of [input,{format:'alabuga-project',version:3,document:input,assets:[]}]){const result=importProject(value);assert.equal(result.schemaVersion,4);assert.deepEqual(result.pages[0].widgets[0].responsive,widget.responsive)}
 assert.deepEqual(input.pages[0].widgets[0],widget);
});

test('schema 5 slide annotations survive the version 3 portable envelope',()=>{
 const chrome={header:{visible:false,text:'АЛАБУГА / Проект'},number:{value:'A-07',position:'center',format:'total',background:'white',color:'ink'}};
 const input={...doc,kind:'presentation',schemaVersion:5,pages:[{...doc.pages[0],chrome}]};
 for(const value of [input,{format:'alabuga-project',version:3,document:input,assets:[]}]){const result=importProject(value);assert.equal(result.schemaVersion,5);assert.deepEqual(result.pages[0].chrome,chrome)}
});
test('unknown versions, invalid formats and missing assets fail before storage',()=>{
 assert.throws(()=>importProject({format:'alabuga-project',version:4,document:doc}),/версия/);
 assert.throws(()=>importProject({...doc,schemaVersion:6}));
 assert.throws(()=>importProject({format:'other',document:doc}),/формат/);
 const image={id:'photo',type:'image',title:'',position:{col:1,row:1,width:4,height:4},src:'asset:'+'a'.repeat(64),alt:'Photo',fit:'contain',caption:''};
 assert.throws(()=>importProject({format:'alabuga-project',version:3,document:{...doc,pages:[{...doc.pages[0],widgets:[image]}]},assets:[]}),/материал/);
 assert.equal(typeof indexedDB,'undefined');
});
