const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

const smooth=(age,from,to)=>{const u=clamp((age-from)/(to-from),0,1);return u*u*(3-2*u)};

// One loaded heave drives the fish, angler, rod, and line. A short rebound
// follows the pull without restarting the landing motion.
export function landingDynamics(age,weight=1){
 const effort=.45+.55*clamp((weight-.4)/2.8,0,1);
 const lift=smooth(age,.16,1.48);
 const strain=Math.sin(Math.PI*clamp((age-.06)/1.48,0,1))*.95*effort;
 const reboundAge=Math.max(0,age-.82);
 const recoil=age>.82?Math.sin(reboundAge*17)*Math.exp(-reboundAge*3.1)*(1-smooth(age,1.7,2.3))*effort:0;
 return {lift,strain,recoil,effort};
}

export function landingPose(origin,target,age,weight=1){
 const motion=landingDynamics(age,weight),progress=clamp(motion.lift-motion.recoil*.10,0,1);
 return {x:origin.x+(target.x-origin.x)*progress,y:origin.y+(target.y-origin.y)*progress,z:origin.z+(target.z-origin.z)*progress,progress};
}

export function landingFishPose(age,mouthHeight,weight,time,horizontal){
 const effort=landingDynamics(age,weight).effort;
 const airborne=smooth(mouthHeight,.12,.85)*smooth(age,.18,.72);
 const struggle=Math.sin(time*23+age*5)*Math.exp(-Math.max(0,age-.35)*1.2)*effort;
 const side=Math.sin(time*15+age*3)*airborne*.12*effort;
 const horizontalWeight=1-airborne*.82;
 const x=horizontal.x*horizontalWeight-horizontal.z*side;
 const z=horizontal.z*horizontalWeight+horizontal.x*side;
 const y=airborne*1.35+Math.max(0,struggle)*airborne*.08;
 const length=Math.hypot(x,y,z)||1;
 return {direction:{x:x/length,y:y/length,z:z/length},airborne,struggle,tail:Math.sin(time*29+age*7)*(.24+airborne*.48)*effort};
}
