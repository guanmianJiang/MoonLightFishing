// Timings are seconds. A behavior changes the same fight state used by the water and line.
const STANDARD={id:'standard',name:'鱼',habit:'规律游动',tell:'竿尖渐弯，鱼在蓄力',counter:'冲刺时松线，放缓后抬竿',windup:1,run:1.05,recover:1.25,thrust:1,reelFactor:1,lateral:1,chainEvery:0};
const profiles={
 carp:{name:'银背鲫',habit:'稳稳蓄力',tell:'竿尖缓慢压低',counter:'冲刺松线，回气抬竿',windup:1.1,run:1.0,recover:1.35,thrust:.92,reelFactor:1,lateral:.9,chainEvery:0},
 minnow:{name:'细鳞白条',habit:'短促乱窜',tell:'鱼影快速一晃',counter:'趁短暂停顿及时收线',windup:.68,run:.55,recover:.72,thrust:.56,reelFactor:1.15,lateral:1.5,chainEvery:0},
 shrimp:{name:'青壳河虾',habit:'轻轻拖线',tell:'浮漂轻轻下沉',counter:'稳稳收线即可',windup:1.15,run:.45,recover:1.2,thrust:.35,reelFactor:1.15,lateral:.45,chainEvery:0},
 perch:{name:'红鳍鲈',habit:'横向双冲',tell:'鱼影突然横摆',counter:'可能二次冲刺，等真正回气再抬竿',windup:.6,run:.82,recover:1.08,thrust:1.2,reelFactor:1.08,lateral:1.6,chainEvery:2},
 catfish:{name:'岩底鲶',habit:'贴底重拖',tell:'竿尖慢慢压入水面',counter:'先松线卸力，停顿后抬竿',windup:1.45,run:1.35,recover:1.65,thrust:1.28,reelFactor:.9,lateral:.48,chainEvery:0,anchor:.5},
 oldgold:{name:'断尾金鲤',habit:'警惕地连冲',tell:'宽鱼影绕开浮漂再压竿',counter:'连续冲刺时耐心让线',windup:.8,run:1.18,recover:1.35,thrust:1.18,reelFactor:1.1,lateral:1.2,chainEvery:2},
 moon:{name:'银月鱼',habit:'左右游弋',tell:'水面银光忽然转向',counter:'跟住方向，回气立刻抬竿',windup:.85,run:.9,recover:.9,thrust:1.12,reelFactor:.9,lateral:1.85,chainEvery:0},
 bottle:{name:'旧漂流瓶',habit:'随水漂动',tell:'线缓缓偏移',counter:'稳定收线',windup:1,run:.4,recover:1.1,thrust:.3,reelFactor:1.1,lateral:.3,chainEvery:0},
 bell:{name:'沉水铜铃',habit:'贴底拖动',tell:'线缓缓下沉',counter:'稳定收线',windup:1,run:.4,recover:1.1,thrust:.3,reelFactor:1.1,lateral:.3,chainEvery:0}
};
const behaviorById=Object.fromEntries(Object.entries(profiles).map(([id,profile])=>[id,Object.freeze({id,...profile})]));
export function fishBehavior(id){return behaviorById[id]||STANDARD}
export function fightReport(f){
 const runsSeen=Math.max(0,Math.floor(f?.runsSeen||0)),cleanRuns=Math.min(runsSeen,Math.max(0,Math.floor(f?.cleanRuns||0))),goodPumps=Math.max(0,Math.floor(f?.goodPumps||0));
 const seconds=Math.max(0,Math.round((f?.elapsed||0)*10)/10);
 const cleanRate=runsSeen?cleanRuns/runsSeen:0;
 const grade=cleanRate>=.8&&goodPumps>=1?'S':cleanRate>=.6&&goodPumps>=1?'A':cleanRate>=.4||goodPumps>=1?'B':'C';
 return {grade,cleanRuns,runsSeen,goodPumps,seconds};
}
const rank={S:4,A:3,B:2,C:1};
export function migrateFightRecords(value){
 const records={};
 if(!value||typeof value!=='object'||Array.isArray(value))return records;
 const finite=value=>Number.isFinite(Number(value))?Number(value):0;
 for(const [id,report] of Object.entries(value)){
  if(!behaviorById[id]||['bottle','bell'].includes(id)||!rank[report?.grade])continue;
  const runsSeen=Math.max(0,Math.floor(finite(report.runsSeen)));
  records[id]={grade:report.grade,runsSeen,cleanRuns:Math.min(runsSeen,Math.max(0,Math.floor(finite(report.cleanRuns)))),goodPumps:Math.max(0,Math.floor(finite(report.goodPumps))),seconds:Math.max(0,Math.round(finite(report.seconds)*10)/10)};
 }
 return records;
}
export function bestFightReport(log,id){
 return (Array.isArray(log)?log:[]).filter(c=>c?.id===id&&rank[c?.fightReport?.grade]).map(c=>c.fightReport)
  .sort((a,b)=>rank[b.grade]-rank[a.grade]||b.cleanRuns-a.cleanRuns||b.goodPumps-a.goodPumps||a.seconds-b.seconds)[0]||null;
}
