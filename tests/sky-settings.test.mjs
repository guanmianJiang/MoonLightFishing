import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SKY_TEXTURES,DEFAULT_SKY_TEXTURE,isSkyTexture,normalizeSkyTexture,normalizeSkyRotation,createSkyTextureController,skyPanoramaGLSL} from '../src/sky-settings.mjs';
import {renderSettings,settingsUniforms} from '../src/render-settings.js';
test('all six sky choices are bundled 2:1 panoramas with a stable default',()=>{
 assert.deepEqual(SKY_TEXTURES.map(({path})=>path),Array.from({length:6},(_,i)=>`./assets/sky-toon-0${i+1}.png`));
 assert.equal(DEFAULT_SKY_TEXTURE,'./assets/sky-toon-04.png');
 for(const {path} of SKY_TEXTURES){
  const bytes=readFileSync(new URL(`../public/${path.slice(2)}`,import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),bytes.readUInt32BE(20)*2);
  assert.ok(isSkyTexture(path));
 }
 assert.equal(isSkyTexture('./assets/missing.png'),false);
 assert.equal(normalizeSkyTexture('../sky-toon-04.png'),DEFAULT_SKY_TEXTURE);
});

test('horizontal rotation stays finite and drives the shared sky uniform',()=>{
 assert.equal(normalizeSkyRotation(NaN),0);
 assert.equal(normalizeSkyRotation(-15),0);
 assert.equal(normalizeSkyRotation(400),360);
 assert.equal(normalizeSkyRotation(135.5),135.5);
 const prior=renderSettings.skyRotation;
 try{renderSettings.skyRotation=205;assert.equal(settingsUniforms.uSetting_skyRotation.value,205)}
 finally{renderSettings.skyRotation=prior}
 assert.match(skyPanoramaGLSL,/uSetting_skyRotation\/360\./);
});

test('sky switching keeps only the latest selection and reuses loaded textures',async()=>{
 const paths=SKY_TEXTURES.map(({path})=>path),loads=[],applied=[];
 const pending=new Map();
 const controller=createSkyTextureController(paths[3],{id:4},path=>{loads.push(path);return new Promise(resolve=>pending.set(path,resolve))},(texture,path)=>applied.push([texture.id,path]));
 const first=controller.select(paths[4]),second=controller.select(paths[5]);
 await Promise.resolve();
 pending.get(paths[5])({id:6});assert.equal(await second,true);
 pending.get(paths[4])({id:5});assert.equal(await first,false);
 assert.deepEqual(applied,[[6,paths[5]]]);
 assert.equal(await controller.select(paths[5]),true);
 assert.deepEqual(loads,[paths[4],paths[5]]);
 assert.equal(await controller.select(paths[3]),true);
 assert.deepEqual(applied.at(-1),[4,paths[3]]);
 await assert.rejects(controller.select('./assets/sky-toon-99.png'),/Unknown sky texture/);
});

test('failed sky loads can retry and disposal ignores late results',async()=>{
 const path=SKY_TEXTURES[0].path;let attempts=0,applyCount=0,finish;
 const initial={id:4};
 const controller=createSkyTextureController(DEFAULT_SKY_TEXTURE,initial,()=>{attempts++;return attempts===1?Promise.reject(Error('load failed')):new Promise(resolve=>{finish=resolve})},()=>{applyCount++});
 await assert.rejects(controller.select(path),/load failed/);
 const pending=controller.select(path);await Promise.resolve();
 const disposed=[];controller.dispose(texture=>disposed.push(texture.id));
 finish({id:1});assert.equal(await pending,false);
 await Promise.resolve();
 assert.equal(applyCount,0);
 assert.deepEqual(disposed.sort(),[1,4]);
});

test('sky panorama lookup is shared by dome and both water reflections',()=>{
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
 const mainFragmentStart=water.indexOf('fragmentShader:`');
 const mainFragmentPreamble=water.slice(mainFragmentStart,water.indexOf('float linearDepth',mainFragmentStart));
 assert.ok(mainFragmentStart>=0);
 assert.match(mainFragmentPreamble,/\$\{skyPanoramaGLSL\}/);
 assert.match(scene,/skyMat\.uniforms\.uSetting_skyRotation=settingsUniforms\.uSetting_skyRotation/);
 assert.match(scene,/skyPanoramaUV\(d\)/);
 assert.match(water,/skyReflectionDirection\(reflectedDir\)/);
 assert.match(water,/skyReflectionDirection\(reflected\)/);
 assert.equal(water.split('${skyReflectionGLSL}').length-1,2);
 assert.match(scene,/waterSystem\.material\.uniforms\.uSky\.value=texture/);
});
