import {Vector3} from './three.module.js';

export function fishMouthWorld(fish){
 fish.updateMatrixWorld(true);
 return (fish.userData.mouthLocal||new Vector3(fish.userData.mouthX??-.94,-.035,0)).clone().applyMatrix4(fish.matrixWorld);
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
