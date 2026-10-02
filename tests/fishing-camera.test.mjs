import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/three.module.js';
import {cameraTransitionBlend,castCameraBeat,fightCameraReaction,lostRodCameraCue,landingCameraWeight,fightCameraFov,fightCameraPose,orbitFightCameraPose,reelCameraPose,lureFocusEnvelope,lureInspectionWeight,lureCameraStrength,lureCameraPose,hookWindowCameraActive,hookWindowCameraPose,landedFishCameraPose} from '../src/fishing-camera.mjs';
import {portraitCloseFraming} from '../src/camera-interaction.mjs';
import {CAST_AREAS,openingCastPoint} from '../src/cast-target.mjs';

const spots=[[-1.5,3.4],[2,8],[5,12]];
const angler=new T.Vector3(-1.2,.5,.35);
function projected(shot,point,aspect,fov){
 const camera=new T.PerspectiveCamera(fov,aspect,.1,100);
 camera.position.copy(shot.position);
 camera.lookAt(shot.aim);
 camera.updateMatrixWorld();
 return point.clone().project(camera);
}

test('cast camera braces, follows the release and settles without a cut',()=>{
 assert.deepEqual(castCameraBeat(-1),{brace:0,follow:0});
 assert.deepEqual(castCameraBeat(NaN),{brace:0,follow:0});
 assert.deepEqual(castCameraBeat(0),{brace:0,follow:0});
 assert.ok(castCameraBeat(.32).brace>.95);
 assert.ok(castCameraBeat(.90).follow>.95);
 assert.deepEqual(castCameraBeat(2.3),{brace:0,follow:0});
 let prior=castCameraBeat(0);
 for(let age=.01;age<=2.3;age+=.01){
  const next=castCameraBeat(age);
  for(const key of ['brace','follow']){
   assert.ok(next[key]>=0&&next[key]<=1,{age,key,next});
   assert.ok(Math.abs(next[key]-prior[key])<.07,{age,key,next,prior});
  }
  prior=next;
 }
});

test('surge opens the fight frame and landing waits before following the lifted fish',()=>{
 assert.deepEqual(fightCameraReaction(null),{pull:0,open:0});
 assert.deepEqual(fightCameraReaction({surge:NaN,surgeWarning:NaN}),{pull:0,open:0});
 assert.deepEqual(fightCameraReaction({surge:2,surgeWarning:-1}),{pull:1,open:.75});
 assert.ok(fightCameraReaction({surge:.6,surgeWarning:0}).pull>.5);
 assert.equal(landingCameraWeight(.1,true),0);
 assert.ok(landingCameraWeight(.7,true)>0&&landingCameraWeight(.7,true)<1);
 assert.equal(landingCameraWeight(1.2,true),1);
 assert.equal(landingCameraWeight(.1,false),1);
 assert.equal(landingCameraWeight(NaN,true),0);
});

test('line break keeps a wide view of the fast rod whip while unhooking stays softer',()=>{
 const start=lostRodCameraCue(0,'line-break',true,62);
 const broken=lostRodCameraCue(.09,'line-break',true,62);
 const escaped=lostRodCameraCue(.09,'escaped',true,62);
 assert.equal(start.focus,0);
 assert.equal(start.fov,62);
 assert.ok(broken.focus>.7&&broken.focus<.8,'the wide first frame centers both rod and angler');
 assert.ok(escaped.focus>broken.focus);
 assert.ok(broken.fov>=94&&broken.fov>escaped.fov);
 assert.ok(lostRodCameraCue(.3,'line-break',true,62).focus>0,'the camera may follow the rod after the main snap');
 assert.equal(lostRodCameraCue(.09,'line-break',true,98).fov,98,'an already wide fight frame must not narrow on the break');
 assert.equal(lostRodCameraCue(NaN,'line-break',true,62).focus,0);
});

