import {pumpOpportunity} from './reference-loop.mjs';
import {fishBehavior} from './fish-behavior.mjs';

export function canSwipePump(f,startY,currentY){
 return Number.isFinite(startY)&&Number.isFinite(currentY)&&startY-currentY>42&&pumpOpportunity(f,false).ready;
}

export function liftOutcomeText(f,startDistance){
 if(!Number.isFinite(startDistance)||!Number.isFinite(f?.distance))return '竿放下后按住收线，守住鱼距。';
 const gained=Math.max(0,startDistance-f.distance);
 return gained>=.1?`本次拉近 ${gained.toFixed(1)} 米；按住收线守住距离。`:'这次没有净拉近；先收紧线，再等鱼放缓。';
}

// The instruction follows what the fish and line are doing, not the last button pressed.
export function fightGuidance(f,held=false){
 const opening=pumpOpportunity(f,held),load=f?.load??f?.tension??0;
 const behavior=fishBehavior(f?.behaviorId);
 if(f.fishState==='hookset')return {step:'reel',title:held?'正在收紧鱼线':'鱼刚上钩，先收紧鱼线',reason:'感受竿弯，留意鱼接下来的蓄力',beat:'刚刚上钩'};
 if(f.fishState==='windup')return {step:'release',title:'鱼在蓄力，准备让线',reason:behavior.counter,beat:behavior.tell};
 if(f.fishState==='anchor')return held?{step:'release',title:'鱼贴底不动，下压让线',reason:'硬收和抬竿都费力，等它回气',beat:'贴底僵持'}:{step:'wait',title:'鱼贴底不动，先稳住',reason:'这时硬收和抬竿都费力，等它回气',beat:'贴底僵持'};
 if(load>.68)return held?{step:'release',title:'线绷紧了，下压让线',reason:'等竿弯回落，再接着收',beat:'鱼线吃紧'}:{step:'wait',title:'线还紧，先稳住',reason:'等鱼缓下来再按住收线',beat:'鱼线吃紧'};
 if(f.fishState==='run')return held?{step:'release',title:'鱼冲出去了，下压让线',reason:'让它耗力，等游速降下来',beat:'鱼在冲刺'}:{step:'wait',title:'让它游一段，守住张力',reason:'鱼放缓时再收回距离',beat:'鱼在冲刺'};
 if(opening.state==='lifting')return {step:'lift',title:'抬竿正在拉近鱼',reason:'竿尖落下后按住收线，守住这段距离',beat:'短促拉近'};
 if(opening.state==='lowering')return {step:'reel',title:'竿尖回落，按住收线',reason:'守住刚带近的距离',beat:'收线时机'};
 if(held){
  if(pumpOpportunity(f,false).ready)return {step:'lift',title:'鱼放缓了，上提抬竿',reason:'滑回原位继续收线，守住拉近的距离',beat:'抬竿时机'};
  return {step:'reel',title:'正在收线，留意竿弯',reason:'线一紧就下压让线',beat:'鱼在靠近'};
 }
 if(opening.state==='slack')return {step:'reel',title:'线松了，先收紧',reason:'拉直鱼线，再找抬竿机会',beat:'鱼线松弛'};
 if(opening.state==='surge'||opening.state==='gathering')return {step:'wait',title:'鱼在发力，先稳住',reason:'线绷紧就下压让线，别硬拉',beat:opening.state==='gathering'?'鱼正蓄力':'鱼在冲刺'};
 if((f.radialVelocity||0)>.25)return {step:'reel',title:'鱼要跑远了，守住距离',reason:'按住收线，线紧就下压让线',beat:'鱼游向远水'};
 if(opening.ready)return {step:'lift',title:'鱼放缓了，抬竿拉近',reason:'短拉近一段，竿回落后按住收线守住',beat:'抬竿时机'};
 return {step:'wait',title:'盯住竿尖和鱼线',reason:'鱼缓下来时抬竿，线紧时下压让线',beat:'鱼正在游动'};
}
