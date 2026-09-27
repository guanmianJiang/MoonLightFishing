import {shore} from './coast.js';

// One reachable patch of water per location. The lanes run away from the angler.
export const CAST_AREAS={reed:[-2,5],bridge:[5,8.5],deep:[0,14.6]};
export const CAST_RADIUS=3.9;
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

// A drag on the cast control moves the marker in screen space. The camera never
// has to raycast a finger that started over the bottom HUD.
export function castPointFromDrag(spot,dx,dy,viewportWidth,viewportHeight){
 const center=CAST_AREAS[spot];if(!center)return null;
 const forward=direction(spot),right=[forward[1],-forward[0]];
 const lateral=Math.max(-2.5,Math.min(2.5,dx/Math.max(80,viewportWidth*.24)*2.5));
 const distance=Math.max(-2.7,Math.min(2.7,-dy/(dy>0?Math.max(34,viewportHeight*.055):Math.max(90,viewportHeight*.13))*2.7));
 let radius=Math.hypot(lateral,distance),scale=radius>3.35?3.35/radius:1;
 for(let i=0;i<8;i++){
  const point=[center[0]+(right[0]*lateral+forward[0]*distance)*scale,center[1]+(right[1]*lateral+forward[1]*distance)*scale];
  if(point[1]>shore(point[0])+.2&&castZone(spot,point))return point;
  scale*=.75;
 }
 return [...center];
}
