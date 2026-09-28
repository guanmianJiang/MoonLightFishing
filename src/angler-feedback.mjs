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
