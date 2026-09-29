import {isOpeningCast} from './opening-cast.mjs';
import {openingCastPoint} from './cast-target.mjs';

const countAt=(log,spot)=>log.reduce((count,catchItem)=>count+(catchItem?.spot===spot?1:0),0);

export function explorationProgress(save){
 const log=Array.isArray(save?.log)?save.log:[];
 const knowledge=Number.isFinite(save?.knowledge)?Math.max(0,Math.floor(save.knowledge)):0;
 return knowledge+Math.min(3,Math.floor(countAt(log,'reed')/2))+Math.min(4,Math.floor(countAt(log,'bridge')/2));
}

export function castDifficultyHint(zone){
 if(zone==='near')return '已选近水：提竿多 2 秒，点水面可调整';
 if(zone==='far')return '已选远水：大鱼更多，点水面可调整';
 return '在亮起的水域点选，拖动调整';
}

export function progressionGuide(save){
 const progress=explorationProgress(save),log=Array.isArray(save?.log)?save.log:[];
 const reedCatches=countAt(log,'reed'),bridgeCatches=countAt(log,'bridge'),spot=save?.spot||'reed';
 if(isOpeningCast(save))return {
  opening:true,stage:'第一竿 · 看水面',title:'这片浅滩会有什么动静？',
  detail:`${save.bait==='grain'?'麦粒':'鱼饵'}已经备好。先选一处近水，看浮漂和鱼线什么时候被带动。`,
  progress:0,target:3,action:{kind:'aim',zone:'near',point:openingCastPoint(),label:'选近水落点'},
 };
 if(progress<3)return {
  stage:'第一站 · 近岸',title:progress===2?'再差 1 点去栈桥':'摸清去栈桥的路',
  detail:progress===2?'再钓获 2 次，或把下一尾做成记录，就能去栈桥。试试稍远的水面。':reedCatches>=2?'每钓获 2 次，探索增加 1 点；做成记录更快。远水会遇到更有力的鱼。':'用麦粒在近水练手；钓获会推进探索，做成记录还会更快。',
  progress,target:3,action:reedCatches>=2?{kind:'aim',zone:'far',label:'试试浅滩远水'}:{kind:'aim',zone:'near',label:'选近水落点'},
 };
 if(spot==='reed')return {
  stage:'新水域已开放',title:'去栈桥外湾看看',
  detail:'木桩旁有鲈鱼和沉水物。先投近水熟悉拉力，再尝试远水。',
  progress,target:7,action:{kind:'spot',spot:'bridge',label:'前往栈桥外湾'},
 };
 if(progress<7){
  const settling=bridgeCatches<2;
  return {
   stage:'第二站 · 外湾',title:settling?'先熟悉外湾鱼口':'向外海继续探索',
   detail:settling?'蚯蚓更容易引来鲈鱼；近水提竿更宽松，鱼发力时先松手。':'每 2 次外湾钓获增加 1 点探索；远水更容易遇到大鱼。',
   progress,target:7,action:settling&&save?.bait!=='worm'?{kind:'bait',bait:'worm',label:'换蚯蚓试试'}:{kind:'aim',zone:settling?'near':'far',label:settling?'选外湾近水':'试探外湾远水'},
  };
 }
 if(spot!=='deep')return {
  stage:'新水域已开放',title:'去外海深水看看',
  detail:'深水目标更重。先投近水摸清鱼线，想挑战再向远水抛。',
  progress,target:7,action:{kind:'spot',spot:'deep',label:'前往外海深水'},
 };
 return {
  stage:'第三站 · 深水',title:'寻找深水鱼讯',
  detail:'夜光虫会引来不同目标；近水容易守，远水更可能遇到大鱼。',
  progress,target:7,action:save?.bait==='glow'?{kind:'aim',zone:'far',label:'试探深水远处'}:{kind:'bait',bait:'glow',label:'换夜光虫观察'},
 };
}
