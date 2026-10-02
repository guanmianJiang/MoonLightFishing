import {shore} from './coast.js';

// One reachable patch of water per location. The lanes run away from the angler.
export const CAST_AREAS={reed:[-2,5],bridge:[5,8.5],deep:[0,14.6]};
export const CAST_RADIUS=3.9;
const WATER_MARGIN=.2;
const TARGET_RADIUS=CAST_RADIUS-.12;
const ANGLER=[-1.2,.35];
export const CAST_ZONES={
 near:{name:'近岸',hint:'等待稍短 · 小鱼偏多'},
 middle:{name:'中段',hint:'鱼情均衡'},
 far:{name:'远水',hint:'等待稍久 · 大鱼偏多'}
};

function direction(spot){const center=CAST_AREAS[spot],dx=center[0]-ANGLER[0],dz=center[1]-ANGLER[1],length=Math.hypot(dx,dz);return [dx/length,dz/length]}
export function castZone(spot,point){
 const center=CAST_AREAS[spot];
 if(!center||!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))return null;
 const dx=point[0]-center[0],dz=point[1]-center[1];
 if(Math.hypot(dx,dz)>CAST_RADIUS+.001)return null;
 const forward=direction(spot),along=dx*forward[0]+dz*forward[1];
 return along<-.95?'near':along>.95?'far':'middle';
}
export function castPreset(spot,zone='middle'){
 const center=CAST_AREAS[spot];if(!center||!CAST_ZONES[zone])return null;
 const forward=direction(spot),offset=zone==='near'?-1.9:zone==='far'?1.9:0;
 return [+(center[0]+forward[0]*offset).toFixed(3),+(center[1]+forward[1]*offset).toFixed(3)];
}

// Touch-sized shortcuts share the same reachable points as water aiming.
export function castAimChoices(spot,point){
 if(!CAST_AREAS[spot])return {active:null,choices:[]};
 const selected=Array.isArray(point)?castPointFromWorld(spot,point[0],point[1]):null;
 return {
  active:castZone(spot,selected||castPreset(spot)),
  choices:Object.entries(CAST_ZONES).map(([id,copy])=>({id,name:copy.name,hint:copy.hint,point:spot==='reed'&&id==='near'?openingCastPoint():castPreset(spot,id)})).filter(choice=>castPointFromWorld(spot,...choice.point))
 };
}

export function openingCastPoint(){
 const near=castPreset('reed','near');
 const point=[+(near[0]+1.2).toFixed(3),+(near[1]+.2).toFixed(3)];
 return castPointFromWorld('reed',...point)?point:near;
}

export function castPointFromWorld(spot,x,z){
 const point=[x,z];
 return castZone(spot,point)&&z>shore(x)+WATER_MARGIN?point:null;
}

// The rendered boundary uses the same reach and shoreline as touch validation.
export function castFootprint(spot,segments=64){
 const center=CAST_AREAS[spot];
 if(!center||!Number.isInteger(segments)||segments<16||segments>256||!castPointFromWorld(spot,...center))return null;
 return Array.from({length:segments},(_,index)=>{
  const angle=index*2*Math.PI/segments,dx=Math.cos(angle),dz=Math.sin(angle);
  const at=distance=>[center[0]+dx*distance,center[1]+dz*distance];
  let low=0,high=CAST_RADIUS;
  for(let step=1;step<=24;step++){
   const distance=CAST_RADIUS*step/24;
   if(!castPointFromWorld(spot,...at(distance))){high=distance;break}
   low=distance;
  }
  if(low===CAST_RADIUS)return at(CAST_RADIUS);
  for(let iteration=0;iteration<12;iteration++){
   const middle=(low+high)/2;
   if(castPointFromWorld(spot,...at(middle)))low=middle;
   else high=middle;
  }
  return at(low);
 });
}

// Project a water touch onto the reachable patch instead of discarding distant water.
export function castPointFromWaterTouch(spot,x,z){
 const center=CAST_AREAS[spot];
 if(!center||!Number.isFinite(x)||!Number.isFinite(z)||z<=shore(x)+.2)return null;
 const dx=x-center[0],dz=z-center[1],length=Math.hypot(dx,dz);
 let scale=length>TARGET_RADIUS?TARGET_RADIUS/length:1;
 for(let i=0;i<10;i++){
  const point=[center[0]+dx*scale,center[1]+dz*scale];
  if(castPointFromWorld(spot,...point))return point;
  scale*=.72;
 }
 return castPointFromWorld(spot,...center)?[...center]:null;
}

// A drag moves the existing target by the finger's world-space delta. The
// touched water can be elsewhere, keeping the reticle out from under a thumb.
export function castAimDragPoint(spot,selected,startWater,currentWater){
 if(!Array.isArray(selected)||!castPointFromWorld(spot,...selected))return null;
 for(const touch of [startWater,currentWater])if(!Array.isArray(touch)||touch.length!==2||!touch.every(Number.isFinite)||touch[1]<=shore(touch[0])+WATER_MARGIN)return null;
 let dx=currentWater[0]-startWater[0],dz=currentWater[1]-startWater[1];
 const length=Math.hypot(dx,dz),scale=length>CAST_RADIUS*1.25?CAST_RADIUS*1.25/length:1;
 dx*=scale;dz*=scale;
 return castPointFromWaterTouch(spot,selected[0]+dx,selected[1]+dz);
}

export function readyWaterTarget(state,x,z){
 if(!state||state.pending||state.aiming||state.overview||!state.keepFishingView)return null;
 return castPointFromWorld(state.spot,x,z);
}

export function confirmedCastPoint(spot,aiming,point){
 if(!aiming)return null;
 const valid=Array.isArray(point)?castPointFromWorld(spot,point[0],point[1]):null;
 return valid||castPreset(spot);
}
