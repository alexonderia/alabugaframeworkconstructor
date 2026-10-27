import {showDialog,libraryDialog,el,button} from '../src/ui';
import {brandAssets} from '@alabuga/framework/brand';
import {OllamaProvider} from '@alabuga/ai/provider';
import {newDraft,generateDraft} from '../src/ai/generation';
import {productFacts,demoPrompts} from '@alabuga/ai/demo-facts';
import {checkSection} from '../src/ai/quality';
import {draftDocument} from '@alabuga/ai/contracts';
import {renderDocument} from '../src/framework-adapter';
import {type DocumentController} from '@alabuga/framework/runtime';
import {writeSetting} from '../src/storage';
import lock from '../../../config/model-lock.json';
import {checkMaterial} from './material-check';
export async function openDiagnostics(){
 if(document.querySelector('.demo-diagnostics'))return;
 const {dialog,body}=libraryDialog('Готовность к показу','demo-diagnostics'),result=el('pre'),checks=el('ul','demo-checks'),status=el('p'),previews=el('div','demo-probes');status.setAttribute('role','status');const abort=new AbortController();let busy=false;const controllers:DocumentController[]=[];const commands:HTMLButtonElement[]=[];
 body.append(el('p','','Проверка выполняется на этом устройстве. Прогрев запускается отдельно и не создаёт проект.'));
 const run=async(probe?:'page'|'presentation'|'both')=>{if(busy)return;busy=true;commands.forEach(b=>b.disabled=true);controllers.splice(0).forEach(c=>c.destroy());previews.replaceChildren();checks.replaceChildren();result.textContent='';status.textContent=probe?'Прогреваем модель и создаём пробный фрагмент…':'Проверяем сервис и материалы…';try{
  const provider=new OllamaProvider(),info=await provider.status(abort.signal);
  const assets=await Promise.all(Object.values(brandAssets).map(src=>checkMaterial(src,abort.signal)));
  await document.fonts.ready;
  abort.signal.throwIfAborted();
  const data:any={checkedAt:new Date().toISOString(),model:info.model,version:info.version,digest:info.digest,expectedBuild:info.digest===lock.digest&&info.version===lock.ollama,materials:assets,loaded:info.loaded,probes:[]};
  if(probe)for(const kind of probe==='both'?['page','presentation'] as const:[probe]){
   abort.signal.throwIfAborted();const start=performance.now(),draft=newDraft({kind,scope:'section',count:1,prompt:demoPrompts[kind],sources:productFacts,audience:'Авторы контента'},'diagnostics','');
   const generated=await generateDraft(draft,provider,[],abort.signal,async d=>{status.textContent=(kind==='page'?'Секция: ':'Слайд: ')+d.status.message},p=>checkSection(p,kind));
   abort.signal.throwIfAborted();
   const sample={kind,milliseconds:Math.round(performance.now()-start),success:generated.status.stage==='ready',errors:generated.errors,warnings:generated.warnings};data.probes.push(sample);
   const card=el('section','demo-probe');card.append(el('h3','',`${kind==='page'?'Секция сайта':'Слайд'} · ${sample.success?'проверка пройдена':'нужно исправление'} · ${(sample.milliseconds/1000).toFixed(1)} с`));
   if(generated.sections.some(Boolean)){const host=el('div');card.append(host);previews.append(card);controllers.push(renderDocument(host,draftDocument(generated),{editing:true}))}else previews.append(card);
  }
  if(probe)data.loaded=(await provider.status(abort.signal)).loaded;
  const response=await fetch('/api/ai/diagnostics',{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});if(response.ok)data.device=await response.json();
  abort.signal.throwIfAborted();
  const loaded=Array.isArray(data.loaded)?data.loaded.find((m:any)=>m.name===info.model):undefined;
  data.ready=probe==='both'&&data.probes.length===2&&data.probes.every((p:any)=>p.success)&&data.expectedBuild&&assets.every(a=>a.available)&&!!loaded?.size&&loaded.size_vram===loaded.size;
  await writeSetting('demo:diagnostics',data);result.textContent=JSON.stringify(data,null,2);
  for(const text of ['Локальный сервис доступен.',data.expectedBuild?'Сборка модели и версия Ollama совпадают с проверенными.':'Сборка отличается от проверенной — повторите приёмочные измерения.',assets.every(a=>a.available)?'Фирменные материалы доступны.':'Некоторые материалы недоступны.',!loaded?'Модель ещё не загружена. Запустите прогрев.':loaded.size_vram===loaded.size?'Модель целиком размещена на GPU.':'Часть модели находится вне GPU — требование устройства пока не выполнено.'])checks.append(el('li','',text));
  checks.append(el('li','','Запись локального отчёта проверена.'));
  status.textContent=data.ready?'Техническая репетиция пройдена: секция и слайд созданы. Проверьте содержание образцов ниже.':probe?(data.probes.every((p:any)=>p.success)?'Фрагменты созданы. Для полной проверки выполните сценарий показа и проверьте замечания ниже.':'Пробная генерация не прошла. Повторите проверку или откройте готовые образцы.'):'Диагностика сохранена. Модель ещё нужно проверить пробной генерацией.';
 }catch(e){if(!abort.signal.aborted){status.textContent='Проверка не завершена: '+String(e);result.textContent='Запустите локальный сервис: npm run ai. Затем повторите проверку. Готовые образцы доступны без генерации.'}}finally{busy=false;commands.forEach(b=>b.disabled=false)}};
 const details=el('details');details.append(el('summary','af-btn af-btn--clear af-btn--sm','Технические сведения'),result);
 commands.push(button('Проверить подключение',()=>void run(),'af-btn af-btn--secondary'),button('Прогреть и проверить секцию',()=>void run('page'),'af-btn af-btn--secondary'),button('Проверить слайд',()=>void run('presentation'),'af-btn af-btn--secondary'),button('Проверить сценарий показа',()=>void run('both'),'af-btn'));
 const commandGroup=el('div','demo-diagnostic-commands');commandGroup.append(...commands);
 const fallback=button('Вернуться к готовым образцам',()=>dialog.close(),'af-btn af-btn--ghost');
 body.append(commandGroup,status,checks,el('p','','Образцы на главной странице подготовлены заранее. Они не заменяют успешную генерацию вживую.'),fallback,previews,details);
 dialog.addEventListener('close',()=>{abort.abort();controllers.splice(0).forEach(c=>c.destroy());dialog.remove()});document.body.append(dialog);showDialog(dialog);await run();
}
