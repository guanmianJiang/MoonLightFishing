import {renderSettings as settings} from './render-settings.js';
import * as T from './three.module.js';

// All intermediate passes remain linear HDR; tone map only the final composite.
export function createComposer(renderer,scene,camera){
 const hdr=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});hdr.samples=Math.min(4,renderer.capabilities.maxSamples);
 const bloom=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 const scratch=bloom.clone();
 const screen=new T.Scene(),screenCamera=new T.Camera();
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const bright=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
  uniforms:{source:{value:hdr.texture},pixel:{value:new T.Vector2()},threshold:{value:settings.bloomThreshold}},
  fragmentShader:`varying vec2 vUv;uniform sampler2D source;uniform vec2 pixel;uniform float threshold;
  vec3 extractLight(vec2 uv){vec3 c=texture2D(source,uv).rgb;float l=max(c.r,max(c.g,c.b));return c*max(l-threshold,0.)/max(l,.0001);}
  void main(){vec3 c=vec3(0.);for(int y=0;y<2;y++)for(int x=0;x<2;x++)c+=extractLight(vUv+(vec2(float(x),float(y))-.5)*pixel);gl_FragColor=vec4(c*.25,1.);}`});
 const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
  uniforms:{source:{value:bloom.texture},direction:{value:new T.Vector2()}},
  fragmentShader:`varying vec2 vUv;uniform sampler2D source;uniform vec2 direction;
  void main(){vec3 c=vec3(0.);float total=0.;for(int i=-8;i<=8;i++){float x=float(i)/8.;float w=exp(-4.5*x*x);c+=texture2D(source,vUv+direction*x).rgb*w;total+=w;}gl_FragColor=vec4(c/total,1.);}`});
 const output=new T.ShaderMaterial({depthTest:false,depthWrite:false,vertexShader,
  uniforms:{source:{value:hdr.texture},bloom:{value:bloom.texture},strength:{value:settings.bloomStrength},bloomOnly:{value:settings.bloomOnly}},
  fragmentShader:`varying vec2 vUv;uniform sampler2D source,bloom;uniform float strength;uniform bool bloomOnly;
  void main(){vec3 base=bloomOnly?vec3(0.):texture2D(source,vUv).rgb;gl_FragColor=vec4(base+texture2D(bloom,vUv).rgb*strength,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),output);quad.frustumCulled=false;screen.add(quad);
 let width=1,height=1,weatherScale=1;
 function pass(material,target){quad.material=material;renderer.setRenderTarget(target);renderer.render(screen,screenCamera);}
 const composer={
  render(){const target=renderer.getRenderTarget(),tone=renderer.toneMapping;try{
   bright.uniforms.threshold.value=settings.bloomThreshold;output.uniforms.strength.value=settings.bloomStrength*weatherScale;output.uniforms.bloomOnly.value=settings.bloomOnly;
   renderer.toneMapping=T.NoToneMapping;renderer.setRenderTarget(hdr);renderer.render(scene,camera);
   if(output.uniforms.strength.value>0){
    pass(bright,bloom);
    blur.uniforms.source.value=bloom.texture;blur.uniforms.direction.value.set(settings.bloomRadius/width,0);pass(blur,scratch);
    blur.uniforms.source.value=scratch.texture;blur.uniforms.direction.value.set(0,settings.bloomRadius/height);pass(blur,bloom);
   }
   renderer.toneMapping=tone;pass(output,target);
  }finally{renderer.toneMapping=tone;renderer.setRenderTarget(target);}},
  dispose(){hdr.dispose();bloom.dispose();scratch.dispose();bright.dispose();blur.dispose();output.dispose();quad.geometry.dispose();}
 };
 return {composer,
  resize(w,h){width=Math.max(1,w);height=Math.max(1,h);const d=renderer.getPixelRatio();hdr.setSize(Math.max(1,Math.floor(w*d)),Math.max(1,Math.floor(h*d)));bloom.setSize(Math.max(1,Math.ceil(hdr.width/2)),Math.max(1,Math.ceil(hdr.height/2)));scratch.setSize(bloom.width,bloom.height);bright.uniforms.pixel.value.set(1/hdr.width,1/hdr.height);},
  setExposure(value){renderer.toneMappingExposure=value;},
  setBloom(value){settings.bloomStrength=value;},
  setWeather(id){weatherScale=id==='rain'?.57:id==='mist'?.76:1;},
  dispose(){composer.dispose();}
 };
}
