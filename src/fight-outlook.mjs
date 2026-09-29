import {FIGHT_LIMITS,lineBreakForce} from './reference-loop.mjs';

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

export function fightOutlook(f){
 const start=Math.max(FIGHT_LIMITS.landingDistance+.1,finite(f?.startDistance,9));
 const distance=clamp(finite(f?.distance,start),FIGHT_LIMITS.landingDistance,start+3.5);
 const remaining=Math.max(0,distance-FIGHT_LIMITS.landingDistance);
 const approach=clamp((start-distance)/(start-FIGHT_LIMITS.landingDistance));
 const load=Math.max(0,finite(f?.load,finite(f?.tension)));
 const forceRatio=Math.max(0,finite(f?.force)/lineBreakForce(f));
 const warning=clamp(Math.max(0,finite(f?.warningAge))/FIGHT_LIMITS.lineWarningAge);
 const overload=clamp(Math.max(0,finite(f?.overload))/FIGHT_LIMITS.overloadAge);
 const breakImminence=Math.min(warning,overload);
 const lineRisk=clamp(Math.max(breakImminence,clamp((load-.46)/.54)*.55,clamp((forceRatio-.7)/.3)*.7));
 const escapeRisk=clamp((distance-start)/FIGHT_LIMITS.escapeExtra);
 const outward=finite(f?.radialVelocity)>0;
 const slack=Math.max(0,finite(f?.slack));
 const elapsed=Math.max(0,finite(f?.elapsed));
 let state='steady',title='鱼还在水中',action='收线靠岸，留意竿弯';
 if(breakImminence>=.66){state='line-critical';title='鱼线快断了';action='立刻下压让线'}
 else if(load>.68||forceRatio>.9||warning>.52){state='line-strain';title='鱼线正在吃力';action='下压或松手，让竿弯回落'}
 else if(escapeRisk>.7||escapeRisk>.43&&outward){state='escaping';title='鱼快游脱了';action='按住收回距离，线紧就让线'}
 else if(elapsed>FIGHT_LIMITS.maxElapsed*.82){state='exhausted';title='僵持太久，鱼要走了';action='趁鱼放缓收线或抬竿'}
 else if(slack>.58){state='slack';title='鱼线松了';action='按住收紧，别让鱼继续游远'}
 else if(remaining<=1.2){state='near';title='快到岸边，还没上岸';action='稳住鱼线，再收最后一段'}
 const lineLabel=breakImminence>=.66?'快断线':load>.68||forceRatio>.9||warning>.52?'线吃力':slack>.58?'线松弛':'线较稳';
 return {approach,remaining,lineRisk,escapeRisk,state,title,action,lineLabel};
}

export function fightOutlookDisplay(outlook){
 const remaining=Number.isFinite(outlook?.remaining)?Math.max(0,outlook.remaining):0;
 const steady=outlook?.state==='steady';
 return {distance:`${remaining.toFixed(1)} 米`,statusTitle:steady?'':String(outlook?.title||''),lineStatus:steady?'鱼线平稳':''};
}

export function fightLossCopy(f){
 switch(f?.lossReason){
  case 'line-break':return {reaction:'鱼线持续过载，最终断线了。',toast:'鱼线断了；下次线吃力时先让线。'};
  case 'escaped':return {reaction:'鱼游向远水，最终脱钩了。',toast:'鱼游得太远，脱钩了。'};
  case 'exhausted':return {reaction:'僵持太久，鱼最终挣脱了。',toast:'僵持太久，鱼挣脱了。'};
  default:return {reaction:'鱼挣脱了，这一竿没能留住它。',toast:'这一竿没留住鱼。'};
 }
}
