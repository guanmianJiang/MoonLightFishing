import {SPOTS,BAITS,FISH,GEAR,PROCESS_ACTIONS,TRIP_GOALS,TRIP_RULES,CLUES,TACTICS,SIGNALS,WEATHERS} from './data/catalog.mjs';
export {SPOTS,BAITS,FISH,GEAR,PROCESS_ACTIONS,TRIP_GOALS,TRIP_RULES,CLUES,TACTICS} from './data/catalog.mjs';
import {GAME_RULES} from './config/game-rules.mjs';
import {newEconomy,migrateEconomy,addToBasket,saleValue} from './reference-loop.mjs';
import {castZone,castPreset} from './cast-target.mjs';
import {BITE_READ_MS} from './bite-guidance.mjs';
import {normalizeWaterTrail,trailFromMiss,matchingWaterTrail,WATER_TRAIL_RETURN_CHANCE,WATER_TRAIL_WAIT_REDUCTION_MS,WATER_TRAIL_BITE_BONUS_MS} from './water-trail.mjs';
import {explorationProgress} from './progression-guide.mjs';
import {isObjectCatch} from './catch-kind.mjs';
import {CAST_TUNING as CAST} from './config/fishing-tuning.mjs';
import {castWeightTable} from './cast-weights.mjs';
import {isOpeningCast,openingCastWeights,openingCastTiming} from './opening-cast.mjs';
import {discoveryResultLine} from './discovery-notes.mjs';
import {makeTripMoment} from './trip-summary.mjs';
import {waterQuestionOutcome} from './water-question.mjs';
export function goalForTrip(number){const goal=TRIP_GOALS[(number-1)%TRIP_GOALS.length];return {...goal,progress:0,complete:false}}
export function ruleForTrip(number){return {...TRIP_RULES[(number-1)%TRIP_RULES.length],triggers:0}}
export function biteWindowForTrip(number){return GAME_RULES.biteWindowsMs[Math.min(Math.max(1,number||1),GAME_RULES.biteWindowsMs.length)-1]}
export function weatherAt(t){return WEATHERS[Math.floor(t/GAME_RULES.weatherPeriodMs)%WEATHERS.length]}
export function newSave(){return {version:GAME_RULES.saveVersion,casts:0,log:[],clues:[],observations:[],discoveryNotes:[],collection:[],tracked:[],fightRecords:{},skill:{streak:0,best:0,awards:0},knowledge:0,economy:newEconomy(),ecosystem:{carp:1,minnow:1,shrimp:1,perch:1,catfish:1},gear:{rod:'willow',reel:'wood',line:'linen',float:'cork'},trip:{number:1,castsLeft:GAME_RULES.castsPerTrip,changes:[],moments:[],goal:goalForTrip(1),rule:ruleForTrip(1)},pending:null,waterTrail:null,spot:'reed',bait:'grain',created:Date.now()}}
export function migrateSave(s){if(!s||![1,2].includes(s.version))return newSave();if(s.version===1){s.version=2;s.collection=[];s.tracked=[];s.skill={streak:0,best:0,awards:0};s.knowledge=0;s.ecosystem={carp:1,minnow:1,shrimp:1,perch:1,catfish:1};s.gear={rod:'willow',reel:'wood',line:'linen',float:'cork'};s.trip={number:1,castsLeft:GAME_RULES.castsPerTrip,changes:[],goal:goalForTrip(1),rule:ruleForTrip(1)}}s.economy=migrateEconomy(s.economy);s.observations=Array.isArray(s.observations)?s.observations:[];s.discoveryNotes=Array.isArray(s.discoveryNotes)?s.discoveryNotes:[];s.waterTrail=normalizeWaterTrail(s.waterTrail);s.collection=Array.isArray(s.collection)?s.collection:[];s.tracked=Array.isArray(s.tracked)?s.tracked.slice(0,GAME_RULES.trackedLimit):[];s.skill=s.skill&&Number.isFinite(s.skill.streak)?s.skill:{streak:0,best:0,awards:0};s.trip=s.trip&&Number.isFinite(s.trip.castsLeft)?s.trip:{number:1,castsLeft:GAME_RULES.castsPerTrip,changes:[]};s.trip.changes=Array.isArray(s.trip.changes)?s.trip.changes:[];s.trip.moments=Array.isArray(s.trip.moments)?s.trip.moments.slice(-GAME_RULES.castsPerTrip):[];if(!s.trip.goal)s.trip.goal=goalForTrip(s.trip.number||1);if(!s.trip.rule)s.trip.rule=ruleForTrip(s.trip.number||1);if(!Number.isFinite(s.trip.rule.triggers))s.trip.rule.triggers=0;if(s.pending&&!Number.isFinite(s.pending.biteWindowMs))s.pending.biteWindowMs=biteWindowForTrip(s.trip.number);if(isObjectCatch(s.pending?.catch)){s.pending.fight=null;s.pending.landedFromFight=false;delete s.pending.catch.fightReport}const selected=SPOTS.find(p=>p.id===s.spot);if(!selected||!spotUnlocked(s,s.spot))s.spot='reed';return s}
export function validSave(s){const valid=!!s&&s.version===GAME_RULES.saveVersion&&Number.isInteger(s.casts)&&s.casts>=0&&Array.isArray(s.log)&&s.log.every(c=>FISH.some(f=>f.id===c.id)&&Number.isFinite(c.weight)&&Number.isFinite(c.length)&&Number.isFinite(c.time))&&Array.isArray(s.clues)&&SPOTS.some(p=>p.id===s.spot)&&BAITS.some(b=>b.id===s.bait)&&s.gear&&s.trip&&(!s.pending||(Number.isFinite(s.pending.readyAt)&&Number.isFinite(s.pending.start)&&SPOTS.some(p=>p.id===s.pending.spot)&&BAITS.some(b=>b.id===s.pending.bait)&&['cast','result'].includes(s.pending.phase)&&(!s.pending.catch||FISH.some(f=>f.id===s.pending.catch.id))));return valid}
export function spotUnlocked(s,id){const spot=SPOTS.find(p=>p.id===id);return !!spot&&explorationProgress(s)>=spot.unlock}
export function equipGear(s,slot,id){const item=GEAR[slot]?.find(g=>g.id===id);if(!item||s.knowledge<item.unlock)return false;s.gear[slot]=id;return true}
function weighted(items,rng){let n=rng()*items.reduce((s,i)=>s+i[1],0);for(const [id,w]of items){n-=w;if(n<=0)return id}return items.at(-1)[0]}
export function makeCast(s,t=Date.now(),rng=Math.random,castPoint=null){
 const selectedZone=castZone(s.spot,castPoint),targetZone=selectedZone||'middle',targetPoint=selectedZone?[...castPoint]:castPreset(s.spot);
 const weather=weatherAt(t),openingCast=isOpeningCast(s),weights=openingCastWeights(s,castWeightTable(s,weather.id,targetZone));
 const trail=matchingWaterTrail(s,weights);s.waterTrail=null;
 const eligible=(s.tracked||[]).filter(x=>x.spot===s.spot&&weights[x.id]),trackChance=Math.min(.55,eligible.reduce((sum,x)=>sum+.18+(x.releases||1)*.09,0)),returning=eligible.length&&rng()<trackChance?eligible[Math.floor(rng()*eligible.length)]:null;
 const trailRoll=!!trail&&!returning&&rng()<WATER_TRAIL_RETURN_CHANCE,fishId=returning?.id||(trailRoll?trail.fishId:weighted(Object.entries(weights),rng)),trailReturned=!!trail&&fishId===trail.fishId,fish=FISH.find(f=>f.id===fishId),sizeBoost=(s.gear?.rod==='tide'?CAST.rodWeightMultiplier:1)*(1+(s.economy?.upgrades?.rod||0)*CAST.rodUpgradeWeightStep)*(targetZone==='near'?CAST.nearWeightMultiplier:targetZone==='far'?CAST.farWeightMultiplier:1);const fishMax=openingCast&&fish.id==='carp'?Math.min(fish.max,CAST.openingCast.maxCarpWeight):fish.max;const weight=returning?+Math.min(fish.max*CAST.returningWeightCap,Math.max(returning.weight*CAST.returningWeightMin,returning.weight*(CAST.returningWeightMin+rng()*CAST.returningWeightVariance))).toFixed(3):+Math.min(fishMax,fish.min+(fishMax-fish.min)*Math.pow(rng(),2)*sizeBoost).toFixed(3);const length=+(fish.length*Math.cbrt(weight/((fish.min+fish.max)/2))).toFixed(1);
 const mutationRoll=rng(),mutation=returning&&(returning.releases||1)>=3?'潮痕个体':fish.special?'特殊个体':fish.object?'沉水物':mutationRoll<CAST.mutationRainChance?'雨水附着':mutationRoll<CAST.mutationGoldChance?'浅金体色':null,variation=returning?`追踪个体 · 已放流 ${returning.releases||1} 次`:fish.special?'已确认的特殊个体':fish.object?'沉水物':mutation==='雨水附着'?'离水后仍持续滴水':mutation==='浅金体色'?'少见的浅金色':rng()<CAST.markedTailChance?'尾鳍有旧伤':'普通体色';
 const waitRoll=rng(),introTiming=openingCastTiming(s,waitRoll),readyAt=t+(introTiming?introTiming.waitMs:GAME_RULES.castWaitBaseMs+waitRoll*GAME_RULES.castWaitRandomMs)+(targetZone==='near'?CAST.nearWaitOffsetMs:targetZone==='far'?CAST.farWaitOffsetMs:0)-(trail?WATER_TRAIL_WAIT_REDUCTION_MS:0),signal=signalFor(fish.id),biteWindowMs=(introTiming?introTiming.biteWindowMs:biteWindowForTrip(s.trip?.number))+(targetZone==='near'?CAST.nearBiteBonusMs:0)+(trailReturned?WATER_TRAIL_BITE_BONUS_MS:0);
 return {start:t,readyAt,decisionAt:readyAt-GAME_RULES.decisionLeadMs,biteWindowMs,biteMode:'natural',openingCast,spot:s.spot,bait:s.bait,castPoint:targetPoint,castZone:targetZone,weather,phase:'cast',followedTrail:!!trail,trailReturned,catch:{id:fish.id,weight,length,variation,mutation,time:t,spot:s.spot,bait:s.bait,weather:weather.name,...(returning?{tagId:returning.tagId,returnCount:returning.releases||1}: {})},signal,tactic:null,tacticSuccess:null,reaction:null,clue:s.spot==='bridge'?(s.clues.includes('gold1')?'gold2':'gold1'):s.spot==='deep'?(s.clues.includes('moon1')?'moon2':'moon1'):(!s.clues.includes('reed')?'reed':null)}
}
export function signalFor(id){const key=id==='perch'?'dart':id==='catfish'?'deep':id==='oldgold'?'broad':id==='shrimp'||id==='minnow'?'peck':'steady';return {id:key,...SIGNALS[key]}}
export function migrateBiteMode(p,now=Date.now()){
 if(!p||p.phase!=='cast'||!p.catch)return p;
 if(!Number.isFinite(p.decisionAt))p.decisionAt=Math.min(p.readyAt-1200,now+1800);
 if(p.biteMode||p.tactic)return p;
 p.biteMode='natural';p.readyAt=Math.max(p.readyAt,now+2200);p.decisionAt=Math.min(p.decisionAt,p.readyAt-2200);
 return p;
}
export function chooseTactic(s,id,now=Date.now(),rng=Math.random){
 const p=s.pending;if(!p||p.biteMode==='natural'||p.phase!=='cast'||p.tactic||now<p.decisionAt||now>=p.decisionAt+BITE_READ_MS)return null;
 const signal=SIGNALS[p.signal?.id]||SIGNALS.steady,success=id===signal.tactic,tripNumber=s.trip?.number||1,forgiven=!success&&(tripNumber===1||tripNumber===2&&rng()<.65),landed=success||forgiven;p.tactic=id;p.tacticSuccess=landed;p.reaction=success?signal.success:forgiven?'鱼被动作惊了一下，但仍留在饵旁。继续看浮漂。':signal.fail;p.reactedAt=now;p.readyAt=now+(landed?2400:1800);
 if(!landed)p.catch=null;
 const skill=s.skill||(s.skill={streak:0,best:0,awards:0});if(success){skill.streak++;skill.best=Math.max(skill.best,skill.streak);if(skill.streak%3===0){skill.awards++;s.knowledge+=1;}}else skill.streak=0;const note={time:now,spot:p.spot,signal:p.signal?.id||'steady',tactic:id,success,forgiven,text:p.reaction,streak:skill.streak,streakAward:success&&skill.streak%3===0};s.observations=[note,...(s.observations||[])].slice(0,GAME_RULES.observationLimit);return note;
}
export function missBite(s,now=Date.now()){
 const p=s?.pending;
 if(!p||p.biteMode==='natural'||p.phase!=='cast'||p.tactic||!Number.isFinite(p.decisionAt)||now<p.decisionAt+BITE_READ_MS)return null;
 p.tactic='missed';p.tacticSuccess=false;p.reaction='鱼口渐渐停了，浮漂回稳。这次没来得及判断。';p.reactedAt=now;p.readyAt=now+1800;p.catch=null;
 const skill=s.skill||(s.skill={streak:0,best:0,awards:0});skill.streak=0;
 const note={time:now,spot:p.spot,signal:p.signal?.id||'steady',tactic:'missed',success:false,forgiven:false,missed:true,text:p.reaction,streak:0,streakAward:false};
 s.observations=[note,...(s.observations||[])].slice(0,GAME_RULES.observationLimit);
 return note;
}
export function markNearMiss(p,reason){const fish=p?.catch&&FISH.find(item=>item.id===p.catch.id);if(!fish||fish.object||!['missed','escaped'].includes(reason))return false;p.nearMiss={fishId:fish.id,reason};return true}
export function expireHookWindow(s,now=Date.now()){
 const p=s?.pending;
 if(!p||p.phase!=='cast'||!p.catch||isObjectCatch(p.catch)||p.biteMode!=='natural'&&!p.tactic||p.directHooked||p.liftedAt||p.fight?.status==='active'||now-p.readyAt<(p.biteWindowMs||GAME_RULES.biteWindowsMs.at(-1)))return false;
 markNearMiss(p,'missed');p.catch=null;p.reaction='鱼口渐弱，鱼松口离开了。';return true;
}
export function finishCast(s){const p=s.pending;if(!p||p.phase==='result')return false;s.casts++;if(p.catch)s.log.unshift(p.catch);if(p.clue&&!s.clues.includes(p.clue))s.clues.push(p.clue);s.log=s.log.slice(0,GAME_RULES.catchLogLimit);p.phase='result';return true}
export function settleEmptyCast(s){
 const p=s?.pending;
 if(!p||p.catch||!['cast','result'].includes(p.phase))return null;
 if(p.processed){s.pending=null;return {action:p.processed,tripEnded:s.trip.castsLeft===0,alreadyProcessed:true}}
 if(p.phase==='cast')finishCast(s);
 const result=processCatch(s,'study');
 if(result&&!result.error){const trail=trailFromMiss(p);s.pending=null;if(trail)s.waterTrail=trail}
 return result;
}
export function trackRelease(s,c,spot=s.spot,now=Date.now()){
 if(!c||FISH.find(x=>x.id===c.id)?.object)return {tracked:false};s.tracked=Array.isArray(s.tracked)?s.tracked:[];let item=c.tagId&&s.tracked.find(x=>x.tagId===c.tagId);
 if(item){item.weight=Math.max(item.weight,c.weight);item.releases=(item.releases||1)+1;item.spot=spot;item.lastSeen=now;return {tracked:true,upgraded:true,item};}
 if(s.tracked.length>=GAME_RULES.trackedLimit)return {tracked:false,full:true};item={tagId:c.tagId||`tag-${now.toString(36)}-${s.casts}`,id:c.id,weight:c.weight,releases:1,spot,lastSeen:now};s.tracked.push(item);return {tracked:true,upgraded:false,item};
}
function resolveTracked(s,c){if(!c?.tagId)return false;const before=s.tracked?.length||0;s.tracked=(s.tracked||[]).filter(x=>x.tagId!==c.tagId);return s.tracked.length<before}
export function processHint(s,action,c=s.pending?.catch){
 if(!c)return action==='study'?'结算本竿，不增加调查进度':'空钩无法执行该操作';const f=FISH.find(x=>x.id===c.id),rule=s.trip?.rule?.id;
 if(action==='basket')return `鱼市参考价 ${saleValue(c)} 金币`;
 if(action==='keep')return f.object?'占用 1 个收藏位，水域状态不变':c.tagId?'占用 1 个收藏位，并结束该个体的追踪':rule==='predator'&&['perch','catfish'].includes(c.id)?'占用 1 个收藏位，后续捕食鱼明显减少':'占用 1 个收藏位，后续同类减少';
 if(action==='release')return f.object?'放回原位置，不计入活体放流目标':c.tagId?`继续追踪；下次出现会更重（已放流 ${c.returnCount||1} 次）`:(s.tracked?.length||0)>=GAME_RULES.trackedLimit?'追踪位已满；只提高后续同类出现率':rule==='shoal'?'加入追踪，后续同类大幅增加':'加入追踪，后续同类增加';
 if(action==='study'){const base=f.special?3:c.mutation?2:1,bonus=rule==='bottom'&&(f.object||c.mutation)?1:0,returnBonus=c.tagId?Math.min(3,c.returnCount||1):0;return `调查进度 +${base+bonus+returnBonus}${returnBonus?'，并结束追踪':''}`;}
 return '';
}
export function processCatch(s,action){
 const p=s.pending,c=p?.catch;if(!p||p.phase!=='result'||p.processed)return null;
 const f=c&&FISH.find(x=>x.id===c.id),result={action,tripEnded:false,eventTriggered:false,text:''};
 if(c&&action==='keep'&&s.collection.length>=GAME_RULES.collectionLimit)return {error:'收藏位已满。先到水域册放回一个样本。'};
 if(c&&action==='basket'&&s.economy.basket.length>=GAME_RULES.basketLimit)return {error:'鱼篓已满。先到鱼市出售一些鱼。'};
 if(!['keep','basket','release','study'].includes(action))return null;p.processed=action;
 if(!c){result.text='本竿为空钩，没有获得样本。';}
 else if(action==='basket'){addToBasket(s.economy,c);resolveTracked(s,c);result.text=`已把${f.name}放入鱼篓，去鱼市可出售换取金币。`;}
 else if(action==='keep'){
  const resolved=resolveTracked(s,c);s.collection.unshift({...c,keptAt:Date.now()});if(!f.object){const drop=s.trip?.rule?.id==='predator'&&['perch','catfish'].includes(c.id)?.34:.18;s.ecosystem[c.id]=Math.max(.5,(s.ecosystem[c.id]||1)-drop);result.eventTriggered=drop>.2;result.text=`已收藏${f.name}。后续抛竿中同类出现率${drop>.2?'明显':''}下降${resolved?'，该个体追踪结束':''}。`;}else result.text=`已收藏${f.name}，占用 1 个收藏位。`;
 }else if(action==='release'){
  if(!f.object){const boost=s.trip?.rule?.id==='shoal'?.35:.22,tracking=trackRelease(s,c,p.spot);s.ecosystem[c.id]=Math.min(2.5,(s.ecosystem[c.id]||1)+boost);c.released=true;result.eventTriggered=boost>.3;result.tracking=tracking.tracked;result.trackingText=tracking.upgraded?`追踪更新：已放流 ${tracking.item.releases} 次，下次出现会更重。`:tracking.tracked?'已加入追踪名单，之后可能再次钓到。':'追踪位已满，本次只改变鱼群数量。';result.text=`已放回${f.name}。${result.trackingText}`;}
  else{result.text=`已把${f.name}放回原位置。`;}
 }else if(action==='study'&&c){
  const base=f.special?3:c.mutation?2:1,bonus=s.trip?.rule?.id==='bottom'&&(f.object||c.mutation)?1:0,returnBonus=c.tagId?Math.min(3,c.returnCount||1):0,gain=base+bonus+returnBonus,resolved=resolveTracked(s,c);s.knowledge+=gain;result.eventTriggered=!!bonus;result.text=`已记录${f.name}，调查进度 +${gain}${bonus?'（本轮事件 +1）':''}${returnBonus?`（追踪样本 +${returnBonus}）`:''}${resolved?'，该个体追踪结束':''}。`;
 }else return null;
 result.discoveryText=discoveryResultLine(p);
 result.waterQuestionText=waterQuestionOutcome(p)?.text;
 const moment=makeTripMoment(s,p,action);
 if(moment){const previous=Array.isArray(s.trip.moments)?s.trip.moments:[];if(!previous.some(item=>item?.castId===moment.castId))s.trip.moments=[...previous,moment].slice(-GAME_RULES.castsPerTrip)}
 if(result.eventTriggered)s.trip.rule.triggers=(s.trip.rule.triggers||0)+1;
 const goal=s.trip.goal,qualifies=!!c&&goal&&(goal.action===action)&&!(action==='release'&&f.object);if(qualifies){goal.progress=Math.min(goal.target,goal.progress+1);goal.complete=goal.progress>=goal.target;}
 s.trip.castsLeft=Math.max(0,s.trip.castsLeft-1);s.trip.changes.push(result.text);
 if(s.trip.castsLeft===0){if(goal?.complete&&!goal.rewarded){goal.rewarded=true;s.knowledge+=goal.reward;s.trip.changes.push(`本轮目标完成：${goal.name}。调查进度 +${goal.reward}。`)}else if(goal&&!goal.complete)s.trip.changes.push(`本轮目标未完成：${goal.name}（${goal.progress}/${goal.target}）。`);s.trip.changes.push(`水域事件：${s.trip.rule.name}，本轮触发 ${s.trip.rule.triggers||0} 次。`);simulateWater(s);result.tripEnded=true;result.summary=[...s.trip.changes];}
 return result;
}
export function simulateWater(s,rng=Math.random){
 const e=s.ecosystem;if(e.minnow>1.15)e.perch=Math.min(2.5,(e.perch||1)+.10);if(e.shrimp>1.15)e.catfish=Math.min(2.5,(e.catfish||1)+.08);
 for(const id of Object.keys(e))e[id]=+Math.max(.5,e[id]*(.97+rng()*.06)).toFixed(2);
 const changes=[];if(e.perch>1.2)changes.push('生态变化：白条数量上升，红鳍鲈的近岸出现率提高。');if(e.catfish>1.15)changes.push('生态变化：底层食物增加，岩底鲶的出现率提高。');if(!changes.length)changes.push('生态变化：当前鱼群结构基本稳定。');s.trip.changes.push(...changes);
}
export function startNextTrip(s){if(s.trip.castsLeft>0)return false;const number=s.trip.number+1;s.trip={number,castsLeft:GAME_RULES.castsPerTrip,changes:[],moments:[],goal:goalForTrip(number),rule:ruleForTrip(number)};return true}
