import {type Page,type Locator,expect} from '@playwright/test';
export async function widgetTools(page:Page,box:Locator){const id=await box.getAttribute('data-widget-id');return page.locator(`.canvas-widget-tools>.widget-tools[data-controls-for="${id}"]`)}
export async function openGeometry(page:Page){const group=page.locator('.property-group').filter({has:page.locator('summary',{hasText:'Размеры и положение'})});if(await group.count()&&!await group.evaluate(n=>(n as HTMLDetailsElement).open)){await group.locator('summary').scrollIntoViewIfNeeded();await group.locator('summary').click();await expect(group).toHaveAttribute('open')}}
export async function settledProperties(page:Page){await expect(page.locator('#save-state')).not.toContainText(/^(Проверяем|Сохраняем)/)}
export async function openTools(page:Page){const summary=page.locator('.editor-more>summary');if(await summary.isVisible()&&!await summary.evaluate(n=>(n.parentElement as HTMLDetailsElement).open))await summary.click()}
