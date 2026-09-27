import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/three.module.js';
import {cameraTransitionBlend,fightCameraFov,fightCameraPose,reelCameraPose,lureFocusEnvelope,lureCameraPose,landedFishCameraPose} from '../dist/fishing-camera.mjs';

const spots=[[-1.5,3.4],[2,8],[5,12]];
const angler=new T.Vector3(-1.2,.5,.35);
function projected(shot,point,aspect,fov){
 const camera=new T.PerspectiveCamera(fov,aspect,.1,100);
 camera.position.copy(shot.position);
 camera.lookAt(shot.aim);
 camera.updateMatrixWorld();
 return point.clone().project(camera);
}

test('reeling view faces the action at eye level and retains angler and fish',()=>{
 for(const aspect of [1135/883,16/9,9/16])for(const [x,z] of spots){
  const span=Math.hypot(x-angler.x,z-angler.z);
  for(const progress of [Math.min(1,1.8/span),1]){
  const fish=new T.Vector3(angler.x+(x-angler.x)*progress,-.3,angler.z+(z-angler.z)*progress);
  const forward=new T.Vector3(x-angler.x,0,z-angler.z).normalize();
  const right=new T.Vector3(forward.z,0,-forward.x);
  const shot=fightCameraPose(angler,fish,forward,right,aspect<.8);
  const fov=fightCameraFov(fish.distanceTo(angler),aspect<.8);
  const along=shot.position.clone().sub(angler).dot(forward);
  if(aspect>=.8)assert.ok(along>0&&along<fish.distanceTo(angler),{along,aspect,x,z,progress});
  else assert.ok(along<0,{along,aspect,x,z,progress});
  assert.ok(shot.position.y>=1.5&&shot.position.y<=2.4,{height:shot.position.y});
  const person=projected(shot,angler.clone().add(new T.Vector3(0,.7,0)),aspect,fov);
  const fishOnScreen=projected(shot,fish,aspect,fov);
  if(aspect>=.8&&fish.distanceTo(angler)<1.81)assert.ok(fishOnScreen.x>-.15,{aspect,x,z,fishOnScreen});
  for(const point of [person,fishOnScreen]){
   assert.ok(Math.abs(point.x)<.8&&Math.abs(point.y)<.7,{aspect,x,z,progress,point});
   assert.ok(point.z>-1&&point.z<1,{aspect,x,z,progress,point});
  }
  }
 }
});

test('fight lens opens for distant fish and camera transitions ignore frame batching',()=>{
 for(const portrait of [false,true]){
  const near=fightCameraFov(1.8,portrait),far=fightCameraFov(13,portrait);
  assert.ok(far>near+6,{near,far});
  assert.ok(near>=39&&far<=55,{near,far});
 }
 let fine=0,coarse=0;
 for(let i=0;i<60;i++)fine=cameraTransitionBlend(fine,true,1/60);
 for(let i=0;i<30;i++)coarse=cameraTransitionBlend(coarse,true,1/30);
 assert.ok(Math.abs(fine-coarse)<1e-12,{fine,coarse});
 assert.ok(fine>.9&&fine<1,{fine});
 const returning=cameraTransitionBlend(fine,false,1/60);
 assert.ok(returning>0&&returning<fine,{fine,returning});
});

test('reel-in begins closer to the hook than the fight camera',()=>{
 for(const portrait of [false,true])for(const [x,z] of spots){
  const fish=new T.Vector3(x,-.25,z);
  const forward=new T.Vector3(x-angler.x,0,z-angler.z).normalize();
  const right=new T.Vector3(forward.z,0,-forward.x);
  const fight=fightCameraPose(angler,fish,forward,right,portrait);
  const reel=reelCameraPose(angler,fish,forward,right,portrait);
  assert.ok(reel.position.distanceTo(fish)<fight.position.distanceTo(fish));
  assert.ok(reel.position.distanceTo(fish)<(portrait?3.7:3.95));
  const image=projected(reel,fish,portrait?9/16:16/9,portrait?42:39);
  assert.ok(Math.abs(image.x)<.35&&Math.abs(image.y)<.4,{portrait,x,z,image});
 }
});

test('bait close-up approaches, holds, and eases back before the hook window',()=>{
 assert.equal(lureFocusEnvelope(-.1),0);
 assert.ok(lureFocusEnvelope(.28)>0&&lureFocusEnvelope(.28)<1);
 assert.equal(lureFocusEnvelope(.7),1);
 assert.ok(lureFocusEnvelope(2.2)<.7&&lureFocusEnvelope(2.2)>.2);
 assert.equal(lureFocusEnvelope(3.3),0);
 for(let age=1.3,last=1;age<3.25;age+=.1){const weight=lureFocusEnvelope(age);assert.ok(weight<=last+1e-9);last=weight}
 for(const portrait of [false,true])for(const [x,z] of spots){
  const fish=new T.Vector3(x,.1,z),forward=new T.Vector3(x-angler.x,0,z-angler.z).normalize(),right=new T.Vector3(forward.z,0,-forward.x);
  const shot=lureCameraPose(fish,forward,right,portrait);
  const image=projected(shot,fish,portrait?9/16:16/9,portrait?37:35);
  assert.ok(Math.abs(image.x)<.3&&Math.abs(image.y)<.3,{portrait,x,z,image});
  assert.ok(shot.position.clone().sub(fish).dot(forward)<-2,'camera should approach from the player side');
 }
});

test('landing close-up centers the fish body across fishing directions',()=>{
 for(const aspect of [16/9,9/16])for(const [x,z] of spots){
  const fish=new T.Vector3(-1,1.65,1.1);
  const forward=new T.Vector3(x-angler.x,0,z-angler.z).normalize();
  const right=new T.Vector3(forward.z,0,-forward.x);
  const shot=landedFishCameraPose(angler,fish,forward,right,aspect<.8);
  for(const point of [fish,fish.clone().addScaledVector(forward,.65),fish.clone().addScaledVector(forward,-.65)]){
   const image=projected(shot,point,aspect,aspect<.8?39:37);
   assert.ok(Math.abs(image.x)<.65&&Math.abs(image.y)<.65,JSON.stringify({aspect,x,z,image}));
  }
 }
});
