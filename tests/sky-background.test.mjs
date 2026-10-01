import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../src/three.module.js';
import {WebGLRenderList} from 'three/src/renderers/webgl/WebGLRenderLists.js';

const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
const camera=new T.PerspectiveCamera(36,1,.1,16000);
const depthAt=distance=>new T.Vector3(0,0,-distance).project(camera).z*.5+.5;
function skyObject(){
 // Exercise the actual material flags and render order from the scene initializer.
 const prefix=source.match(/const skyMat=new T.ShaderMaterial\(\{(.*?),vertexShader:/)?.[1];
 assert.ok(prefix);
 const sky=new T.Mesh(new T.BufferGeometry(),new T.ShaderMaterial(new Function('T',`return {${prefix}}`)(T)));
 const order=source.match(/sky.renderOrder=(-?\d+)/);if(order)sky.renderOrder=Number(order[1]);
 return sky;
}
function surfaceObject(name,order,always=false){
 const mesh=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({depthFunc:always?T.AlwaysDepth:T.LessEqualDepth}));
 mesh.name=name;mesh.renderOrder=order;return mesh;
}
function compositePixel(objects){
 // CPU depth comparison, not a WebGL render. Use Three's real opaque sorter.
 const list=new WebGLRenderList(),depths=new Map();list.init();
 for(const [object,distance] of objects){list.push(object,object.geometry,object.material,0,depthAt(distance),null);depths.set(object,depthAt(distance));}
 list.finish();list.sort();let depth=1,color='clear';
 for(const {object,material} of list.opaque){
  const fragment=depths.get(object);
  if(!material.depthTest||material.depthFunc===T.AlwaysDepth||fragment<=depth){
   color=object.name;if(material.depthTest&&material.depthWrite)depth=fragment;
  }
 }
 return {color,depth,order:list.opaque.map(({object})=>object.name)};
}

test('the old sky dome masks far sea despite depthWrite false; background ordering preserves near and far sea',()=>{
 const sky=skyObject();sky.name='sky';const sea=surfaceObject('sea',-1,true);
 try{
  const legacy=sky.clone();legacy.material=sky.material.clone();legacy.material.depthTest=true;legacy.renderOrder=0;
  assert.equal(compositePixel([[sea,5000],[legacy,1600]]).color,'sky');
  assert.equal(compositePixel([[sea,100],[legacy,1600]]).color,'sea');
  for(const distance of [.2,100,1599,1600,1601,5000,12000]){
   const pixel=compositePixel([[sea,distance],[sky,1600]]);
   assert.equal(pixel.color,'sea');assert.equal(pixel.depth,depthAt(distance));assert.deepEqual(pixel.order,['sky','sea']);
  }
  legacy.material.dispose();
 }finally{sky.material.dispose();sky.geometry.dispose();sea.material.dispose();sea.geometry.dispose()}
});

test('background sky leaves empty depth clear and far captured terrain keeps matching colour and depth',()=>{
 const sky=skyObject();sky.name='sky';const ground=surfaceObject('ground',-2);
 try{
  const empty=compositePixel([[sky,1600]]);assert.equal(empty.color,'sky');assert.equal(empty.depth,1);
  for(const distance of [10,1599,1601,5000,12000]){
   const captured=compositePixel([[ground,distance],[sky,1600]]);
   assert.equal(captured.color,'ground');assert.equal(captured.depth,depthAt(distance));assert.deepEqual(captured.order,['sky','ground']);
  }
  assert.match(source,/ground.renderOrder=-2/);
 }finally{sky.material.dispose();sky.geometry.dispose();ground.material.dispose();ground.geometry.dispose()}
});

test('HDR intermediates retain above-one values while panel colours remain sRGB base colours',()=>{
 const post=readFileSync(new URL('../src/postprocessing.js',import.meta.url),'utf8');
 const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/render-settings-panel.js',import.meta.url),'utf8');
 const gradient=readFileSync(new URL('../src/gradient-editor.js',import.meta.url),'utf8');
 assert.match(post,/const hdr=new T.WebGLRenderTarget\(1,1,\{type:T.HalfFloatType/);
 assert.match(water,/const captureTarget=new T.WebGLRenderTarget\(1,1,\{type:T.HalfFloatType/);
 assert.ok(post.indexOf('renderer.toneMapping=T.NoToneMapping;renderer.setRenderTarget(hdr)')<post.indexOf('renderer.toneMapping=tone;pass(output,target)'));
 assert.ok(T.DataUtils.fromHalfFloat(T.DataUtils.toHalfFloat(2.65))>2.64);
 assert.equal(new T.Color('#ffffff').r,1);assert.ok(new T.Color('#ffffff').multiplyScalar(2.65).r>1);
 assert.ok(panel.includes("input.type='color'"));assert.ok(gradient.includes("color.type='color'"));
 assert.match(source,/skyTexture.colorSpace=T.SRGBColorSpace/);
});
