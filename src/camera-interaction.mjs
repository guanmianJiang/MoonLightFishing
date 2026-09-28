export function cameraStage(state,phase){
 if(state.overview)return 'overview';
 if(state.aiming&&!state.pending)return 'aim';
 if(state.revealing)return 'landing';
 if(state.pending?.fight?.status==='active')return 'fight';
 if(phase==='casting')return 'casting';
 if(['reading','responding','nibble','hooked'].includes(phase))return 'bite';
 if(state.pending)return 'waiting';
 return 'survey';
}

export function castNeedsAimCamera(overview){
 return !overview;
}

export function readyWaterGesture(pointerCount,travelPx){
 if(pointerCount>=2)return 'pinch';
 return pointerCount===1&&Number.isFinite(travelPx)&&travelPx>7?'select':'wait';
}

export function visibleCastRanges(state,spotIds){
 if(!state||state.pending||!Array.isArray(spotIds))return [];
 if(state.overview||!state.keepFishingView&&!state.aiming)return [...spotIds];
 return spotIds.includes(state.spot)?[state.spot]:[];
}

export function viewTransitionWeight(age,duration){
 if(!Number.isFinite(age)||!Number.isFinite(duration)||duration<=0)return 1;
 const t=Math.max(0,Math.min(1,age/duration));
 return t*t*t*(t*(t*6-15)+10);
}

export function portraitCloseFraming(rangeBlend,aiming){
 const t=Math.max(0,Math.min(1,rangeBlend));
 return {
  side:(aiming?2.1:1.9)-t*.5,
  aimMix:(aiming?.23:.17)+t*(aiming?.19:.13)
 };
}

export function cameraSettled(position,aim,targetPosition,targetAim,blend){
 return blend>.975&&position.distanceTo(targetPosition)<.9&&aim.distanceTo(targetAim)<.45;
}

export function cameraImpulse(age,duration){
 if(!Number.isFinite(age)||!Number.isFinite(duration)||age<=0||age>=duration||duration<=0)return 0;
 return Math.sin(Math.PI*age/duration);
}
