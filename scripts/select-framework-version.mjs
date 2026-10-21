import {readFile,writeFile} from 'node:fs/promises';
const root=JSON.parse(await readFile('package.json','utf8'));
const version=process.argv[2]==='--minimum'?root.alabugaFramework.minimum:process.argv[2];
if(!/^1\.\d+\.\d+(?:-[\w.]+)?$/.test(version||''))throw new Error('Pass a supported Framework 1.x version');
for(const file of ['package.json','apps/editor/package.json','packages/ai/package.json']){const pkg=JSON.parse(await readFile(file,'utf8'));pkg.dependencies['@alabuga/framework']=version;await writeFile(file,JSON.stringify(pkg,null,2)+'\n')}
console.log('Framework candidate selected; run npm install, then all checks.');
