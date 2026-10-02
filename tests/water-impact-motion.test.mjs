import test from 'node:test';
import assert from 'node:assert/strict';
import {splashDroplet,sampleSplashDroplet} from '../src/water-impact-motion.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../src/three.module.js';
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('droplets accelerate under gravity and recycle exactly when returning to water',()=>{
 const plan=splashDroplet(.8,[.3,.6,.8,.2]),a=sampleSplashDroplet(plan,.02),b=sampleSplashDroplet(plan,.12);
 near(b.velocity[1]-a.velocity[1],-1.18);near(sampleSplashDroplet(plan,plan.lifetime).position[1],0);
 assert.equal(sampleSplashDroplet(plan,plan.lifetime-1e-5).visible,true);assert.equal(sampleSplashDroplet(plan,plan.lifetime).visible,false);
 const apex=sampleSplashDroplet(plan,plan.velocity[1]/plan.gravity);near(apex.velocity[1],0);assert.ok(apex.position[1]>.1&&apex.position[1]<.3);
 assert.ok(a.stretch>apex.stretch);assert.ok(plan.lifetime<.45);assert.ok(plan.radius<.025);
});

test('impact strength changes height and spread while all flights stay bounded',()=>{
 const low=splashDroplet(.3,[0,.5,1,.5]),high=splashDroplet(.98,[0,.5,1,.5]);
 assert.ok(high.velocity[1]>low.velocity[1]);assert.ok(high.velocity[0]>low.velocity[0]);
 for(const power of [NaN,Infinity,-100,0,.1,1,100]){
  const plan=splashDroplet(power,[NaN,-2,Infinity,8]);assert.ok(plan.velocity.every(Number.isFinite));assert.ok(plan.radius>=.01&&plan.radius<=.022);
  assert.ok(plan.lifetime>0&&plan.lifetime<.5);
  for(const age of [-10,NaN,Infinity,0,.1,1])assert.ok(sampleSplashDroplet(plan,age).position.every(Number.isFinite));
  assert.deepEqual(sampleSplashDroplet(plan,-1).position,sampleSplashDroplet(plan,0).position);
 }
});

test('actual pooled scene update uses elapsed time even when a render frame is late',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8'),start=source.indexOf('  droplets.forEach(d=>'),end=source.indexOf('  boat.rotation',start),code=source.slice(start,end);
 const plan=splashDroplet(.8,[.3,.6,.8,.2]),mesh=new T.Mesh(new T.SphereGeometry(.01),new T.MeshBasicMaterial()),drop={m:mesh,plan,started:10,life:plan.lifetime,age:0,origin:new T.Vector3(2,.14,3),v:new T.Vector3()};
 const context=vm.createContext({droplets:[drop],t:10.1,dt:.016,sampleSplashDroplet,clamp:T.MathUtils.clamp,dropUp:new T.Vector3(0,1,0)});
 vm.runInContext(code,context);const motion=sampleSplashDroplet(plan,.1);near(drop.m.position.y,.14+motion.position[1]);assert.ok(drop.m.scale.y>drop.m.scale.x);
 context.t=11;vm.runInContext(code,context);assert.equal(drop.life,0);assert.equal(drop.m.visible,false);
 mesh.geometry.dispose();mesh.material.dispose();
});
