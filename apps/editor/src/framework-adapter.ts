import {renderDocument as render, type DocumentController,type AFDocument} from '@alabuga/framework';
import {embedLocalImage as embed} from '@alabuga/framework/assets';
import {fitSlide as fit,type FitSlideOptions} from '@alabuga/framework/slide-fit';
export type {DocumentController,AFDocument};
export const frameworkDom=Object.freeze({panel:'.af-panel',activeSlide:'.af-slide--active',widgets:'[data-widget-id]',sections:'[data-section-id]',content:'.af-widget__content',overflow:'.af-widget__content,.af-table-scroll',heading:':scope > .af-heading,:scope > .af-slide__title',label:'.af-label',copy:'.af-title,.af-prose p,.af-metric__value',sectionById:(id:string)=>'[data-section-id="'+CSS.escape(id)+'"]',widgetById:(id:string)=>'[data-widget-id="'+CSS.escape(id)+'"]',sectionBackground:(id:string)=>frameworkDom.sectionById(id)+' > .af-section-background',editableWidget:(id:string)=>frameworkDom.widgetById(id)+' [contenteditable]',title:'.af-widget__title',prose:'.af-prose',metric:'.af-metric__value',caption:'.af-caption',action:'[data-action-id]',quote:'.af-quote__text',author:'.af-quote__author',card:'.af-feature',cardTitle:'.af-feature__title',cardText:'.af-feature__text',galleryCaption:'figcaption',tableRows:'tbody tr'});
export const assetsBaseUrl=()=>new URL('../assets/',location.href).href;
export const renderDocument:typeof render=(container,input,options={})=>render(container,input,{assetsBaseUrl:assetsBaseUrl(),...options});
export const fitSlide:typeof fit=(slide,options:FitSlideOptions={})=>fit(slide,{assetsBaseUrl:assetsBaseUrl(),...options});
export const embedLocalImage=(src:string)=>embed(src,{assetsBaseUrl:assetsBaseUrl()});
