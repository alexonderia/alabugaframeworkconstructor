import {expect,type Locator} from '@playwright/test';

/** Exercise the Framework popup instead of assigning its hidden backing select. */
export async function chooseOption(locator:Locator,value:string){
 const source=locator.first();await expect(source).toBeAttached();
 const select=source.locator('xpath=self::select | ../select');
 const label=await select.evaluate((node,value)=>{
  const option=[...(node as HTMLSelectElement).options].find(option=>option.value===value);
  if(!option)throw new Error(`Missing option ${value}`);return option.label;
 },value);
 const box=select.locator('..');
 const control=box.getByRole('combobox');
 if(await control.count()){
  await control.click();await box.getByRole('option',{name:label,exact:true}).click();
 }else await select.selectOption(value);
 await expect(select).toHaveValue(value);
}
