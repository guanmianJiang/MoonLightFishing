import {CAST_TUNING} from './config/fishing-tuning.mjs';

export function isOpeningCast(save){
 return save?.casts===0&&save?.trip?.number===1&&save?.spot==='reed'&&Array.isArray(save.log)&&save.log.length===0&&!save.waterTrail&&(!Array.isArray(save.tracked)||save.tracked.length===0);
}

export function openingCastWeights(save,weights){
 if(!isOpeningCast(save)||save.spot!=='reed'||save.bait!=='grain')return weights;
 const selected=Object.entries(weights).filter(([id,value])=>CAST_TUNING.openingCast.defaultSpecies.includes(id)&&value>0);
 return selected.length?Object.fromEntries(selected):weights;
}

export function openingCastTiming(save,rng){
 if(!isOpeningCast(save))return null;
 const tuning=CAST_TUNING.openingCast;
 return {waitMs:tuning.waitBaseMs+rng*tuning.waitRandomMs,biteWindowMs:tuning.biteWindowMs};
}
