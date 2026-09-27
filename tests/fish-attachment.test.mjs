import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from '../src/three.module.js';
import {fishMouthWorld,alignFishMouth,alignFishMouthHorizontal} from '../src/fish-attachment.mjs';

test('fish mouth remains on the hook through scaling and rotation',()=>{
 const fish=new Group();fish.userData.mouthLocal=new Vector3(-.53,-.06,0);
 fish.position.set(2,-.4,4);fish.scale.setScalar(.68);
 const hook=new Vector3(-1,1.3,3);
 for(const angle of [0,.35,1.2,2.7]){
  fish.rotation.set(.12,angle,-.22);
  alignFishMouth(fish,hook);
  assert.ok(fishMouthWorld(fish).distanceTo(hook)<1e-8);
 }
});

test('hooked fish follows the hook mouth first while retaining swimming depth',()=>{
 const fish=new Group();fish.userData.mouthLocal=new Vector3(-.9,-.04,0);
 fish.scale.setScalar(.62);
 const hook=new Vector3(1,-.25,2);
 for(const yaw of [0,.3,1.4,Math.PI,4.8]){
  fish.position.set(1.2,-.7,2.3);
  fish.rotation.set(.08,yaw,-.12);
  alignFishMouthHorizontal(fish,hook);
  const mouth=fishMouthWorld(fish);
  assert.ok(Math.hypot(mouth.x-hook.x,mouth.z-hook.z)<1e-8);
  assert.equal(fish.position.y,-.7);
  const tail=new Vector3(.9,0,0).applyMatrix4(fish.matrixWorld);
  assert.ok(mouth.distanceTo(hook)<tail.distanceTo(hook),'the hook must remain at the head, not the tail');
 }
});
