import {pumpOpportunity} from './reference-loop.mjs';

// The instruction follows what the fish and line are doing, not the last button pressed.
export function fightGuidance(f,held=false){
 const opening=pumpOpportunity(f,held),load=f?.load??f?.tension??0;
 if(load>.68)return held?{step:'release',title:'线绷紧了，快松手！',reason:'等竿弯回落，再接着收',beat:'鱼线吃紧'}:{step:'wait',title:'线还紧，先稳住',reason:'保持松手，等鱼缓下来',beat:'鱼线吃紧'};
 if(f.fishState==='windup')return {step:'release',title:'鱼在蓄力，准备让线',reason:'看竿尖变弯，松手耗掉冲刺',beat:'鱼正蓄力'};
 if(f.fishState==='run')return held?{step:'release',title:'鱼冲出去了，松手让线',reason:'让它耗力，等游速降下来',beat:'鱼在冲刺'}:{step:'wait',title:'让它游一段，守住张力',reason:'鱼放缓时再收回距离',beat:'鱼在冲刺'};
 if(opening.state==='lifting')return {step:'lift',title:'鱼正被带近，等它放下',reason:'竿尖落下再收线',beat:'抬竿成功'};
 if(opening.state==='lowering')return {step:'reel',title:'竿尖回落，抓紧收线',reason:'守住刚带近的距离',beat:'收线时机'};
 if(held)return {step:'reel',title:'正在收线，留意竿弯',reason:'线一紧就松手',beat:'鱼在靠近'};
 if(opening.state==='slack')return {step:'reel',title:'线松了，先收紧',reason:'拉直鱼线，再找抬竿机会',beat:'鱼线松弛'};
 if(opening.state==='surge'||opening.state==='gathering')return {step:'wait',title:'鱼在发力，先稳住',reason:'线绷紧就松手，别硬拉',beat:opening.state==='gathering'?'鱼正蓄力':'鱼在冲刺'};
 if((f.radialVelocity||0)>.25)return {step:'reel',title:'鱼要跑远了，守住距离',reason:'按住收线，线紧就松手',beat:'鱼游向远水'};
 if(opening.ready)return {step:'lift',title:'好机会，抬竿带鱼！',reason:'鱼缓下来了，趁现在抬竿',beat:'抬竿时机'};
 return {step:'wait',title:'盯住竿尖和鱼线',reason:'鱼缓下来时抬竿，线紧时松手',beat:'鱼正在游动'};
}
