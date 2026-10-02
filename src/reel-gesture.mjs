import {canSwipePump} from './fight-guidance.mjs';

const SWIPE_DISTANCE=42;
const RETURN_DISTANCE=12;
const HORIZONTAL_TOLERANCE=30;
const PAYOUT_DISTANCE=24;
const PAYOUT_RETURN_DISTANCE=10;

export function verticalLiftProgress(startX,startY,currentX,currentY,range=SWIPE_DISTANCE){
 if(![startX,startY,currentX,currentY,range].every(Number.isFinite)||range<=0||Math.abs(currentX-startX)>HORIZONTAL_TOLERANCE)return 0;
 return Math.max(0,Math.min(1,(startY-currentY)/range));
}

export function controlOrigin(rect){
 const width=Number.isFinite(rect?.width)&&rect.width>0?rect.width:108;
 const height=Number.isFinite(rect?.height)&&rect.height>0?rect.height:108;
 return {x:width/2,y:height/2};
}

export function joystickVisual(startX,startY,currentX,currentY,anchorX,anchorY,gameBounds,viewportBounds){
 const values=[startX,startY,currentX,currentY,anchorX,anchorY];
 if(!values.every(Number.isFinite))return {active:false,angle:0,scale:1,dx:0,dy:0};
 const dx=currentX-startX,dy=currentY-startY,distance=Math.hypot(dx,dy);
 if(distance<=10)return {active:false,angle:0,scale:1,dx,dy};
 const left=Math.max(gameBounds?.left??0,viewportBounds?.left??0)+8;
 const right=Math.min(gameBounds?.right??0,viewportBounds?.right??0)-8;
 const top=Math.max(gameBounds?.top??0,viewportBounds?.top??0)+8;
 const bottom=Math.min(gameBounds?.bottom??0,viewportBounds?.bottom??0)-8;
 if(![left,right,top,bottom].every(Number.isFinite)||left>=right||top>=bottom||anchorX<left||anchorX>right||anchorY<top||anchorY>bottom)return {active:false,angle:0,scale:1,dx,dy};
 const ux=dx/distance,uy=dy/distance;
 const lateralX=Math.abs(uy)*44,lateralY=Math.abs(ux)*44;
 const roomX=Math.abs(ux)<1e-6?Infinity:(ux>0?right-anchorX-lateralX:anchorX-left-lateralX)/Math.abs(ux);
 const roomY=Math.abs(uy)<1e-6?Infinity:(uy>0?bottom-anchorY-lateralY:anchorY-top-lateralY)/Math.abs(uy);
 const scale=Math.min(3,1+distance/75,1+(roomX-44)/21,1+(roomY-44)/21);
 if(scale<1)return {active:false,angle:0,scale:1,dx,dy};
 return {active:true,angle:Math.atan2(-dy,dx)*180/Math.PI,scale,dx,dy};
}

export function joystickReleaseFrames(scale){
 const current=Number.isFinite(scale)?Math.max(1,Math.min(3,scale)):1;
 return [{scale:current,offset:0},{scale:1+(1-current)*.307,offset:.57},{scale:1,offset:1}];
}

export function gestureRodInput(startX,startY,currentX,currentY,load=0){
 if(![startX,startY,currentX,currentY].every(Number.isFinite))return {side:0,lift:0,lower:0,force:0};
 const side=Math.max(-1,Math.min(1,(currentX-startX)/90));
 const vertical=Math.max(-1,Math.min(1,(startY-currentY)/90));
 const resistance=1-.35*Math.max(0,Math.min(1,Number.isFinite(load)?load:0));
 return {side,lift:Math.max(0,vertical)*resistance,lower:Math.max(0,-vertical),force:Math.min(1,Math.hypot(side,vertical))};
}

export function startReelGesture(pointerId,startY,startX=0){
 if(!Number.isFinite(startY)||!Number.isFinite(startX))return null;
 return {pointerId,startX,startY,currentX:startX,currentY:startY,lifted:false,paying:false,progress:0};
}

export function moveReelGesture(gesture,f,currentY,currentX=gesture?.startX){
 if(!gesture||!Number.isFinite(currentY)||!Number.isFinite(currentX))return {gesture,action:'none'};
 gesture={...gesture,currentX,currentY};
 const lane=Math.abs(currentX-gesture.startX)<=HORIZONTAL_TOLERANCE;
 const down=lane?Math.max(0,currentY-gesture.startY):0;
 if(gesture.lifted){
  if(lane&&currentY>=gesture.startY-RETURN_DISTANCE){
   if(down>=PAYOUT_DISTANCE)return {gesture:{...gesture,lifted:false,paying:true,progress:0},action:'payout'};
   return {gesture:{...gesture,lifted:false,progress:0},action:'reel'};
  }
  return {gesture,action:'none'};
 }
 if(gesture.paying){
  if(lane&&currentY<=gesture.startY+PAYOUT_RETURN_DISTANCE)return {gesture:{...gesture,paying:false,progress:0},action:'reel'};
  return {gesture,action:'none'};
 }
 if(down>=PAYOUT_DISTANCE)return {gesture:{...gesture,paying:true,progress:0},action:'payout'};
 const progress=verticalLiftProgress(gesture.startX,gesture.startY,currentX,currentY);
 if(progress===1&&canSwipePump(f,gesture.startY,currentY))return {gesture:{...gesture,lifted:true,progress:1},action:'lift'};
 return {gesture:{...gesture,progress},action:'none'};
}
