const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

export function fightHapticSample(f){
 if(!f)return null;
 return {
  status:f.status,lossReason:f.lossReason,
  tension:finite(f.tension),load:finite(f.load),slack:finite(f.slack,1),
  spoolVelocity:finite(f.spoolVelocity),reelTurns:finite(f.reelTurns),
  surge:finite(f.surge),warningAge:finite(f.warningAge),overload:finite(f.overload),
  held:!!f.held
 };
}

export function fightHapticEvent(previous,current){
 const before=fightHapticSample(previous),after=fightHapticSample(current);
 if(!before||!after||before.status!=='active')return null;
 if(after.status==='lost')return after.lossReason==='line-break'?'line-break':'escaped';
 if(after.status==='won')return 'landed';
 if(after.status!=='active')return null;
 const taut=after.slack<.18&&after.tension>.12;
 if(!taut)return null;
 if((before.overload<.16||before.warningAge<=.6)&&after.overload>=.16&&after.warningAge>.6)return 'line-critical';
 if(before.warningAge<.42&&after.warningAge>=.42)return 'line-warning';
 if(after.tension-before.tension>.16&&after.tension>.32)return 'impact';
 if(before.surge<=.55&&after.surge>.55)return 'surge';
 if(before.spoolVelocity<=.12&&after.spoolVelocity>.12)return 'payout';
 if(after.held&&Math.floor(after.reelTurns)>Math.floor(before.reelTurns)&&after.load>.22)return 'spool';
 return null;
}

const cues={
 tap:{pattern:7,priority:0,cooldown:70},
 invalid:{pattern:7,priority:0,cooldown:180},
 cast:{pattern:12,priority:2,cooldown:250},
 splash:{pattern:9,priority:1,cooldown:180},
 'release-water':{pattern:12,priority:2,cooldown:300},
 'release-heavy':{pattern:[20,22,8],priority:3,cooldown:300},
 object:{pattern:11,priority:2,cooldown:280},
 bite:{pattern:[18,32,23],priority:4,cooldown:350},
 hook:{pattern:[23,25,14],priority:5,cooldown:320},
 pump:{pattern:[20,18,11],priority:4,cooldown:240},
 spool:{pattern:7,priority:1,cooldown:130},
 payout:{pattern:11,priority:2,cooldown:350},
 surge:{pattern:[15,27,12],priority:3,cooldown:480},
 impact:{pattern:[13,20,13],priority:3,cooldown:170},
 'line-warning':{pattern:[14,30,16],priority:4,cooldown:650},
 'line-critical':{pattern:[18,22,18],priority:5,cooldown:650},
 'line-break':{pattern:[29,18,10],priority:7,cooldown:700},
 escaped:{pattern:[14,20,9],priority:7,cooldown:700},
 landed:{pattern:[21,24,18],priority:6,cooldown:700}
};

export function createHaptics(vibrate,clock=()=>performance.now(),active=()=>true){
 let busyUntil=0,busyPriority=-1,lastTime=-Infinity;
 const lastByCue=new Map();
 const emit=name=>{
  const cue=cues[name],now=clock();
  if(!cue||!Number.isFinite(now)||!active()||typeof vibrate!=='function')return false;
  if(now<lastTime){busyUntil=0;lastByCue.clear()}
  lastTime=now;
  if(now<busyUntil&&cue.priority<=busyPriority)return false;
  if(now-(lastByCue.get(name)??-Infinity)<cue.cooldown)return false;
  let accepted=false;
  try{accepted=!!vibrate(cue.pattern)}catch{return false}
  if(!accepted)return false;
  const duration=Array.isArray(cue.pattern)?cue.pattern.reduce((sum,value)=>sum+value,0):cue.pattern;
  busyUntil=now+duration+12;busyPriority=cue.priority;lastByCue.set(name,now);
  return true;
 };
 const stop=()=>{busyUntil=0;busyPriority=-1;try{vibrate?.(0)}catch{}};
 return {emit,stop};
}
