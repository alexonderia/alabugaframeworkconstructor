import ts from 'typescript';
import {readdir,readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),framework=JSON.parse(await readFile(require.resolve('@alabuga/framework/package.json'),'utf8'));
try{await access('packages/framework');throw new Error('Framework sources must not exist in Constructor')}catch(e){if(e.code!=='ENOENT')throw e}
const roots=['apps/editor','apps/ai-server','packages/ai','scripts','tests'],errors=[];
async function walk(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).filter(e=>!['dist','node_modules'].includes(e.name)).map(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]))).flat()}
function check(file,spec){
 const clean=spec.split('?')[0];
 if(/packages\/framework|alabuga-framework[\\/]src|@alabuga\/framework\/(src|dist)\//.test(clean))errors.push(file+': internal Framework reference '+spec);
 if(clean.startsWith('@alabuga/framework')){const entry=clean==='@alabuga/framework'?'.':'.'+clean.slice('@alabuga/framework'.length);if(!framework.exports[entry]&&!Object.keys(framework.exports).some(k=>k.endsWith('*')&&entry.startsWith(k.slice(0,-1))))errors.push(file+': unpublished entry '+entry)}
 if(clean.startsWith('.')){const target=resolve(file,'..',clean);if(!target.startsWith(process.cwd()))errors.push(file+': import escapes repository '+spec)}
}
for(const root of roots)for(const file of await walk(root))if(/\.(ts|mjs|css)$/.test(file)&&!file.endsWith('check-boundaries.mjs')){
 const text=await readFile(file,'utf8');if(/\/packages\/framework\/src\//.test(text))errors.push(file+': Framework source browser URL');
 if(file.endsWith('.css')){for(const m of text.matchAll(/@import\s+['"]([^'"]+)['"]/g))check(file,m[1]);continue}
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 function visit(node){if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))check(file,node.moduleSpecifier.text);if(ts.isCallExpression(node)&&node.arguments[0]){let arg=node.arguments[0];while(ts.isAsExpression(arg)||ts.isParenthesizedExpression(arg))arg=arg.expression;if((node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')&&ts.isStringLiteral(arg))check(file,arg.text)}ts.forEachChild(node,visit)}visit(source);
}
for(const file of ['package.json','apps/editor/package.json','packages/ai/package.json']){const p=JSON.parse(await readFile(file,'utf8')),v=p.dependencies?.['@alabuga/framework'];if(!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(v))errors.push(file+': Framework must use an exact npm version')}
if(errors.length)throw new Error(errors.join('\n'));console.log('Constructor uses published Framework APIs only');
