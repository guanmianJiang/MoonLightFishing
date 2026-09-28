import {FISH,SPOTS,BAITS} from './data/catalog.mjs';

export const WATER_TRAIL_RETURN_CHANCE=.62;
export const WATER_TRAIL_WAIT_REDUCTION_MS=1400;
export const WATER_TRAIL_BITE_BONUS_MS=2000;

export function normalizeWaterTrail(value){
 if(!value||typeof value!=='object')return null;
 const {fishId,spot,bait,reason}=value,fish=FISH.find(item=>item.id===fishId);
 if(!fish||fish.object||!SPOTS.some(item=>item.id===spot)||!BAITS.some(item=>item.id===bait)||!['missed','escaped'].includes(reason))return null;
 return {fishId,spot,bait,reason};
}

export function trailFromMiss(pending){
 if(!pending?.nearMiss)return null;
 return normalizeWaterTrail({fishId:pending.nearMiss.fishId,spot:pending.spot,bait:pending.bait,reason:pending.nearMiss.reason});
}

export function matchingWaterTrail(save,weights){
 const trail=normalizeWaterTrail(save?.waterTrail);
 return trail&&trail.spot===save.spot&&trail.bait===save.bait&&weights[trail.fishId]>0?trail:null;
}
