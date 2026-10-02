import {GAME_RULES} from './config/game-rules.mjs';
import {LURE_TEASE_TUNING} from './config/fishing-tuning.mjs';
import {isObjectCatch} from './catch-kind.mjs';

export {LURE_TEASE_TUNING as LURE_TEASE};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const u=clamp(value,0,1);return u*u*(3-2*u)};

export function canTeaseBait(pending,phase,now){
 return !!pending&&pending.phase==='cast'&&pending.biteMode==='natural'&&['approach','reading'].includes(phase)&&
  !!pending.catch&&!isObjectCatch(pending.catch)&&!pending.liftedAt&&
  Number.isFinite(now)&&Number.isFinite(pending.readyAt)&&now<pending.readyAt&&
  !(Number.isFinite(pending.teaseCount)&&pending.teaseCount>0);
}

export function teaseBait(pending,phase,now){
 if(!canTeaseBait(pending,phase,now))return false;
 pending.teaseAt=now;
 pending.teaseCount=1;
 const original=Number.isFinite(pending.biteWindowMs)&&pending.biteWindowMs>0?pending.biteWindowMs:GAME_RULES.biteWindowsMs.at(-1);
 pending.biteWindowMs=original+LURE_TEASE_TUNING.biteBonusMs;
 return true;
}

export function lureTeaseMotion(ageMs){
 if(!Number.isFinite(ageMs)||ageMs<0)return {lift:0,follow:0};
 const u=clamp(ageMs/LURE_TEASE_TUNING.liftMs,0,1);
 return {lift:u<1?Math.sin(Math.PI*u)*LURE_TEASE_TUNING.liftHeight:0,
  follow:LURE_TEASE_TUNING.followStrength*smooth(ageMs/LURE_TEASE_TUNING.followMs)};
}
