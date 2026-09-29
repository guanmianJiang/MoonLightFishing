// Pure local motion offsets; scene.js owns meshes, water splashes, and anchors.
export const BOBBER_TUNING=Object.freeze({
 hooked:Object.freeze({settleSeconds:.28,objectDip:.10,objectTilt:.12})
});

const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const smoothstep=(x,min,max)=>{const t=clamp((x-min)/(max-min),0,1);return t*t*(3-2*t)};

export function readingBobberMotion(kind,age){
 return {x:0,y:0,z:0,tilt:0};
}

export function nibbleBobberMotion(remainingMs,nowMs,readyAt,time){
 return {y:0,tilt:0,pulse:-1};
}

export function hookedBobberMotion(objectCatch,ageSeconds,time,fightWave,surge){
 const c=BOBBER_TUNING.hooked,load=smoothstep(ageSeconds,0,c.settleSeconds);
 if(objectCatch)return {x:0,y:-c.objectDip*load,z:0,tilt:c.objectTilt*load};
 return {
  x:(Math.sin(time*2.35)*.11+Math.sin(time*.67)*.18)*load,
  y:-(.16+Math.pow(Math.max(0,Math.sin(time*3.15)),6)*.12+surge*.08)*load,
  z:(Math.cos(time*1.85)*.09+Math.sin(time*.53)*.14)*load,
  tilt:(.36+fightWave*.08+surge*.18)*load
 };
}
