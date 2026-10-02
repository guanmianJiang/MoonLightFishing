import {FISH} from './data/catalog.mjs';
import {discoveryJournal,discoveryResultLine} from './discovery-notes.mjs';
import {waterQuestionOutcome,waterQuestionRecap} from './water-question.mjs';

const liveFish=id=>FISH.find(fish=>fish.id===id&&!fish.object);
const fishFor=id=>FISH.find(fish=>fish.id===id);
const actions=['keep','basket','release','study'];

export function makeTripMoment(save,pending,action){
 if(!Number.isInteger(save?.casts)||save.casts<1||!Number.isFinite(pending?.start)||!actions.includes(action))return null;
 const caught=fishFor(pending.catch?.id),missed=!caught&&liveFish(pending.nearMiss?.fishId);
 const kind=caught?caught.object?'object':'landed':missed?'near-miss':'quiet';
 const change=pending.discoveryTransition;
 const discovery=discoveryResultLine(pending)&&discoveryJournal(save).some(note=>note.topicId===change.topicId&&note.state===change.state)?{topicId:change.topicId,state:change.state}:undefined;
 const question=waterQuestionOutcome(pending);
 return {
  castId:`${save.casts}:${pending.start}`,kind,
  ...(caught||missed?{fishId:(caught||missed).id}:{}),
  ...(caught?{action}:{}),
  ...(kind==='landed'&&pending.catch.tagId?{returned:true}:{}),
  ...(kind==='landed'&&typeof pending.catch.mutation==='string'?{mutation:pending.catch.mutation}:{}),
  ...(kind==='near-miss'&&['missed','escaped'].includes(pending.nearMiss.reason)?{missReason:pending.nearMiss.reason}:{}),
  ...(discovery?{discovery}:{}),
  ...(question?{waterQuestion:{id:question.id,status:question.status}}:{})
 };
}

function validMoment(moment){
 if(!moment||typeof moment.castId!=='string'||!moment.castId)return false;
 if(moment.kind==='quiet')return true;
 const fish=fishFor(moment.fishId);
 if(!fish)return false;
 return moment.kind==='object'?!!fish.object:moment.kind==='landed'||moment.kind==='near-miss'?!fish.object:false;
}

function momentHighlight(moment){
 const discoveryText=moment.discovery&&discoveryResultLine({discoveryTransition:moment.discovery});
 if(discoveryText&&moment.discovery.state==='supported')return {score:100,lead:'这一轮，你亲手确认了水下的一种回应。',title:'同一种回应，出现了第二次',body:discoveryText};
 if(discoveryText&&moment.discovery.state==='hypothesis')return {score:90,lead:'刚才的轻提，给下一竿留下了一个问题。',title:'鱼影跟着饵走了',body:discoveryText};
 const waterQuestion=waterQuestionRecap(moment);
 if(waterQuestion)return {score:85,lead:'这一轮，你带着自己的问题试了一竿。',...waterQuestion};
 const fish=fishFor(moment.fishId);
 if(moment.kind==='landed'&&moment.returned)return {score:80,lead:'你又遇见了一尾认识的鱼。',title:`认出了放回去的${fish.name}`,body:'带有同一个追踪标记的个体再次上岸；这次相遇已经留在记录里。'};
 if(moment.kind==='landed'&&fish.special)return {score:75,lead:'这一轮，水里出现了一尾特别的鱼。',title:`遇见了${fish.name}`,body:'这尾特殊个体真的上岸了；它的条件与习性仍可以继续观察。'};
 if(moment.kind==='landed'&&moment.mutation)return {score:70,lead:'熟悉的水里，也有不同的个体。',title:`${fish.name}带着${moment.mutation}`,body:'这次外观变化来自真正上岸的鱼，已经留下记录。'};
 if(moment.kind==='landed')return {score:60,lead:'这一轮，你把一尾鱼带到了岸边。',title:`遇见了${fish.name}`,body:moment.action==='release'?'它回到了水里，这次相遇仍留在钓获记录中。':moment.action==='study'?'你仔细记下了这尾鱼的模样。':'这次相遇已经留在钓获记录中。'};
 if(moment.kind==='object')return {score:55,lead:'这一轮，钩上来了一件意料外的东西。',title:`带上岸的${fish.name}`,body:'这件沉水物确实来自刚才的抛竿，已留在钓获记录中。'};
 if(moment.kind==='near-miss')return {score:50,lead:'有鱼真正靠近过，也留下了可惜的一瞬。',title:`错过了${fish.name}`,body:moment.missReason==='escaped'?'搏鱼时没能留住它。同种鱼讯可以再试，不能认定是同一尾。':moment.missReason==='missed'?'鱼口渐弱后它松开了。下次看到咬实提示，及时按住提竿；能否再遇仍要看水情。':'这次没能留住它。下次是否再遇，仍要看水情。'};
 if(discoveryText&&moment.discovery.state==='seen')return {score:40,lead:'你看见了一道真实的鱼影。',title:'水下确实有动静',body:discoveryText};
 return {score:0,lead:'这一轮没有新的可确认线索。',title:'水面平静下来',body:'空钩就是空钩。可以换个落点，也可以先休息。'};
}

function legacyHighlight(trip){
 const changes=Array.isArray(trip?.changes)?trip.changes.filter(x=>typeof x==='string'):[];
 if(changes.some(text=>/^已放回|^已记录|^已收藏|^已把.+放入鱼篓/.test(text)))return {score:20,lead:'这轮留下了钓获处理记录。',title:'旧行程的收获',body:'旧记录只保留了钓获处理，无法确认当时看见的鱼影或发现。之后每竿会单独记录。'};
 if(changes.some(text=>/空钩/.test(text)))return {score:-1,lead:'这一轮有空钩。',title:'水面平静下来',body:'旧存档没有逐竿过程；空钩不能反推出鱼种或新的线索。'};
 return {score:-2,lead:'这一轮的细节没有留在旧手记里。',title:'下次从水面开始',body:'可以随心选择钓点和鱼饵。新的逐竿回顾会从下一轮开始。'};
}

export function tripStory(trip,thread=null){
 const moments=(Array.isArray(trip?.moments)?trip.moments:[]).filter(validMoment);
 let highlight=null;
 for(const moment of moments){const candidate=momentHighlight(moment);if(!highlight||candidate.score>=highlight.score)highlight=candidate;}
 const legacy=legacyHighlight(trip);
 if(!highlight||legacy.score>highlight.score)highlight=legacy;
 const notes=[{kind:'memory',label:'这一轮记住了',title:highlight.title,body:highlight.body}];
 const actionable=!!thread&&typeof thread.title==='string'&&typeof thread.detail==='string'&&['spot','bait','aim'].includes(thread.action?.kind);
 if(actionable)notes.push({kind:'next',label:'下次可试',title:thread.title,body:thread.detail});
 return {lead:highlight.lead,notes,continueLabel:actionable?'沿线索继续':'回到水边',hasNextAction:actionable};
}
