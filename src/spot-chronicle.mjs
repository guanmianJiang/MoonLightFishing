import {SPOTS,FISH,BAITS,WEATHERS} from './data/catalog.mjs';
import SPOT_CONTENT from './config/gameplay/spot-content.json' with {type:'json'};

const spotIds=new Set(SPOTS.map(spot=>spot.id));
const liveFish=new Map(FISH.filter(fish=>!fish.object).map(fish=>[fish.id,fish]));
const objectFish=new Map(FISH.filter(fish=>fish.object).map(fish=>[fish.id,fish]));
const zones=['near','middle','far'];
const kinds=['landed','object','near-miss','quiet'];
const recentLimit=4;
const zoneNames={near:'近水',middle:'中段',far:'远水'};
const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const ordinal=castId=>{
 const match=typeof castId==='string'&&/^([1-9]\d*):\d+$/.exec(castId);
 const value=match?Number(match[1]):0;
 return Number.isSafeInteger(value)?value:0;
};
const emptySpot=()=>({casts:0,outcomes:{landed:0,object:0,nearMiss:0,quiet:0},fish:{},zones:{near:0,middle:0,far:0},recent:[]});
export const emptyWaterChronicle=()=>({version:1,total:0,lastOrdinal:0,spots:Object.fromEntries(SPOTS.map(spot=>[spot.id,emptySpot()]))});

export function validateSpotContent(config=SPOT_CONTENT){
 if(config?.version!==1||!Array.isArray(config.spots)||config.spots.length!==SPOTS.length)return false;
 const seen=new Set();
 for(const item of config.spots){
  if(!spotIds.has(item?.id)||seen.has(item.id)||!BAITS.some(bait=>bait.id===item.bait)||!zones.includes(item.zone))return false;
  if(!['theme','firstStep','returnStep'].every(key=>typeof item[key]==='string'&&item[key].trim().length>0&&item[key].length<=120))return false;
  seen.add(item.id);
 }
 return true;
}

function cleanMoment(moment){
 if(!moment||!spotIds.has(moment.spot)||!kinds.includes(moment.kind)||!ordinal(moment.castId))return null;
 const fish=moment.kind==='object'?objectFish.get(moment.fishId):moment.kind==='landed'||moment.kind==='near-miss'?liveFish.get(moment.fishId):null;
 if(moment.kind!=='quiet'&&!fish)return null;
 const clean={castId:moment.castId,spot:moment.spot,kind:moment.kind};
 if(fish)clean.fishId=fish.id;
 if(zones.includes(moment.zone))clean.zone=moment.zone;
 if(typeof moment.bait==='string'&&BAITS.some(bait=>bait.id===moment.bait))clean.bait=moment.bait;
 if(typeof moment.weatherId==='string'&&WEATHERS.some(weather=>weather.id===moment.weatherId))clean.weatherId=moment.weatherId;
 if(Number.isFinite(moment.at)&&moment.at>=0)clean.at=moment.at;
 if(moment.kind==='landed'&&['keep','basket','release','study'].includes(moment.action))clean.action=moment.action;
 if(moment.kind==='landed'&&moment.returned===true)clean.returned=true;
 if(moment.kind==='near-miss'&&['missed','escaped'].includes(moment.missReason))clean.missReason=moment.missReason;
 if(moment.discovery&&typeof moment.discovery.topicId==='string'&&['seen','hypothesis','supported'].includes(moment.discovery.state))clean.discovery={topicId:moment.discovery.topicId,state:moment.discovery.state};
 return clean;
}

export function normalizeWaterChronicle(raw){
 const clean=emptyWaterChronicle();
 if(raw?.version!==1||!raw.spots||typeof raw.spots!=='object')return clean;
 for(const spot of SPOTS){
  const source=raw.spots[spot.id];if(!source||typeof source!=='object')continue;
  const target=clean.spots[spot.id];
  target.casts=count(source.casts);
  for(const kind of kinds)target.outcomes[kind==='near-miss'?'nearMiss':kind]=count(source.outcomes?.[kind==='near-miss'?'nearMiss':kind]);
  for(const zone of zones)target.zones[zone]=count(source.zones?.[zone]);
  for(const fish of liveFish.values())if(count(source.fish?.[fish.id]))target.fish[fish.id]=count(source.fish[fish.id]);
  target.recent=(Array.isArray(source.recent)?source.recent:[]).map(cleanMoment).filter(item=>item?.spot===spot.id).slice(-recentLimit);
 }
 clean.total=SPOTS.reduce((sum,spot)=>sum+clean.spots[spot.id].casts,0);
 clean.lastOrdinal=Math.max(count(raw.lastOrdinal),...SPOTS.flatMap(spot=>clean.spots[spot.id].recent.map(moment=>ordinal(moment.castId))));
 return clean;
}