test('reeling view moves from the right shoulder toward the line and retains angler and fish',()=>{
 for(const aspect of [1135/883,16/9,9/16])for(const [x,z] of spots){
  const span=Math.hypot(x-angler.x,z-angler.z);
  for(const progress of [Math.min(1,1.8/span),.35,.65,1]){
  const fish=new T.Vector3(angler.x+(x-angler.x)*progress,-.3,angler.z+(z-angler.z)*progress);
  const forward=new T.Vector3(x-angler.x,0,z-angler.z).normalize();
  const right=new T.Vector3(forward.z,0,-forward.x);
  const shot=fightCameraPose(angler,fish,forward,right,aspect<.8);
  const fov=fightCameraFov(fish.distanceTo(angler),aspect<.8);
  const along=shot.position.clone().sub(angler).dot(forward);
  if(aspect>=.8)assert.ok(along>0&&along<fish.distanceTo(angler),{along,aspect,x,z,progress});
  else{
   const lateral=shot.position.clone().sub(angler).dot(right);
   assert.ok(lateral>2.99&&lateral<=4.81,{lateral,aspect,x,z,progress});
   assert.ok(along>-3.21&&along<fish.distanceTo(angler),{along,aspect,x,z,progress});
  }
  assert.ok(shot.position.y>=1.5&&shot.position.y<=2.46,{height:shot.position.y});
  const person=projected(shot,angler.clone().add(new T.Vector3(0,.7,0)),aspect,fov);
  const fishOnScreen=projected(shot,fish,aspect,fov);
  if(aspect>=.8&&fish.distanceTo(angler)<1.81)assert.ok(fishOnScreen.x>-.15,{aspect,x,z,fishOnScreen});
  for(const point of [person,fishOnScreen]){
   assert.ok(Math.abs(point.x)<(aspect<.8?.85:.8)&&Math.abs(point.y)<.7,{aspect,x,z,progress,point});
   assert.ok(point.z>-1&&point.z<1,{aspect,x,z,progress,point});
  }
  if(aspect<.8)assert.ok(person.x-fishOnScreen.x>.35,{aspect,x,z,progress,person,fishOnScreen});
  }
 }
});

test('portrait fight camera tracks the fish toward the dock without a pose jump',()=>{
 const forward=new T.Vector3(5-angler.x,0,12-angler.z).normalize();
 const right=new T.Vector3(forward.z,0,-forward.x);
 let previous=null;
 for(let span=13;span>=.7;span-=.1){
  const fish=angler.clone().addScaledVector(forward,span);fish.y=-.3;
  const shot=fightCameraPose(angler,fish,forward,right,true);
  if(previous){
   assert.ok(shot.position.distanceTo(previous.position)<.32,{span});
   assert.ok(shot.aim.distanceTo(previous.aim)<.12,{span});
  }
  previous=shot;
 }
});

test('manual fight orbit keeps the live action pivot and camera distance',()=>{
 const forward=new T.Vector3(0,0,1),right=new T.Vector3(1,0,0);
 const shot=fightCameraPose(angler,new T.Vector3(-1.2,-.3,8),forward,right,true);
 const defaultShot=orbitFightCameraPose(shot);
 assert.ok(defaultShot.position.distanceTo(shot.position)<1e-10);
 const moved=orbitFightCameraPose(shot,.35,.14);
 assert.ok(moved.position.distanceTo(shot.position)>.5);
 assert.ok(moved.aim.distanceTo(shot.aim)<1e-10);
 assert.ok(Math.abs(moved.position.distanceTo(moved.aim)-shot.position.distanceTo(shot.aim))<1e-10);
 const extreme=orbitFightCameraPose(shot,100,100),limit=orbitFightCameraPose(shot,.58,.28);
 assert.ok(extreme.position.distanceTo(limit.position)<1e-10);
 assert.ok(orbitFightCameraPose(shot,NaN,NaN).position.distanceTo(shot.position)<1e-10);
 assert.ok(orbitFightCameraPose(shot,0,-100).position.y>shot.aim.y);
});

