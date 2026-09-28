const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Small suspended-bait follower. The float owns the anchor; only the short
// leader below it lags, so a cast or fish run cannot detach the bait.
export class BaitMotion{
 constructor(){this.reset()}
 reset(){this.previous=null;this.x=0;this.z=0;this.vx=0;this.vz=0;return {x:0,z:0}}
 update(position,dt,load=0){
  if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z))return {x:this.x,z:this.z};
  if(!this.previous){this.previous={x:position.x,z:position.z};return {x:this.x,z:this.z}}
  const h=Number.isFinite(dt)?clamp(dt,0,.05):0;
  if(h===0)return {x:this.x,z:this.z};
  const taut=clamp(Number.isFinite(load)?load:0,0,1);
  const targetX=clamp(-(position.x-this.previous.x)/h*.018,-.12,.12)*(1-taut*.7);
  const targetZ=clamp(-(position.z-this.previous.z)/h*.018,-.12,.12)*(1-taut*.7);
  this.previous={x:position.x,z:position.z};
  const stiffness=34+taut*22,damping=9+taut*5;
  this.vx+=(targetX-this.x)*stiffness*h;this.vz+=(targetZ-this.z)*stiffness*h;
  this.vx*=Math.exp(-damping*h);this.vz*=Math.exp(-damping*h);
  this.x=clamp(this.x+this.vx*h,-.13,.13);this.z=clamp(this.z+this.vz*h,-.13,.13);
  return {x:this.x,z:this.z};
 }
}
