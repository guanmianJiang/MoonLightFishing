import {PROCESS_ACTIONS} from './data/catalog.mjs';
import {GAME_RULES} from './config/game-rules.mjs';

export function catchActionPlan(save,catchItem,fish,sameCount){
 const goal=save?.trip?.goal;
 let recommended=goal&&!goal.complete&&goal.progress<goal.target?goal.action:'study';
 if(!PROCESS_ACTIONS.some(action=>action.id===recommended))recommended='study';
 if(recommended==='release'&&fish?.object)recommended='study';
 if(recommended==='keep'&&(save?.collection?.length||0)>=GAME_RULES.collectionLimit)recommended='study';
 if(recommended==='basket'&&(save?.economy?.basket?.length||0)>=GAME_RULES.basketLimit)recommended='study';
 const notable=!!(fish?.special||catchItem?.mutation||catchItem?.tagId||Number.isFinite(sameCount)&&sameCount<=1);
 return {recommended,notable};
}
