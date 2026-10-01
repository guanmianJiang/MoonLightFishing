import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../src/three.module.js';
import {WATER_LEVEL,waterSurfaceGLSL} from '../src/water-surface.js';
import {shore,shoreGLSL,terrainY} from '../src/coast.js';

const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
const statement=water.match(/p\.y\+=([^;]*waterSurface\(p\.xz,uTime\)[^;]*);/)[0];
// Execute the real vertex statement, rather than assuming the mesh adds .14.
const vertexHeight=new Function('waterLevel','waterSurface','p','uTime','lift',`${statement}return p.y;`);
const at=(wave,lift=0,localY=0)=>vertexHeight(WATER_LEVEL,()=>({z:wave}),{y:localY,xz:{}},0,lift);
const smoothstep=(a,b,x)=>{const q=Math.max(0,Math.min(1,(x-a)/(b-a)));return q*q*(3-2*q);};
function scalar(name,args,bindings={}){
 const start=shoreGLSL.indexOf(`float ${name}(`),open=shoreGLSL.indexOf('{',start);
 let end=open+1,depth=1;
 for(;depth;end++){if(shoreGLSL[end]==='{')depth++;if(shoreGLSL[end]==='}')depth--;}
 assert.ok(start>=0);
 const body=shoreGLSL.slice(open+1,end-1).replace(/\bfloat\b/g,'let');
 return new Function(...Object.keys(bindings),...args,`const {sin,cos,pow,abs,max,min,sqrt,exp}=Math;${body}`).bind(null,...Object.values(bindings));
}
const slope=x=>(shore(x+1e-5)-shore(x-1e-5))/2e-5;
const bed=scalar('seabedHeight',['p'],{shore,smoothstep});
let reach=0;
const surge=scalar('shoreWaterHeight',['p','t'],{
 shore,shoreSlope:slope,shoreRunupReach:()=>reach,seabedHeight:bed,smoothstep,vec2:(x,y)=>({x,y})
});

test('actual flat water geometry adds the same base level as shore and seabed',()=>{
 assert.equal(WATER_LEVEL,.14);
 assert.ok(waterSurfaceGLSL.includes(`const float waterLevel=${WATER_LEVEL};`));
 const geometry=new T.PlaneGeometry(2,2,128,160);geometry.rotateX(-Math.PI/2);
 for(let i=0;i<geometry.attributes.position.count;i++){
  const y=geometry.attributes.position.getY(i);
  assert.ok(Math.abs(y)<1e-15);
  assert.ok(Math.abs(at(0,0,y)-WATER_LEVEL)<1e-15);
 }
 geometry.dispose();
 for(let x=-16;x<=16;x+=.5)assert.equal(terrainY(x,shore(x)),WATER_LEVEL);
});

test('old missing-level behavior is below sand; actual new vertex meets the moving contact',()=>{
 for(let x=-16;x<=16;x+=.5)for(reach=-.12;reach<=.90001;reach+=.04){
  const z=shore(x)-reach*Math.sqrt(1+slope(x)**2),wave=surge({x,y:z},0),sand=terrainY(x,z);
  assert.ok(Math.abs((sand-wave)-WATER_LEVEL)<1e-8,'the old vertex is exactly 14 cm too low');
  assert.ok(Math.abs(at(wave)-sand)<1e-8,'execute the real vertex at the contact');
 }
});

test('shallow flooded sand lies below the actual mesh instead of zero-depth transmission',()=>{
 for(let x=-12;x<=12;x+=1)for(reach=0;reach<=.8001;reach+=.1){
  const z=shore(x)-reach*Math.sqrt(1+slope(x)**2)+.12;
  const wave=surge({x,y:z},0),sand=Math.min(terrainY(x,z),WATER_LEVEL+wave-.045);
  assert.ok(at(wave)-sand>=.045-1e-12);
  assert.ok(Math.max(0,wave-sand)<.01,'reproduce the old zero-depth strip');
 }
});

test('signed interaction waves and meniscus lift keep exactly one base water level',()=>{
 for(const baseWave of [-.08,0,.12])for(const interaction of [-.18,0,.18])for(const lift of [0,.03,.09]){
  assert.ok(Math.abs(at(baseWave,lift,interaction)-(WATER_LEVEL+baseWave+interaction+lift))<1e-12);
 }
 assert.ok(water.includes('vertexShader:material.vertexShader,fragmentShader:material.fragmentShader'));
 assert.ok(water.indexOf('p.y+=wave.y;')<water.indexOf(statement));
 assert.doesNotMatch(water,/water\.position\.y\s*=/);
 assert.doesNotMatch(scene,/water(?:System\.mesh)?\.position\.y\s*=/);
});

test('receiver optical depth and flooded ground use the same shader base level',()=>{
 assert.ok(water.includes('waterCapturedColumn(vWorld.y,receiverWorld.y,receiverValid)'));
 assert.ok(scene.includes('float waterY=waterLevel+waterSurface(position.xz,uTime).z;'));
 assert.ok(scene.includes('float currentWaterGap=waterLevel+waterSurface(vGround.xz,uTime).z-vGround.y;'));
 assert.ok(water.includes('p.y+=waterLevel+waterSurface(p.xz,uTime).z+lift;'));
});

test('rowboat retains its previous draft relative to the corrected sea level',()=>{
 assert.ok(scene.includes('boat.position.set(-4.55,WATER_LEVEL+.13,-1.42)'));
 const expression=scene.match(/boat\.position\.y=([^;]+);/)[1];
 const boatHeight=new Function('WATER_LEVEL','t',`return ${expression};`);
 for(let t=0;t<30;t+=.1){
  const relative=.2+Math.sin(t*.9)*.026;
  assert.ok(Math.abs(boatHeight(WATER_LEVEL,t)-WATER_LEVEL-relative)<1e-12);
  assert.ok(boatHeight(WATER_LEVEL,t)>=WATER_LEVEL+.174-1e-12);
 }
});
