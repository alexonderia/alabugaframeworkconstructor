import '@alabuga/framework/standalone.css';
import '@alabuga/framework';
import '../src/product.css';
import './style.css';
import {mountControls} from '../src/component-lifecycle';
import {el,button} from '../src/ui';
import {renderDocument} from '../src/framework-adapter';

import {demoDocument} from '@alabuga/framework/demo-documents';
import {brandAssets} from '@alabuga/framework/brand';
import {saveProject,writeSetting} from '../src/storage';
const openAI:typeof import('../src/ai/panel').openAI=(...args)=>import('../src/ai/panel').then(m=>m.openAI(...args));
import {draftDocument} from '@alabuga/ai/contracts';
import {openDiagnostics} from './diagnostics';
const root=document.querySelector<HTMLElement>('#demo')!;let busy=false;
const frameworkDocsUrl=import.meta.env.VITE_FRAMEWORK_DOCS_URL||'http://127.0.0.1:4391/';
const header=el('header','demo-header'),brand=el('a','demo-brand'),logo=el('img');logo.src=brandAssets.logo;logo.alt='Алабуга';brand.href='./';brand.append(logo,el('strong','','Framework'));const nav=el('nav');
for(const [label,href]of [['Мои проекты','../builder/'],['Помощь','./guide.html'],['Документация',frameworkDocsUrl]]){const a=el('a','',label);a.href=href;nav.append(a)}
nav.append(button('Готовность к показу',()=>void openDiagnostics(),'af-btn af-btn--secondary'));header.append(brand,nav);root.append(header);
const hero=el('section','demo-hero');hero.append(el('p','demo-kicker','САЙТЫ И ПРЕЗЕНТАЦИИ · ЛОКАЛЬНО'),el('h1','','От идеи —\nк своей истории.'),el('p','demo-lead','Начните с готовой композиции. Настройте каждый элемент. Доверьте первый черновик локальному ИИ.'));
const select=el('select','af-select');select.setAttribute('aria-label','Формат проекта');for(const [v,t]of [['page','Сайт'],['presentation','Презентация']]){const o=el('option','',t);o.value=v;select.append(o)}
const actions=el('div','demo-actions'),status=el('p','demo-status');status.setAttribute('role','status');
async function create(mode:'template'|'elements'|'ai'){
 if(busy)return;busy=true;actions.inert=true;status.textContent='Готовим рабочее пространство…';const kind=select.value as 'page'|'presentation';
 try{
  if(mode==='ai'){await openAI({projectId:'demo-'+kind,anchorId:'',kind,demo:true},async draft=>{const id=crypto.randomUUID();await saveProject(id,draftDocument(draft),draft.id);location.href='../builder/#/edit/'+id});status.textContent='Черновик появится в проектах только после применения.';return}
  const doc=demoDocument(kind),id=crypto.randomUUID();doc.title+=' — моя копия';await saveProject(id,doc);await writeSetting('tutorial:'+id,{enabled:true,section:mode==='elements'?(kind==='page'?4:5):0,done:[]});location.href='../builder/#/edit/'+id;
 }catch(e){status.textContent='Не удалось создать копию: '+String(e)}finally{busy=false;actions.inert=false}
}
actions.append(select,button('Собрать из шаблона',()=>void create('template'),'af-btn'),button('Настроить элементы',()=>void create('elements'),'af-btn af-btn--secondary'),button('Создать с ИИ',()=>void create('ai'),'af-btn af-btn--secondary'));hero.append(actions,status,el('p','demo-note','Без аккаунта. Проекты хранятся в этом браузере. Исходный образец остаётся неизменным.'));root.append(hero);const disposeControls=mountControls(actions);
const gallery=el('section','demo-gallery');gallery.append(el('h2','','Один конструктор. Два результата.'),el('p','','Это живые документы из штатных компонентов. Посмотрите образцы, затем откройте свою копию.'));
const controllers:ReturnType<typeof renderDocument>[]=[];
for(const kind of ['page','presentation'] as const){const article=el('article','demo-sample'),head=el('div','demo-sample-head');head.append(el('h3','',kind==='page'?'Сайт · 10 секций':'Презентация · 11 слайдов'));head.append(button('Открыть свою копию',()=>{select.value=kind;void create('template')},'af-btn af-btn--secondary'));const host=el('div','demo-preview '+kind);article.append(head,host);gallery.append(article);controllers.push(renderDocument(host,demoDocument(kind)))}root.append(gallery);
const footer=el('footer','demo-footer');footer.append(el('p','','Создано средствами Alabuga Framework. Эти образцы подготовлены редактором; новые черновики ИИ создаются отдельно.'),el('p','','Шаблоны → содержание → настройка → предпросмотр → экспорт.'));root.append(footer);
window.addEventListener('pagehide',()=>{disposeControls();controllers.forEach(c=>c.destroy())},{once:true});
