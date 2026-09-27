const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// The hooked fish moves along the cast line. Its lateral dodge is perpendicular
// to that line, so every fishing spot pulls toward the angler correctly.
export function fightFishMotion(f,angler,spot,time){
 const dx=spot.x-angler.x,dz=spot.z-angler.z,span=Math.hypot(dx,dz)||1;
 const outward={x:dx/span,z:dz/span},side={x:-dz/span,z:dx/span};
 const distance=clamp((f?.distance||0)/Math.max(.1,f?.startDistance||1),.15,1.35);
 const progress=clamp(f?.progress||0,0,1),surge=clamp(f?.surge||0,0,1);
 const lift=clamp(f?.pumpPulse||0,0,1),load=clamp(f?.load||0,0,1.5);
 const dodge=((f?.fishPosition??.5)-.5)*1.4;
 const depth=.58-progress*.34+surge*.14-lift*.48*(.35+progress*.65);
 const position={x:angler.x+dx*distance+side.x*dodge,y:-depth,z:angler.z+dz*distance+side.z*dodge};
 const dodgeVelocity=clamp((f?.fishVelocity||0)*.20,-.55,.55);
 // Face the direction of travel. During a pull the head stays toward shore;
 // a real outward run turns it back toward open water.
 const travel=(f?.radialVelocity||0)>.16?1:-1;
 const heading={x:outward.x*travel+side.x*dodgeVelocity,z:outward.z*travel+side.z*dodgeVelocity};
 const struggle=clamp(surge*.7+load*.40+Math.abs(f?.fishVelocity||0)*.1,0,1);
 const surface=clamp((position.y+.32)/.42,0,1);
 const tail=Math.sin(time*(13+surge*11)+(f?.seed||0))*(.20+struggle*.46);
 const roll=Math.sin(time*(8+surge*7)+(f?.seed||0))*(.04+struggle*(.18+surface*.28));
 // Local -X is the head. Negative Z rotation raises that head toward the line.
 const pitch=-lift*.23-Math.max(0,-(f?.radialVelocity||0))*.065+surge*.08+Math.sin(time*12+(f?.seed||0))*surface*struggle*.16;
 return {position,heading,depth,struggle,tail,roll,pitch};
}
