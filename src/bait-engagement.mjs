const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const u=clamp(value,0,1);return u*u*(3-2*u)};

// One continuous swim path; phase changes only affect the fish's response to the hook.
export function fishApproachOffset(biteAge,time,signal){
 const age=Number.isFinite(biteAge)?biteAge:-5.5,t=Number.isFinite(time)?time:0;
 const near=smooth((age+5.5)/1.2),commit=smooth((age+2.2)/2.2);
 const orbit=smooth((age+4.3)/.6)*(1-smooth((age+2.7)/.5));
 const radius=signal==='broad'?1.05:signal==='dart'?.58:.28;
 return {x:(2.6-2.1*near)*(1-commit)+Math.cos(t*(signal==='dart'?2.4:.7))*radius*orbit,
  z:(1.45-1.1*near)*(1-commit)+Math.sin(t*(signal==='dart'?2.4:.7))*radius*orbit};
}

export function fishMouthApproach(hook,biteAge,time,signal,phase,_readingAge=0,restHookY=hook?.y){
 const age=Number.isFinite(biteAge)?biteAge:-5.5,swim=fishApproachOffset(age,time,signal);
 const near=smooth((age+5.5)/1.2),commit=smooth((age+2.2)/2.2);
 const horizontal=Math.hypot((2.6-2.1*near)*(1-commit),(1.45-1.1*near)*(1-commit));
 const rise=smooth(1-horizontal/3.05);
 const hx=Number.isFinite(hook?.x)?hook.x:0,hookY=Number.isFinite(hook?.y)?hook.y:-.25,hz=Number.isFinite(hook?.z)?hook.z:0;
 const restingY=Number.isFinite(restHookY)?restHookY:hookY,goalY=phase==='hooked'?hookY:restingY;
 return {x:hx+swim.x,y:-.72+(goalY+.72)*rise,z:hz+swim.z};
}

// Probe the bait while it is being read, then commit the mouth to the hook.
export function baitEngagement(phase,readingAge=0,biteAge=-Infinity){
 if(phase==='reading'){
  const probe=.36+.38*Math.pow(Math.max(0,Math.sin(readingAge*5.2)),2);
  return probe+(.88-probe)*smooth((biteAge+2.7)/.5);
 }
 if(phase==='responding')return .72+.28*smooth((biteAge+1.1)/1.1);
 if(phase==='nibble')return .88+.12*clamp((biteAge+.5)/.5,0,1);
 if(phase==='hooked')return 1;
 return 0;
}
