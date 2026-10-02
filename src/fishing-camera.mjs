import {LURE_CAMERA_TUNING} from './config/fishing-tuning.mjs';
import {cameraImpulse,adjustCameraAngles} from './camera-interaction.mjs';

// Camera targets for the fight and landing shots. The fight camera sits to
// the angler's right, abreast of the line, so both ends stay readable.
export function cameraTransitionBlend(current,active,dt){
 const target=active?1:0,rate=active?3.1:2.3;
 return current+(target-current)*(1-Math.exp(-Math.max(0,dt)*rate));
}

const smooth=(from,to,value)=>{
 const t=Math.max(0,Math.min(1,(value-from)/(to-from)));
 return t*t*(3-2*t);
};

export function castCameraBeat(age){
 if(!Number.isFinite(age)||age<0)return {brace:0,follow:0};
 return {
  brace:smooth(0,.30,age)*(1-smooth(.47,.76,age)),
  follow:smooth(.48,.88,age)*(1-smooth(1.50,2.25,age))
 };
}

export function fightCameraReaction(fight){
 if(!fight)return {pull:0,open:0};
 const surge=Number.isFinite(fight.surge)?Math.max(0,Math.min(1,fight.surge)):0;
 const warning=Number.isFinite(fight.surgeWarning)?Math.max(0,Math.min(1,fight.surgeWarning)):0;
 return {pull:Math.max(surge,warning*.35),open:Math.max(surge*.75,warning*.25)};
}

export function lostRodCameraCue(age,reason,portrait,fightFov){
 const base=Number.isFinite(fightFov)?fightFov:portrait?60:42;
 if(!Number.isFinite(age)||age<0)return {focus:0,aimFraction:.5,aimFloor:1.8,fov:base};
 const broken=reason==='line-break',exit=1-smooth(.52,.95,age);
 const focus=(broken?smooth(0,.07,age)*.75:smooth(0,.12,age))*exit;
 const width=(broken?smooth(0,.05,age):smooth(0,.12,age))*exit;
 const target=broken?Math.max(base,portrait?94:68):portrait?58:48;
 return {focus,aimFraction:.5,aimFloor:broken?2:1.8,fov:base+(target-base)*width};
}

export function landingCameraWeight(age,fromFight){
 if(!fromFight)return 1;
 if(!Number.isFinite(age))return 0;
 return smooth(.22,1.12,age);
}

export function fightCameraFov(span,portrait){
 const t=Math.max(0,Math.min(1,(span-2.5)/6.5));
 const ease=t*t*(3-2*t);
 return (portrait?60:39)+(portrait?20:7)*ease;
}

export function fightCameraPose(angler,fish,forward,right,portrait){
 const span=Math.hypot(fish.x-angler.x,fish.z-angler.z);
 const nearT=Math.max(0,Math.min(1,(span-1.1)/2.2));
 const nearSide=portrait?1-nearT*nearT*(3-2*nearT):0;
 const aim=angler.clone().lerp(fish,portrait?.3+nearSide*.22:.50);
 aim.y=portrait?.4+nearSide*.18:.50;
 const near=Math.max(0,Math.min(1,(span-1.7)/1.8));
 const nearEase=near*near*(3-2*near);
 // As the fish reaches the dock, move its image clear of the left fight panel.
 if(!portrait)aim.addScaledVector(forward,.75*(1-nearEase));
 // Start over the right shoulder to hold a distant fish in the portrait frame.
 // Follow the line to a side-on view as the fish reaches the dock.
 const position=portrait
  ?angler.clone().addScaledVector(forward,-3.2*(1-nearSide)+span*.4*nearSide).addScaledVector(right,3+1.8*nearSide)
  :angler.clone().addScaledVector(forward,span*.58).addScaledVector(right,Math.hypot(5,span*1.45));
 position.y=portrait?2.35+nearSide*.1:1.75;
 return {position,aim};
}

export function orbitFightCameraPose(shot,yaw=0,pitch=0){
 const offset=shot.position.clone().sub(shot.aim),radius=offset.length();
 if(radius<.001)return {position:shot.position.clone(),aim:shot.aim.clone()};
 const azimuth=Math.atan2(offset.x,offset.z)+Math.max(-.58,Math.min(.58,Number.isFinite(yaw)?yaw:0));
 const elevation=Math.max(.06,Math.min(.82,Math.atan2(offset.y,Math.hypot(offset.x,offset.z))+Math.max(-.22,Math.min(.28,Number.isFinite(pitch)?pitch:0))));
 const horizontal=radius*Math.cos(elevation);
 const position=shot.aim.clone();
 position.x+=horizontal*Math.sin(azimuth);position.y+=radius*Math.sin(elevation);position.z+=horizontal*Math.cos(azimuth);
 return {position,aim:shot.aim.clone()};
}

