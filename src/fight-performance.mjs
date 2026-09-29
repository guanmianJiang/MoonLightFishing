const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Normalized motion channels shared by the current procedural pose and a future IK rig.
// They come from the fight simulation, so releasing the line or losing tension changes the pose.
export function fightPerformance(f,time=0){
 const slack=Math.max(0,f?.slack||0);
 const taut=clamp(1-slack/.42,0,1);
 const tension=clamp(f?.tension||0,0,1.5);
 const load=clamp(f?.load||0,0,1.5);
 const surge=clamp(f?.surge||0,0,1);
 const lift=clamp(f?.pumpPulse||0,0,1);
 const spool=f?.spoolVelocity||0;
 const reel=clamp(-spool/1.65,0,1);
 const payout=clamp(spool/.6,0,1);
 const give=f?.held?payout*.12:payout*taut;
 const resistance=clamp((tension*.68+load*.32)*taut,0,1.4);
 const brace=clamp(resistance*(.72-give*.28)+surge*taut*.20+lift*.24,0,1);
 const crank=Math.sin((f?.reelTurns||0)*Math.PI*2);
 const recoil=clamp((f?.inputPulse||0)*(resistance*.55+.15)*taut,0,1);
 const velocity=clamp(Math.abs(f?.fishVelocity||0),0,2);
 const snap=clamp((tension-load)*1.8,0,1);
 const hookset=f?.fishState==='hookset'?.42*Math.exp(-Math.max(0,f?.stateAge||0)*.75):0;
 const struggle=clamp(surge*.53+velocity*.25+snap*.35+hookset,0,1);
 const rhythm=Math.sin((Number.isFinite(time)?time:0)*(13+surge*7)+(Number.isFinite(f?.seed)?f.seed:0)*2.7);
 const thrash=struggle*rhythm;
 const shock=clamp((snap*.62+velocity*.13+surge*.16+Math.abs(thrash)*.36)*taut,0,1);
 return {taut,resistance,reel,payout,give,brace,surge,lift,crank,recoil,struggle,thrash,shock};
}

export function fightSurfacePulse(f,previous=null){
 if(!f||f.status!=='active')return {kind:null,amount:0,tracker:null};
 const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
 const elapsed=Math.max(0,finite(f.elapsed));
 const taut=finite(f.slack,1)<.18&&finite(f.tension)>.18;
 const tracker={
  lift:clamp(finite(f.pumpPulse),0,1),taut,
  reelBeat:Math.max(0,Math.floor(finite(f.reelTurns)/2)),
  surgeBeat:Math.floor(elapsed*2.4),warningBeat:Math.floor(elapsed*1.4),
  surge:clamp(finite(f.surge),0,1),warning:clamp(finite(f.surgeWarning),0,1)
 };
 if(!previous||!taut)return {kind:null,amount:0,tracker};
 const load=clamp(finite(f.load),0,1.5);
 if(tracker.lift>.25&&(finite(previous.lift)<=.25||!previous.taut))return {kind:'pump',amount:.32+Math.min(.08,load*.1),tracker};
 if(f.held&&tracker.reelBeat>finite(previous.reelBeat))return {kind:'reel',amount:.10+Math.min(.12,load*.12),tracker};
 if(tracker.surge>.45&&(finite(previous.surge)<=.45||tracker.surgeBeat>finite(previous.surgeBeat)))return {kind:'surge',amount:.18+tracker.surge*.18,tracker};
 if(tracker.warning>.58&&(finite(previous.warning)<=.58||tracker.warningBeat>finite(previous.warningBeat)))return {kind:'warning',amount:.11+tracker.warning*.08,tracker};
 return {kind:null,amount:0,tracker};
}
