import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditorSaveQueue,type SaveState} from '../apps/editor/src/editor-save';
import {emptyDocument} from '../apps/editor/src/model';
test('queued writes preserve snapshots, ordering and only acknowledge the latest version',async()=>{
 const states:SaveState[]=[],titles:string[]=[],revisions:string[]=[];
 let release!:()=>void;
 const gate=new Promise<void>(r=>release=r);
 const queue=new EditorSaveQueue({write:async(id,doc)=>{await gate;titles.push(doc.title);return doc},revision:async(id,doc)=>{revisions.push(doc.title)},state:s=>states.push(s),changed:()=>{},revisionError:e=>{throw e},revisionDelay:5});
 const document=emptyDocument();document.title='First';queue.save('id',document);document.title='Second';queue.save('id',document);document.title='Unsubmitted';
 release();await queue.queue;await new Promise(r=>setTimeout(r,20));queue.destroy();
 assert.deepEqual(titles,['First','Second']);assert.deepEqual(states,['saving','saving','saved']);assert.deepEqual(revisions,['Second']);
});
test('a failed save is not acknowledged and a retry can recover',async()=>{
 const states:SaveState[]=[];let fail=true;
 const queue=new EditorSaveQueue({write:async(id,doc)=>{if(fail)throw Error('disk full');return doc},revision:async()=>{},state:s=>states.push(s),changed:()=>{},revisionError:()=>{}});
 queue.save('id',emptyDocument());await queue.queue;assert.equal(queue.error,true);assert.deepEqual(states,['saving','failed']);
 fail=false;queue.save('id',emptyDocument());await queue.queue;assert.equal(queue.error,false);assert.equal(states.at(-1),'saved');queue.destroy();
});

test('slow storage coalesces pending edits and still persists the last snapshot before leaving',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r),titles:string[]=[];
 const queue=new EditorSaveQueue({write:async(_id,doc)=>{await gate;titles.push(doc.title);return doc},revision:async()=>{},state:()=>{},changed:()=>{},revisionError:()=>{}});
 const doc=emptyDocument();for(let i=0;i<100;i++){doc.title=String(i);queue.save('project',doc)}
 release();await queue.queue;queue.destroy();assert.deepEqual(titles,['0','99']);assert.equal(queue.error,false);
});
