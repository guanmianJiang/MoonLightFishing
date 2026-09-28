import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from '../src/three.module.js';
import {assetAnchorLocal,alignAssetAnchorLocal,mountBaitAtAnchor,fishMouthWorld,alignFishMouth,alignFishMouthHorizontal,alignFloatOverMouth,attachHookToMouth} from '../src/fish-attachment.mjs';

test('named GLB anchors survive nested transforms and place the bait tip exactly on the hook',()=>{
 const parent=new Group(),bait=new Group(),meshPivot=new Group(),tip=new Group();
 parent.position.set(3,.4,-2);parent.rotation.y=.35;parent.add(bait);
 bait.scale.setScalar(.72);bait.rotation.y=.2;bait.add(meshPivot);
 meshPivot.position.set(.03,-.02,.01);meshPivot.add(tip);
 tip.name='HookAnchor';tip.position.set(.047,-.164,0);
 const local=assetAnchorLocal(bait,'HookAnchor'),target=new Vector3(.11,-.43,.01);
 assert.ok(local.distanceTo(new Vector3(.077,-.184,.01))<1e-8);
 assert.equal(alignAssetAnchorLocal(bait,local,target),true);
 assert.ok(bait.worldToLocal(tip.getWorldPosition(new Vector3())).distanceTo(local)<1e-8);
 assert.ok(tip.getWorldPosition(new Vector3()).distanceTo(parent.localToWorld(target.clone()))<1e-8);
 assert.equal(assetAnchorLocal(bait,'MissingAnchor'),null);
 assert.equal(alignAssetAnchorLocal(bait,null,target),false);
});

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

test('the physical hook remains exactly in the mouth while the fish turns and dives',()=>{
 const fish=new Group(),hook=new Group();fish.userData.mouthLocal=new Vector3(-.96,-.035,0);fish.scale.setScalar(.56);
 for(const [yaw,pitch,depth] of [[0,0,-.4],[1.2,-.2,-.7],[2.8,.14,-.2]]){
  fish.position.set(2,depth,4);fish.rotation.set(.12,yaw,pitch);
  const mouth=attachHookToMouth(fish,hook);
  assert.ok(hook.position.distanceTo(mouth)<1e-9);
  assert.ok(hook.position.distanceTo(fish.position)>.3,'hook cannot jump to the body center');
 }
});

test('the float tracks the mouth instead of the body during turns and dives',()=>{
 const fish=new Group(),float=new Group(),hook=new Group();
 fish.userData.mouthLocal=new Vector3(-.96,-.035,0);fish.scale.setScalar(.56);
 for(const [yaw,pitch,depth] of [[0,0,-.4],[1.2,-.2,-.7],[2.8,.14,-.2]]){
  fish.position.set(2,depth,4);fish.rotation.set(.12,yaw,pitch);float.position.set(0,.08,0);
  const mouth=alignFloatOverMouth(float,fish),hookPoint=attachHookToMouth(fish,hook);
  assert.ok(mouth.distanceTo(hookPoint)<1e-9);
  assert.ok(Math.hypot(float.position.x-mouth.x,float.position.z-mouth.z)<1e-9);
  assert.ok(Math.hypot(float.position.x-fish.position.x,float.position.z-fish.position.z)>.2);
  assert.equal(float.position.y,.08);
 }
});

test('one bait model moves from float to mouth hook and back without leaving a duplicate',()=>{
 const float=new Group(),fish=new Group(),hook=new Group(),bait=new Group(),tip=new Group();
 float.position.set(1,.15,2);fish.position.set(2,-.45,3);fish.userData.mouthLocal=new Vector3(-.9,-.04,0);
 fish.rotation.y=.7;hook.name='CaughtHook';tip.name='HookAnchor';tip.position.set(.08,-.18,.01);bait.add(tip);bait.scale.setScalar(.72);
 const local=assetAnchorLocal(bait,'HookAnchor'),floatTarget=new Vector3(.11,-.43,.01);
 assert.equal(mountBaitAtAnchor(bait,float,local,floatTarget),true);
 assert.ok(tip.getWorldPosition(new Vector3()).distanceTo(float.localToWorld(floatTarget.clone()))<1e-8);
 attachHookToMouth(fish,hook);
 assert.equal(mountBaitAtAnchor(bait,hook,local,new Vector3()),true);
 assert.equal(float.children.includes(bait),false);
 assert.ok(tip.getWorldPosition(new Vector3()).distanceTo(fishMouthWorld(fish))<1e-8);
 fish.rotation.y=2.1;attachHookToMouth(fish,hook);
 assert.ok(tip.getWorldPosition(new Vector3()).distanceTo(fishMouthWorld(fish))<1e-8);
 mountBaitAtAnchor(bait,float,local,floatTarget);
 assert.equal(hook.children.includes(bait),false);
 assert.ok(tip.getWorldPosition(new Vector3()).distanceTo(float.localToWorld(floatTarget.clone()))<1e-8);
});
