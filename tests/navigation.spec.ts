import {test,expect,type Page} from '@playwright/test';

async function referenceSite(page:Page){
 await page.goto('/demo/');
 const base=new URL((await page.getByRole('link',{name:'Документация',exact:true}).getAttribute('href'))!,page.url());
 base.search='';base.hash='';if(!base.pathname.endsWith('/'))base.pathname+='/';
 // The independently deployed docs site is a remote dependency, not a second checkout.
 await page.route(url=>url.origin===base.origin&&url.pathname.startsWith(base.pathname),route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ru"><meta charset="utf-8"><h1>Справочник Framework</h1></html>'}));
 return base;
}

test('root and index bookmarks open Framework documentation and retain query and section',async({page})=>{
 const base=await referenceSite(page);
 for(const entry of ['/?from=bookmark#buttons','/index.html?from=bookmark#colors']){
  const source=new URL(entry,'http://constructor.invalid'),expected=new URL(base);
  expected.search=source.search;expected.hash=source.hash;
  await page.goto(entry);await expect(page).toHaveURL(expected.href);
  await expect(page.getByRole('heading',{name:'Справочник Framework'})).toBeVisible();
 }
});

test('legacy component demos open independently deployed examples with their parameters',async({page})=>{
 const base=await referenceSite(page);
 for(const name of ['panel','form','slides','showcase']){
  const path=`demos/${name}.html`,query=name==='showcase'?'?kind=presentation&from=bookmark#slide-2':'';
  const expected=new URL(path+query,base);
  await page.goto('/'+path+query);await expect(page).toHaveURL(expected.href);
  await expect(page.getByRole('heading',{name:'Справочник Framework'})).toBeVisible();
 }
});

test('project help opens the full workspace documentation in a new tab',async({page})=>{
 await page.goto('/builder/');await page.getByRole('button',{name:'Помощь',exact:true}).click();
 const [guide]=await Promise.all([page.context().waitForEvent('page'),page.getByRole('dialog').getByRole('link',{name:'Документация',exact:true}).click()]);
 await expect(guide).toHaveURL(/\/docs\/ru\/projects\.html$/);
 await expect(guide.locator('main > h1')).toHaveText('Проекты, материалы и рабочее пространство');
 await expect(guide.getByRole('heading',{name:'Локальная библиотека и корзина',exact:true})).toBeVisible();
 await guide.close();
});
