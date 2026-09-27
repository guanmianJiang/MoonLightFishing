// Far offshore: both ships sit near the sea horizon in the reed fishing camera.
export const FERRY_ROUTES=[
 {name:'passenger_ferry_a',position:[-52,.10,40],scale:.65,speed:.052,phase:0,range:3,heading:0},
 {name:'passenger_ferry_b',position:[-50,.10,30],scale:.70,speed:.061,phase:Math.PI,range:4,heading:Math.PI}
];
export function gullRoute(random){
 const dir=random()<.5?-1:1,startZ=12+random()*15;
 return {dir,fromX:dir>0?-48:48,startY:7+random()*3,startZ,exitZ:startZ+10+random()*14,dur:30+random()*10,bend:(random()-.5)*12,lift:1.4+random()*1.8,wavePhase:random()*Math.PI*2};
}
