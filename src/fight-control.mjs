import {phaseOf} from './fishing-motion.js';
import {isObjectCatch} from './catch-kind.mjs';

export function fightControlMode(pending,now,revealing=false){
 if(!pending||revealing||pending.phase==='result')return 'hidden';
 if(pending.fight?.status==='active')return 'reel';
 if(pending.fight)return 'hidden';
 if(!pending.catch||phaseOf(pending,now)!=='hooked')return 'hidden';
 return isObjectCatch(pending.catch)?'retrieve':'strike';
}
