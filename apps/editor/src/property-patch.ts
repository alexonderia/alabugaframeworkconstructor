/** Apply only fields edited in this inspector draft to the current widget. */
export function mergePropertyDraft<T>(base:T,draft:T,current:T):T{
 if(JSON.stringify(base)===JSON.stringify(draft))return structuredClone(current);
 if(Array.isArray(base)&&Array.isArray(draft)&&Array.isArray(current)&&base.length===draft.length&&current.length===base.length)return draft.map((value,index)=>mergePropertyDraft(base[index],value,current[index])) as T;
 if(base&&draft&&current&&typeof base==='object'&&typeof draft==='object'&&typeof current==='object'&&!Array.isArray(base)&&!Array.isArray(draft)&&!Array.isArray(current)){
  const result=structuredClone(current) as Record<string,unknown>,before=base as Record<string,unknown>,next=draft as Record<string,unknown>;
  for(const key of new Set([...Object.keys(before),...Object.keys(next)])){
   if(JSON.stringify(before[key])===JSON.stringify(next[key]))continue;
   if(!(key in next))delete result[key];else result[key]=mergePropertyDraft(before[key],next[key],result[key]);
  }
  return result as T;
 }
 return structuredClone(draft);
}
