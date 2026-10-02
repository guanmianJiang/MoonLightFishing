const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
const species={minnow:1.25,carp:.9,perch:1.05,catfish:.83,oldgold:.78,moon:.88,shrimp:1.12};

export function fishAnimationTarget(caught={},cue={}){
 if(caught.object||['bottle','bell'].includes(caught.id))return {speed:0,amplitude:0,fin:0,breath:0};
 const weight=clamp(caught.weight??1,.02,12),pace=(species[caught.id]||1)*clamp(1.06-Math.log1p(weight)*.13,.7,1.06);
 const effort=clamp(cue.effort??0,0,1),surge=clamp(cue.surge??0,0,1);
 let speed=6,amplitude=.025,fin=.14;
 switch(cue.stage){
  case 'hooked':{const load=clamp((cue.hookAge??0)/.26,0,1);speed=6+load*11;amplitude=.025+load*.065;fin=.14+load*.07;break;}
  case 'fight':speed=12+surge*8+effort*3;amplitude=.045+effort*.055+surge*.02;fin=.20;break;
  case 'landing':speed=17;amplitude=.04+effort*.06;fin=.16;break;
  case 'held':speed=4;amplitude=.014;fin=.075;break;
  case 'release':speed=8;amplitude=.025;fin=.10;break;
  case 'swim':speed=13;amplitude=.065;fin=.20;break;
  case 'viewer':speed=4.5;amplitude=.025;fin=.12;break;
 }
 return {speed:speed*pace,amplitude,fin,breath:.012};
}

export function createFishAnimation(caught={}){
 let phase=clamp((caught.weight??1)*13.7,0,1e4)%(Math.PI*2),current=fishAnimationTarget(caught,{stage:'approach'});
 return {update(cue={},dt=0,reduced=false){
  const target=fishAnimationTarget(caught,cue),step=clamp(dt,0,.1),blend=1-Math.exp(-step*9);
  if(reduced){target.amplitude*=.55;target.fin*=.65;}
  for(const key of ['speed','amplitude','fin','breath'])current[key]+=(target[key]-current[key])*blend;
  // Objects have no residual living motion, even on a reused presentation.
  if(target.speed===0)current={...target};
  phase=(phase+current.speed*step)%(Math.PI*2);
  return {...current,phase};
 }};
}
