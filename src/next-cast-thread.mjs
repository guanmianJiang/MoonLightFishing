import {FISH,SPOTS,BAITS} from './data/catalog.mjs';
import {normalizeWaterTrail} from './water-trail.mjs';
import {explorationProgress} from './progression-guide.mjs';
import {castWeightTable} from './cast-weights.mjs';
import {discoveryThread} from './discovery-notes.mjs';
import {firstBiteRecovery} from './first-bite-recovery.mjs';
import {waterQuestionWaitingLine} from './water-question.mjs';

const fishName=id=>FISH.find(f=>f.id===id&&!f.object)?.name;
const spotName=id=>SPOTS.find(s=>s.id===id)?.name;
const baitName=id=>BAITS.find(b=>b.id===id)?.name;
const actionFor=(save,spot,bait)=>save?.spot!==spot?{kind:'spot',spot,label:`前往${spotName(spot)}`}:save?.bait!==bait?{kind:'bait',bait,label:`换${baitName(bait)}试试`}:{kind:'aim',zone:'middle',label:'沿线索再抛一竿'};

export function nextCastThread(save,weatherId=null){
 if(!save||typeof save!=='object')return null;
 const progress=explorationProgress(save),log=Array.isArray(save.log)?save.log:[];
 const trail=normalizeWaterTrail(save.waterTrail);
 const trailSpot=trail&&SPOTS.find(spot=>spot.id===trail.spot);
 const trailEligible=trail&&trailSpot&&progress>=trailSpot.unlock&&(!weatherId||castWeightTable({...save,spot:trail.spot,bait:trail.bait},weatherId)[trail.fishId]>0);
 if(trailEligible){
  const name=fishName(trail.fishId);
  return {kind:'trail',title:`刚才的${name}可能还在`,detail:firstBiteRecovery(save)?.detail||`回到${spotName(trail.spot)}，继续用${baitName(trail.bait)}。下一竿可能追到那道鱼影。`,waterLine:'刚才鱼影离开的方向又有轻微水纹，先看浮漂是否真的被带动。',action:actionFor(save,trail.spot,trail.bait)};
 }
 const discovery=discoveryThread(save);
 if(discovery)return discovery;
 if(progress>=3&&save.spot==='reed'&&!log.some(c=>c?.spot==='bridge'))return {kind:'new-water',title:'栈桥外湾已经能去了',detail:'浅滩的记录指向木桩旁。下一竿可以去外湾看看水纹与鱼线。',waterLine:'木桩旁有一道慢水纹，浮漂仍在原处。',action:{kind:'spot',spot:'bridge',label:'前往栈桥外湾'}};
 if(progress>=7&&save.spot!=='deep'&&!log.some(c=>c?.spot==='deep'))return {kind:'new-water',title:'深水有新的动静',detail:'外湾的记录已足够辨认深水方向。下一竿可以去外海观察。',waterLine:'远水有一层缓浪，先看鱼线是否跟着变化。',action:{kind:'spot',spot:'deep',label:'前往外海深水'}};
 const tracked=Array.isArray(save.tracked)?save.tracked.filter(item=>fishName(item?.id)&&spotName(item?.spot)).sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0))[0]:null;
 if(tracked&&tracked.spot===save.spot)return {kind:'release',title:`放回的${fishName(tracked.id)}还在这片水域`,detail:'曾放流的个体可能再次出现。下一竿留意熟悉的鱼影和竿尖动作。',waterLine:'旧鱼影经过的水面起了一圈细纹，还不能确定是不是它。',action:{kind:'aim',zone:'middle',label:'留在这片水再抛'}};
 const clues=Array.isArray(save.clues)?save.clues:[];
 if(save.spot==='reed'&&clues.includes('reed'))return {kind:'clue',title:'手记提到了追麦粒的白条',detail:'试试麦粒，再看浅滩稍远处的水面。下一竿或许能认出不同的鱼口。',waterLine:'浅滩有细小的水纹，先等它靠近浮漂。',action:save.bait==='grain'?{kind:'aim',zone:'far',label:'试试浅滩远水'}:{kind:'bait',bait:'grain',label:'换麦粒观察'}};
 if(save.spot==='bridge'&&clues.includes('gold1'))return {kind:'clue',title:'木桩旁有断尾的宽鱼影',detail:'手记说它在雨后会接近浮水饵。先观察这片水，不必急着提竿。',waterLine:'木桩旁的宽水纹慢慢散开，留意是否靠向浮漂。',action:save.bait==='grain'?{kind:'aim',zone:'middle',label:'观察木桩旁水面'}:{kind:'bait',bait:'grain',label:'换麦粒观察'}};
 if(save.spot==='deep'&&clues.includes('moon1'))return {kind:'clue',title:'深水里有一闪而过的银光',detail:'手记提到夜光虫。下一竿可以观察微光附近是否有鱼影。',waterLine:'深水反光掠过浮漂外侧，先看它是否回头。',action:save.bait==='glow'?{kind:'aim',zone:'far',label:'试探深水远处'}:{kind:'bait',bait:'glow',label:'换夜光虫观察'}};
 return null;
}

export function waitingWaterLine(save,pending){
 const questionLine=waterQuestionWaitingLine(pending);
 if(questionLine)return questionLine;
 if(pending?.followedTrail)return '刚才鱼影离开的方向又有轻微水纹，先看浮漂是否真的被带动。';
 const thread=nextCastThread(save,pending?.weather?.id);
 return thread?.waterLine||null;
}
