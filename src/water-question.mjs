import config from './config/gameplay/water-questions.json' with {type:'json'};
import {FISH,SPOTS,BAITS,TRIP_RULES} from './data/catalog.mjs';
import {castWeightTable} from './cast-weights.mjs';
import {explorationProgress} from './progression-guide.mjs';
import {isOpeningCast} from './opening-cast.mjs';

const questions=Array.isArray(config.questions)?config.questions:[];
const byId=new Map(questions.map(item=>[item.id,item]));
const fishFor=id=>FISH.find(item=>item.id===id&&!item.object);
const conditionsMatch=(question,pending)=>pending?.spot===question.spot&&pending?.bait===question.bait&&pending?.castZone===question.zone;

export function validateWaterQuestionConfig(data=config){
 if(data?.schemaVersion!==1||!Array.isArray(data.questions)||!data.questions.length)return false;
 const ids=new Set(),rules=new Set();
 for(const q of data.questions){
  if(!q||typeof q.id!=='string'||!q.id||ids.has(q.id)||!TRIP_RULES.some(rule=>rule.id===q.ruleId)||rules.has(q.ruleId))return false;
  ids.add(q.id);rules.add(q.ruleId);
  if(!SPOTS.some(spot=>spot.id===q.spot)||!BAITS.some(bait=>bait.id===q.bait)||!['near','middle','far'].includes(q.zone))return false;
  if(!Array.isArray(q.targetFish)||!q.targetFish.length||new Set(q.targetFish).size!==q.targetFish.length)return false;
  const weights=castWeightTable({spot:q.spot,bait:q.bait,trip:{rule:{id:q.ruleId}}},'sun',q.zone);
  if(!q.targetFish.every(id=>fishFor(id)&&Number.isFinite(weights[id])&&weights[id]>0))return false;
  if(!['title','detail','actionLabel','waterLine'].every(key=>typeof q[key]==='string'&&q[key].trim().length>0))return false;
  if(!['matched','other','unresolved'].every(key=>typeof q.copy?.[key]==='string'&&q.copy[key].trim().length>0))return false;
 }
 return true;
}
if(!validateWaterQuestionConfig())throw Error('Invalid water question configuration');

export function waterQuestion(save){
 if(!save||typeof save!=='object'||save.pending||isOpeningCast(save)||!Number.isInteger(save.trip?.castsLeft)||save.trip.castsLeft<=0)return null;
 const q=questions.find(item=>item.ruleId===save.trip?.rule?.id),spot=SPOTS.find(item=>item.id===q?.spot);
 if(!q||!spot||explorationProgress(save)<spot.unlock)return null;
 return {id:q.id,title:q.title,detail:q.detail,action:{kind:'water-question',id:q.id,spot:q.spot,bait:q.bait,zone:q.zone,label:q.actionLabel}};
}

export function waterQuestionCastId(save,selectedId){
 const q=byId.get(selectedId);
 if(!q||!save?.pending||save.pending.phase!=='cast'||save.trip?.rule?.id!==q.ruleId||!conditionsMatch(q,save.pending))return null;
 return q.id;
}

export function waterQuestionOutcome(pending){
 const q=byId.get(pending?.waterQuestionId);
 if(!q||pending.phase!=='result'||!conditionsMatch(q,pending))return null;
 const fish=fishFor(pending.catch?.id),status=fish?q.targetFish.includes(fish.id)?'matched':'other':'unresolved';
 return {id:q.id,status,text:q.copy[status].replace('{fish}',fish?.name||'鱼')};
}

export function waterQuestionWaitingLine(pending){
 const q=byId.get(pending?.waterQuestionId);
 return q&&conditionsMatch(q,pending)?q.waterLine:null;
}

export function waterQuestionRecap(moment){
 const q=byId.get(moment?.waterQuestion?.id),fish=fishFor(moment?.fishId);
 if(!q||moment.waterQuestion.status!=='matched'||!fish||!q.targetFish.includes(fish.id))return null;
 return {title:q.title,body:`这一轮你主动试了本轮水情，实际钓到${fish.name}。这次符合判断，还值得继续比较。`};
}
