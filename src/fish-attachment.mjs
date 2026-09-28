import {Vector3} from './three.module.js';
const anchorOffset=new Vector3();

export function assetAnchorLocal(model,name){
 const anchor=model.getObjectByName(name);
 if(!anchor)return null;
 model.updateWorldMatrix(true,true);
 const point=model.worldToLocal(anchor.getWorldPosition(new Vector3()));
 return point.toArray().every(Number.isFinite)?point:null;
}

// The target is expressed in the model parent's coordinates.
export function alignAssetAnchorLocal(model,anchorLocal,target){
 if(!anchorLocal)return false;
 model.position.copy(target).sub(anchorOffset.copy(anchorLocal).multiply(model.scale).applyQuaternion(model.quaternion));
 return true;
}

export function mountBaitAtAnchor(model,parent,anchorLocal,target){
 if(!model||!parent||!anchorLocal)return false;
 if(model.parent!==parent)parent.add(model);
 return alignAssetAnchorLocal(model,anchorLocal,target);
}

export function fishMouthWorld(fish){
 fish.updateMatrixWorld(true);
 return (fish.userData.mouthLocal||new Vector3(fish.userData.mouthX??-.94,-.035,0)).clone().applyMatrix4(fish.matrixWorld);
}

export function alignFloatOverMouth(float,fish){
 const mouth=fishMouthWorld(fish);
 float.position.x=mouth.x;float.position.z=mouth.z;
 return mouth;
}

export function alignFishMouth(fish,hookPoint){
 fish.position.add(hookPoint.clone().sub(fishMouthWorld(fish)));
 fish.updateMatrixWorld(true);
}

export function alignFishMouthHorizontal(fish,hookPoint){
 const mouth=fishMouthWorld(fish);
 fish.position.x+=hookPoint.x-mouth.x;
 fish.position.z+=hookPoint.z-mouth.z;
 fish.updateMatrixWorld(true);
}

export function attachHookToMouth(fish,hook){
 const mouth=fishMouthWorld(fish);
 hook.position.copy(mouth);
 hook.updateMatrixWorld(true);
 return mouth;
}
