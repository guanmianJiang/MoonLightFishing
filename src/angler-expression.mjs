import {isObjectCatch} from './catch-kind.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=(v,d=0)=>Number.isFinite(v)?v:d;
const smooth=v=>{const u=clamp(v,0,1);return u*u*(3-2*u)};
const neutral={mood:'relaxed',eyeOpen:1,browLift:0,browTilt:0,smile:.22,mouthOpen:0,mouthWidth:1,asymmetry:0};
const pose=(mood,changes={})=>({...neutral,mood,...changes});
const curious=()=>pose('curious',{eyeOpen:1.12,browLift:.006,browTilt:-.035,smile:.12,mouthOpen:.35,mouthWidth:.88,asymmetry:.008});
const happy=(bright=false)=>pose('pleased',{eyeOpen:bright?1.13:.84,browLift:bright?.012:.004,browTilt:-.045,smile:bright?1:.78,mouthOpen:bright?.30:.08,mouthWidth:bright?1.13:1.07});

export function anglerExpressionTarget(context={},now=0){
 const p=context.pending,event=context.outcomeEvent,process=context.catchProcessEvent,time=finite(now),caught=p?.catch,object=isObjectCatch(caught);
 if(process){
  if(process.object)return curious();
  if(process.action==='study')return pose('studying',{eyeOpen:.87,browTilt:.055,smile:.15});
  return pose(process.action==='release'?'gentle':'pleased',{eyeOpen:.88,browLift:.003,browTilt:-.035,smile:.72,mouthWidth:1.05});
 }
 const eventAge=(time-finite(event?.at,time))/1000,fresh=event&&Number.isFinite(event.at)&&eventAge>=0&&eventAge<2.2&&(!p||finite(p.start)<=event.at);
 if(fresh&&['line-break','escaped','missed'].includes(event.kind)&&!caught){
  const shock=event.kind==='line-break'?.28:event.kind==='escaped'?.18:0;
  if(eventAge<shock)return pose('startled',{eyeOpen:1.38,browLift:.017,browTilt:-.025,smile:0,mouthOpen:1,mouthWidth:.85});
  const recovery=smooth((eventAge-1.1)/1.1);
  return pose('regret',{eyeOpen:.78+recovery*.22,browLift:.003*(1-recovery),browTilt:-.20*(1-recovery),smile:-.40+(neutral.smile+.40)*recovery,mouthWidth:.90+.10*recovery});
 }
 if(caught&&p?.fight?.status==='active'&&!object){
  const f=p.fight,taut=1-clamp(finite(f.slack)/.42,0,1),effort=clamp((finite(f.tension)*.70+finite(f.load)*.30)*taut,0,1),warning=clamp(finite(f.surgeWarning),0,1)*taut;
  return pose('effort',{eyeOpen:1-.38*effort,browLift:-.006*effort,browTilt:.22*effort,smile:.06-.22*effort,mouthOpen:.24*effort,mouthWidth:1-.18*effort,asymmetry:.002*warning});
 }
 if(caught&&(context.revealing||p.phase==='result'||p.landedFromFight))return object?curious():happy(fresh&&['first','record','special','reunion'].includes(event.kind));
 if(object)return pose('observing',{eyeOpen:1.03,browLift:.003,smile:.1});
 if(caught&&context.phase==='hooked'){
  const biteAge=(time-finite(p.readyAt,time))/1000;
  return Number.isFinite(p.readyAt)&&biteAge>=0&&biteAge<.28?pose('bite-surprise',{eyeOpen:1.23,browLift:.012,smile:0,mouthOpen:.65,mouthWidth:.86}):pose('expectant',{eyeOpen:1.10,browLift:.008,browTilt:.035,smile:.10,mouthOpen:.12});
 }
 if(caught&&['approach','reading','responding','nibble'].includes(context.phase))return pose('attentive',{eyeOpen:1.08,browLift:.005,browTilt:.025,smile:.09});
 if(context.aiming||context.phase==='casting')return pose('focused',{eyeOpen:.92,browTilt:.065,smile:.08});
 return {...neutral};
}

export function createAnglerExpression(){
 const current={...neutral};
 return {update(context,now,dt,reduced=false){
  const target=anglerExpressionTarget(context,now),step=clamp(finite(dt),0,.1),weight=1-Math.exp(-step*(target.mood==='startled'?24:10));
  for(const key of Object.keys(neutral))if(key!=='mood')current[key]+=(target[key]-current[key])*weight;
  current.mood=target.mood;
  const cue={...current},blinkAllowed=['relaxed','gentle','pleased','studying'].includes(target.mood);
  const clock=((finite(now)/1000)%4.8+4.8)%4.8,blink=!reduced&&blinkAllowed?Math.max(0,1-Math.abs(clock-4.40)/.085):0;
  cue.eyeOpen=Math.max(.065,cue.eyeOpen*(1-blink));return cue;
 }};
}
