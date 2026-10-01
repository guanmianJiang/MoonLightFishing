// One parameter contract for the panel, published defaults and CPU validation.
export const DEFAULT_ATMOSPHERE_COLOR='#9fb9d3';
export const atmosphereFields=Object.freeze([
 ['skyCloudHeight','云层高度倍率',.25,2,.05,.5],
 ['atmosphereHeight','雾层高度 (m)',1,120,1,12],
 ['atmosphereStrength','大气散射强度',0,2,.01,.45],
 ['atmosphereSunStrength','向阳暖散射',0,1,.01,.15]
].map(field=>Object.freeze(field)));
export const atmosphereDefaults=Object.freeze(Object.fromEntries(atmosphereFields.map(([key,,,,,value])=>[key,value])));
export function isAtmosphereSetting(key){return Object.hasOwn(atmosphereDefaults,key)}
export function validAtmosphereSetting(key,value){
 const field=atmosphereFields.find(([name])=>name===key);
 return !!field&&Number.isFinite(value)&&value>=field[2]&&value<=field[3];
}
export function applyAtmosphereSettings(target,values){
 if(values&&!Object.hasOwn(values,'atmosphereStrength')&&['skyFogStrength','sceneFogStrength','waterFogDensity'].every(key=>values[key]===0))target.atmosphereStrength=0;
 for(const [key,,min,max] of atmosphereFields)if(Number.isFinite(values?.[key]))target[key]=Math.min(max,Math.max(min,values[key]));
 return target;
}
export function clearAtmosphereFog(target){
 return applyAtmosphereSettings(target,{atmosphereStrength:0});
}
