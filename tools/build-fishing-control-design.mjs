// Creates a self-contained review fragment; never starts a browser or touches a save.
import {readFile,writeFile} from 'node:fs/promises';
import {uiIcon} from '../src/ui/icons.mjs';
const base=new URL('../docs/design/prototypes/',import.meta.url);
const read=name=>readFile(new URL(name,base),'utf8');
const [template,css,surface,previous]=await Promise.all([read('fishing-control-v6.template.html'),read('fishing-control-v6.css'),read('fishing-control-surface.mjs'),read('fishing-control-v5.html')]);
const scene=previous.match(/class="moon-grip-scene" src="([^"]+)"/)?.[1];
if(!scene)throw new Error('Missing existing static scene');
const icon=uiIcon('cast').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" style="color:#465b49" ');
const fragment=template.replace('__SCENE_IMAGE__',scene).replace('__CAST_ICON__','data:image/svg+xml;base64,'+Buffer.from(icon).toString('base64')).replace('__STYLE_SOURCE__',css.trim()).replace('__SURFACE_SOURCE__',surface.replaceAll('export ',''));
if(/__(?:SCENE|CAST|STYLE|SURFACE)_/.test(fragment))throw new Error('Unresolved design placeholder');
await writeFile(new URL('fishing-control-v6.html',base),fragment);
console.log('Built fishing-control-v6.html');
