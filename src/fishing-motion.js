import * as T from './three.module.js';
import {isObjectCatch} from './catch-kind.mjs';
export function phaseOf(p,now=Date.now()){
 if(!p||p.phase==='result')return 'idle';
 if(now-p.start<1850)return 'casting';
 if(p.directHooked)return p.catch?'hooked':'empty';
 if(p.biteMode==='natural'){
  if(now>=p.readyAt)return p.catch?'hooked':'empty';
  if(p.catch&&!isObjectCatch(p.catch)){
   if(p.readyAt-now<2200)return 'nibble';
   if(now>=p.decisionAt)return 'reading';
   if(p.readyAt-now<5500)return 'approach';
  }
  return 'waiting';
 }
 if(now>=p.readyAt&&!p.catch)return 'empty';
 if(p.decisionAt&&now>=p.decisionAt&&!p.tactic)return 'reading';
 if(p.reactedAt&&now<p.readyAt)return p.tacticSuccess?'responding':'spooked';
 if(now>=p.readyAt)return p.catch?'hooked':'empty';
 if(p.catch&&!isObjectCatch(p.catch)){
  if(p.readyAt-now<2200)return 'nibble';
  if(p.readyAt-now<5500)return 'approach';
 }
 return 'waiting';
}
export class FishingLine{
 constructor(count=38){this.nodes=Array.from({length:count},()=>new T.Vector3());this.old=this.nodes.map(v=>v.clone());this.waveOffsets=this.nodes.map(()=>new T.Vector3());this.pulses=[];this.ready=false;this.accumulator=0;this.rest=0;this.tension=0;this.tautness=0;this.reelGuide=0;this.wave=0;this.waveAge=0;this.lastImpulse=0;}
 reset(a,b){this.nodes.forEach((v,i)=>{const u=i/(this.nodes.length-1);v.copy(a).lerp(b,u);v.y-=Math.sin(u*Math.PI)*Math.min(.24,a.distanceTo(b)*.06);this.old[i].copy(v);this.waveOffsets[i].set(0,0,0)});this.accumulator=0;this.pulses.length=0;this.rest=a.distanceTo(b)*1.04;this.tautness=0;this.reelGuide=0;this.wave=0;this.waveAge=0;this.lastImpulse=0;this.ready=true;}
 update(a,b,dt,options={}){if(typeof options==='boolean')options={tight:options};dt=Number.isFinite(dt)?T.MathUtils.clamp(dt,0,.05):0;if(!this.ready)this.reset(a,b);for(let i=1;i<this.nodes.length-1;i++){this.nodes[i].sub(this.waveOffsets[i]);this.old[i].sub(this.waveOffsets[i]);this.waveOffsets[i].set(0,0,0)}this.accumulator+=dt;const direct=a.distanceTo(b),slack=options.tight?1.002:(Number.isFinite(options.slack)?T.MathUtils.clamp(options.slack,1,1.5):1.035),extra=Number.isFinite(options.extra)?T.MathUtils.clamp(options.extra,0,3):0,target=Math.max(direct*1.001,Number.isFinite(options.length)?options.length:direct*slack+extra);this.rest=Number.isFinite(options.length)?target:T.MathUtils.damp(this.rest,target,options.reel?12:3.5,dt);const n=this.nodes.length,segment=this.rest/(n-1),delta=new T.Vector3();let steps=0;
  while(this.accumulator>=1/90&&steps++<5){this.accumulator-=1/90;
   for(let i=1;i<n-1;i++){const p=this.nodes[i],old=this.old[i],x=p.x,y=p.y,z=p.z;p.addScaledVector(delta.copy(p).sub(old),.982);p.y-=9.81/8100;if(p.y<.025){p.y=.025;p.x=T.MathUtils.lerp(x,p.x,.22);p.z=T.MathUtils.lerp(z,p.z,.22)}old.set(x,y,z);}
   for(let j=0;j<48;j++){this.nodes[0].copy(a);this.nodes[n-1].copy(b);for(let i=0;i<n-1;i++){const x=this.nodes[i],y=this.nodes[i+1];delta.copy(y).sub(x);const length=delta.length();if(length<1e-7)continue;delta.multiplyScalar((length-segment)/length*.5);if(i>0)x.add(delta);if(i<n-2)y.sub(delta);}}
  }
  const tautTarget=Number.isFinite(options.length)&&Number.isFinite(options.load)?T.MathUtils.clamp((options.load-.1)/.35,0,1)*T.MathUtils.clamp((direct+.16-this.rest)/.16,0,1):0;
  this.tautness=T.MathUtils.damp(this.tautness,tautTarget,21,Math.min(dt,.05));
  if(this.tautness>.001){const amount=1-Math.exp(-this.tautness*85*dt);for(let i=1;i<n-1;i++){this.nodes[i].lerp(delta.copy(a).lerp(b,i/(n-1)),amount);this.old[i].lerp(this.nodes[i],amount)}}
  this.reelGuide=T.MathUtils.damp(this.reelGuide,options.reel&&!Number.isFinite(options.length)?1:0,20,Math.min(dt,.05));
  if(this.reelGuide>.001){const amount=1-Math.exp(-this.reelGuide*135*dt),sag=Math.min(.16,Math.max(.035,(this.rest-direct)*.25));for(let i=1;i<n-1;i++){const u=i/(n-1);delta.copy(a).lerp(b,u);delta.y-=Math.sin(u*Math.PI)*sag;this.nodes[i].lerp(delta,amount);this.old[i].lerp(this.nodes[i],amount)}}
  const impulse=T.MathUtils.clamp(Number.isFinite(options.impulse)?options.impulse:0,0,1);
  for(const pulse of this.pulses)pulse.age+=dt;
  const rising=impulse-this.lastImpulse>.16||(impulse>.35&&this.lastImpulse<=.35);
  if(dt>0&&rising&&this.tautness>.1){this.pulses.push({age:0,amplitude:impulse*.07,duration:T.MathUtils.clamp(direct/28,.08,.40),origin:options.impulseOrigin==='rod'?'rod':'fish'});if(this.pulses.length>4)this.pulses.shift();this.waveAge=0;}
  this.pulses=this.pulses.filter(pulse=>pulse.age<pulse.duration+.12);this.waveAge+=dt;if(dt>0)this.lastImpulse=impulse;
  this.wave=this.pulses.reduce((max,pulse)=>Math.max(max,pulse.amplitude*Math.exp(-pulse.age*9)),0);
  if(this.pulses.length&&this.tautness>.1){const dx=b.x-a.x,dz=b.z-a.z,horizontal=Math.hypot(dx,dz)||1;for(let i=1;i<n-1;i++){const u=i/(n-1);let offset=0;for(const pulse of this.pulses){const center=pulse.origin==='rod'?pulse.age/pulse.duration:1-pulse.age/pulse.duration,q=(u-center)/.22;if(Math.abs(q)<1)offset+=Math.sin(Math.PI*q)*Math.pow(1-q*q,2)*pulse.amplitude*Math.exp(-pulse.age*9)*Math.sin(Math.PI*u)*this.tautness;}this.waveOffsets[i].set(-dz/horizontal*offset,0,dx/horizontal*offset);this.nodes[i].add(this.waveOffsets[i]);this.old[i].add(this.waveOffsets[i]);}}
  this.tension=Number.isFinite(options.load)?options.load:T.MathUtils.damp(this.tension,T.MathUtils.clamp((direct/Math.max(this.rest,.01)-.96)*18,0,1.5),8,dt);
  this.nodes[0].copy(a);this.nodes[n-1].copy(b);return this.nodes;
 }
}
export function dynamicTube(count,sides=6){const g=new T.BufferGeometry(),p=new Float32Array(count*sides*3),ind=[];for(let i=0;i<count-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;ind.push(a,b,a+sides,b,b+sides,a+sides)}g.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));g.setIndex(ind);return g;}
export function updateTube(g,points,radius,taper=1){const side=6,p=g.attributes.position,n=new T.Vector3(),b=new T.Vector3(),t=new T.Vector3(),up=new T.Vector3(0,1,0);for(let i=0;i<points.length;i++){t.copy(points[Math.min(points.length-1,i+1)]).sub(points[Math.max(0,i-1)]).normalize();n.crossVectors(t,Math.abs(t.y)>.95?new T.Vector3(1,0,0):up).normalize();b.crossVectors(t,n);const r=radius*(1-(1-taper)*i/(points.length-1));for(let j=0;j<side;j++){const a=j/side*Math.PI*2;p.setXYZ(i*side+j,points[i].x+(n.x*Math.cos(a)+b.x*Math.sin(a))*r,points[i].y+(n.y*Math.cos(a)+b.y*Math.sin(a))*r,points[i].z+(n.z*Math.cos(a)+b.z*Math.sin(a))*r)}}p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();}
