// World-space shoreline coverage and refraction budgets, shared with regression tests.
export const waterContactGLSL = `
float waterContactCoverage(float distance,float footprint){
 float aa=max(footprint,.005);
 return smoothstep(-aa,aa,distance);
}
float waterContactRefractionLimit(float width,float strength){
 return clamp(width,0.,1.2)*.125*clamp(strength,0.,1.);
}
`;
