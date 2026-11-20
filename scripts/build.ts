import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {buildWorkspace} from './build-workspace';
import {buildDocs} from './build-docs';
import {buildRevision} from './build-revision';
import {frameworkDocsBaseUrl} from './framework-docs-routes';
import {version} from '../package.json';
for(const name of ['editor','ai','ai-server'])await buildWorkspace(name);
const output=resolve('dist/site');if(dirname(output)!==resolve('dist'))throw new Error('Unsafe output directory');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp('dist/editor',output,{recursive:true});await buildDocs('dist/site/docs');
await writeFile(resolve(output, 'build-info.json'), JSON.stringify({
 version: process.env.AF_APP_VERSION || version,
 revision: buildRevision(),
 frameworkDocsUrl: frameworkDocsBaseUrl(),
}) + '\n');
