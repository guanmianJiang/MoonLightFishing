import {isObjectCatch} from './catch-kind.mjs';
import {catchRevealPresentation} from './ui/catch-reveal.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const u=clamp(v,0,1);return u*u*(3-2*u)};
const profiles={
 catch:{push:.36,side:.10,lift:.06,fov:-2,duration:1.8,duck:.72},
 first:{push:.50,side:.35,lift:.10,fov:-3,duration:2.0,duck:.65},
 record:{push:.32,side:.15,lift:.18,fov:-2.5,duration:2.2,duck:.62},
 special:{push:.60,side:.50,lift:.12,fov:-4,duration:2.3,duck:.55},
 reunion:{push:.42,side:-.28,lift:.08,fov:-2.6,duration:2.1,duck:.65},
 discovery:{push:.16,side:.48,lift:.04,fov:1.5,duration:1.9,duck:.72},
 empty:{push:-.25,side:0,lift:0,fov:1.8,duration:1.5,duck:.86},
 missed:{push:-.32,side:-.12,lift:.03,fov:2.5,duration:1.7,duck:.72},
 escaped:{push:-.45,side:.15,lift:.05,fov:3.5,duration:1.9,duck:.62},
 'line-break':{push:-.55,side:0,lift:.04,fov:4.5,duration:1.9,duck:.40}
};
export function outcomeKind({caught,fish,label='',lossReason,reaction=''}={}){
 if(caught)return catchRevealPresentation(caught,{...fish,object:fish?.object||isObjectCatch(caught)},label).mood;
 if(lossReason==='line-break')return 'line-break';
 if(['escaped','exhausted'].includes(lossReason))return 'escaped';
 if(lossReason==='missed'||/松口|鱼口|咬牢|错过/.test(reaction))return 'missed';
 if(/挣脱|脱钩/.test(reaction))return 'escaped';
 return 'empty';
}
export function createOutcomeDirector(){
 let current=null;const seen=new Set();
 return {emit(cast,stage,detail={},at=0){
  if(!cast||!['arrival','reveal'].includes(stage))return null;
  if(cast!==current){current=cast;seen.clear()}
  if(seen.has(stage))return null;
  seen.add(stage);
  return {kind:outcomeKind(detail),stage,at:Number.isFinite(at)?at:0};
 }};
}
export function outcomeShowcaseReady(pending,revealing,age,mouthHeight){
 return !!(revealing&&pending?.phase==='cast'&&pending.catch&&Number.isFinite(age)&&age>=1.05&&Number.isFinite(mouthHeight)&&mouthHeight>=.55);
}
export function outcomeCameraCue(event,age,reduced=false){
 const zero={push:0,side:0,lift:0,fov:0,weight:0};
 if(!event||reduced||!Number.isFinite(age)||age<0)return zero;
 const p=profiles[event.kind]||profiles.empty,delay=event.kind==='line-break'?.4:0;
 const elapsed=age-delay;if(elapsed<0||elapsed>=p.duration)return zero;
 const weight=smooth(elapsed/.35)*(1-smooth((elapsed-p.duration*.58)/(p.duration*.42)));
 const strength=event.stage==='reveal'?1:.7;
 return {push:p.push*weight*strength,side:p.side*weight*strength,lift:p.lift*weight*strength,fov:p.fov*weight*strength,weight};
}
const real=(id,gain,delay=0,extra={})=>({type:'real',id,gain,delay,duration:.22,...extra});
const note=(freq,delay,gain=.04)=>({type:'note',freq,delay,gain,dur:.45});
const sweep=(freqStart,freqEnd,delay=0,gain=.012,dur=.22)=>({type:'sweep',freqStart,freqEnd,delay,gain,dur,typeName:'triangle'});
export function outcomeAudioScore(kind,stage='arrival'){
 if(!profiles[kind])kind='empty';
 const p=profiles[kind]||profiles.empty;let sounds=[];
 if(stage==='reveal'){
  const melodies={catch:[440,554,659],first:[523,659,880],record:[330,494,659],special:[392,587,784,1175],reunion:[392,523,494,659],discovery:[523,494]};
  sounds=(melodies[kind]||[]).map((f,i)=>note(f,.06+i*.14,kind==='special'?.08:kind==='discovery'?.05:.065));
  if(kind==='discovery')sounds.unshift(real('uiClickSoft',.13,0,{rate:.9,duration:.08}));
 }else if(kind==='line-break'){
  sounds=[real('uiClickSoft',.36,0,{rate:1.7,duration:.045}),real('whooshShort',.48,.015,{rate:1.48,offset:.20,duration:.16}),sweep(620,180,.08,.035,.22)];
 }else if(kind==='escaped'||kind==='missed'){
  sounds=[real('splashTiny',kind==='escaped'?.32:.20,0,{rate:1.1}),sweep(kind==='escaped'?240:195,120,.10,.025,.25)];
 }else if(kind==='empty'){
  sounds=[real('reel',.20,0,{offset:1.8,duration:.20}),real('splashTiny',.09,.22,{rate:1.25})];
 }else if(kind==='discovery'){
  sounds=[real('splashTiny',.20,0),real('uiClickSoft',.13,.12,{rate:.82,duration:.09})];
 }else{
  // A readable success cue starts at the win, before the identity melody.
  // The scene's onFishLift still supplies the actual water/reel sound.
  sounds=[real('uiRollover',.32,0,{duration:.24}),note(kind==='record'?494:659,.035,.065)];
 }
 return {sounds,duck:p.duck,duration:stage==='reveal'?.95:kind==='line-break'?.7:.55};
}

export function playOutcomeScore(score,{realSound,chimeNote,toneSweep,duck}){
 duck(score.duck,score.duration);
 for(const cue of score.sounds){
  const {type,id,typeName,...options}=cue;
  if(type==='real')realSound(id,options);
  else if(type==='note')chimeNote(options);
  else if(type==='sweep')toneSweep({...options,type:typeName});
 }
}
