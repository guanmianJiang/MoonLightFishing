// Active cast tuning. Keep existing values when moving rules out of the engine.
export const CAST_TUNING=Object.freeze({
 openingCast:Object.freeze({
  defaultSpecies:Object.freeze(['carp','minnow']),
  waitBaseMs:7700,
  waitRandomMs:1800,
  biteWindowMs:16000,
  maxCarpWeight:.38
 }),
 spotWeights:Object.freeze({
  reed:Object.freeze({carp:40,minnow:35,shrimp:20,perch:5}),
  bridge:Object.freeze({carp:15,shrimp:10,perch:32,catfish:20,bottle:15,bell:8}),
  deep:Object.freeze({minnow:10,perch:22,catfish:52,bottle:10,bell:6})
 }),
 ruleMultipliers:Object.freeze({shoal:Object.freeze({carp:1.55,minnow:1.55}),bottom:Object.freeze({shrimp:1.6,catfish:1.6,bottle:1.6,bell:1.6}),predator:Object.freeze({perch:1.55,catfish:1.55})}),
 baitMultipliers:Object.freeze({grain:Object.freeze({carp:2,minnow:2}),worm:Object.freeze({catfish:2,perch:1.5}),glow:Object.freeze({bottle:2,shrimp:1.4})}),
 zoneMultipliers:Object.freeze({near:Object.freeze({carp:1.35,minnow:1.35,shrimp:1.35,perch:.72,catfish:.72}),far:Object.freeze({carp:.75,minnow:.75,shrimp:.75,perch:1.35,catfish:1.35})}),
 copperMultiplier:1.8,
 mirrorMoonWeight:22,
 specialWeights:Object.freeze({oldgold:45,moon:48}),
 floatUpgradeCommon:.08,
 floatUpgradeSpecial:.12,
 nearWaitOffsetMs:-700,
 farWaitOffsetMs:700,
 nearBiteBonusMs:2000,
 rodWeightMultiplier:1.16,
 rodUpgradeWeightStep:.1,
 nearWeightMultiplier:.94,
 farWeightMultiplier:1.10,
 returningWeightMin:1.08,
 returningWeightVariance:.12,
 returningWeightCap:1.35,
 mutationRainChance:.035,
 mutationGoldChance:.09,
 markedTailChance:.12
});

export const FIGHT_FEEL_TUNING=Object.freeze({
 cleanRunMinSeconds:.38,
 turnReelBonus:2.2,
 turnInwardForce:6,
 turnThrustReduction:.6,
 pumpLiftLineSpeed:4.5
});

export const LURE_TEASE_TUNING=Object.freeze({
 liftMs:700,
 followMs:400,
 liftHeight:.075,
 followStrength:.32,
 biteBonusMs:1000
});

export const LURE_CAMERA_TUNING=Object.freeze({
 portraitMaxMix:.55,
 landscapeMaxMix:.72,
 portraitFov:41,
 landscapeFov:38,
 hookPortraitMix:.35,
 hookLandscapeMix:.22,
 hookPortraitFov:43,
 hookLandscapeFov:39,
 focusStartDistance:3,
 focusFullDistance:.8,
 distantMix:.18
});
