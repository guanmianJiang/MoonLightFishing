const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

// Find a second handhold on the same shaft while respecting the other arm's
// reach. The primary hand remains the fixed butt anchor after IK limiting.
export function supportGripTarget(primary,shoulder,axis,maxReach,preferred=-.15){
 let best=null,bestScore=Infinity;
 for(let i=0;i<=36;i++){
  const along=-.24+i*.0125;
  const point={x:primary.x+axis.x*along,y:primary.y+axis.y*along,z:primary.z+axis.z*along};
  const reach=distance(point,shoulder);
  const score=Math.abs(along-preferred)+(reach>maxReach?10+(reach-maxReach)*100:0);
  if(score<bestScore){best=point;bestScore=score}
 }
 return best;
}
