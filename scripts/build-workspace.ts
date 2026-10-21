import {build as viteBuild} from 'vite';
import {build as bundle} from 'esbuild';
import {cp,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url);
export const frameworkAssets=resolve(dirname(require.resolve('@alabuga/framework/assets/brand/manifest.json')),'..');
export async function buildWorkspace(name:string){
 if(name==='ai'){await bundle({entryPoints:['packages/ai/src/index.ts'],outdir:'packages/ai/dist',bundle:true,platform:'neutral',format:'esm',external:['zod','@alabuga/framework','@alabuga/framework/*']});return}
 if(name==='ai-server'){await bundle({entryPoints:['apps/ai-server/src/ai-server.ts','apps/ai-server/src/bootstrap.ts'],outdir:'apps/ai-server/dist',bundle:true,platform:'node',format:'esm'});return}
 if(name==='editor'){await viteBuild();await cp(frameworkAssets,'dist/editor/assets',{recursive:true});await cp('public/projects','dist/editor/projects',{recursive:true});return}
 if(name==='docs'){const {buildDocs}=await import('./build-docs');await buildDocs();return}
 throw new Error('Unknown Constructor workspace '+name);
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-workspace.ts'))await buildWorkspace(process.argv[2]);
