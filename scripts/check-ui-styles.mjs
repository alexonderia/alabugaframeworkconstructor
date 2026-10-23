import {readdir,readFile} from 'node:fs/promises';
import ts from 'typescript';
import postcss from 'postcss';

async function styles(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?styles(dir+'/'+e.name):e.name.endsWith('.css')?[dir+'/'+e.name]:[]))).flat()}
const files=await styles('apps/editor'),errors=[];
const primitive=/\.(?:af-(?:btn(?:--[\w-]+)?|input(?:--[\w-]+)?|select(?:[\w-]+|__[\w-]+)?|textarea|label|check|checkbox|radio|card(?:--[\w-]+)?|badge|help|dialog(?:__title|__header)?)|product-dialog|block-catalog|asset-library|project-library|ai-dialog|fit-dialog|demo-diagnostics|slide-settings-tab|outline-add|outline-close|widget-handle|insert-button|image-change|asset-card|template-card|palette-button|project-card|project-thumbnail|project-create|section-count|author-tutorial|outline-actions|variant-card|ai-properties)(?:\[[^\]]+\])?(?::[\w-]+(?:\([^)]*\))?)*$/;
const visual=/^(?:font(?:-.+)?|line-height|letter-spacing|color|background(?:-.+)?|border(?:-.+)?|box-shadow|outline(?:-.+)?)$/;
for(const file of files){
 const css=await readFile(file,'utf8');
 const parsed=postcss.parse(css,{from:file});
 parsed.walkRules(rule=>{if(!rule.selector.trim())errors.push(`${file}: CSS rule has no selector`)});
 // Inspect declaration values: selectors such as #add-widget are not colors.
 for(const match of css.matchAll(/(?:^|[;{])\s*([\w-]+)\s*:\s*([^;{}]*)(?=[;}])/g)){
  if(/#[\da-f]{3,8}\b/i.test(match[2])||/^(?:color|background(?:-color)?)$/.test(match[1])&&/\b(?:white|black)\b/.test(match[2]))errors.push(`${file}: ${match[1]} uses a literal color`);
  if(match[1].startsWith('--af-'))errors.push(`${file}: do not redefine public Framework token ${match[1]}`);
 }
 // Shell layout may position/size controls. Framework owns their visual recipe,
 // typography and interaction states; domain thumbnails/selection stay separate.
 parsed.walkRules(rule=>{
  const selectors=rule.selectors;
  if(!selectors.some(s=>primitive.test(s.trim())||/(?:^|[ >])summary$/.test(s.trim())||/\.(?:creation-methods|ai-material) label$/.test(s.trim())||/^(?:button|input|select|textarea)(?::[\w-]+)?$/.test(s.trim())||/\.(?:card-menu|project-menu)\s*>?\s*(?:button|div)(?::[\w-]+)?$/.test(s.trim())||/\.(?:document-name|page-picker) (?:input|select)$/.test(s.trim())))return;
  rule.walkDecls(({prop:property})=>{
   if(visual.test(property))errors.push(`${file}: ${rule.selector} overrides Framework ${property}`);
   if(/\.af-(?:input|select|textarea)(?:--[\w-]+)?\b/.test(rule.selector)&&/^(?:height|min-height|padding(?:-.+)?)$/.test(property))errors.push(`${file}: choose a Framework field size variant instead of ${property}`);
  });
 });
}
// CSS checks cannot catch a control that never opted into Framework at all.
async function sources(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?sources(dir+'/'+e.name):e.name.endsWith('.ts')?[dir+'/'+e.name]:[]))).flat()}
const contracts={input:/\baf-(?:input|checkbox|radio|switch)\b/,select:/\baf-select\b/,textarea:/\baf-textarea\b/,button:/\baf-btn\b/,summary:/\baf-btn\b/};
for(const file of await sources('apps/editor')){
 const text=await readFile(file,'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 const check=(tag,classes,pos)=>{if(contracts[tag]&&!contracts[tag].test(classes))errors.push(`${file}:${ast.getLineAndCharacterOfPosition(pos).line+1}: ${tag} is missing its public Framework class`)};
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='el'&&ts.isStringLiteral(node.arguments[0])){
   const [tag,classes]=node.arguments;
   if(!classes||ts.isStringLiteral(classes))check(tag.text,classes?.text??'',node.getStart(ast));
  }
  if(ts.isTemplateExpression(node)||ts.isNoSubstitutionTemplateLiteral(node)){
   for(const match of node.getText(ast).matchAll(/<(input|select|textarea|button|summary)\b([^>]*)>/g))check(match[1],/class=["']([^"']*)["']/.exec(match[2])?.[1]??'',node.getStart(ast)+match.index);
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);
}
if(errors.length)throw new Error(errors.join('\n'));
console.log(`Constructor UI: checked ${files.length} stylesheets and Framework classes in control markup`);