export function addWaterChronicleMoment(raw,moment){
 const clean=normalizeWaterChronicle(raw),event=cleanMoment(moment),index=ordinal(event?.castId);
 if(!event||index<=clean.lastOrdinal)return clean;
 const spot=clean.spots[event.spot],outcome=event.kind==='near-miss'?'nearMiss':event.kind;
 spot.casts++;spot.outcomes[outcome]++;
 if(event.kind==='landed')spot.fish[event.fishId]=(spot.fish[event.fishId]||0)+1;
 if(event.zone)spot.zones[event.zone]++;
 spot.recent=[...spot.recent,event].slice(-recentLimit);
 clean.total++;clean.lastOrdinal=index;
 return clean;
}

export function waterChronicleCoverage(save){
 const totalCasts=count(save?.casts),unsettled=save?.pending?.phase==='result'&&!save.pending.processed?1:0,recorded=normalizeWaterChronicle(save?.waterChronicle).total;
 return {totalCasts,recorded,hasOlderCasts:Math.max(0,totalCasts-unsettled)>recorded};
}

function momentLine(moment){
 if(!moment)return null;
 const name=moment.fishId?(liveFish.get(moment.fishId)||objectFish.get(moment.fishId))?.name:null;
 if(moment.kind==='landed')return moment.returned?`最近一竿：又认出了放回去的${name}。`:`最近一竿：钓起了${name}。`;
 if(moment.kind==='object')return `最近一竿：带起了${name}。`;
 if(moment.kind==='near-miss')return `最近一竿：${name}靠近过，但没能留住。`;
 return '最近一竿：水面平静，未见可确认的鱼讯。';
}

function nextPreparation(moment,content){
 const fallback={bait:content?.bait||'grain',zone:content?.zone||'middle'};
 if(!moment)return {next:content?.firstStep||'先轻松抛一竿。',...fallback};
 const bait=moment.bait||fallback.bait,zone=moment.zone||fallback.zone;
 if(!moment.bait||!moment.zone)return {next:content?.returnStep||'换个落点再看一次水面。',...fallback};
 if(moment.kind==='near-miss')return {next:`刚才在${zoneNames[zone]}有鱼靠近。用同一鱼饵再观察一次；能否再遇仍要看水情。`,bait,zone};
 const other=zone==='near'?'middle':zone==='middle'?'far':'middle';
 if(moment.kind==='quiet')return {next:`刚才${zoneNames[zone]}很平静。换到${zoneNames[other]}，看看水面有没有不同回应。`,bait,zone:other};
 if(moment.kind==='object')return {next:`刚才在${zoneNames[zone]}带起沉水物。换到${zoneNames[other]}，先看鱼线的动静。`,bait,zone:other};
 return {next:`刚才在${zoneNames[zone]}有鱼上岸。换到${zoneNames[other]}，比较这片水的回应。`,bait,zone:other};
}

export function spotChronicleView(save,spotId){
 const spot=SPOTS.find(item=>item.id===spotId);if(!spot)return null;
 const chronicle=normalizeWaterChronicle(save?.waterChronicle),record=chronicle.spots[spotId];
 const content=validateSpotContent()?SPOT_CONTENT.spots.find(item=>item.id===spotId):null;
 const knownFish=Object.entries(record.fish).filter(([,times])=>times>0).map(([id,times])=>({id,name:liveFish.get(id).name,times})).sort((a,b)=>b.times-a.times||a.name.localeCompare(b.name,'zh'));
 const legacy=waterChronicleCoverage(save).hasOlderCasts;
 const preparation=nextPreparation(record.recent.at(-1),content);
 return {id:spotId,name:spot.name,casts:record.casts,outcomes:{...record.outcomes},knownFish,latest:momentLine(record.recent.at(-1)),legacy,
  theme:content?.theme||'这片水还可以继续观察。',
  next:preparation.next,
  action:{spot:spotId,bait:preparation.bait,zone:preparation.zone}};
}

export function spotDecisionGuide(save,spotId){
 const view=spotChronicleView(save,spotId);if(!view)return null;
 const bait=BAITS.find(item=>item.id===view.action.bait);
 return {kind:'spot-plan',title:view.casts?`${view.name} · 下一竿怎么试`:`在${view.name}试第一竿`,
  detail:view.latest||view.next,
  action:{kind:'spot-plan',...view.action,label:`用${bait?.name||'当前鱼饵'}试${zoneNames[view.action.zone]||'中段'}`}};
}
