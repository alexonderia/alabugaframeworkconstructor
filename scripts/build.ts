import {cp,mkdir,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {buildWorkspace} from './build-workspace';
import {buildDocs} from './build-docs';
for(const name of ['editor','ai','ai-server'])await buildWorkspace(name);
const output=resolve('dist/site');if(dirname(output)!==resolve('dist'))throw new Error('Unsafe output directory');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp('dist/editor',output,{recursive:true});await buildDocs('dist/site/docs');
