const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const count=v=>Number.isFinite(v)?clamp(Math.floor(v),0,64):0;

// World-space decoration only: no browser, engine, save or per-frame random state.
export function createSeabedScatter({seed=7241,rockCount=28,shellCount=14,shore,terrainY}={}){
 if(typeof shore!=='function'||typeof terrainY!=='function')throw new TypeError('Seabed samplers required');
 let state=Number.isFinite(seed)?seed>>>0:7241;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const items=[];
 for(const [kind,total] of [['rock',count(rockCount)],['shell',count(shellCount)]]){
  let accepted=0;
  for(let attempt=0;attempt<total*100&&accepted<total;attempt++){
   const x=-16+random()*28,z=shore(x)+3+random()*14;
   const bed=terrainY(x,z),depth=.14-bed;
   const size=kind==='rock'?.16+random()*.22:.15+random()*.10;
   // Keep pier footings and the very shallow wave front clear.
   if(!Number.isFinite(z)||!Number.isFinite(bed)||depth<.30||depth>2.4)continue;
   if(x>-2.8-size&&x<.4+size&&z<1.5+size)continue;
   if(items.some(item=>Math.hypot(item.x-x,item.z-z)<1.1))continue;
   const dx=(terrainY(x+.1,z)-terrainY(x-.1,z))/.2;
   const dz=(terrainY(x,z+.1)-terrainY(x,z-.1))/.2;
   const length=Math.hypot(dx,1,dz);
   if(!Number.isFinite(length))continue;
   items.push({kind,x,y:bed-size*(kind==='rock'?.10:.025),z,size,yaw:random()*Math.PI*2,normal:[-dx/length,1/length,-dz/length]});
   accepted++;
  }
 }
 return items;
}
