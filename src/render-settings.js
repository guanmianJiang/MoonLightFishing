import publishedDefaults from './render-defaults.js';
import {Color} from './three.module.js';
import {DEFAULT_SKY_TEXTURE,normalizeSkyTexture,normalizeSkyRotation} from './sky-settings.mjs';
import {atmosphereDefaults,applyAtmosphereSettings,DEFAULT_ATMOSPHERE_COLOR} from './atmosphere-settings.mjs';
import {reflectionDefaults,applyReflectionSettings} from './reflection-settings.mjs';
import {waterWaveDefaults,applyWaterWaveSettings} from './water-surface.js';
// 修改后刷新页面；贴图路径相对于页面入口。
export const renderSettings = {
  ...atmosphereDefaults,
  ...waterWaveDefaults,
  atmosphereColor:DEFAULT_ATMOSPHERE_COLOR,
  waterGradient: [{depth:0,color:'#1f6e91'},{depth:3.4,color:'#0a4482'},{depth:8.8,color:'#031d71'}],
  waterAbsorption: 1.0, // 水体吸收倍率：越高，水下颜色随深度衰减越快
  sandSparkleStrength: 1.2, // 沙粒离散高光强度
  sandSparkleDensity: 24.0, // 沙粒密度
  underwaterRelief: 0.32, // 水底起伏明暗强度
  underwaterReliefScale: 1.8, // 水底起伏尺度
  wetSandRoughness: 0.24, // 湿沙高光粗糙度
  wetSandSpecular: 1.0, // 湿沙高光倍率
  sunColor: '#fff0d6', // 主光颜色，sRGB
  skyTexture: DEFAULT_SKY_TEXTURE, // 2:1 全景天空球贴图
  skyRotation: 0, // 天空球与水面倒影共同水平旋转，度
  foamColor: '#f5f5e8',
  toneMapping: 'aces', // aces / neutral / agx / reinhard / linear / none
  shadingMode: 'shaded', // shaded / wireframe / shaded-wireframe
  sunAzimuth: -158.2, // 太阳方位角，度
  sunElevation: 40.9, // 太阳仰角，度
    normalTexture: './assets/Tex_Water_Normal_06.jpg',
  normalStrengthA: 0.72, // 主层强度，建议 0.10～0.35
  normalStrengthB: -0.27, // 次层强度，建议主层的 1/3
  normalScaleA: 0.305, // 越大纹理越密，越小波纹越大
  normalScaleB: 0.173,
  normalSpeedA: 3.0, // 主层流动速度倍率，0 静止
  normalSpeedB: -1.55, // 次层独立速度倍率，0 静止
  ...reflectionDefaults, // 5 次 Schlick；反射直接使用合成水面法线
  specularStrength: 2.45, // 风格化高光强度，0 关闭；建议 0～3
  specularPower: 128.0, // Raider 高光幂次，越大亮斑越小
  specularThreshold: 0.5, // 高光阈值，越大亮斑越少，范围 0～0.95
  specularSoftness: 0.01, // 分段边缘柔度，建议 0.001～0.2
  causticStrength: 6.4, // 焦散强度，0 关闭，建议 1～4
  causticScale: 0.65, // 焦散密度，越小光纹越大
  causticSpeed: 1.8, // 焦散变化速度，0 静止
  causticMinDepth: 0.25, // 水深 ≤ 此值无焦散，米
  causticFadeInDepth: 0.8, // 从最小深度渐入，到此深度完全启用
  causticFadeOutDepth: 2.9, // 从此深度开始淡出
  causticDepth: 4.5, // 水深 ≥ 此值无焦散，米
  // 深度顺序：MinDepth < FadeInDepth < FadeOutDepth < Depth
  exposure: 1.08, // ACES 曝光，不改变 Bloom 提取阈值
  bloomThreshold: 0.8, // 线性 HDR 亮度阈值
  bloomStrength: 2.52, // 晴天强度；晨雾、雨天按比例减弱
  bloomRadius: 2.25, // 光晕半径（CSS 像素），建议 2～24
  bloomOnly: false, // true 仅显示 Bloom 光晕，用于检查阈值/强度/半径
  shorePeriod: 5.6, // 拍岸周期，秒
  shoreReach: 0.80, // 最大冲岸距离，米（建议不超过 0.9）
  shoreFoam: 0.65, // 破碎浪花强度
  meniscusWidth: 0.20, // 接触弯月面宽度，米
  meniscusCrown: 0.30, // 曲面峰位，占接触带宽度的比例
  meniscusBulge: 0.75, // 曲面隆起，控制外观高度与法线倾斜
  meniscusRefraction: 1.0, // 接触透镜折射倍率
  meniscusShadow: 0.055, // 内侧暗边强度
  meniscusStrength: 1.0, // 弯月面总强度，0 关闭
  meniscusGlintReach: 0.46, // 高光从接触缘向水内延伸的比例
  meniscusHighlightStrength: 1.1, // 独立的曲面高光强度
  wetSandStrength: 1.0, // 湿沙颜色变化强度
  wetSandReach: 0.8, // 湿痕延伸距离，米
  wetSandFeather: 0.8, // 湿痕边缘过渡宽度，米
  wetSandDarkening: 1.0, // 湿沙压暗倍率，0 不压暗
  foamWarp: 0.35, // 世界空间纹理扰动，减少重复
  foamWidth: 0.55, // 动态交界内侧泡沫带宽，米
  foamScale: 1.8, // 沿岸纹理密度
  foamSpeed: 0.3, // 泡沫纹理流速
  foamCutoff: 0.42, // 纹理阈值，越高越破碎
  foamSoftness: 0.08, // 纹理边缘柔度
  shoreLip: 0.055, // 移动浪头的窄边高光
};
// GLSL 数值必须有小数点；仅用于上述数值参数。
export const glslNumber = value => Number(value).toFixed(6);

