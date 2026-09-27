const cues={
 waiting:{period:3.4,intensity:.10,color:'#bde8dc',scale:.20},
 approach:{period:1.9,intensity:.19,color:'#e9dcaa',scale:.28},
 reading:{period:1.15,intensity:.27,color:'#f5d593',scale:.32},
 responding:{period:1.1,intensity:.24,color:'#e9d591',scale:.29},
 nibble:{period:.72,intensity:.36,color:'#f5c77e',scale:.38},
 hooked:{period:.54,intensity:.58,color:'#ffd5a0',scale:.47},
 spooked:{period:2.8,intensity:.07,color:'#c9d6cf',scale:.13},
 empty:{period:3.0,intensity:.055,color:'#c9d6cf',scale:.10}
};
export function fishingCue(phase){return cues[phase]||{period:3.4,intensity:0,color:'#bde8dc',scale:0}}

const presentation={
 waiting:{step:'wait',title:'浮漂平稳',hint:'水面暂时安静'},
 approach:{step:'wait',title:'浮漂边有动静',hint:'水纹正靠近落点'},
 reading:{step:'read',title:'漂尖轻动',hint:'鱼还在饵旁试探'},
 responding:{step:'read',title:'浮漂又动了',hint:'鱼仍在饵旁'},
 nibble:{step:'read',title:'鱼线慢慢拉直',hint:'漂尖正在下沉'},
 hooked:{step:'lift',title:'鱼线绷紧',hint:'现在提竿'},
 spooked:{step:'settle',title:'鱼影散开',hint:'浮漂渐渐回稳'},
 empty:{step:'return',title:'浮漂回稳',hint:'收回鱼线'}
};
export function rhythmPresentation(phase){return presentation[phase]||presentation.waiting}
export const BITE_WINDOW_MS=6500;
export function hookTiming(readyAt,now,windowMs=BITE_WINDOW_MS){const age=Math.max(0,(now-readyAt)/1000),remaining=Math.max(0,(windowMs/1000-age)),quality=age<.25?.92+age/.25*.08:age<=2.1?1:Math.max(.65,1-(age-2.1)*.11);return {age,remaining,quality,grade:age<.25?'settling':age<=2.1?'clean':remaining>1.3?'late':'fading'}}
