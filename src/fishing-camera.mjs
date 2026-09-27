// Camera targets for the fight and landing shots. In a wide frame the fight
// camera sits beside the line between angler and fish, at roughly eye level.
export function cameraTransitionBlend(current,active,dt){
 const target=active?1:0,rate=active?3.1:2.3;
 return current+(target-current)*(1-Math.exp(-Math.max(0,dt)*rate));
}

export function fightCameraFov(span,portrait){
 const t=Math.max(0,Math.min(1,(span-2.5)/6.5));
 const ease=t*t*(3-2*t);
 return (portrait?46:39)+(portrait?9:7)*ease;
}

export function fightCameraPose(angler,fish,forward,right,portrait){
 const span=Math.hypot(fish.x-angler.x,fish.z-angler.z);
 const aim=angler.clone().lerp(fish,portrait?.72:.50);
 aim.y=portrait?.34:.50;
 const near=Math.max(0,Math.min(1,(span-1.7)/1.8));
 const nearEase=near*near*(3-2*near);
 // As the fish reaches the dock, move its image clear of the left fight panel.
 if(!portrait)aim.addScaledVector(forward,.75*(1-nearEase));
 // Portrait play reads from behind the angler: the rod leads toward the fish.
 const position=portrait
  ?angler.clone().addScaledVector(forward,-3.4).addScaledVector(right,.95)
  :angler.clone().addScaledVector(forward,span*.58).addScaledVector(right,Math.hypot(5,span*1.45));
 position.y=portrait?2.35:1.75;
 return {position,aim};
}

// Reel-in begins near the hook. A distant target may leave the angler outside
// the frame briefly; the fish stays legible instead of shrinking both subjects.
export function reelCameraPose(angler,fish,forward,right,portrait){
 const aim=fish.clone();
 aim.y=Math.max(.15,fish.y+.10);
 const position=aim.clone()
  .addScaledVector(forward,portrait?2.45:-.45)
  .addScaledVector(right,portrait?2.0:3.45);
 position.y=aim.y+(portrait?1.1:1.05);
 return {position,aim};
}

export function lureFocusEnvelope(age){
 const smooth=(from,to)=>{const u=Math.max(0,Math.min(1,(age-from)/(to-from)));return u*u*(3-2*u)};
 return smooth(0,.48)*(1-smooth(1.25,3.25));
}

// Move along the player's line of sight for a brief water-level bite close-up.
export function lureCameraPose(bobber,forward,right,portrait){
 const aim=bobber.clone();aim.y=.18;
 const position=aim.clone()
  .addScaledVector(forward,portrait?-2.55:-3.0)
  .addScaledVector(right,portrait?.72:1.15);
 position.y=portrait?1.25:1.12;
 return {position,aim};
}

export function landedFishCameraPose(angler,fishBody,forward,right,portrait){
 const aim=fishBody.clone().lerp(angler,.08);
 aim.y=fishBody.y+.05;
 const position=aim.clone()
  .addScaledVector(forward,portrait?3.2:1.0)
  .addScaledVector(right,portrait?1.55:3.2);
 position.y=aim.y+.82;
 return {position,aim};
}
