// Height and its world-space gradient are evaluated by both shader stages.
// Keep the shore envelope in the derivative: fading only the normal flattens
// the highlight before the visible wave has actually flattened.
export const waterSurfaceGLSL = `
float smoothDerivative(float a,float b,float x){
 float q=clamp((x-a)/(b-a),0.,1.);return 6.*q*(1.-q)/(b-a);
}
vec3 waveSample(vec2 p,vec2 k,float speed,float phase,float amplitude,float t){
 float a=dot(p,k)-t*speed+phase;
 return vec3(k*cos(a)*amplitude,sin(a)*amplitude);
}
vec3 waterSurface(vec2 p,float t){
 float d=p.y-shore(p.x),r=length(p);
 vec2 dg=vec2(-shoreSlope(p.x),1.);
 float coast=smoothstep(-.12,2.5,d),farFade=1.-smoothstep(55.,150.,r);
 vec2 envelopeGradient=dg*smoothDerivative(-.12,2.5,d)*farFade
  -coast*smoothDerivative(55.,150.,r)*p/max(r,.001);
 vec3 w=waveSample(p,vec2(.31,.14),.48,0.,.078,t)
  +waveSample(p,vec2(-.19,.37),.61,1.7,.040,t)
  +waveSample(p,vec2(.63,-.41),.86,4.1,.018,t)
  +waveSample(p,vec2(1.12,-.72),1.08,2.4,.008,t);
 w.xy=(w.xy*coast*farFade+w.z*envelopeGradient)*.7;
 w.z*=coast*farFade*.7;
 float a=d*1.45+t*.72+p.x*.07;
 float enter=smoothstep(.4,2.5,d),leave=1.-smoothstep(5.,12.,d);
 float e=enter*leave;
 float de=smoothDerivative(.4,2.5,d)*leave-enter*smoothDerivative(5.,12.,d);
 w.xy+=.014*(cos(a)*(dg*1.45+vec2(.07,0.))*e+sin(a)*dg*de);
 w.z+=.014*sin(a)*e;
 // Differentiate the shared surge, including its offshore envelope.
 float h=.025;
 w.xy+=vec2(shoreWaterHeight(p+vec2(h,0.),t)-shoreWaterHeight(p-vec2(h,0.),t),
             shoreWaterHeight(p+vec2(0.,h),t)-shoreWaterHeight(p-vec2(0.,h),t))/(2.*h);
 w.z+=shoreWaterHeight(p,t);
 return w;
}`;
