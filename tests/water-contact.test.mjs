import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {waterContactGLSL} from '../src/water-contact.mjs';
import {glslScalar} from './helpers/glsl-scalar.mjs';

const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const coverage=glslScalar(waterContactGLSL,'waterContactCoverage',['distance','footprint'],{smoothstep});
const limit=glslScalar(waterContactGLSL,'waterContactRefractionLimit',['width','strength']);

test('only the contact pixel blends water into exposed sand',()=>{
 for(const footprint of [0,.001,.01,.05,.2]){
  const aa=Math.max(footprint,.005);
  assert.equal(coverage(-aa,footprint),0);
  assert.equal(coverage(0,footprint),.5);
  assert.equal(coverage(aa,footprint),1);
  assert.equal(coverage(aa+.01,footprint),1);
 }
 assert.equal(coverage(.04,.01),1,'shallow water must retain its surface after the contact pixel');
 assert.equal(coverage(.20,.05),1,'no fixed 42 cm naked-sand fade');
});

test('moving contact coverage is continuous, monotonic and bounded at all footprints',()=>{
 for(const footprint of [-1,0,.005,.05,.2,1]){
  const aa=Math.max(footprint,.005);
  let previous=0;
  for(let i=-120;i<=120;i++){
   const value=coverage(i*aa/100,footprint);
   assert.ok(value>=previous&&value>=0&&value<=1);previous=value;
  }
  for(const edge of [-aa,0,aa])assert.ok(Math.abs(coverage(edge-1e-8,footprint)-coverage(edge+1e-8,footprint))<1e-5);
 }
});

test('world-space bend cannot reach outside the local shoreline lens',()=>{
 for(const width of [-1,0,.005,.2,.405,1.2,100])for(const strength of [-1,0,.67,1,2,100]){
  const budget=limit(width,strength);
  assert.ok(budget>=0&&budget<=.15);
  assert.ok(budget<=Math.max(0,width)/8);
  if(width<=0||strength<=0)assert.equal(budget,0);
 }
 assert.equal(limit(.405,.67),.405*.125*.67);
 assert.equal(limit(.405,2),limit(.405,1));
});

test('extreme slope and refraction parameters stay inside the world bend budget',()=>{
 for(const width of [.005,.2,.405,1.2])for(const strength of [0,.67,1,2])
 for(const slope of [-2.2,0,3.2])for(const refraction of [0,1,2.8,3]){
  const budget=limit(width,strength);
  const bend=Math.max(-budget,Math.min(budget,slope*.025*refraction*strength));
  assert.ok(Math.abs(bend)<=budget);
  if(!strength||!refraction||!slope)assert.equal(Math.abs(bend),0);
 }
});

test('shader projects the bend and retains one receiver for all colour channels',()=>{
 const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
 assert.ok(water.includes('${waterContactGLSL}'));
 assert.ok(water.includes('waterContactRefractionLimit(meniscusWidth,uSetting_meniscusStrength)'));
 assert.ok(water.includes('uViewProjection*vec4(vWorld+vec3(towardShore.x,0.,towardShore.y)*bendMetres,1.)'));
 assert.ok(water.includes('if(bentClip.w>0.)offset+=(bendUV-uv)*distortionMask;'));
 assert.ok(water.includes('if(!refrInside||receiverValid<.5||originalValid<.5){'));
 assert.ok(water.includes('vec3 source=texture2D(uScene,refrUV).rgb;'));
 for(const removed of ['meniscusWaterCoverage','stableMeniscusDepth','lensBlur','refrUVR','refrUVB'])assert.ok(!water.includes(removed));
});

test('water remains opaque and applies coverage once after optical transport',()=>{
 const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
 assert.ok(water.includes('gl_FragColor=vec4(color,1.);'));
 assert.equal(water.split('color=mix(undistortedSource,color,contactCoverage);').length-1,1);
 assert.ok(water.indexOf('color=mix(undistortedSource,color,contactCoverage);')>water.indexOf('waterChannelRadiance(source.r'));
 assert.ok(water.includes('waterContactCoverage(contactDistance,fwidth(contactDistance))'));
});
