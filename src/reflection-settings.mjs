export const reflectionFields=Object.freeze([
 ['reflectionStrength','反射强度',0,2,.01,1],
 ['reflectionFresnelPower','菲涅尔幂次',.1,24,.1,5],
 ['reflectionFresnelMin','基础反射增量',0,1,.01,0],
 ['reflectionSceneStrength','岸边物体倒影',0,1,.01,.65]
].map(field=>Object.freeze(field)));
export const reflectionDefaults=Object.freeze(Object.fromEntries(reflectionFields.map(([key,,,,,value])=>[key,value])));
export function isReflectionSetting(key){return Object.hasOwn(reflectionDefaults,key)}
export function validReflectionSetting(key,value){
 const field=reflectionFields.find(([name])=>name===key);
 return !!field&&Number.isFinite(value)&&value>=field[2]&&value<=field[3];
}
export function applyReflectionSettings(target,values){
 for(const [key,,min,max] of reflectionFields)if(Number.isFinite(values?.[key]))target[key]=Math.min(max,Math.max(min,values[key]));
 return target;
}
