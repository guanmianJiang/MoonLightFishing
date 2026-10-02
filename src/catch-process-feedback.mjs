const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const smooth=v=>{const u=clamp(v,0,1);return u*u*(3-2*u)};
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
const point=(v,fallback)=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)?[...v]:[...fallback];
export function releaseImpactStrength(weight){return clamp(.30+clamp(Math.sqrt(clamp(finite(weight,.1),.01,50)),.12,2)*.32,.34,.98)}
export function releaseContactReady(plan,age,handled=false,hidden=false){return !handled&&!hidden&&Number.isFinite(age)&&age>=plan.flightTime&&age-plan.flightTime<.18}

export function catchProcessFeedback(action,caught,fish,result,at=0){
 if(!caught||!['release','study','keep','basket'].includes(action)||result?.error)return null;
 const object=!!fish?.object,name=fish?.name||'钓获';
 const copy={release:[object?'放回挂物':'让它回到水中',object?'挂物正在落回水中':'松手后落水，随后游离'],study:['记下这次相遇',`正在记录${name}的样本信息`],keep:['留下这一份样本',`正在收好${name}，可在水域册查看`],basket:['放入鱼篓',`正在把${name}收进鱼篓`]}[action];
 const noticeTitle={release:object?'已放回原处':'已放回水里',study:'记录已保存',keep:'样本已收藏',basket:'已放入鱼篓'}[action];
 return {action,object,weight:clamp(finite(caught.weight,.1),.01,50),at:finite(at,0),duration:action==='release'?1.85:1.25,title:copy[0],hint:copy[1],noticeTitle,resultText:result?.text||'',id:caught.id,variation:caught.variation};
}

export function releaseTrajectory(start,end,weight=.1,object=false){
 const to=point(end,[0,.12,2]),from=point(start,[0,1.2,0]);from[1]=Math.max(to[1]+.12,from[1]);
 const gravity=11.8,vy=object?.12:.38,flightTime=(vy+Math.sqrt(vy*vy+2*gravity*(from[1]-to[1])))/gravity;
 const vx=(to[0]-from[0])/flightTime,vz=(to[2]-from[2])/flightTime;
 return {start:from,end:to,velocity:[vx,vy,vz],gravity,flightTime,object:!!object,impactStrength:releaseImpactStrength(weight)};
}

export function sampleRelease(plan,age){
 const t=Math.max(0,finite(age,0)),{start,end,velocity:[vx,vy,vz],gravity,flightTime,object}=plan;
 if(t<flightTime)return {position:[start[0]+vx*t,start[1]+vy*t-gravity*t*t/2,start[2]+vz*t],velocity:[vx,vy-gravity*t,vz],phase:'air',immersion:0,visible:true,impactStrength:plan.impactStrength};
 const u=t-flightTime,speed=Math.hypot(vx,vz)||1,dx=vx/speed,dz=vz/speed,impactSpeed=gravity*flightTime-vy;
 // Drag consumes the entry momentum; a live fish then levels out and swims away.
 const drag=14,depth=impactSpeed/drag*(1-Math.exp(-drag*u)),swim=object?0:1.5*(u-.16*(1-Math.exp(-u/.16)));
 const carry=speed/9*(1-Math.exp(-u*9)),distance=carry+swim,sink=object?.18:.10;
 return {position:[end[0]+dx*distance,end[1]-depth-sink*(u-(1-Math.exp(-drag*u))/drag),end[2]+dz*distance],velocity:[dx*(speed*Math.exp(-u*9)+(object?0:1.5*(1-Math.exp(-u/.16)))),-impactSpeed*Math.exp(-drag*u)-sink*(1-Math.exp(-drag*u)),dz*(speed*Math.exp(-u*9)+(object?0:1.5*(1-Math.exp(-u/.16))))],phase:object?'sink':u<.18?'entry':'swim',immersion:clamp(depth/.3,0,1),visible:u<1.05,impactStrength:plan.impactStrength};
}

export function processCameraCue(event,age,reduced=false){
 if(!event||!Number.isFinite(event.duration)||event.duration<=0||!Number.isFinite(age)||age<0||age>event.duration)return {weight:0,push:0,side:0};
 const weight=1-smooth((age-event.duration+.4)/.4),beat=Math.sin(Math.PI*clamp(age/event.duration,0,1));
 return {weight,push:reduced?0:beat*(event.action==='study'?.18:event.action==='release'?.30:-.20),side:reduced?0:beat*(event.action==='keep'?.16:event.action==='basket'?-.18:0)};
}

export function processGesture(event,age,flightTime=.4,reduced=false){
 const rest={hold:0,reach:0,lower:0,offHand:0};
 if(!event||!Number.isFinite(event.duration)||event.duration<=0||!Number.isFinite(age)||age<0||age>=event.duration)return rest;
 const release=event.action==='release',flight=clamp(finite(flightTime,.4),.15,.8),end=release?Math.min(event.duration,flight+.4):event.duration;
 const hold=1-smooth((age-(release?.08:event.duration*.45))/Math.max(.1,end-(release?.08:event.duration*.45)));
 const reachEnd=flight+.18,reach=release&&!reduced?smooth(age/.10)*(1-smooth((age-.10)/(reachEnd-.10))):0;
 const collect=event.action==='keep'||event.action==='basket',lower=collect?smooth((age/event.duration-.3)/.6)*hold*.20:0;
 return {hold,reach,lower,offHand:hold};
}

export function catchProcessTip(event,landed=false){
 if(!event)return null;
 return {title:event.action==='release'&&landed?(event.object?'挂物已落水':'已回到水中'):event.title,
  hint:event.action==='release'&&landed?event.resultText:event.hint};
}
