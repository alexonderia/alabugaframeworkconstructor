import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=JSON.parse(await readFile('package.json','utf8')),pkg=JSON.parse(await readFile(require.resolve('@alabuga/framework/package.json'),'utf8'));
if(root.dependencies['@alabuga/framework']!==pkg.version)throw new Error('Installed Framework differs from exact application pin');
const policy=root.alabugaFramework,actual=pkg.version.split('-')[0].split('.').map(Number),minimum=policy.minimum.split('-')[0].split('.').map(Number);
if(actual[0]!==policy.major)throw new Error('Unsupported Framework major');
const difference=actual.findIndex((v,i)=>v!==minimum[i]);
if(difference<0&&pkg.version.includes('-')&&!policy.minimum.includes('-'))throw new Error('Prerelease is below supported stable minimum');
if(difference>=0&&actual[difference]<minimum[difference])throw new Error('Framework is below supported minimum');
for(const path of ['apps/editor','packages/ai']){const p=JSON.parse(await readFile(path+'/package.json','utf8'));if(p.dependencies['@alabuga/framework']!==pkg.version)throw new Error('Workspace Framework version mismatch: '+path)}
console.log('Exact Framework version and supported major verified: '+pkg.version);
