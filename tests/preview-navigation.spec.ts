import {test,expect} from '@playwright/test';
import {openEditor} from './open-editor';

test('finishing an autosave preserves a preview navigation that is already requested',async({page})=>{
 // Hold route handling until the pending write completes, reproducing the
 // ordering seen when navigation and IndexedDB finish under browser load.
 await page.addInitScript(()=>{
  let held=false;
  window.addEventListener('hashchange',event=>{
   if(held||!location.hash.startsWith('#/view/'))return;
   held=true;event.stopImmediatePropagation();
   const release=()=>{
    if(document.querySelector('#save-state')?.textContent!=='Сохранено в браузере')return;
    observer.disconnect();requestAnimationFrame(()=>window.dispatchEvent(new HashChangeEvent('hashchange')));
   };
   const observer=new MutationObserver(release);observer.observe(document.body,{subtree:true,childList:true,characterData:true});release();
  },true);
 });
 await openEditor(page);
 await page.evaluate(()=>{
  const name=document.querySelector<HTMLInputElement>('#project-name')!;name.value='Сохранённый проект перед просмотром';
  name.dispatchEvent(new Event('change',{bubbles:true}));
  document.querySelector<HTMLButtonElement>('#preview')!.click();
 });
 await expect(page).toHaveURL(/#\/view\//);
 await expect(page.getByRole('heading',{name:'Сохранённый проект перед просмотром',exact:true})).toBeVisible();
 await expect(page.frameLocator('.project-preview iframe').locator('.af-document')).toBeVisible();
});
