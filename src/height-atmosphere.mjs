import {DEFAULT_ATMOSPHERE_COLOR} from './atmosphere-settings.mjs';
export function atmosphereWeatherScale(id){return id==='mist'?1.45:id==='rain'?.9:1}
export function atmosphereColorLinear(color){
 const hex=/^#[0-9a-f]{6}$/i.test(color??'')?color:DEFAULT_ATMOSPHERE_COLOR;
 return [1,3,5].map(index=>{const c=parseInt(hex.slice(index,index+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)});
}

// Analytic integration of an exponential air layer above the mean sea surface.
export const heightAtmosphereGLSL=`
float heightAtmosphereMean(float startHeight,float endHeight,float layerHeight){
 float h=max(layerHeight,1.);
 float low=min(startHeight,endHeight)-.14;
 float high=max(startHeight,endHeight)-.14;
 float span=high-low;
 if(span<.000001)return exp(-max(low,0.)/h);
 float aboveSpan=max(high,0.)-max(low,0.);
 float delta=aboveSpan/h;
 float integral=delta<.001?1.-delta*.5+delta*delta/6.:(1.-exp(-delta))/max(delta,.000001);
 float belowFraction=clamp(-low/span,0.,1.);
 return belowFraction+aboveSpan/span*exp(-max(low,0.)/h)*integral;
}
float heightAtmosphereScatter(float rayLength,float startHeight,float endHeight,float layerHeight,float strength,float weatherScale){
 float density=clamp(strength,0.,2.)*clamp(weatherScale,0.,2.);
 if(density==0.)return 0.;
 float opticalDepth=clamp(rayLength,0.,12000.)*.0006*density*heightAtmosphereMean(startHeight,endHeight,layerHeight);
 return clamp(1.-exp(-opticalDepth),0.,.985);
}
float heightRayleighPhase(float cosine){
 float c=clamp(cosine,-1.,1.);
 return .75*(1.+c*c);
}
float heightMiePhase(float cosine){
 float c=clamp(cosine,-1.,1.);
 return .042875/pow(max(1.4225-1.3*c,.1225),1.5);
}
float heightAtmosphereChannel(float base,float sun,float rayleighPhase,float miePhase,float sunStrength){
 return max(base,0.)*(.85+.15*rayleighPhase)+max(sun,0.)*.12*miePhase*clamp(sunStrength,0.,1.);
}
`;
export const heightAtmosphereUniformsGLSL=`
uniform vec3 uHeightFogParams,uHeightFogSunDirection,uHeightFogSunRadiance,uHeightFogColor;
uniform float uHeightFogWeather,uHeightFogCapture;
`;
export const heightAtmosphereRadianceGLSL=`
vec3 heightAtmosphereRadiance(vec3 direction){
 vec3 d=normalize(direction+vec3(.0000001,0.,0.));
 float cosine=dot(d,normalize(uHeightFogSunDirection+vec3(.0000001,0.,0.)));
 float rayleighPhase=heightRayleighPhase(cosine),miePhase=heightMiePhase(cosine);
 return vec3(
  heightAtmosphereChannel(uHeightFogColor.r,uHeightFogSunRadiance.r,rayleighPhase,miePhase,uHeightFogParams.z),
  heightAtmosphereChannel(uHeightFogColor.g,uHeightFogSunRadiance.g,rayleighPhase,miePhase,uHeightFogParams.z),
  heightAtmosphereChannel(uHeightFogColor.b,uHeightFogSunRadiance.b,rayleighPhase,miePhase,uHeightFogParams.z));
}
vec3 heightAtmosphereComposite(vec3 source,vec3 ray,float originHeight,float targetHeight){
 float amount=heightAtmosphereScatter(length(ray),originHeight,targetHeight,uHeightFogParams.x,uHeightFogParams.y,uHeightFogWeather);
 if(uHeightFogCapture>.5&&targetHeight<.14)amount=0.;
 return mix(source,heightAtmosphereRadiance(ray),amount);
}
`;

export function patchHeightAtmosphereShader(shader){
 if(!shader.vertexShader.includes('#include <fog_vertex>')||!shader.fragmentShader.includes('#include <fog_fragment>'))return false;
 shader.vertexShader=shader.vertexShader.replace('#include <fog_pars_vertex>','uniform mat4 uHeightFogCameraWorld;varying vec3 vHeightFogWorld;')
  .replace('#include <fog_vertex>','vHeightFogWorld=(uHeightFogCameraWorld*mvPosition).xyz;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <fog_pars_fragment>',`varying vec3 vHeightFogWorld;${heightAtmosphereUniformsGLSL}${heightAtmosphereGLSL}${heightAtmosphereRadianceGLSL}`)
  .replace('#include <fog_fragment>','')
  .replace('#include <tonemapping_fragment>','gl_FragColor.rgb=heightAtmosphereComposite(gl_FragColor.rgb,vHeightFogWorld-cameraPosition,cameraPosition.y,vHeightFogWorld.y);\n#include <tonemapping_fragment>');
 return true;
}

export function createHeightAtmosphere(settings,lighting,camera){
 const params=new Float32Array(3),color=new Float32Array(3),installed=new Map(),callbacks=new WeakSet();let previousColor=null;
 const uniforms={
  uHeightFogParams:{get value(){params[0]=settings.atmosphereHeight;params[1]=settings.atmosphereStrength;params[2]=settings.atmosphereSunStrength;return params;}},
  uHeightFogColor:{get value(){const value=settings.atmosphereColor??DEFAULT_ATMOSPHERE_COLOR;if(previousColor!==value){previousColor=value;color.set(atmosphereColorLinear(value));}return color;}},
  uHeightFogWeather:{value:1},uHeightFogCapture:{value:0},
  uHeightFogSunDirection:lighting.uSunDirection,uHeightFogSunRadiance:lighting.uSunRadiance,
  uHeightFogCameraWorld:{value:camera.matrixWorld}
 };
 return {
  uniforms,
  setWeather(id){uniforms.uHeightFogWeather.value=atmosphereWeatherScale(id)},
  beginCapture(){uniforms.uHeightFogCapture.value=1},endCapture(){uniforms.uHeightFogCapture.value=0},
  install(root){root.traverseVisible(object=>{
   for(const material of [object.material].flat()){
    if(!material||material.isShaderMaterial||material.fog===false||callbacks.has(material.onBeforeCompile))continue;
    const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
    const key=previousKey?.call(material)??'';
    const wrapper=function(shader,renderer){previous?.call(this,shader,renderer);if(patchHeightAtmosphereShader(shader))Object.assign(shader.uniforms,uniforms);};
    const cacheKey=()=>key+'|height-atmosphere-v1';
    callbacks.add(wrapper);installed.set(material,{previous,previousKey,wrapper,cacheKey});
    material.onBeforeCompile=wrapper;material.customProgramCacheKey=cacheKey;material.needsUpdate=true;
   }
  })},
  dispose(){for(const [material,{previous,previousKey,wrapper,cacheKey}] of installed){
   if(material.onBeforeCompile===wrapper)material.onBeforeCompile=previous;
   if(material.customProgramCacheKey===cacheKey)material.customProgramCacheKey=previousKey;
   material.needsUpdate=true;
  }installed.clear();}
 };
}
