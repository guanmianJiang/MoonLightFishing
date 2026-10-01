import {atmosphereFields,DEFAULT_ATMOSPHERE_COLOR} from './atmosphere-settings.mjs';
import {reflectionFields,applyReflectionSettings} from './reflection-settings.mjs';
import {waterWaveFields,applyWaterWaveSettings} from './water-surface.js';

export const lookControlHints=Object.freeze({
 atmosphereHeight:'越大，天际线空气层越厚。',
 atmosphereStrength:'越大，远景散射越浓；0 关闭。',
 atmosphereSunStrength:'增加太阳方向的暖色；0 关闭暖色项。',
 atmosphereColor:'空气层的底色；建议用低饱和蓝灰。',
 reflectionStrength:'0 关闭；1 为基准；大于 1 提亮倒影。',
 reflectionFresnelPower:'越大，倒影越集中在远处掠射角；5 为基准。',
 reflectionFresnelMin:'提高俯看时的反射；0 仍保留约 2%。',
 reflectionSceneStrength:'屏幕内岸边物体的倒影；0 关闭此项。',
 waterWaveStrength:'0 关闭默认波浪，1 原始波幅；同步改变波高与法线，贴图水纹和交互波独立保留。'
});

const groupFields=Object.freeze({
 '地平线大气':atmosphereFields.slice(1),
 '环境反射':reflectionFields,
 '海面波浪':waterWaveFields
});

// Read defaults at click time so a newly published look is also restorable.
export function restoreLookGroup(target,defaults,title){
 if(!Object.hasOwn(groupFields,title))return false;
 for(const [key,,min,max,,fallback] of groupFields[title]){
  const value=defaults?.[key];
  target[key]=Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
 }
 if(title==='地平线大气'){
  const color=defaults?.atmosphereColor;
  target.atmosphereColor=typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color)?color:DEFAULT_ATMOSPHERE_COLOR;
 }
 return true;
}

export function clearReflection(target){
 return applyReflectionSettings(target,{reflectionStrength:0});
}
export function clearWaterWaves(target){return applyWaterWaveSettings(target,{waterWaveStrength:0});}
