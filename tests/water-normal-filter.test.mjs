import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {waterNormalsGLSL} from '../src/water-normals.mjs';
import {glslScalar} from './helpers/glsl-scalar.mjs';

const slope=glslScalar(waterNormalsGLSL,'waterNormalSlope',['component','up']);
const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
const vector=(x,y,z)=>new Vector3(x,y,z);
const normalExpression=water.match(/vec3 normal=([^;]+);/)[1];
const normal=new Function('macroSlope','detailSlope','vec3','normalize',`return ${normalExpression};`);
const fromSlopes=(macro,detail)=>normal(macro,detail,vector,n=>n.normalize());

test('actual slope GLSL and water normal reconstruct the decoded tangent normal with positive world X/Z UV',()=>{
 for(const n of [vector(0,0,1),vector(.3,.1,1).normalize(),vector(-.4,.2,1).normalize(),vector(.2,-.5,1).normalize()]){
  const restored=fromSlopes({x:0,y:0},{x:slope(n.x,n.z),y:slope(n.y,n.z)});
  assert.ok(restored.distanceTo(vector(n.x,n.z,n.y))<1e-12);
  assert.ok(Number.isFinite(restored.x)&&Math.abs(restored.length()-1)<1e-12);
 }
});

test('old positive slope conversion reverses the map tilt and the corrected formula fixes it',()=>{
 const n=vector(.3,.15,1).normalize(),expected=vector(n.x,n.z,n.y);
 const old=fromSlopes({x:0,y:0},{x:n.x/n.z,y:n.y/n.z});
 const corrected=fromSlopes({x:0,y:0},{x:slope(n.x,n.z),y:slope(n.y,n.z)});
 assert.ok(old.angleTo(expected)>.6);assert.ok(corrected.angleTo(expected)<1e-7);
 assert.ok(slope(.3,1)<0);assert.ok(slope(-.3,1)>0);assert.ok(slope(0,1)===0);
});

test('zero detail, opposite layers and safe up denominator remain finite',()=>{
 for(const up of [0,.01,.16,.38,1])for(const component of [-1,0,1])assert.ok(Number.isFinite(slope(component,up)));
 assert.equal(slope(.38,0),-1);assert.equal(slope(-.38,.16),1);
 const macro={x:.04,y:-.07},zero=fromSlopes(macro,{x:0,y:0});
 assert.ok(zero.distanceTo(vector(-macro.x,1,-macro.y).normalize())<1e-12);
 const a=slope(.2,.8),b=slope(-.2,.8);assert.equal(a+b,0);
});

test('both normal layers use the shared signed slope and preserve UV rotation plus shore blend',()=>{
 const expression=water.match(/vec2 detailSlope=([^;]+);/)[1];
 for(const layer of ['A','B'])for(const axis of ['x','y'])assert.ok(expression.includes(`waterNormalSlope(normal${layer}.${axis},normal${layer}.z)`));
 assert.ok(expression.includes('uSetting_normalStrengthA'));assert.ok(expression.includes('uSetting_normalStrengthB'));
 assert.ok(expression.endsWith('*shoreFade'));
 assert.doesNotMatch(expression,/pixelFootprint|distanceToEye|detailFade|bodyDetailFade|grazing|smoothstep/);
 assert.ok(water.includes('normalB.xy=transpose(detailRotation)*normalB.xy;'));
 assert.equal(water.split('${waterNormalsGLSL}').length-1,1);
});

test('normal sampling uses each layer own UV derivatives with mip and anisotropy, without adding queries',()=>{
 for(const layer of ['A','B'])assert.ok(water.includes(`texture2DGradEXT(uNormal${layer},uv${layer},dFdx(uv${layer}),dFdy(uv${layer}))`));
 assert.equal((water.match(/texture2DGradEXT\(uNormal/g)||[]).length,2);
 assert.doesNotMatch(water,/texture2D\(uNormal|texture2DLodEXT\(uNormal|grazingDetail|float detailFade=/);
 assert.ok(water.includes('texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8)'));
 assert.ok(water.includes('texture.colorSpace=T.NoColorSpace'));
 assert.ok(water.includes('vec3 reflectionNormal=normalize(mix(normal,meniscusNormal,'));
});
