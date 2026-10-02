const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const u=clamp(value,0,1);return u*u*(3-2*u)};
const curve=(a,b,c,d,u)=>{const v=1-u;return {x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,z:v*v*v*a.z+3*v*v*u*b.z+3*v*u*u*c.z+u*u*u*d.z}};

// One continuous swim path; phase changes only affect the fish's response to the hook.
export function fishApproachOffset(biteAge,time,signal){
 const age=Number.isFinite(biteAge)?biteAge:-5.5,t=Number.isFinite(time)?time:0;
 const radius=signal==='broad'?.72:signal==='dart'?.58:.50,speed=signal==='dart'?1.15:.92;
 const startAngle=.75+.18*Math.sin(t*.5),endAngle=startAngle+3.2*speed;
 const start={x:radius*Math.cos(startAngle),z:radius*Math.sin(startAngle)};
 const end={x:radius*Math.cos(endAngle),z:radius*Math.sin(endAngle)};
 if(age<=-4.3){
  const tangent={x:-Math.sin(startAngle)*radius*speed,z:Math.cos(startAngle)*radius*speed};
  return curve({x:2.6,z:1.45},{x:start.x-tangent.x*.8,z:start.z-tangent.z*.8},{x:start.x-tangent.x*.4,z:start.z-tangent.z*.4},start,clamp((age+5.5)/1.2,0,1));
 }
 if(age<-1.1){
  const u=(age+4.3)/3.2,angle=startAngle+(age+4.3)*speed;
  // Two gentle investigations: close in, then drift out, without a stop/flip.
  const probe=.10*Math.sin(u*Math.PI*2)**2,r=radius-probe;
  return {x:r*Math.cos(angle),z:r*Math.sin(angle)};
 }
 const tangent={x:-Math.sin(endAngle)*radius*speed,z:Math.cos(endAngle)*radius*speed};
 return curve(end,{x:end.x+tangent.x*1.1/3,z:end.z+tangent.z*1.1/3},{x:end.x*.16,z:end.z*.16},{x:0,z:0},clamp((age+1.1)/1.1,0,1));
}

export function fishApproachSwim(biteAge,time,signal){
 const age=Number.isFinite(biteAge)?biteAge:-5.5,t=Number.isFinite(time)?time:0;
 const before=fishApproachOffset(age-.005,t-.005,signal),after=fishApproachOffset(age+.005,t+.005,signal);
 const vx=(after.x-before.x)/.01,vz=(after.z-before.z)/.01,speed=Math.hypot(vx,vz);
 const heading=speed>1e-5?{x:vx/speed,z:vz/speed}:{x:-2.6/Math.hypot(2.6,1.45),z:-1.45/Math.hypot(2.6,1.45)};
 return {heading,speed,tailAmplitude:.13+.07*clamp(speed/1.5,0,1)};
}

export function fishMouthApproach(hook,biteAge,time,signal,phase,_readingAge=0,restHookY=hook?.y,lureFollow=0){
 const age=Number.isFinite(biteAge)?biteAge:-5.5,swim=fishApproachOffset(age,time,signal);
 const follow=clamp(Number.isFinite(lureFollow)?lureFollow:0,0,.32)*smooth(Math.hypot(swim.x,swim.z)/.55);
 const near=smooth((age+5.5)/1.2),commit=smooth((age+2.2)/2.2);
 const horizontal=Math.hypot((2.6-2.1*near)*(1-commit),(1.45-1.1*near)*(1-commit));
 const rise=smooth(1-horizontal/3.05);
 const hx=Number.isFinite(hook?.x)?hook.x:0,hookY=Number.isFinite(hook?.y)?hook.y:-.25,hz=Number.isFinite(hook?.z)?hook.z:0;
 const restingY=Number.isFinite(restHookY)?restHookY:hookY,goalY=phase==='hooked'?hookY:restingY;
 return {x:hx+swim.x*(1-follow),y:-.72+(goalY+.72)*rise,z:hz+swim.z*(1-follow)};
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
