import {heightAtmosphereGLSL,heightAtmosphereUniformsGLSL,heightAtmosphereRadianceGLSL} from './height-atmosphere.mjs';
export const SKY_TEXTURES=Object.freeze(Array.from({length:6},(_,index)=>Object.freeze({
 path:`./assets/sky-toon-0${index+1}.png`,
 label:`天空 ${String(index+1).padStart(2,'0')}${index===3?' · 当前默认':''}`
})));

export const DEFAULT_SKY_TEXTURE=SKY_TEXTURES[3].path;
const skyTexturePaths=new Set(SKY_TEXTURES.map(({path})=>path));

export function isSkyTexture(path){return skyTexturePaths.has(path)}
export function normalizeSkyTexture(path){return isSkyTexture(path)?path:DEFAULT_SKY_TEXTURE}
export function normalizeSkyRotation(degrees){return Number.isFinite(degrees)?Math.min(360,Math.max(0,degrees)):0}

export function createSkyTextureController(initialPath,initialTexture,load,apply){
 const cache=new Map([[normalizeSkyTexture(initialPath),Promise.resolve(initialTexture)]]);
 let request=0,disposed=false;
 return {
  async select(path){
   if(!isSkyTexture(path))throw new Error('Unknown sky texture');
   const current=++request;let loading=cache.get(path);
   if(!loading){loading=Promise.resolve().then(()=>load(path));cache.set(path,loading)}
   let texture;try{texture=await loading}catch(error){if(cache.get(path)===loading)cache.delete(path);throw error}
   if(disposed||current!==request)return false;
   apply(texture,path);return true;
  },
  dispose(disposeTexture){disposed=true;request++;for(const loading of cache.values())loading.then(texture=>disposeTexture(texture),()=>{});cache.clear()}
 };
}

// One equirectangular lookup for the dome, open water and shore film.
export const skyPanoramaGLSL=`float skyCloudLatitude(float vertical,float height){
 float y=clamp(vertical,-1.,1.);
 if(abs(y)==1.)return y*1.57079633;
 return atan(y/(sqrt(1.-y*y)*clamp(height,.25,2.)));
}
vec2 skyPanoramaUV(vec3 direction){
 vec3 d=normalize(direction);
 return vec2(atan(d.z,d.x)/6.2831853+.5+uSetting_skyRotation/360.,skyCloudLatitude(d.y,uSetting_skyCloudHeight)/3.14159265+.5);
}`;

// Environment rays originate at the camera for the dome and at the surface for reflections.
export const skyRadianceGLSL=`${heightAtmosphereUniformsGLSL}${heightAtmosphereGLSL}${heightAtmosphereRadianceGLSL}
vec3 skyEnvironmentRadiance(vec3 direction,vec3 sampleColor,float originHeight){
 vec3 d=normalize(direction);
 float targetHeight=originHeight+abs(d.y)*12000.;
 float amount=heightAtmosphereScatter(12000.,originHeight,targetHeight,uHeightFogParams.x,uHeightFogParams.y,uHeightFogWeather);
 return mix(sampleColor,heightAtmosphereRadiance(d),amount);
}`;

// A missing downward reflection falls back to the horizon, never underground sky.
// Use only the real pixel footprint; do not introduce an artistic blur/LOD bias.
export const skyReflectionGLSL=`
vec3 skyReflectionDirection(vec3 direction){
 return normalize(vec3(direction.x,max(direction.y,0.),direction.z)+vec3(.0000001,0.,0.));
}
float skyWrappedDerivative(float delta){return delta-floor(delta+.5);}
vec3 skyReflectionSample(sampler2D panorama,vec3 direction){
 vec2 uv=skyPanoramaUV(direction);
 vec2 dx=dFdx(uv),dy=dFdy(uv);
 dx.x=skyWrappedDerivative(dx.x);dy.x=skyWrappedDerivative(dy.x);
 return texture2DGradEXT(panorama,uv,dx,dy).rgb;
}`;
