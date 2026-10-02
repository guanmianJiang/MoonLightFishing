import {castEffort} from './angler-motion.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Short motion envelopes. Keeping them time based makes a restored cast and a
// low frame rate land on the same pose without storing additional animation state.
export function castWhip(age){
 if(!Number.isFinite(age)||age<=0||age>=.48)return 0;
 return Math.sin(age*19)*Math.exp(-age*7.5);
}

export function castFeedback(age,distance){
 const effort=castEffort(Number.isFinite(distance)?distance:2.5);
 const release=castWhip(age);
 const followThrough=Number.isFinite(age)&&age>0&&age<.72?Math.sin(Math.PI*age/.72)*Math.exp(-age*2.2):0;
 return {effort,recoil:release*(.32+.68*effort),followThrough:followThrough*effort};
}

export function biteStrike(age){
 if(!Number.isFinite(age)||age<=0||age>=.65)return 0;
 return (1-Math.exp(-age*42))*Math.exp(-age*9);
}

export function landingHoldBlend(age){
 if(!Number.isFinite(age))return 0;
 const u=clamp(age/.28,0,1);
 return u*u*(3-2*u);
}

function freeSpring(age,displacement,velocity,frequency,damping){
 const decay=frequency*damping,oscillation=frequency*Math.sqrt(1-damping*damping);
 return Math.exp(-decay*age)*(displacement*Math.cos(oscillation*age)+(velocity+decay*displacement)/oscillation*Math.sin(oscillation*age));
}

export function lostFightRecoil(age,initialBend,initialAngle,restAngle,reason='escaped',initialBendVelocity=0,initialAngleVelocity=0){
 const rest=clamp(Number.isFinite(restAngle)?restAngle:.8,.3,2.2);
 if(!Number.isFinite(age)||age<0)return {active:false,bend:0,angle:rest,kick:0,slack:0};
 if(age>=.62)return {active:false,bend:0,angle:rest,kick:0,slack:0};
 const loaded=clamp(Number.isFinite(initialBend)?initialBend:0,-6,6);
 const start=clamp(Number.isFinite(initialAngle)?initialAngle:rest,-.5,3.2);
 const bendVelocity=clamp(Number.isFinite(initialBendVelocity)?initialBendVelocity:0,-24,24);
 const angleVelocity=clamp(Number.isFinite(initialAngleVelocity)?initialAngleVelocity:0,-10,10);
 const damping=reason==='line-break'?.32:reason==='escaped'?.47:.55;
 const energyLength=Math.hypot(loaded,bendVelocity/31);
 const phase=age/(reason==='line-break'?.07:.085),kickShape=phase*phase*Math.exp(2-2*phase);
 const kick=Math.sign(loaded||bendVelocity)*Math.min(1.8,energyLength/1.6)*(reason==='line-break'?1:reason==='escaped'?.76:.66)*kickShape;
 const rebound=freeSpring(age,loaded,bendVelocity,31,damping)-kick*(reason==='line-break'?.85:.46);
 return {
  active:true,
  bend:loaded>=0?Math.max(-2.3,rebound):rebound,
  angle:rest+freeSpring(age,start-rest,angleVelocity,16,.65)+kick*.45,
  kick,
  slack:clamp(1-age/.4,0,1)
 };
}

export function fightLossCue(fight,castStart,at){
 if(fight?.status!=='lost'||!Number.isFinite(castStart)||!Number.isFinite(at))return null;
 const reason=['line-break','escaped','exhausted'].includes(fight.lossReason)?fight.lossReason:'escaped';
 return {at,castStart,reason};
}

export function lostLineEnd(age,rodTip,oldTip,oldFloat,reelProgress,reason){
 if(reason!=='line-break'||!rodTip||!oldTip||!oldFloat)return null;
 if(![rodTip.x,rodTip.y,rodTip.z,oldTip.x,oldTip.y,oldTip.z,oldFloat.x,oldFloat.y,oldFloat.z].every(Number.isFinite))return null;
 const progress=clamp(Number.isFinite(reelProgress)?reelProgress:0,0,1),time=clamp(Number.isFinite(age)?age:0,0,2.2);
 const fraction=.38*(1-progress)+.04,fall=Math.min(1.25,4.9*time*time)*(1-progress);
 return {x:rodTip.x+(oldFloat.x-oldTip.x)*fraction,y:Math.max(.06,rodTip.y+(oldFloat.y-oldTip.y)*fraction-fall),z:rodTip.z+(oldFloat.z-oldTip.z)*fraction};
}

export function brokenLineReveal(age){
 if(!Number.isFinite(age)||age<=.1)return 0;
 const u=clamp((age-.1)/.13,0,1);
 return u*u*(3-2*u);
}
