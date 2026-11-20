import { embedLocalImage as embed } from '@alabuga/framework/assets';
export const assetsBaseUrl = () => new URL('../assets/', location.href).href;
export const embedLocalImage = (src: string) => embed(src, { assetsBaseUrl: assetsBaseUrl() });
