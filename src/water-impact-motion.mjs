const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;

// A small pooled droplet follows one exact flight, then returns to the water.
export function splashDroplet(strength=.6,random=[]){
 const power=clamp(finite(strength,.6),0,1.4),r=i=>clamp(finite(random[i],.5),0,1);
 const angle=r(0)*Math.PI*2,speed=(.45+r(1)*.55)*power,vy=1.05+r(2)*1.15*Math.sqrt(power),gravity=11.8,height=.035;
 return {velocity:[Math.cos(angle)*speed,vy,Math.sin(angle)*speed],gravity,height,radius:.010+r(3)*.012,lifetime:(vy+Math.sqrt(vy*vy+2*gravity*height))/gravity};
}

export function sampleSplashDroplet(plan,age){
 const t=Math.max(0,finite(age,0)),[vx,vy,vz]=plan.velocity,vertical=vy-plan.gravity*t;
 return {position:[vx*t,plan.height+vy*t-plan.gravity*t*t/2,vz*t],velocity:[vx,vertical,vz],stretch:1+clamp(Math.hypot(vx,vertical,vz)*.32,0,.85),visible:t<plan.lifetime};
}
