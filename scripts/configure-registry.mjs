import {readFile,writeFile} from 'node:fs/promises';
const registry=new URL(process.argv[2]||process.env.ALABUGA_NPM_REGISTRY||'http://127.0.0.1:4873/');
if(registry.username||registry.password||registry.search||registry.hash)throw new Error('Registry URL must not contain credentials, query or fragment');
if(registry.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(registry.hostname)&&!(registry.hostname==='host.docker.internal'&&process.env.ALABUGA_ALLOW_DOCKER_REGISTRY==='1'))throw new Error('Remote registry requires HTTPS');
if(!registry.pathname.endsWith('/'))registry.pathname+='/';
await writeFile('.npmrc',`registry=https://registry.npmjs.org/\n@alabuga:registry=${registry.href}\n`);
try{
 const file='package-lock.json',lock=JSON.parse(await readFile(file,'utf8'));
 for(const [path,record]of Object.entries(lock.packages||{}))if(path.endsWith('node_modules/@alabuga/framework')&&record.version&&record.integrity)record.resolved=new URL(`@alabuga/framework/-/framework-${record.version}.tgz`,registry).href;
 await writeFile(file,JSON.stringify(lock,null,2)+'\n');
}catch(error){if(error.code!=='ENOENT')throw error}
console.log('Scoped registry configured: '+registry.href+' (archive integrity preserved)');
