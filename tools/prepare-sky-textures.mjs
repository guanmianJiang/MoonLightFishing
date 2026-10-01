import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodePng,conditionPanorama,encodePng,validateSkyPanorama} from './sky-texture-pipeline.mjs';

const manifest={version:'2026.10-sky-v2',tool:'built-in image_gen',conditioning:'horizontal seam 3.5%, smooth longitude flattening at 12% pole caps; no creative repaint',assets:[]};
const prepared=[];
for(let index=1;index<=6;index++){
 const id=String(index).padStart(2,'0'),name=`sky-toon-${id}.png`;
 const raw=await readFile(new URL(`../assets_pipeline/sky/v2/sky-toon-${id}-raw.png`,import.meta.url));
 const map=conditionPanorama(decodePng(raw)),metrics=validateSkyPanorama(map),png=encodePng(map);
 prepared.push({name,png});
 manifest.assets.push({path:`public/assets/${name}`,source:`assets_pipeline/sky/v2/sky-toon-${id}-raw.png`,width:map.width,height:map.height,bytes:png.length,sha256:createHash('sha256').update(png).digest('hex'),...metrics});
}
// All six must pass before replacing any installed texture.
for(const {name,png} of prepared){
 await writeFile(new URL(`../assets_pipeline/sky/v2/${name}`,import.meta.url),png);
 await writeFile(new URL(`../public/assets/${name}`,import.meta.url),png);
}
await writeFile(new URL('../assets_pipeline/sky/v2/manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.assets.map(({path,bytes,...metrics})=>({path,bytes,...metrics})),null,2));