test('fight lens opens for distant fish and camera transitions ignore frame batching',()=>{
 for(const portrait of [false,true]){
  const near=fightCameraFov(1.8,portrait),far=fightCameraFov(13,portrait);
  assert.ok(far>near+6,{near,far});
  assert.ok(near>=(portrait?60:39)&&far<=(portrait?80:46),{near,far});
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

test('bait close-up begins with a light approach, holds, and eases back before the hook window',()=>{
 assert.equal(lureFocusEnvelope(-1.3),0);
 assert.ok(lureFocusEnvelope(-.6)>0&&lureFocusEnvelope(-.6)<.36);
 assert.equal(lureFocusEnvelope(0),.36);
 assert.ok(lureFocusEnvelope(.28)>.36&&lureFocusEnvelope(.28)<1);
 assert.equal(lureFocusEnvelope(.7),1);
 assert.ok(lureFocusEnvelope(2.2)<.7&&lureFocusEnvelope(2.2)>.2);
 assert.equal(lureFocusEnvelope(3.3),0);
 assert.equal(lureFocusEnvelope(NaN),0);
 let prior=lureFocusEnvelope(-1.3);
 for(let age=-1.29;age<=3.35;age+=.01){const weight=lureFocusEnvelope(age);assert.ok(weight>=0&&weight<=1,{age,weight});assert.ok(Math.abs(weight-prior)<.035,{age,weight,prior});prior=weight}
 for(let age=1.3,last=1;age<3.25;age+=.1){const weight=lureFocusEnvelope(age);assert.ok(weight<=last+1e-9);last=weight}
 for(const portrait of [false,true])for(const [x,z] of spots){
  const fish=new T.Vector3(x,.1,z),forward=new T.Vector3(x-angler.x,0,z-angler.z).normalize(),right=new T.Vector3(forward.z,0,-forward.x);
  const shot=lureCameraPose(fish,forward,right,portrait);
  const image=projected(shot,fish,portrait?9/16:16/9,portrait?37:35);
  assert.ok(Math.abs(image.x)<.3&&Math.abs(image.y)<.3,{portrait,x,z,image});
  assert.ok(shot.position.clone().sub(fish).dot(forward)<-2,'camera should approach from the player side');
 }
});

test('portrait bait camera keeps a wide enough share of the waiting composition',()=>{
 assert.equal(lureCameraStrength(0,true,0),0);
 assert.equal(lureCameraStrength(1,true,0),.55);
 assert.equal(lureCameraStrength(1,false,0),.72);
 assert.equal(lureCameraStrength(2,true,0),.55);
 assert.equal(lureCameraStrength(-1,true,0),0);
 assert.equal(lureCameraStrength(NaN,true,0),0);
 assert.equal(lureCameraStrength(1,true,Infinity),0);
 assert.ok(lureCameraStrength(1,true,3)<.11);
 assert.ok(lureCameraStrength(1,true,1)>lureCameraStrength(1,true,2));
 assert.ok(lureCameraStrength(lureFocusEnvelope(-.6),true,3)<.04);
});

test('hook camera begins only after a live fish takes the bait',()=>{
 const fish={catch:{id:'carp'}};
 assert.equal(hookWindowCameraActive('bite','hooked',fish),true);
 for(const phase of ['approach','reading','responding','nibble','waiting','casting'])assert.equal(hookWindowCameraActive('bite',phase,fish),false);
 for(const stage of ['overview','fight','landing','survey'])assert.equal(hookWindowCameraActive(stage,'hooked',fish),false);
 for(const pending of [null,{}, {catch:{id:'bottle'}},{catch:{id:'bell'}},{catch:{id:'carp'},fight:{status:'active'}},{catch:{id:'carp'},landedFromFight:true}])assert.equal(hookWindowCameraActive('bite','hooked',pending),false);
});

test('hook shot enlarges the real float while retaining player and float in portrait',()=>{
 const first=openingCastPoint(),targets=[first,...Object.values(CAST_AREAS)];
 const origin=new T.Vector3(-1.25,1.35,.1);
 for(const [width,height] of [[390,844],[320,568],[800,450]])for(const [x,z] of targets){
  const aspect=width/height,portrait=aspect<.8,spot=new T.Vector3(x,.12,z),bobber=new T.Vector3(x,.13,z);
  const forward=spot.clone().sub(origin).setY(0).normalize(),right=new T.Vector3(forward.z,0,-forward.x);
  const range=Math.max(0,Math.min(1,(spot.distanceTo(origin)-3.4)/8.4)),frame=portraitCloseFraming(range,false);
  const waiting={
   position:origin.clone().addScaledVector(forward,portrait?-7.7:-6.9).addScaledVector(right,portrait?frame.side:3.8),
   aim:spot.clone().lerp(origin,portrait?frame.aimMix:.17),
   fov:portrait?47:40
  };
  waiting.position.y=portrait?3.9:2.95;waiting.aim.y=.65;waiting.aim.lerp(bobber,.65);
  const player=origin.clone().add(new T.Vector3(0,.45,0));
  const shot=hookWindowCameraPose(waiting,bobber,forward,right,portrait);
  const floatView=projected(shot,bobber,aspect,shot.fov),personView=projected(shot,player,aspect,shot.fov);
  assert.ok(Math.abs(floatView.x)<.91&&Math.abs(floatView.y)<.86&&floatView.z>-1&&floatView.z<1,JSON.stringify({width,height,x,z,floatView}));
  if(x===first[0]&&z===first[1])assert.ok(Math.abs(personView.x)<.91&&Math.abs(personView.y)<.86&&personView.z>-1&&personView.z<1,JSON.stringify({width,height,x,z,personView}));
  const apparent=(distance,fov)=>1/(distance*Math.tan(fov*Math.PI/360));
  const sizeGain=apparent(shot.position.distanceTo(bobber),shot.fov)/apparent(waiting.position.distanceTo(bobber),waiting.fov);
  assert.ok(sizeGain>(portrait?1.23:1.18),JSON.stringify({width,height,x,z,sizeGain}));
  assert.ok(shot.position.distanceTo(waiting.position)<waiting.position.distanceTo(bobber)*.36,{width,height,x,z});
 }
});

test('hook shot has safe fallbacks and frame rate independent entry',()=>{
 const waiting={position:new T.Vector3(0,4,-8),aim:new T.Vector3(0,.2,2),fov:47};
 const direction=new T.Vector3(0,0,1),right=new T.Vector3(1,0,0),bobber=new T.Vector3(0,.1,5);
 const invalid=hookWindowCameraPose(waiting,new T.Vector3(NaN,0,0),direction,right,true);
 assert.ok(invalid.position.equals(waiting.position)&&invalid.aim.equals(waiting.aim));
 assert.equal(invalid.fov,47);
 const shot=hookWindowCameraPose(waiting,bobber,direction,right,true);
 assert.ok(waiting.position.equals(new T.Vector3(0,4,-8))&&waiting.aim.equals(new T.Vector3(0,.2,2)),'the waiting composition must remain immutable');
 let blend=0,previous=waiting.position.clone();
 for(let frame=0;frame<90;frame++){
  blend=cameraTransitionBlend(blend,true,1/60);
  const position=waiting.position.clone().lerp(shot.position,blend*blend*(3-2*blend));
  assert.ok(position.distanceTo(previous)<.2,JSON.stringify({frame,step:position.distanceTo(previous)}));previous=position;
 }
 assert.ok(previous.distanceTo(shot.position)<.06);
 const batched=cameraTransitionBlend(0,true,.5),stepped=Array.from({length:30}).reduce(value=>cameraTransitionBlend(value,true,1/60),0);
 assert.ok(Math.abs(batched-stepped)<1e-12);
});

test('a valid bait tap gives one short camera response only while the fish is approaching or reading',()=>{
 assert.equal(lureInspectionWeight('approach',.4),.58);
 assert.equal(lureInspectionWeight('reading',.4),.58);
 for(const phase of ['waiting','nibble','hooked','idle'])assert.equal(lureInspectionWeight(phase,.4),0);
 for(const age of [-1,0,.8,NaN])assert.equal(lureInspectionWeight('approach',age),0);
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
