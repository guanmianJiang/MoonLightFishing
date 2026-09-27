const clamp01=value=>Math.max(0,Math.min(1,value));
const mix=(a,b,t)=>a+(b-a)*t;
const smootherstep=t=>{t=clamp01(t);return t*t*t*(t*(t*6-15)+10)};

function orbit(center,angle,radius,height){
 return [center[0]+Math.sin(angle)*radius,center[1]+height,center[2]+Math.cos(angle)*radius];
}

export function introCameraPose(progress,normalPosition,normalAim,aspect=1.6,normalFov=36){
 const u=clamp01(progress),center=[-1.2,.62,.35],characterAim=[-1.2,1.18,.35],portrait=aspect<.8;
 const orbitRadius=portrait?18:15,farRadius=portrait?59:55,startAngle=-.92,orbitStartAngle=-.42,orbitEndAngle=orbitStartAngle+Math.PI*2/3;
 let position,aim,fov;
 if(u<.24){
  const t=smootherstep(u/.24),angle=mix(startAngle,orbitStartAngle,t);
  position=orbit(center,angle,mix(farRadius,orbitRadius,t),mix(13,5.4,t));
  aim=characterAim.map((value,i)=>mix(value,[normalAim[0],normalAim[1]+.32,normalAim[2]][i],t*.12));
  fov=mix(31,34,t);
 }else if(u<.59){
  const t=smootherstep((u-.24)/.35);
  position=orbit(center,mix(orbitStartAngle,orbitEndAngle,t),orbitRadius,5.4);
  aim=characterAim.map((value,i)=>mix(value,[normalAim[0],normalAim[1]+.32,normalAim[2]][i],.12));
  fov=34;
 }else{
  const t=smootherstep((u-.59)/.41),from=orbit(center,orbitEndAngle,orbitRadius,5.4);
  position=from.map((value,i)=>mix(value,normalPosition[i],t));
  const orbitAim=characterAim.map((value,i)=>mix(value,[normalAim[0],normalAim[1]+.32,normalAim[2]][i],.12));
  aim=orbitAim.map((value,i)=>mix(value,normalAim[i],t));
  fov=mix(34,normalFov,t);
 }
 return {position,aim,fov,done:u>=1};
}
