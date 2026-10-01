// Self-contained design build. Does not import runtime code or start a browser.
import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('../docs/design/prototypes/fishing-control-v7/',import.meta.url);
const [template,css,surface,hook,scene]=await Promise.all(['control.template.html','control.css','surface.mjs','hook.svg','scene.jpg'].map(n=>readFile(new URL(n,base))));
const fragment=template.toString().replace('__SCENE_IMAGE__','data:image/jpeg;base64,'+scene.toString('base64')).replace('__HOOK_ICON__','data:image/svg+xml;base64,'+hook.toString('base64')).replace('__STYLE_SOURCE__',css.toString().trim()).replace('__SURFACE_SOURCE__',surface.toString().replaceAll('export ',''));
if(/__(?:SCENE|HOOK|STYLE|SURFACE)_/.test(fragment))throw new Error('Unresolved design placeholder');
await writeFile(new URL('index.html',base),fragment);
console.log('Built fishing-control-v7/index.html');
