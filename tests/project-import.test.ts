import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importProject} from '../apps/editor/src/storage';
const doc={schemaVersion:3,kind:'page',title:'Compatible',pages:[{id:'p',title:'',grid:{columns:12,rowHeight:64,gap:16},widgets:[]}]};
test('legacy bare documents and project envelopes 1–3 remain readable',()=>{
 for(const schemaVersion of [1,2,3])assert.equal(importProject({...doc,schemaVersion}).schemaVersion,3);
 for(const version of [undefined,1,2,3])assert.equal(importProject({format:'alabuga-project',version,document:doc,assets:[]}).title,'Compatible');
});
test('unknown versions, invalid formats and missing assets fail before storage',()=>{
 assert.throws(()=>importProject({format:'alabuga-project',version:4,document:doc}),/версия/);
 assert.throws(()=>importProject({...doc,schemaVersion:4}));
 assert.throws(()=>importProject({format:'other',document:doc}),/формат/);
 const image={id:'photo',type:'image',title:'',position:{col:1,row:1,width:4,height:4},src:'asset:'+'a'.repeat(64),alt:'Photo',fit:'contain',caption:''};
 assert.throws(()=>importProject({format:'alabuga-project',version:3,document:{...doc,pages:[{...doc.pages[0],widgets:[image]}]},assets:[]}),/материал/);
 assert.equal(typeof indexedDB,'undefined');
});
