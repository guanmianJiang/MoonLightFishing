import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../src/three.module.js';
import {cameraViewMode,adjustCameraAngles,CAMERA_ANGLE_LIMITS,portraitCloseFraming} from '../src/camera-interaction.mjs';
import {orbitCloseCameraPose} from '../src/fishing-camera.mjs';
import {CAST_AREAS} from '../src/cast-target.mjs';
import {mountCameraAngleControls} from '../src/ui/camera-angle-controls.mjs';

test('angle controls use the visible mode including manual overview during a fight',()=>{
 assert.equal(cameraViewMode(), 'overview');
 for(const state of [{aiming:true},{keepFishingView:true},{pending:{}}])assert.equal(cameraViewMode(state),'close');
 assert.equal(cameraViewMode({pending:{fight:{status:'active'}}}),'fight');
 assert.equal(cameraViewMode({overview:true,pending:{fight:{status:'active'}}}),'overview');
});

test('angle deltas are bounded and invalid inputs cannot poison camera state',()=>{
 for(const [mode,limits] of Object.entries(CAMERA_ANGLE_LIMITS)){
  assert.deepEqual(adjustCameraAngles(mode,{},Infinity,NaN),{yaw:limits.defaultYaw,pitch:limits.defaultPitch});
  assert.deepEqual(adjustCameraAngles(mode,{},100,100),{yaw:limits.yaw[1],pitch:limits.pitch[1]});
  assert.deepEqual(adjustCameraAngles(mode,{},-100,-100),{yaw:limits.yaw[0],pitch:limits.pitch[0]});
  const next=adjustCameraAngles(mode,{},-.1,.06);
  assert.ok(Math.abs(next.yaw-(limits.defaultYaw-.1))<1e-10);
  assert.ok(Math.abs(next.pitch-(limits.defaultPitch+.06))<1e-10);
 }
 assert.deepEqual(adjustCameraAngles('missing'),adjustCameraAngles('overview'));
});

test('close camera orbits its focus without shifting the subject or changing radius',()=>{
 const shot={position:new T.Vector3(2,4,-8),aim:new T.Vector3(-1,.1,3)};
 const zero=orbitCloseCameraPose(shot,NaN,Infinity);
 assert.ok(zero.position.equals(shot.position));
 const moved=orbitCloseCameraPose(shot,.2,.12);
 assert.ok(moved.position.distanceTo(shot.position)>1);
 assert.ok(moved.aim.equals(shot.aim));
 assert.ok(Math.abs(moved.position.distanceTo(moved.aim)-shot.position.distanceTo(shot.aim))<1e-10);
 assert.ok(orbitCloseCameraPose(shot,100,100).position.distanceTo(orbitCloseCameraPose(shot,.30,.22).position)<1e-10);
 const tiny={position:new T.Vector3(),aim:new T.Vector3()};
 assert.ok(orbitCloseCameraPose(tiny,.2,.2).position.equals(tiny.position));
});

test('portrait close angle extremes retain player and target in three fishing areas',()=>{
 const origin=new T.Vector3(-1.25,1.35,.1),person=new T.Vector3(-1.2,1.2,.35);
 for(const [id,[x,z]] of Object.entries(CAST_AREAS))for(const aiming of [false,true]){
  const spot=new T.Vector3(x,.12,z),blend=T.MathUtils.clamp((spot.distanceTo(origin)-3.4)/8.4,0,1);
  const frame=portraitCloseFraming(blend,aiming),forward=spot.clone().sub(origin).setY(0).normalize(),right=new T.Vector3(forward.z,0,-forward.x);
  const position=origin.clone().addScaledVector(forward,aiming?-7.3:-7.7).addScaledVector(right,frame.side);position.y=aiming?4.65:3.9;
  const aim=spot.clone().lerp(origin,frame.aimMix);aim.y=aiming?.20:.13;
  for(const yaw of [-.30,0,.30])for(const pitch of [-.12,0,.22]){
   const shot=orbitCloseCameraPose({position,aim},yaw,pitch,{subjects:[person,spot],aspect:9/16,fov:aiming?49:47}),camera=new T.PerspectiveCamera(aiming?49:47,9/16,.1,2400);
   camera.position.copy(shot.position);camera.lookAt(shot.aim);camera.updateMatrixWorld();
   for(const point of [person,spot]){const image=point.clone().project(camera);assert.ok(Math.abs(image.x)<.86&&image.y>-.55&&image.y<.65&&image.z>-1&&image.z<1,JSON.stringify({id,aiming,yaw,pitch,image}));}
  }
 }
});

function controls(){
 const node=()=>({hidden:true,disabled:false,attrs:{},setAttribute(key,value){this.attrs[key]=value}});
 const toggle=node(),buttons=['left','right','up','down','unknown'].map(direction=>({...node(),dataset:{cameraAngle:direction}}));
 const panel={...node(),querySelectorAll:()=>buttons},calls=[];
 const ui=mountCameraAngleControls({querySelector:selector=>selector==='#cameraAngleToggle'?toggle:panel},()=>({orbit:(...args)=>calls.push(args),cancelIntro:()=>calls.push('cancelIntro')}));
 return {ui,toggle,panel,buttons,calls};
}

