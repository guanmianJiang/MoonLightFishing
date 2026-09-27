const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Relative look limits for the seated idle pose. The root and legs keep facing the spot.
export function idleLookTarget(origin,forward,target,spot){
 if(!target)return {torsoYaw:0,headYaw:0,pitch:0};
 const vx=target.x-origin.x,vz=target.z-origin.z,length=Math.hypot(vx,vz);
 if(length<.75)return {torsoYaw:0,headYaw:0,pitch:0};
 const fx=forward.x,fz=forward.z,forwardLength=Math.hypot(fx,fz)||1;
 const yaw=Math.atan2((fz*vx-fx*vz)/forwardLength,(fx*vx+fz*vz)/forwardLength);
 const eyeHeight=origin.y+.96;
 const targetPitch=Math.atan2((target.y??.12)-eyeHeight,length);
 const baseDistance=Math.hypot(spot.x-origin.x,spot.z-origin.z)||1;
 const basePitch=Math.atan2((spot.y??.12)-eyeHeight,baseDistance);
 const torsoYaw=clamp(yaw*.72,-.62,.62);
 return {torsoYaw,headYaw:clamp(yaw-torsoYaw,-.42,.42),pitch:clamp(targetPitch-basePitch,-.20,.16)};
}
