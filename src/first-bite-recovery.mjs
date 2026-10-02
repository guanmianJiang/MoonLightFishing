import {FISH} from './data/catalog.mjs';

const RECOVERY=Object.freeze({
 cue:'鱼线绷紧时 · 按住右下钓钩',
 detail:'前一竿鱼已咬实，却在提竿前松开。再试同一片水时，看见鱼线绷紧就按住右下钓钩；同种鱼可能回来，但不保证。'
});

export function firstBiteRecovery(save){
 if(save?.casts!==1||save.trip?.number!==1||save.pending||!Array.isArray(save.trip.moments)||save.trip.moments.length!==1)return null;
 const moment=save.trip.moments[0];
 if(moment?.kind!=='near-miss'||moment.missReason!=='missed'||!FISH.some(fish=>fish.id===moment.fishId&&!fish.object))return null;
 const [cast,start,extra]=typeof moment.castId==='string'?moment.castId.split(':'):[];
 return cast==='1'&&!extra&&Number.isFinite(Number(start))&&Number(start)>0?RECOVERY:null;
}
