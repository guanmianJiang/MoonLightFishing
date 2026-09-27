const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// A compact drawing of the same distance, line slack and rod load used by the fight physics.
export function fightRigGeometry(f){
 const distance=Number.isFinite(f.distance)?f.distance:9;
 const start=Number.isFinite(f.startDistance)?f.startDistance:9;
 const load=clamp(Number.isFinite(f.load)?f.load:f.tension||0,0,1.4);
 const slack=clamp(f.slack||0,0,1.5),lift=clamp(f.pumpPulse||0,0,1);
 const x=clamp(111+(distance-1.8)/(start+3.5-1.8)*268,104,379);
 const movement=f.radialVelocity<-.14?'in':f.radialVelocity>.16?'out':'steady';
 const y=clamp(104+(f.fishPosition-.5)*22+(f.surge||0)*5,94,118);
 const tipY=clamp(47+load*24-lift*25,26,82);
 const midX=(84+x)/2;
 const sag=slack>.08?clamp(slack*34,0,43):0;
 const rod=`M33 111 Q${(59+load*12).toFixed(1)} ${(73+load*17-lift*7).toFixed(1)} 84 ${tipY.toFixed(1)}`;
 const mouthX=x+(movement==='out'?14:-14);
 const line=`M84 ${tipY.toFixed(1)} Q${midX.toFixed(1)} ${((tipY+y)/2+sag).toFixed(1)} ${mouthX.toFixed(1)} ${y.toFixed(1)}`;
 const state=slack>.34?'slack':load>.68?'strained':load>.45?'working':'steady';
 const lineText={slack:'线松了',strained:'线太紧',working:'线在吃力',steady:'线较稳'}[state];
 return {rod,line,fish:`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${movement==='out'?1:-1} 1)`,wake:`translate(${x.toFixed(1)} ${(y+4).toFixed(1)}) scale(${(1+(f.surge||0)*.7).toFixed(2)} 1)`,tipY:tipY.toFixed(1),state,lineText,fishX:x,movement};
}
