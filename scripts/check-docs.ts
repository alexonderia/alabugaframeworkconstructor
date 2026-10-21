import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {topics} from './build-docs';
const standalone=process.argv.includes('--standalone'),root=resolve(standalone?'dist/docs':'dist/site');
for(const lang of ['ru','en']){
 const actual=(await readdir(`docs/${lang}`)).filter(n=>n.endsWith('.md')).map(n=>n.slice(0,-3)).sort();
 if(JSON.stringify(actual)!==JSON.stringify([...topics].sort()))throw new Error('Translation topic mismatch: '+lang);
 for(const id of topics){const file=resolve(root,`docs/${lang}/${id}.html`),html=await readFile(file,'utf8');if(/\{\{[A-Z_]+\}\}/.test(html))throw new Error('Unresolved documentation URL '+file);if(!html.includes(`../${lang==='ru'?'en':'ru'}/${id}.html`))throw new Error('Missing language switch '+file);
  for(const link of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)){if(/^https?:|mailto:/.test(link[1])||standalone&&/^\/(demo|builder)\//.test(link[1]))continue;const target=link[1].startsWith('/')?resolve(root,'.'+link[1]):resolve(dirname(file),link[1]);await access(target)}
 }
}
console.log('RU/EN parity and local documentation links passed');
