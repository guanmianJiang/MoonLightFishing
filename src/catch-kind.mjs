import {FISH} from './data/catalog.mjs';

const objectCatchIds=new Set(FISH.filter(item=>item.object).map(item=>item.id));

export function isObjectCatch(catchInfo){
 return !!catchInfo&&objectCatchIds.has(catchInfo.id);
}
