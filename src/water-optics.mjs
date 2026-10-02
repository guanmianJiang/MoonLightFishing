// Scalar GLSL helpers are exercised directly by Node tests, without WebGL.
export const waterOpticsGLSL=`
 float waterOpticalPath(float depth,float airCosine){
  float c=clamp(abs(airCosine),0.,1.);
  float waterCosine=sqrt(1.-.7502*.7502*(1.-c*c));
  return min(24.,max(depth,0.)/waterCosine);
 }
 float waterChannelRadiance(float source,float body,float absorption,float scattering,float viewPath,float sunPath){
  float extinction=max(absorption+scattering,.00001);
  float transmission=exp(-extinction*viewPath);
  // Captured receivers combine direct and ambient light. Attenuate the
  // estimated direct share on the way down; both shares travel back up.
  float illumination=.30+.70*exp(-extinction*sunPath);
  return source*illumination*transmission+body*(scattering/extinction)*(1.-transmission);
 }
 float waterReflectionWeight(float cosine,float base,float power,float strength){
  // Fine normals can tip past the view at the horizon. They are still
  // grazing water, not a hole in the environment reflection.
  float c=clamp(cosine,0.,1.);
  float f0=.0204+.9796*clamp(base,0.,1.);
  float fresnel=f0+(1.-f0)*pow(1.-c,max(power,.001));
  return fresnel*clamp(strength,0.,1.);
 }
 float waterReflectionGain(float strength){
  return clamp(strength,1.,2.);
 }
 float waterReflectionHit(float edge,float height,float error,float travel){
  return smoothstep(.025,.10,edge)*smoothstep(.025,.12,height)
   *(1.-smoothstep(.08+travel*.025,.20+travel*.06,error));
 }
`;
