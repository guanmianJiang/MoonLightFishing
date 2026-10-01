// All optical thickness comes from the accepted scene-depth receiver.
export const waterCapturedDepthGLSL = `
float waterLinearEyeDepth(float raw,float nearPlane,float farPlane){
 return nearPlane*farPlane/(farPlane-raw*(farPlane-nearPlane));
}
float waterCapturedReceiverValid(float raw,float receiverEye,float surfaceEye,float verticalGap,float nearPlane,float farPlane){
 // Two 24-bit depth steps converted to eye-space units, plus a rounding floor.
 float epsilon=max(.0001,surfaceEye*surfaceEye*(farPlane-nearPlane)/(nearPlane*farPlane)*.00000012);
 return raw>=0.&&raw<1.&&surfaceEye>0.&&receiverEye>=surfaceEye-epsilon&&verticalGap>=-epsilon?1.:0.;
}
float waterCapturedColumn(float surfaceY,float receiverY,float valid){
 return valid>.5?clamp(surfaceY-receiverY,0.,24.):24.;
}
float waterDepthRefractionGate(float depth){
 return smoothstep(.005,.30,max(depth,0.))*exp(-max(depth,0.)*.045);
}
`;
