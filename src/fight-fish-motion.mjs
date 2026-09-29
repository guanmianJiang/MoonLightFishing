const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// The bite pose bridges the approaching fish and the loaded fight motion.
export function hookedFishPose(outward,age,time,seed=0){
 const span=Math.hypot(outward?.x||0,outward?.z||0)||1;
 const ox=(outward?.x||0)/span,oz=(outward?.z||0)/span;
 const flankSign=Math.sin(seed*2.17)>=0?1:-1;
 const flank=flankSign*(.94+.08*Math.sin(time*3+seed));
 const settle=clamp(Number.isFinite(age)?age/.25:0,0,1);
 const impact=Number.isFinite(age)&&age>=0?Math.exp(-age*5)*Math.sin(age*17):0;
 return {
  heading:{x:-ox-oz*flank,z:-oz+ox*flank},
  pitch:-.08-.38*settle-.07*impact,
  roll:flankSign*.08+Math.sin(time*7+seed)*.04
 };
}

export function biteFishPose(outward,age,time,seed=0,hooked=false){
 const biteAge=Number.isFinite(age)?age:-5.5,clock=Number.isFinite(time)?time:0,phase=Number.isFinite(seed)?seed:0;
 const target=hookedFishPose(outward,Math.max(0,biteAge),clock,phase);
 const blend=clamp((biteAge+1.1)/1.1,0,1);
 const smooth=blend*blend*(3-2*blend);
 const start=Math.atan2(-1.45,-2.6),end=Math.atan2(target.heading.z,target.heading.x);
 const delta=Math.atan2(Math.sin(end-start),Math.cos(end-start));
 const yaw=start+delta*smooth;
 const load=hooked?clamp(biteAge/.26,0,1):0,ramp=load*load*(3-2*load);
 const calmTail=Math.sin(clock*5.2+phase)*(.09+.03*clamp((biteAge+2.2)/2.2,0,1));
 const fightTail=Math.sin(clock*19+phase)*.55;
 return {
  heading:{x:Math.cos(yaw),z:Math.sin(yaw)},
  pitch:biteAge<0?-.08*clamp((biteAge+.5)/.5,0,1):target.pitch,
  roll:target.roll*smooth*(.3+.7*ramp),
  tail:calmTail+(fightTail-calmTail)*ramp
 };
}

export function turnFishYaw(current,heading,dt){
 if(!Number.isFinite(current)||!Number.isFinite(dt)||Math.hypot(heading?.x||0,heading?.z||0)<1e-6)return current;
 const target=Math.atan2(heading.z,-heading.x);
 const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
 const step=clamp(dt,0,.12)*4.8;
 return current+clamp(delta,-step,step);
}

export function fightEntryPosition(from,to,age){
 const u=clamp(Number.isFinite(age)?age/.4:1,0,1),ease=u*u*(3-2*u);
 return {x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease,z:from.z+(to.z-from.z)*ease};
}

// The hooked fish moves along the cast line. Its lateral dodge is perpendicular
// to that line, so every fishing spot pulls toward the angler correctly.
export function fightFishMotion(f,angler,spot,time,thrash=0){
 const dx=spot.x-angler.x,dz=spot.z-angler.z,span=Math.hypot(dx,dz)||1;
 const outward={x:dx/span,z:dz/span},side={x:-dz/span,z:dx/span};
 const distance=clamp((f?.distance||0)/Math.max(.1,f?.startDistance||1),.15,1.35);
 const progress=clamp(f?.progress||0,0,1),surge=clamp(f?.surge||0,0,1);
 const lift=clamp(f?.pumpPulse||0,0,1),load=clamp(f?.load||0,0,1.5);
 const taut=clamp(1-(f?.slack||0)/.52,0,1);
 const pull=clamp((clamp(f?.tension??load,0,1.5)*.48+load*.52)*taut,0,1.25);
 const dodge=((f?.fishPosition??.5)-.5)*1.4;
 const depth=.58-progress*.34+surge*.14-lift*.48*(.35+progress*.65)-pull*.10;
 const sway=clamp(Number.isFinite(thrash)?thrash:0,-1,1);
 const position={x:angler.x+dx*distance+side.x*(dodge+sway*.20),y:-depth+Math.abs(sway)*.045,z:angler.z+dz*distance+side.z*(dodge+sway*.20)};
 const dodgeVelocity=clamp((f?.fishVelocity||0)*.20,-.55,.55);
 // The actual change of fish distance and lateral position determines heading.
 // Only a nearly straight run receives a small camera-readable flank bias.
 const radialSpeed=(f?.radialVelocity||0)*span/Math.max(.1,f?.startDistance||span);
 const lateralSpeed=(f?.fishVelocity||0)*1.4;
 const flankSign=Math.sin((f?.seed??1)*2.17)>=0?1:-1;
 const bias=flankSign*.65*Math.abs(radialSpeed)*clamp(1-Math.abs(lateralSpeed)/.14,0,1);
 const heading=Math.hypot(radialSpeed,lateralSpeed)>.18?
  {x:outward.x*radialSpeed+side.x*(lateralSpeed+bias),z:outward.z*radialSpeed+side.z*(lateralSpeed+bias)}:
  hookedFishPose(outward,0,time,f?.seed??1).heading;
 const struggle=clamp(surge*.7+load*.40+Math.abs(f?.fishVelocity||0)*.1+(f?.fishState==='hookset'?.25*Math.exp(-Math.max(0,f.stateAge||0)) :0),0,1);
 const surface=clamp((position.y+.32)/.42,0,1);
 const tail=Math.sin(time*(13+surge*11)+(f?.seed||0))*(.24+struggle*.64+pull*.12)+sway*.20;
 const roll=dodgeVelocity*.22+Math.sin(time*(8+surge*7)+(f?.seed||0))*(.04+struggle*(.11+surface*.11))+sway*.25;
 // Local -X is the head. Negative Z rotation raises the hooked mouth.
 const hooksetRise=f?.fishState==='hookset'?.38*Math.exp(-Math.max(0,f.stateAge||0)*1.4):0;
 const headRise=clamp(.06+hooksetRise+pull*.48+lift*.36*taut+Math.max(0,-(f?.radialVelocity||0))*.12*taut,0,.87);
 const pitch=-headRise+surge*(1-taut*.4)*.10+Math.sin(time*12+(f?.seed||0))*surface*struggle*.035-Math.abs(sway)*.055;
 return {position,heading,depth,struggle,tail,roll,pitch,pull,taut};
}
