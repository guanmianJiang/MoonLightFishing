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

export function lostFightRecoil(age,initialBend,initialAngle,restAngle,reason='escaped'){
 const rest=clamp(Number.isFinite(restAngle)?restAngle:.8,.3,2.2);
 if(!Number.isFinite(age)||age<0)return {active:false,bend:0,angle:rest,kick:0,slack:0};
 const loaded=clamp(Number.isFinite(initialBend)?initialBend:0,0,6);
 const start=clamp(Number.isFinite(initialAngle)?initialAngle:rest,-.5,3.2);
 const strength=reason==='line-break'?1:reason==='escaped'?.8:.7;
 const settleU=clamp(age/.52,0,1),settle=settleU*settleU*(3-2*settleU);
 const kick=age<.32?Math.sin(Math.PI*age/.32)*Math.exp(-age*3.5)*strength:0;
 const oscillation=Math.exp(-age*14)*Math.cos(age*23);
 const counterbend=Math.exp(-age*10)*Math.sin(age*23)*strength*Math.max(loaded,.35)*.36;
 return {active:age<.62,bend:age<.62?loaded*oscillation-counterbend:0,angle:start+(rest-start)*settle+kick*.25,kick,slack:clamp(1-age/.4,0,1)};
}

export function fightLossCue(fight,castStart,at){
 if(fight?.status!=='lost'||!Number.isFinite(castStart)||!Number.isFinite(at))return null;
 const reason=['line-break','escaped','exhausted'].includes(fight.lossReason)?fight.lossReason:'escaped';
 return {at,castStart,reason};
}
