// A tangent-space normal is (-dh/du, -dh/dv, 1) after normalization.
// Return its height derivative so the final world normal reconstructs it.
export const waterNormalsGLSL=`
 float waterNormalSlope(float component,float up){
  return -component/max(up,.38);
 }
`;
