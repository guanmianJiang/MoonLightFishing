import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {decodePng} from './sky-texture-pipeline.mjs';
import defaults from '../src/render-defaults.js';
import {skyPanoramaGLSL} from '../src/sky-settings.mjs';
import {glslScalar} from '../tests/helpers/glsl-scalar.mjs';

// Asset pixels only. This is neither a screenshot nor an exact recreation of saved camera state.
const latitude=glslScalar(skyPanoramaGLSL,'skyCloudLatitude',['vertical','height']);
const map=decodePng(await readFile(`public/${defaults.skyTexture.slice(2)}`));
function sample(u,degrees){
 const wrapped=((u%1)+1)%1;
 const v=latitude(Math.sin(degrees*Math.PI/180),defaults.skyCloudHeight)/Math.PI+.5;
 // PNG top is positive latitude because Three's ordinary texture loader flips Y.
 const x=Math.min(map.width-1,Math.floor(wrapped*map.width));
 const y=Math.min(map.height-1,Math.max(0,Math.floor((1-v)*map.height)));
 return [...map.pixels.slice((y*map.width+x)*3,(y*map.width+x)*3+3)];
}
const report={kind:'Offline direction-to-asset sampling; not a GPU render or captured camera',
 skyTexture:defaults.skyTexture,skyRotation:defaults.skyRotation,skyCloudHeight:defaults.skyCloudHeight,
 samples:[.92,.94,.96,.98,0,.02,.04,.1,.2,.3].map(u=>({u,latitudeSamples:[2,5,10,14,20].map(degrees=>({degrees,rgb:sample(u,degrees)}))})),
 note:'A world +Z ray maps to u=0.75+rotation/360. At rotation 82 this is about 0.978, within the cloud-free seam region in sky02. Rotating toward u=0.2 reveals cloud pixels without changing fog. A screenshot alone does not determine its actual heading, saved texture or load state.'};
const directory='docs/validation/sky-tools-visibility-2026-10-01';
await mkdir(directory,{recursive:true});await writeFile(`${directory}/sky-pixel-review.json`,JSON.stringify(report,null,2)+'\n');
console.log('已检查天空方向与资源像素；未修改画面参数或操作界面。');
