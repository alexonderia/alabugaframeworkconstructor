export * from '@alabuga/framework/slide-fit';

import {measureSlide as measure} from '@alabuga/framework/slide-fit';
import {assetsBaseUrl} from '../../apps/editor/src/framework-adapter';
export {fitSlide} from '../../apps/editor/src/framework-adapter';
export const measureSlide:typeof measure=(slide,options={})=>measure(slide,{assetsBaseUrl:assetsBaseUrl(),...options});
