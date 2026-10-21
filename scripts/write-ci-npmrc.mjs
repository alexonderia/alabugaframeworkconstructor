import {writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const registry=new URL(process.env.ALABUGA_NPM_REGISTRY),token=process.env.NODE_AUTH_TOKEN;
if(registry.protocol!=='https:'||registry.username||registry.password||!token)throw new Error('HTTPS registry and read token required');
const file=resolve(process.env.RUNNER_TEMP||'.local','constructor-read.npmrc');
await writeFile(file,`//${registry.host}${registry.pathname.replace(/\/?$/,'/')}:_authToken=${token}\n`,{mode:0o600});
if(process.env.GITHUB_ENV)await appendFile(process.env.GITHUB_ENV,`ALABUGA_NPMRC_FILE=${file}\n`);
console.log('Read-only Docker credential file prepared (content is not logged)');
