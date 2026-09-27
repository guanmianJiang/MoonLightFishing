// Shared gameplay and save limits. Preserve values when changing file structure.
export const GAME_RULES=Object.freeze({
 saveVersion:2,
 saveKey:'moonwater-v1',
 soundKey:'moonwater-sound',
 weatherPeriodMs:120000,
 castsPerTrip:4,
 catchLogLimit:250,
 observationLimit:40,
 trackedLimit:3,
 collectionLimit:6,
 basketLimit:30,
 biteWindowsMs:Object.freeze([9500,8000,6500]),
 castWaitBaseMs:12000,
 castWaitRandomMs:6000,
 decisionLeadMs:4300
});
