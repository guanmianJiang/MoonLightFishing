import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePng,encodePng,conditionPanorama,panoramaMetrics,validateSkyPanorama} from '../tools/sky-texture-pipeline.mjs';
import {skyRadianceGLSL,SKY_TEXTURES} from '../src/sky-settings.mjs';
import {heightAtmosphereGLSL,atmosphereColorLinear} from '../src/height-atmosphere.mjs';
import {glslScalar} from './helpers/glsl-scalar.mjs';

const mean=glslScalar(heightAtmosphereGLSL,'heightAtmosphereMean',['startHeight','endHeight','layerHeight']);
const weight=glslScalar(heightAtmosphereGLSL,'heightAtmosphereScatter',['rayLength','startHeight','endHeight','layerHeight','strength','weatherScale'],{heightAtmosphereMean:mean});
const air=atmosphereColorLinear('#9fb9d3');
const weights=[.2126,.7152,.0722];
const linear=value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;};
const scatter=y=>weight(12000,2,2+Math.abs(y)*12000,12,.45,1);
const shade=(rgb,y)=>rgb.map((v,i)=>v*(1-scatter(y))+air[i]*scatter(y));

test('shared height atmosphere preserves blue horizon chroma and rapidly clears above the dense layer',()=>{
 for(let y=-1;y<=1;y+=.002){
  assert.ok(scatter(y)>=0&&scatter(y)<=.985);
  assert.ok(Math.abs(scatter(y)-scatter(y+.00001))<.005);
  for(const rgb of [[0,0,0],[1,1,1],[.18,.46,.62]])assert.ok(shade(rgb,y).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 }
 const horizon=shade([118,181,206].map(linear),0);
 assert.ok(horizon[2]>horizon[0]*1.5);assert.ok(horizon.reduce((sum,v,i)=>sum+v*weights[i],0)<.6);
 assert.ok(scatter(.5)<.007);assert.ok(scatter(-.5)<.007);
 assert.ok(scatter(.08)<.04);assert.ok(scatter(-.08)<.04);
 assert.ok(skyRadianceGLSL.includes('mix(sampleColor,heightAtmosphereRadiance(d),amount)'));
});

test('six installed panoramas match provenance, have continuous blue equators and no pole/seam seams',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../assets_pipeline/sky/v2/manifest.json',import.meta.url)));
 assert.equal(manifest.assets.length,6);
 for(const {path} of SKY_TEXTURES){
  const bytes=readFileSync(new URL(`../public/${path.slice(2)}`,import.meta.url));
  const map=decodePng(bytes),metrics=validateSkyPanorama(map),record=manifest.assets.find(item=>item.path===`public/${path.slice(2)}`);
  assert.equal(map.width,map.height*2);assert.ok(map.width<=2048);assert.ok(bytes.length<1300000);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  assert.deepEqual(bytes,readFileSync(new URL(`../assets_pipeline/sky/v2/${path.split('/').at(-1)}`,import.meta.url)));
  assert.equal(metrics.seamMax,0);assert.equal(metrics.poleRange,0);assert.ok(metrics.seamSlopeMax<=12);
  assert.ok(metrics.horizonStepMax<=4,`${path}: equator must be cloud/line free`);
  const [r,g,b]=metrics.horizonRgb;assert.ok(b>g&&g>r+45&&r<160);
  assert.ok(shade(metrics.horizonRgb.map(linear),0)[2]>shade(metrics.horizonRgb.map(linear),0)[0]*1.5);
  // Below the equator, even localized clouds/white strips must not sneak through a row average.
  for(let y=Math.floor(map.height/2);y<map.height;y++)for(let x=0;x<map.width;x++){
   const i=(y*map.width+x)*3;assert.ok(map.pixels[i+2]>map.pixels[i]+35&&map.pixels[i]<190);
  }
 }
});

