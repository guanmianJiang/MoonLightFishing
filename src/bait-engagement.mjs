const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Probe the bait while it is being read, then commit the mouth to the hook.
export function baitEngagement(phase,readingAge=0){
 if(phase==='reading')return .36+.38*Math.pow(Math.max(0,Math.sin(readingAge*5.2)),2);
 if(phase==='responding')return .72;
 if(phase==='nibble')return .88;
 if(phase==='hooked')return 1;
 return 0;
}

export function baitFishOpacity(phase,focus=0){
 const engagement=baitEngagement(phase);
 return clamp(.14+engagement*.45+focus*.13,.14,.82);
}
