import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/three.module.js';
import {CAST_AREAS} from '../src/cast-target.mjs';
import {cameraStage,castNeedsAimCamera,readyWaterGesture,visibleCastRanges,viewTransitionWeight,portraitCloseFraming,cameraSettled,cameraImpulse} from '../src/camera-interaction.mjs';

test('ready water touch waits for a tap or short drag and gives two fingers to pinch',()=>{
 assert.equal(readyWaterGesture(1,0),'wait');
 assert.equal(readyWaterGesture(1,7),'wait');
 assert.equal(readyWaterGesture(1,7.1),'select');
 assert.equal(readyWaterGesture(2,0),'pinch');
 assert.equal(readyWaterGesture(0,20),'wait');
 assert.equal(readyWaterGesture(1,NaN),'wait');
});

test('camera intent gives manual overview priority and follows the fishing action',()=>{
 assert.equal(cameraStage({},'idle'),'survey');
 assert.equal(cameraStage({aiming:true},'idle'),'aim');
 assert.equal(cameraStage({aiming:true,overview:true},'idle'),'overview');
 const pending={fight:{status:'active'}};
 assert.equal(cameraStage({pending},'hooked'),'fight');
 assert.equal(cameraStage({pending,overview:true},'hooked'),'overview');
 assert.equal(cameraStage({pending,revealing:true},'hooked'),'landing');
 assert.equal(cameraStage({pending},'casting'),'fight');
 assert.equal(cameraStage({pending:{phase:'cast'}},'casting'),'casting');
 assert.equal(cameraStage({pending:{phase:'cast'}},'waiting'),'waiting');
 assert.equal(cameraStage({pending:{phase:'cast'}},'approach'),'bite');
 assert.equal(cameraStage({pending:{phase:'cast'}},'reading'),'bite');
});

test('a manually chosen overview cast skips close-camera readiness',()=>{
 assert.equal(castNeedsAimCamera(true),false);
 assert.equal(castNeedsAimCamera(false),true);
});

test('cast range stays visible in close ready view and follows camera mode',()=>{
 const spots=['reed','bridge','deep'];
 assert.deepEqual(visibleCastRanges({spot:'reed',keepFishingView:false},spots),spots);
 assert.deepEqual(visibleCastRanges({spot:'reed',keepFishingView:true},spots),['reed']);
 assert.deepEqual(visibleCastRanges({spot:'reed',keepFishingView:true,aiming:true},spots),['reed']);
 assert.deepEqual(visibleCastRanges({spot:'reed',keepFishingView:true,overview:true},spots),spots);
 assert.deepEqual(visibleCastRanges({spot:'reed',keepFishingView:true,pending:{phase:'cast'}},spots),[]);
 assert.deepEqual(visibleCastRanges({spot:'missing',keepFishingView:true},spots),[]);
});

test('view transitions use one smooth, monotonic progress for position, aim and lens',()=>{
 assert.equal(viewTransitionWeight(-10,760),0);
 assert.equal(viewTransitionWeight(0,760),0);
 assert.equal(viewTransitionWeight(380,760),.5);
 assert.equal(viewTransitionWeight(760,760),1);
 assert.equal(viewTransitionWeight(900,760),1);
 const values=[0,100,200,300,400,500,600,700,760].map(age=>viewTransitionWeight(age,760));
 assert.ok(values.every((value,index)=>index===0||value>values[index-1]));
 assert.ok(values[1]<.03);
 assert.ok(1-values.at(-2)<.03);
});

test('aim confirmation waits for camera position and target to settle',()=>{
 const position=new T.Vector3(0,2,4),aim=new T.Vector3(0,0,0);
 assert.equal(cameraSettled(position,aim,position.clone(),aim.clone(),.99),true);
 assert.equal(cameraSettled(position,aim,position.clone().add(new T.Vector3(1,0,0)),aim.clone(),.99),false);
 assert.equal(cameraSettled(position,aim,position.clone(),aim.clone().add(new T.Vector3(0,.5,0)),.99),false);
 assert.equal(cameraSettled(position,aim,position.clone(),aim.clone(),.9),false);
});

test('inspection and hook impulses are brief and return to a stable frame',()=>{
 assert.equal(cameraImpulse(-.1,.46),0);
 assert.equal(cameraImpulse(0,.46),0);
 assert.ok(cameraImpulse(.23,.46)>.99);
 assert.equal(cameraImpulse(.46,.46),0);
 assert.equal(cameraImpulse(1,.46),0);
 assert.equal(cameraImpulse(NaN,.46),0);
});

test('portrait aim and waiting frames keep the angler and landing point clear of side and bottom controls',()=>{
 const origin=new T.Vector3(-1.25,1.35,.1),person=new T.Vector3(-1.2,1.2,.35);
 for(const [spotId,[x,z]] of Object.entries(CAST_AREAS))for(const aiming of [true,false]){
  const spot=new T.Vector3(x,.12,z),rangeBlend=T.MathUtils.clamp((spot.distanceTo(origin)-3.4)/8.4,0,1);
  const framing=portraitCloseFraming(rangeBlend,aiming),forward=spot.clone().sub(origin).setY(0).normalize(),right=new T.Vector3(forward.z,0,-forward.x);
  const position=origin.clone().addScaledVector(forward,aiming?-7.3:-7.7).addScaledVector(right,framing.side);
  position.y=aiming?4.65:3.9;
  const aim=spot.clone().lerp(origin,framing.aimMix);aim.y=aiming?.20:.13;
  const camera=new T.PerspectiveCamera(aiming?49:47,9/16,.1,2400);
  camera.position.copy(position);camera.lookAt(aim);camera.updateMatrixWorld();
  const normalized=point=>{const projected=point.clone().project(camera);return {x:(projected.x+1)/2,y:(1-projected.y)/2}};
  const player=normalized(person),landing=normalized(spot);
  assert.ok(player.x>.55&&player.x<.77&&player.y>.45&&player.y<.73,{spotId,aiming,player});
  assert.ok(landing.x>.37&&landing.x<.58&&landing.y>.32&&landing.y<.56,{spotId,aiming,landing});
 }
});