test('technical spherical conditioning preserves central art and source bytes while joining poles and edges',()=>{
 const width=64,height=32,pixels=Buffer.from(Array.from({length:width*height*3},(_,i)=>(i*73+Math.floor(i/3))%256)),original=Buffer.from(pixels);
 const conditioned=conditionPanorama({width,height,pixels});assert.deepEqual(pixels,original);
 const at=(16*width+32)*3;assert.deepEqual(conditioned.pixels.subarray(at,at+3),pixels.subarray(at,at+3));
 const metrics=panoramaMetrics(conditioned);assert.equal(metrics.seamMax,0);assert.equal(metrics.poleRange,0);
 assert.deepEqual(decodePng(encodePng(conditioned)),conditioned);
 assert.deepEqual(conditionPanorama({width,height,pixels}),conditioned);
});

test('malformed PNGs and invalid mobile panorama geometry are rejected before installation',()=>{
 assert.throws(()=>decodePng(Buffer.alloc(0)),/Expected PNG/);
 const valid=encodePng({width:8,height:4,pixels:Buffer.alloc(96)});
 assert.throws(()=>decodePng(valid.subarray(0,valid.length-7)),/Truncated PNG/);
 const interlaced=Buffer.from(valid);interlaced[28]=1;assert.throws(()=>decodePng(interlaced),/Unsupported PNG/);
 assert.throws(()=>encodePng({width:2,height:2,pixels:Buffer.alloc(1)}),/Invalid RGB/);
 assert.throws(()=>conditionPanorama({width:8,height:8,pixels:Buffer.alloc(192)}),/2:1/);
 assert.throws(()=>conditionPanorama({width:2050,height:1025,pixels:Buffer.alloc(0)}),/2:1/);
});

test('seam corrections clamp underflow and overflow instead of wrapping bytes into bright spots',()=>{
 const width=128,height=64,pixels=Buffer.alloc(width*height*3,100),row=32*width*3;
 pixels[row]=0;pixels[row+(width-1)*3]=10;pixels[row+(width-2)*3]=0;
 pixels[row+1]=255;pixels[row+(width-1)*3+1]=245;pixels[row+(width-2)*3+1]=255;
 const corrected=conditionPanorama({width,height,pixels});
 assert.equal(corrected.pixels[row+(width-2)*3],0);assert.equal(corrected.pixels[row+(width-2)*3+1],255);
 assert.equal(panoramaMetrics(corrected).seamMax,0);
});

test('far water uses the shared directional atmosphere instead of sampled horizon depth fog',()=>{
 const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
 assert.match(water,/vec3 horizonAir=heightAtmosphereRadiance\(-view\)/);
 assert.ok(!water.includes('vec3 horizonAir=vec3(.54,.70,.73)'));
 assert.match(water,/color=mix\(color,horizonAir,aerialHaze\)/);
});

test('installation gate rejects a white strip, a hard equator, a seam, and clouds in the lower hemisphere',()=>{
 const width=64,height=32,pixels=Buffer.alloc(width*height*3);
 for(let i=0;i<pixels.length;i+=3){pixels[i]=80;pixels[i+1]=160;pixels[i+2]=220;}
 const original={width,height,pixels};assert.equal(validateSkyPanorama(original).seamMax,0);
 const withChange=mutate=>{const map={width,height,pixels:Buffer.from(pixels)};mutate(map.pixels);return map;};
 assert.throws(()=>validateSkyPanorama(withChange(p=>p.fill(240,16*width*3,17*width*3))),/horizon/);
 assert.throws(()=>validateSkyPanorama(withChange(p=>{for(let i=0;i<width;i++)p[(15*width+i)*3]=110;})),/horizon/);
 assert.throws(()=>validateSkyPanorama(withChange(p=>p[16*width*3]=100)),/seam/);
 assert.throws(()=>validateSkyPanorama(withChange(p=>p[(24*width+32)*3]=230)),/lower hemisphere/);
 assert.throws(()=>validateSkyPanorama({width:8,height:4,pixels:Buffer.alloc(96)}),/dimensions/);
});
