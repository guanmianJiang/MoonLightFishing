// A distance-scaled ballistic arc. The horizontal motion stays linear so the
// float keeps its momentum through the apex and arrives at the chosen point.
export const CAST_RELEASE_TIME=.78;

export function castLineProfile(progress,distance){
 const u=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
 const effort=Math.max(0,Math.min(1,((Number.isFinite(distance)?distance:2.5)-2.5)/10));
 const release=Math.max(0,1-u/.18);
 const payout=Math.sin(Math.PI*u);
 return {slack:1.01+payout*(.025+.018*effort),extra:.055+payout*(.08+.12*effort)+release*.025};
}

export function castFlight(age,origin,target){
 const dx=target.x-origin.x,dz=target.z-origin.z;
 const distance=Math.hypot(dx,dz);
 const duration=Math.max(.62,Math.min(1.05,.48+distance*.047));
 const u=Math.max(0,Math.min(1,(age-CAST_RELEASE_TIME)/duration));
 const height=Math.max(.60,Math.min(1.85,.38+distance*.105));
 const x=origin.x+dx*u,z=origin.z+dz*u;
 const y=origin.y+(target.y-origin.y)*u+4*height*u*(1-u);
 const velocity={x:dx/duration,y:(target.y-origin.y+4*height*(1-2*u))/duration,z:dz/duration};
 return {u,duration,distance,height,position:{x,y,z},velocity,landed:u>=1};
}
