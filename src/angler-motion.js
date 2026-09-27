import {motionClips} from './angler-motion-data.js';
const smooth=u=>u*u*(3-2*u);
export function sampleAnglerMotion(name,time){
 const keys=motionClips[name];
 if(!keys)throw new Error(`Unknown angler motion: ${name}`);
 const t=Math.max(0,Math.min(time,keys[keys.length-1].t));
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],u=smooth((t-a.t)/(b.t-a.t));
 return {
  action:a.action+(b.action-a.action)*u,
  rodAngle:a.rodAngle+(b.rodAngle-a.rodAngle)*u,
  lean:a.lean+(b.lean-a.lean)*u,
  handLift:a.handLift+(b.handLift-a.handLift)*u,
  handBack:a.handBack+(b.handBack-a.handBack)*u,
  rootLift:a.rootLift+(b.rootLift-a.rootLift)*u,
  torsoYaw:a.torsoYaw+(b.torsoYaw-a.torsoYaw)*u,
  offHandLift:a.offHandLift+(b.offHandLift-a.offHandLift)*u,
  offHandBack:a.offHandBack+(b.offHandBack-a.offHandBack)*u,
  gripSide:a.gripSide+(b.gripSide-a.gripSide)*u
 };
}

// The authored clip is a full cast. Blend its movement from the resting pose
// using the distance from the angler to the chosen water point.
export function castEffort(distance){
 const u=Math.max(0,Math.min(1,(distance-2.5)/10));
 return .32+.68*u*u*(3-2*u);
}

export function sampleCastMotion(time,distance){
 const pose=sampleAnglerMotion('cast',time),effort=castEffort(distance);
 const scaled={...pose};
 for(const key of ['action','lean','handLift','handBack','rootLift','torsoYaw','offHandLift','offHandBack','gripSide'])scaled[key]*=effort;
 scaled.rodAngle=.72+(pose.rodAngle-.72)*effort;
 // Medium casts still move the grip aside once the tip goes behind the torso.
 const rearward=Math.max(0,Math.min(1,(scaled.rodAngle-1.55)/.25));
 scaled.gripSide=Math.max(scaled.gripSide,.28*rearward);
 return scaled;
}

export function reelAnimationTime(age,landedFromFight){
 // The fight has already supplied the reel and heave. Keep the raised hold
 // for the catch camera instead of playing the reel clip a second time.
 return landedFromFight?1.6:age;
}

export function isLargeCatch(catchInfo){return !!catchInfo&&catchInfo.weight>=2.4&&!['bottle','bell'].includes(catchInfo.id);}

export function shouldStandForCatch(catchInfo,{fighting=false,landedFromFight=false,revealing=false,showingResult=false}={}){
 return isLargeCatch(catchInfo)&&(fighting||landedFromFight||revealing||showingResult);
}