export function orbitCloseCameraPose(shot,yaw=0,pitch=0,framing){
 const angles=adjustCameraAngles('close',{yaw,pitch});
 const offset=shot.position.clone().sub(shot.aim),radius=offset.length();
 if(radius<.001||angles.yaw===0&&angles.pitch===0)return {position:shot.position.clone(),aim:shot.aim.clone()};
 const azimuth=Math.atan2(offset.x,offset.z)+angles.yaw;
 const elevation=Math.max(.10,Math.min(1.15,Math.atan2(offset.y,Math.hypot(offset.x,offset.z))+angles.pitch));
 const horizontal=radius*Math.cos(elevation),position=shot.aim.clone();
 position.x+=horizontal*Math.sin(azimuth);position.y+=radius*Math.sin(elevation);position.z+=horizontal*Math.cos(azimuth);
 if(framing?.subjects?.length){
  // Keep the camera on the clear shoulder: crossing behind the line hides the float.
  if(framing.angler&&framing.target){
   const line=framing.target.clone().sub(framing.angler).setY(0).normalize(),side=line.clone().cross({x:0,y:1,z:0}).negate();
   const lateral=position.clone().sub(framing.angler).dot(side);
   if(lateral<1.8)position.addScaledVector(side,1.8-lateral);
  }
  const orbitRadius=position.distanceTo(shot.aim);
  const forward=shot.aim.clone().sub(position).normalize(),right=forward.clone().cross({x:0,y:1,z:0}).normalize(),up=right.clone().cross(forward);
  const vertical=Math.tan(framing.fov*Math.PI/360)/(framing.zoom||1),horizontal=vertical*framing.aspect;
  let distance=orbitRadius;
  if(vertical>0&&horizontal>0)for(const point of framing.subjects){
   const delta=point.clone().sub(shot.aim),x=delta.dot(right),y=delta.dot(up),along=delta.dot(forward);
   const required=Math.max(Math.abs(x)/(horizontal*.48),Math.abs(y)/(vertical*(y<0?.50:.65)));
   distance=Math.max(distance,required-along);
  }
  position.sub(shot.aim).multiplyScalar(distance/orbitRadius).add(shot.aim);
 }
 return {position,aim:shot.aim.clone()};
}

// Reel-in begins near the hook. A distant target may leave the angler outside
// the frame briefly; the fish stays legible instead of shrinking both subjects.
export function reelCameraPose(angler,fish,forward,right,portrait){
 const aim=fish.clone();
 aim.y=Math.max(.15,fish.y+.10);
 const position=aim.clone()
  .addScaledVector(forward,portrait?2.45:-.45)
  .addScaledVector(right,portrait?2.0:3.45);
 position.y=aim.y+(portrait?1.1:1.05);
 return {position,aim};
}

export function lureFocusEnvelope(age){
 if(!Number.isFinite(age))return 0;
 const smooth=(from,to)=>{const u=Math.max(0,Math.min(1,(age-from)/(to-from)));return u*u*(3-2*u)};
 return (.36*smooth(-1.2,0)+.64*smooth(0,.55))*(1-smooth(1.25,3.25));
}

export function lureInspectionWeight(phase,age){
 return ['approach','reading'].includes(phase)?cameraImpulse(age,.8)*.58:0;
}

export function lureCameraStrength(envelope,portrait,fishGap=Infinity){
 const weight=Number.isFinite(envelope)?Math.max(0,Math.min(1,envelope)):0;
 if(!Number.isFinite(fishGap))return 0;
 const nearness=smooth(0,1,(LURE_CAMERA_TUNING.focusStartDistance-Math.max(0,fishGap))/(LURE_CAMERA_TUNING.focusStartDistance-LURE_CAMERA_TUNING.focusFullDistance));
 const spacing=LURE_CAMERA_TUNING.distantMix+(1-LURE_CAMERA_TUNING.distantMix)*nearness;
 return weight*spacing*(portrait?LURE_CAMERA_TUNING.portraitMaxMix:LURE_CAMERA_TUNING.landscapeMaxMix);
}

// Move along the player's line of sight for a brief water-level bite close-up.
export function lureCameraPose(bobber,forward,right,portrait){
 const aim=bobber.clone();aim.y=.18;
 const position=aim.clone()
  .addScaledVector(forward,portrait?-2.55:-3.0)
  .addScaledVector(right,portrait?.72:1.15);
 position.y=portrait?1.25:1.12;
 return {position,aim};
}

export function landedFishCameraPose(angler,fishBody,forward,right,portrait){
 const aim=fishBody.clone().lerp(angler,.08);
 aim.y=fishBody.y+.05;
 const position=aim.clone()
  .addScaledVector(forward,portrait?3.2:1.0)
  .addScaledVector(right,portrait?1.55:3.2);
 position.y=aim.y+.82;
 return {position,aim};
}
