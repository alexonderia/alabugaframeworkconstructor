/** A bilingual live example, rendered by the same public runtime as authored projects. */
export function docsExample(lang:string){
 const ru=lang==='ru',doc={schemaVersion:3,kind:'page',title:ru?'Живой пример':'Live example',pages:[{id:'example',title:'',grid:{columns:12,rowHeight:64,gap:16},widgets:[
 {id:'calendar',type:'calendar',title:ru?'Календарь':'Calendar',date:'2026-10-07',position:{col:1,row:1,width:4,height:4}},
 {id:'table',type:'table',title:ru?'Редактируемые форматы':'Editable formats',columns:[{key:'format',label:ru?'Формат':'Format'},{key:'output',label:ru?'Экспорт':'Export'}],rows:[{format:ru?'Сайт':'Website',output:'HTML'},{format:ru?'Презентация':'Presentation',output:'HTML / PDF'}],pageSize:5,position:{col:5,row:1,width:8,height:4}}
 ]}]};
 return `<section aria-label="${ru?'Живой пример':'Live example'}"><h2>${ru?'Живой пример библиотеки':'Live framework example'}</h2><p>${ru?'Выберите день или отсортируйте таблицу. Пример использует общий механизм отображения; подписи элементов календаря остаются на языке продукта.':'Select a day or sort the table. This example uses the shared renderer; calendar controls retain the product UI language.'}</p><div id="live-example"></div><script src="../assets/alabuga.iife.js"></script><script>Alabuga.renderDocument(document.getElementById('live-example'),${JSON.stringify(doc)});</script></section>`;
}
