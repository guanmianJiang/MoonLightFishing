import {canSwipePump} from './fight-guidance.mjs';

const SWIPE_DISTANCE=42;
const RETURN_DISTANCE=12;

export function startReelGesture(pointerId,startY){
 if(!Number.isFinite(startY))return null;
 return {pointerId,startY,lifted:false,progress:0};
}

export function moveReelGesture(gesture,f,currentY){
 if(!gesture||!Number.isFinite(currentY))return {gesture,action:'none'};
 if(gesture.lifted){
  if(currentY>=gesture.startY-RETURN_DISTANCE)return {gesture:{...gesture,startY:currentY,lifted:false,progress:0},action:'reel'};
  return {gesture,action:'none'};
 }
 const progress=Math.max(0,Math.min(1,(gesture.startY-currentY)/SWIPE_DISTANCE));
 if(canSwipePump(f,gesture.startY,currentY))return {gesture:{...gesture,lifted:true,progress:1},action:'lift'};
 return {gesture:{...gesture,progress},action:'none'};
}
