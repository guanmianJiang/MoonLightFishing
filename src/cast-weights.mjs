import {CAST_TUNING as C} from './config/fishing-tuning.mjs';

// Pure weight table for the active cast. Never mutate the shared tuning table.
export function castWeightTable(save,weatherId,zone='middle'){
 const weights={...(C.spotWeights[save?.spot]||C.spotWeights.reed)};
 for(const id of Object.keys(weights))if(save?.ecosystem?.[id])weights[id]*=Math.max(.35,save.ecosystem[id]);
 const rule=save?.trip?.rule?.id;
 const multipliers=rule==='shoal'&&save?.spot!=='reed'?null:C.ruleMultipliers[rule];
 for(const [id,multiplier] of Object.entries(multipliers||{}))if(weights[id])weights[id]*=multiplier;
 for(const [id,multiplier] of Object.entries(C.baitMultipliers[save?.bait]||{}))if(weights[id])weights[id]*=multiplier;
 if(save?.spot==='bridge'&&save?.bait==='grain'&&weatherId==='rain'&&save?.clues?.includes('gold2'))weights.oldgold=C.specialWeights.oldgold;
 if(save?.spot==='deep'&&save?.bait==='glow'&&weatherId==='moon'&&save?.clues?.includes('moon2'))weights.moon=C.specialWeights.moon;
 if(save?.gear?.line==='copper')for(const id of ['bottle','bell'])if(weights[id])weights[id]*=C.copperMultiplier;
 if(save?.gear?.float==='mirror'&&save?.spot==='deep'&&save?.clues?.includes('moon1'))weights.moon=(weights.moon||0)+C.mirrorMoonWeight;
 const level=save?.economy?.upgrades?.float||0;
 if(level)for(const id of ['perch','catfish','oldgold','moon'])if(weights[id])weights[id]*=1+level*(['oldgold','moon'].includes(id)?C.floatUpgradeSpecial:C.floatUpgradeCommon);
 for(const [id,multiplier] of Object.entries(C.zoneMultipliers[zone]||{}))if(weights[id])weights[id]*=multiplier;
 return weights;
}