test('live angle buttons toggle, dispatch both axes and close for landing and result',()=>{
 const {ui,toggle,panel,buttons,calls}=controls();
 toggle.onclick();assert.equal(panel.hidden,false);assert.equal(toggle.attrs['aria-expanded'],'true');
 for(const button of buttons)button.onclick();
 assert.deepEqual(calls,['cancelIntro',[-.1,0],[.1,0],[0,.06],[0,-.06]]);
 ui.update({revealing:true});assert.equal(panel.hidden,true);assert.equal(toggle.disabled,true);
 toggle.onclick();buttons[0].onclick();assert.equal(calls.length,5);
 ui.update({pending:{phase:'result'}});assert.equal(toggle.disabled,true);
 ui.update({pending:{fight:{status:'active'}}});assert.equal(toggle.disabled,false);
 toggle.onclick();toggle.onclick();assert.equal(panel.hidden,true);assert.equal(toggle.attrs['aria-expanded'],'false');
});

test('angle UI is safe before the world has loaded and during a rendering failure',()=>{
 const {toggle,panel,buttons}=controls();
 mountCameraAngleControls({querySelector:selector=>selector==='#cameraAngleToggle'?toggle:panel},()=>null);
 assert.doesNotThrow(()=>{toggle.onclick();buttons[0].onclick()});
});

test('live scene angle and reset methods independently update the visible camera',()=>{
 const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 const methods=source.slice(source.indexOf(' function orbitBy('),source.indexOf(' function zoomBy('));
 const sample=new Function('cameraViewMode','adjustCameraAngles',`
  let state={},yaw=.16,pitch=1.02,closeYaw=0,closePitch=0,fightViewYaw=0,fightViewPitch=0;
  let desiredZoom=1.3,desiredFightZoom=1.2,clickedWaterPoint={},focusBlend=1;
  const cancelIntro=()=>{},getState=()=>state;
  ${methods}
  return {orbitBy,resetViewAngles,setState:value=>state=value,
   read:()=>({yaw,pitch,closeYaw,closePitch,fightViewYaw,fightViewPitch,desiredZoom,desiredFightZoom})};
 `)(cameraViewMode,adjustCameraAngles);
 sample.orbitBy(.1,.06);assert.ok(Math.abs(sample.read().yaw-.26)<1e-10);
 sample.setState({keepFishingView:true});sample.orbitBy(.2,.12);
 assert.equal(sample.read().closeYaw,.2);assert.equal(sample.read().closePitch,.12);
 sample.setState({pending:{fight:{status:'active'}}});sample.orbitBy(-.3,-.1);
 assert.equal(sample.read().fightViewYaw,-.3);assert.equal(sample.read().closeYaw,.2);
 sample.resetViewAngles();assert.equal(sample.read().fightViewYaw,0);assert.equal(sample.read().desiredFightZoom,1);
 sample.setState({overview:true,pending:{fight:{status:'active'}}});sample.resetViewAngles();
 assert.equal(sample.read().yaw,.16);assert.equal(sample.read().pitch,1.02);assert.equal(sample.read().closeYaw,.2);
 sample.setState({aiming:true});sample.resetViewAngles();assert.equal(sample.read().closeYaw,0);assert.equal(sample.read().closePitch,0);
});

test('portrait focus fitting protects a distant bobber at maximum zoom and angle',()=>{
 const shot={position:new T.Vector3(2,3.9,-7),aim:new T.Vector3(4,.12,10)};
  const subjects=[new T.Vector3(-1.2,.5,.35),new T.Vector3(-1.2,1.7,.35),new T.Vector3(5,.14,12)];
 for(const aspect of [9/16,320/568,16/9])for(const yaw of [-.3,.3])for(const pitch of [-.12,.22]){
  const pose=orbitCloseCameraPose(shot,yaw,pitch,{angler:subjects[0],target:subjects[2],subjects,aspect,fov:37,zoom:1.45});
  const camera=new T.PerspectiveCamera(37,aspect,.1,2400);camera.zoom=1.45;camera.updateProjectionMatrix();camera.position.copy(pose.position);camera.lookAt(pose.aim);camera.updateMatrixWorld();
  for(const point of subjects){const image=point.clone().project(camera);assert.ok(Math.abs(image.x)<=.480001&&image.y>=-.500001&&image.y<=.650001,JSON.stringify({aspect,yaw,pitch,image}));}
  const line=subjects[2].clone().sub(subjects[0]).setY(0).normalize(),side=new T.Vector3(line.z,0,-line.x);
  assert.ok(pose.position.clone().sub(subjects[0]).dot(side)>=1.8-1e-10,'the float must stay clear of the player shoulder');
 }
});
