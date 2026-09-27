const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale=(v,s)=>({x:v.x*s,y:v.y*s,z:v.z*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const length=v=>Math.hypot(v.x,v.y,v.z);

// Shoulder and hand are the constraints. The elbow chooses the side nearest
// the authored rest pose (pole), while both arm segments keep their lengths.
export function solveTwoBoneIK(shoulder,target,pole,upperLength,lowerLength){
 const direction=subtract(target,shoulder),rawDistance=length(direction);
 const axis=rawDistance>1e-6?scale(direction,1/rawDistance):{x:0,y:0,z:1};
 const minDistance=Math.abs(upperLength-lowerLength)+1e-4;
 const maxDistance=upperLength+lowerLength-1e-4;
 const distance=Math.max(minDistance,Math.min(maxDistance,rawDistance));
 const hand=add(shoulder,scale(axis,distance));
 const poleDirection=subtract(pole,shoulder);
 let bend=subtract(poleDirection,scale(axis,dot(poleDirection,axis)));
 const bendLength=length(bend);
 if(bendLength>1e-6)bend=scale(bend,1/bendLength);
 else{
  const fallback=Math.abs(axis.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0};
  const sideways=subtract(fallback,scale(axis,dot(fallback,axis)));
  bend=scale(sideways,1/length(sideways));
 }
 const along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
 const height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
 const elbow=add(add(shoulder,scale(axis,along)),scale(bend,height));
 return {elbow,hand,limited:Math.abs(rawDistance-distance)>1e-3};
}
