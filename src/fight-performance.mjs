const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Normalized motion channels shared by the current procedural pose and a future IK rig.
// They come from the fight simulation, so releasing the line or losing tension changes the pose.
export function fightPerformance(f){
 const slack=Math.max(0,f?.slack||0);
 const taut=clamp(1-slack/.42,0,1);
 const tension=clamp(f?.tension||0,0,1.5);
 const load=clamp(f?.load||0,0,1.5);
 const surge=clamp(f?.surge||0,0,1);
 const lift=clamp(f?.pumpPulse||0,0,1);
 const spool=f?.spoolVelocity||0;
 const reel=clamp(-spool/1.65,0,1);
 const payout=clamp(spool/.6,0,1);
 const resistance=clamp((tension*.68+load*.32)*taut,0,1.4);
 const brace=clamp(resistance*.72+surge*taut*.20+lift*.24,0,1);
 const crank=Math.sin((f?.reelTurns||0)*Math.PI*2);
 const recoil=clamp((f?.inputPulse||0)*(resistance*.55+.35),0,1);
 return {taut,resistance,reel,payout,brace,surge,lift,crank,recoil};
}
