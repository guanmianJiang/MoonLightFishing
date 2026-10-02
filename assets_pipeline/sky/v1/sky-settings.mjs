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
export const skyPanoramaGLSL=`vec2 skyPanoramaUV(vec3 direction){
 vec3 d=normalize(direction);
 return vec2(atan(d.z,d.x)/6.2831853+.5+uSetting_skyRotation/360.,asin(clamp(d.y,-1.,1.))/3.14159265+.5);
}`;

// The dome and its reflections share linear radiance before tone mapping.
export const skyRadianceGLSL=`vec3 skyEnvironmentRadiance(vec3 direction,vec3 sampleColor){
 vec3 d=normalize(direction);
 vec3 horizonAir=vec3(.54,.70,.73);
 float horizonPath=exp(-abs(d.y)*15.0);
 float upperScatter=exp(-max(d.y,0.)*8.0);
 float lowerScatter=exp(-max(-d.y,0.)*23.0);
 float scatter=horizonPath*.68+upperScatter*lowerScatter*.18;
 float luminance=dot(sampleColor,vec3(.2126,.7152,.0722));
 vec3 col=mix(vec3(luminance),sampleColor,1.-scatter*.34);
 return mix(col,horizonAir,clamp(scatter,0.,.88));
}`;
