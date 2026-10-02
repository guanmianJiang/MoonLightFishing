import config from './config/gameplay/discoveries.json' with {type:'json'};
import {FISH,SPOTS,BAITS} from './data/catalog.mjs';

const STATES=['seen','hypothesis','supported'];
const topicList=Array.isArray(config.topics)?config.topics:[];
const topicById=new Map(topicList.map(topic=>[topic.id,topic]));

export function validateDiscoveryConfig(data=config){
 if(data?.schemaVersion!==1||!Array.isArray(data.topics))return false;
 const ids=new Set();
 for(const topic of data.topics){
  if(!topic||typeof topic.id!=='string'||!topic.id||ids.has(topic.id)||typeof topic.title!=='string'||!topic.title)return false;
  ids.add(topic.id);
  if(!Array.isArray(topic.conditions?.spots)||!topic.conditions.spots.length||!topic.conditions.spots.every(id=>SPOTS.some(spot=>spot.id===id)))return false;
  if(!Array.isArray(topic.conditions?.baits)||!topic.conditions.baits.length||!topic.conditions.baits.every(id=>BAITS.some(bait=>bait.id===id)))return false;
  if(topic.events?.seen!=='live_approach'||topic.events?.response!=='bait_follow')return false;
  if(!Number.isInteger(topic.supportDistinctCasts)||topic.supportDistinctCasts<2||topic.supportDistinctCasts>5)return false;
  if(!['seen','hypothesis','supported','routeSeen','routeHypothesis','waterLine'].every(key=>typeof topic.copy?.[key]==='string'&&topic.copy[key].length>0))return false;
 }
 return true;
}
if(!validateDiscoveryConfig())throw Error('Invalid discovery configuration');

const castId=(save,pending)=>`${save.casts+1}:${pending.start}`;
const livingFish=id=>FISH.some(fish=>fish.id===id&&!fish.object);
const matching=(topic,pending)=>topic.conditions.spots.includes(pending.spot)&&topic.conditions.baits.includes(pending.bait);
const evidenceFor=(note,topic)=>{
 const allowed=[topic.events.seen,topic.events.response],used=new Set();
 return (Array.isArray(note?.evidence)?note.evidence:[]).filter(item=>{
  if(!item||typeof item.castId!=='string'||!item.castId||!allowed.includes(item.eventType)||!Number.isFinite(item.observedAt))return false;
  const id=`${item.castId}:${item.eventType}`;
  if(used.has(id))return false;used.add(id);return true;
 });
};
const noteState=(evidence,topic)=>{
 const responses=new Set(evidence.filter(item=>item.eventType===topic.events.response).map(item=>item.castId));
 if(responses.size>=topic.supportDistinctCasts)return 'supported';
 if(responses.size)return 'hypothesis';
 return evidence.some(item=>item.eventType===topic.events.seen)?'seen':null;
};
const readNote=(save,topic)=>{
 const raw=Array.isArray(save?.discoveryNotes)?save.discoveryNotes.find(note=>note?.topicId===topic.id):null;
 const evidence=evidenceFor(raw,topic),state=noteState(evidence,topic);
 return state?{topicId:topic.id,state,evidence,updatedAt:raw?.updatedAt}:null;
};

export function recordDiscoveryEvidence(save,eventType,now){
 const pending=save?.pending;
 if(!pending||pending.phase!=='cast'||pending.biteMode!=='natural'||!livingFish(pending.catch?.id)||!Number.isInteger(save.casts)||!Number.isFinite(pending.start)||!Number.isFinite(pending.readyAt)||!Number.isFinite(now)||now<pending.start||now>=pending.readyAt)return null;
 if(eventType==='bait_follow'&&(!Number.isFinite(pending.teaseAt)||pending.teaseAt!==now||pending.teaseCount!==1))return null;
 for(const topic of topicList){
  if(!matching(topic,pending)||![topic.events.seen,topic.events.response].includes(eventType))continue;
  const before=readNote(save,topic),previous=before?.state||null;
  if(previous==='supported'||eventType===topic.events.seen&&previous)continue;
  const id=castId(save,pending),evidence=before?.evidence||[];
  if(evidence.some(item=>item.castId===id&&item.eventType===eventType))continue;
  evidence.push({castId:id,eventType,observedAt:now});
  const state=noteState(evidence,topic);
  if(state===previous)return null;
  const note={topicId:topic.id,state,evidence,updatedAt:now};
  save.discoveryNotes=(Array.isArray(save.discoveryNotes)?save.discoveryNotes.filter(item=>item?.topicId!==topic.id):[]).concat(note);
  pending.discoveryTransition={topicId:topic.id,state};
  return {topicId:topic.id,state,text:topic.copy[state]};
 }
 return null;
}

export function recordVisibleApproach(save,view,now){
 if(!view||view.overview||view.hidden||view.modalOpen)return null;
 return recordDiscoveryEvidence(save,'live_approach',now);
}

export function discoveryThread(save){
 if(!save||typeof save!=='object')return null;
 for(const topic of topicList){
  const note=readNote(save,topic);
  if(!note||note.state==='supported')continue;
  const spot=topic.conditions.spots[0],bait=topic.conditions.baits[0];
  const action=save.spot!==spot?{kind:'spot',spot,label:`前往${SPOTS.find(item=>item.id===spot).name}`}:save.bait!==bait?{kind:'bait',bait,label:`换${BAITS.find(item=>item.id===bait).name}试试`}:{kind:'aim',zone:'middle',label:'再观察一竿'};
  return {kind:'discovery',title:topic.title,detail:topic.copy[note.state==='seen'?'routeSeen':'routeHypothesis'],waterLine:topic.copy.waterLine,action};
 }
 return null;
}

export function discoveryResultLine(pending){
 const change=pending?.discoveryTransition,topic=topicById.get(change?.topicId);
 return topic&&STATES.includes(change.state)?topic.copy[change.state]:null;
}

export function discoveryJournal(save){
 return topicList.map(topic=>{
  const note=readNote(save,topic);
  if(!note)return null;
  return {topicId:topic.id,title:topic.title,state:note.state,stateLabel:{seen:'亲眼看见',hypothesis:'待再试',supported:'观察支持'}[note.state],body:topic.copy[note.state]};
 }).filter(Boolean);
}
