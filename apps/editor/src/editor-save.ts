import type {AFDocument} from '@alabuga/framework/schema';

export type SaveState='saving'|'saved'|'failed';
export interface SaveServices {
 write:(id:string,document:AFDocument)=>Promise<AFDocument>;
 revision:(id:string,document:AFDocument)=>Promise<unknown>;
 state:(state:SaveState,error?:unknown)=>void;
 changed:(id:string)=>void;
 revisionError:(error:unknown)=>void;
 revisionDelay?:number;
}

/** Serializes writes and keeps completion from an older write out of the current UI. */
export class EditorSaveQueue {
 queue:Promise<void>=Promise.resolve();
 error=false;
 private generation=0;
 private stopped=false;
 private timer:ReturnType<typeof setTimeout>|undefined;
 private pending:{id:string;snapshot:AFDocument;generation:number}[]=[];
 private running=false;
 constructor(private services:SaveServices){}
 save(id:string,document:AFDocument){
  if(this.stopped)return;
  const snapshot=structuredClone(document),generation=++this.generation;
  clearTimeout(this.timer);this.services.state('saving');
  const last=this.pending.at(-1),entry={id,snapshot,generation};
  if(last?.id===id)this.pending[this.pending.length-1]=entry;else this.pending.push(entry);
  if(!this.running)this.queue=this.drain();
 }
 private async drain(){
  this.running=true;
  try{while(this.pending.length){const {id,snapshot,generation}=this.pending.shift()!;
   try{
    const stored=await this.services.write(id,snapshot);this.error=false;
    if(this.stopped)continue;
    this.services.changed(id);
    if(generation!==this.generation)continue;
    this.services.state('saved');
    this.timer=setTimeout(()=>{void this.services.revision(id,stored).catch(e=>{if(!this.stopped)this.services.revisionError(e)})},this.services.revisionDelay??30000);
   }catch(error){this.error=true;if(!this.stopped&&generation===this.generation)this.services.state('failed',error)}
  }}finally{this.running=false}
 }
 acknowledge(){this.error=false;this.services.state('saved')}
 destroy(){this.stopped=true;clearTimeout(this.timer)}
}
