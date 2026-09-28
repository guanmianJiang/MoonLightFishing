import * as T from './three.module.js';
export function phaseOf(p,now=Date.now()){
 if(!p||p.phase==='result')return 'idle';
 if(now-p.start<1850)return 'casting';
 if(p.directHooked)return p.catch?'hooked':'empty';
 if(p.biteMode==='natural'){
  if(now>=p.readyAt)return p.catch?'hooked':'empty';
  if(p.catch&&!['bottle','bell'].includes(p.catch.id)){
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
 if(p.catch&&!['bottle','bell'].includes(p.catch.id)){
  if(p.readyAt-now<2200)return 'nibble';
  if(p.readyAt-now<5500)return 'approach';
 }
 return 'waiting';
}
export class FishingLine{
 constructor(count=38){this.nodes=Array.from({length:count},()=>new T.Vector3());this.old=this.nodes.map(v=>v.clone());this.ready=false;this.accumulator=0;this.rest=0;this.tension=0;this.tautness=0;this.reelGuide=0;this.wave=0;this.waveAge=0;this.lastImpulse=0;}
 reset(a,b){this.nodes.forEach((v,i)=>{const u=i/(this.nodes.length-1);v.copy(a).lerp(b,u);v.y-=Math.sin(u*Math.PI)*.24;this.old[i].copy(v)});this.rest=a.distanceTo(b)*1.04;this.tautness=0;this.reelGuide=0;this.wave=0;this.waveAge=0;this.lastImpulse=0;this.ready=true;}
 update(a,b,dt,options={}){if(typeof options==='boolean')options={tight:options};dt=Number.isFinite(dt)?T.MathUtils.clamp(dt,0,.05):0;if(!this.ready)this.reset(a,b);this.accumulator+=dt;const direct=a.distanceTo(b),slack=options.tight?1.002:(options.slack??1.035),target=Math.max(direct*1.001,options.length??direct*slack+(options.extra??0));this.rest=Number.isFinite(options.length)?target:T.MathUtils.damp(this.rest,target,options.reel?12:3.5,dt);const n=this.nodes.length,segment=this.rest/(n-1),delta=new T.Vector3();let steps=0;
  while(this.accumulator>=1/90&&steps++<5){this.accumulator-=1/90;
   for(let i=1;i<n-1;i++){const p=this.nodes[i],old=this.old[i],x=p.x,y=p.y,z=p.z;p.addScaledVector(delta.copy(p).sub(old),.982);p.y-=9.81/8100;if(p.y<.025){p.y=.025;p.x=T.MathUtils.lerp(x,p.x,.22);p.z=T.MathUtils.lerp(z,p.z,.22)}old.set(x,y,z);}
   for(let j=0;j<48;j++){this.nodes[0].copy(a);this.nodes[n-1].copy(b);for(let i=0;i<n-1;i++){const x=this.nodes[i],y=this.nodes[i+1];delta.copy(y).sub(x);const length=delta.length();if(length<1e-7)continue;delta.multiplyScalar((length-segment)/length*.5);if(i>0)x.add(delta);if(i<n-2)y.sub(delta);}}
  }
  const tautTarget=Number.isFinite(options.length)&&Number.isFinite(options.load)?T.MathUtils.clamp((options.load-.1)/.35,0,1)*T.MathUtils.clamp((direct+.16-this.rest)/.16,0,1):0;
  this.tautness=T.MathUtils.damp(this.tautness,tautTarget,21,Math.min(dt,.05));
  if(this.tautness>.001){const amount=this.tautness*.64;for(let i=1;i<n-1;i++){this.nodes[i].lerp(delta.copy(a).lerp(b,i/(n-1)),amount);this.old[i].lerp(this.nodes[i],amount)}}
  this.reelGuide=T.MathUtils.damp(this.reelGuide,options.reel&&!Number.isFinite(options.length)?1:0,20,Math.min(dt,.05));
  if(this.reelGuide>.001){const amount=this.reelGuide*.9,sag=Math.min(.16,Math.max(.035,(this.rest-direct)*.25));for(let i=1;i<n-1;i++){const u=i/(n-1);delta.copy(a).lerp(b,u);delta.y-=Math.sin(u*Math.PI)*sag;this.nodes[i].lerp(delta,amount);this.old[i].lerp(this.nodes[i],amount)}}
  const impulse=T.MathUtils.clamp(Number.isFinite(options.impulse)?options.impulse:0,0,1);
  this.wave=Math.max(this.wave*Math.exp(-Math.min(Math.max(dt,0),.05)*10),Math.max(0,impulse-this.lastImpulse)*.055);
  this.waveAge+=Math.min(Math.max(dt,0),.05);this.lastImpulse=impulse;
  if(this.wave>.0001&&this.tautness>.1){const dx=b.x-a.x,dz=b.z-a.z,horizontal=Math.hypot(dx,dz)||1;for(let i=1;i<n-1;i++){const u=i/(n-1),pulse=Math.sin(Math.PI*u)*Math.sin(this.waveAge*27-u*13)*this.wave*this.tautness;this.nodes[i].x+=-dz/horizontal*pulse;this.nodes[i].z+=dx/horizontal*pulse;this.old[i].lerp(this.nodes[i],.45)}}
  this.tension=Number.isFinite(options.load)?options.load:T.MathUtils.damp(this.tension,T.MathUtils.clamp((direct/Math.max(this.rest,.01)-.96)*18,0,1.5),8,dt);
  this.nodes[0].copy(a);this.nodes[n-1].copy(b);return this.nodes;
 }
}
export function dynamicTube(count,sides=6){const g=new T.BufferGeometry(),p=new Float32Array(count*sides*3),ind=[];for(let i=0;i<count-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;ind.push(a,b,a+sides,b,b+sides,a+sides)}g.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));g.setIndex(ind);return g;}
export function updateTube(g,points,radius,taper=1){const side=6,p=g.attributes.position,n=new T.Vector3(),b=new T.Vector3(),t=new T.Vector3(),up=new T.Vector3(0,1,0);for(let i=0;i<points.length;i++){t.copy(points[Math.min(points.length-1,i+1)]).sub(points[Math.max(0,i-1)]).normalize();n.crossVectors(t,Math.abs(t.y)>.95?new T.Vector3(1,0,0):up).normalize();b.crossVectors(t,n);const r=radius*(1-(1-taper)*i/(points.length-1));for(let j=0;j<side;j++){const a=j/side*Math.PI*2;p.setXYZ(i*side+j,points[i].x+(n.x*Math.cos(a)+b.x*Math.sin(a))*r,points[i].y+(n.y*Math.cos(a)+b.y*Math.sin(a))*r,points[i].z+(n.z*Math.cos(a)+b.z*Math.sin(a))*r)}}p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();}