Object.assign(renderSettings, publishedDefaults);
applyAtmosphereSettings(renderSettings,applyAtmosphereSettings({...atmosphereDefaults},publishedDefaults));
applyReflectionSettings(renderSettings,applyReflectionSettings({...reflectionDefaults},publishedDefaults));
applyWaterWaveSettings(renderSettings,applyWaterWaveSettings({...waterWaveDefaults},publishedDefaults));
delete renderSettings.reflectionRoughness;
delete renderSettings.reflectionFarRetention;
delete renderSettings.reflectionWaveStrength;
delete renderSettings.reflectionNormalStrength;
if(!/^#[0-9a-f]{6}$/i.test(renderSettings.atmosphereColor??''))renderSettings.atmosphereColor=DEFAULT_ATMOSPHERE_COLOR;
for(const key of ['skyFogStrength','sceneFogStrength','waterFogDensity'])delete renderSettings[key];
renderSettings.skyTexture=normalizeSkyTexture(renderSettings.skyTexture);
renderSettings.skyRotation=normalizeSkyRotation(renderSettings.skyRotation);
export const defaultRenderSettings = structuredClone(renderSettings);
export const settingsUniforms=Object.fromEntries(Object.keys(renderSettings).filter(k=>typeof renderSettings[k]==='number').map(k=>['uSetting_'+k,{get value(){return renderSettings[k];}}]));
export const colorSettingKeys=['sunColor','foamColor','atmosphereColor'];
for(const key of colorSettingKeys){const color=new Color();let previous;settingsUniforms['uSetting_'+key]={get value(){if(previous!==renderSettings[key]){previous=renderSettings[key];color.set(previous);}return color;}};}
export const settingsGLSL=Object.keys(settingsUniforms).map(k=>'uniform '+(colorSettingKeys.includes(k.slice(9))?'vec3':'float')+' '+k+';').join('\n');

const gradientColors=Array.from({length:8},()=>new Color());
const gradientDepths=new Float32Array(8);
settingsUniforms.uGradientColors={get value(){for(let i=0;i<8;i++)gradientColors[i].set(renderSettings.waterGradient[Math.min(i,renderSettings.waterGradient.length-1)].color);return gradientColors;}};
settingsUniforms.uGradientDepths={get value(){for(let i=0;i<8;i++)gradientDepths[i]=renderSettings.waterGradient[Math.min(i,renderSettings.waterGradient.length-1)].depth;return gradientDepths;}};
settingsUniforms.uGradientCount={get value(){return renderSettings.waterGradient.length;}};
