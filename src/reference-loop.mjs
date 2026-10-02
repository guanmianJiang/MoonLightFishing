import {SHOP} from './data/catalog.mjs';
export {SHOP} from './data/catalog.mjs';
import {GAME_RULES} from './config/game-rules.mjs';
import {fishBehavior} from './fish-behavior.mjs';
import {FIGHT_FEEL_TUNING} from './config/fishing-tuning.mjs';
export const newEconomy=()=>({coins:0,basket:[],upgrades:{rod:0,reel:0,float:0,line:0},sold:0});
export function migrateEconomy(value){const base=newEconomy();if(!value||typeof value!=='object')return base;return {coins:Number.isFinite(value.coins)?Math.max(0,Math.floor(value.coins)):0,basket:Array.isArray(value.basket)?value.basket.filter(c=>c&&typeof c.id==='string'&&Number.isFinite(c.weight)).slice(0,GAME_RULES.basketLimit):[],upgrades:Object.fromEntries(Object.keys(base.upgrades).map(id=>[id,Math.min(4,Math.max(0,Math.floor(Number(value.upgrades?.[id])||0)))])),sold:Number.isFinite(value.sold)?Math.max(0,Math.floor(value.sold)):0}}
export function saleValue(c){if(!c)return 0;const rarity=c.mutation==='特殊个体'||c.special?2:c.mutation?1.4:1;return Math.max(8,Math.round((30+Math.sqrt(Math.max(.001,c.weight))*35)*rarity))}
export function addToBasket(economy,c){if(!c||economy.basket.length>=GAME_RULES.basketLimit)return false;economy.basket.unshift({...c});return true}
export function sellBasket(economy,index=null){const selected=index===null?economy.basket.splice(0):index>=0&&index<economy.basket.length?economy.basket.splice(index,1):[];const earned=selected.reduce((sum,c)=>sum+saleValue(c),0);economy.coins+=earned;economy.sold+=selected.length;return {earned,count:selected.length}}
export function buyUpgrade(economy,id){const item=SHOP.find(x=>x.id===id),level=economy.upgrades[id]||0;if(!item||level>=4)return {ok:false,reason:'已经达到最高等级'};const price=item.prices[level];if(economy.coins<price)return {ok:false,reason:`还需要 ${price-economy.coins} 金币`};economy.coins-=price;economy.upgrades[id]=level+1;return {ok:true,name:item.levels[level+1],price}}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const START_DISTANCE=9;
const LANDING_DISTANCE=1.8;
const HOOKSET_DURATION=2.4;
export const FIGHT_LIMITS=Object.freeze({landingDistance:LANDING_DISTANCE,lineWarningAge:.95,overloadAge:.3,escapeExtra:3.49,maxElapsed:80});
export function lineBreakForce(f){return 26+(f?.levels?.line||0)*5+(f?.levels?.rod||0)*2}
export function createFight(c,upgrades={},options={}){const weight=Math.max(.01,c?.weight||.5),startDistance=START_DISTANCE,hookQuality=clamp(options.hookQuality??.65,.65,1),lead=(hookQuality-.65)/.35*.42,distance=startDistance-lead;return {fishPosition:.53,fishVelocity:0,progress:lead/(startDistance-LANDING_DISTANCE),tension:0,load:0,force:0,elapsed:0,overload:0,warningAge:0,lossReason:null,weight,seed:(weight*13.7)%6.28,levels:{rod:upgrades.rod||0,reel:upgrades.reel||0,line:upgrades.line||0},held:false,inputPulse:0,surge:0,surgeWarning:0,fatigue:0,status:'active',startDistance,distance,radialVelocity:0,lineLength:distance+.22,slack:.22,spoolVelocity:0,reelTurns:0,physicsCarry:0,hookQuality,pumpAge:0,pumpCooldown:0,pumpPulse:0,pumpQuality:0,pumps:0,goodPumps:0,fishState:'hookset',stateAge:0,stateDuration:HOOKSET_DURATION,stamina:1,pressure:0,runCount:0,runsSeen:0,cleanRuns:0,runReward:0,turnBonus:0,behaviorId:fishBehavior(c?.id).id};}
export function pumpOpportunity(f,held=f?.held){if(!f||f.status!=='active')return {ready:false,state:'done'};if((f.pumpAge||0)>0)return {ready:false,state:'lifting'};if((f.pumpCooldown||0)>0)return {ready:false,state:'lowering'};if(f.fishState==='hookset')return {ready:false,state:'settling'};if(f.slack>.58)return {ready:false,state:'slack'};if(f.fishState==='windup'||(f.surgeWarning||0)>.78)return {ready:false,state:'gathering'};if(f.fishState==='run'||f.fishState==='anchor'||f.load>.72)return {ready:false,state:f.fishState==='anchor'?'anchor':'surge'};if(held)return {ready:false,state:'reeling'};if((f.radialVelocity||0)>.25)return {ready:false,state:'moving'};return {ready:true,state:'opening'};}
export function pumpRod(f,held=f?.held){const chance=pumpOpportunity(f,held);if(!chance.ready)return {ok:false,state:chance.state};f.pumpAge=.68;f.pumpCooldown=1.18;f.pumpQuality=clamp((f.fishState==='recover'?1:.7)*(1-f.load*.45)*clamp(1-f.slack/.9,.15,1),.12,1);f.stamina=clamp((f.stamina??1)-.32*f.pumpQuality,0,1);f.fatigue=1-f.stamina;f.pumps=(f.pumps||0)+1;if(f.pumpQuality>=.55)f.goodPumps=(f.goodPumps||0)+1;return {ok:true,quality:f.pumpQuality,state:chance.state};}
function advanceFishState(f,h,held,difficulty){
 const behavior=fishBehavior(f.behaviorId);
 f.stateAge=(f.stateAge||0)+h;
 const state=f.fishState||'cruise';
 if(state==='windup'){
  f.surgeWarning=clamp(f.stateAge/f.stateDuration,0,1);f.surge=0;
  if(f.stateAge>=f.stateDuration){f.fishState='run';f.stateAge=0;f.stateDuration=behavior.run+difficulty*.35;f.runCount=(f.runCount||0)+1;f.runsSeen=(f.runsSeen||0)+1}
 }else if(state==='run'){
  const shape=Math.min(1,f.stateAge/.2,(f.stateDuration-f.stateAge)/.23);
  f.surge=Math.max(0,shape)*(.65+.35*(f.stamina??1));f.surgeWarning=0;
  if(f.stateAge>=f.stateDuration){
   const clean=(f.runReward||0)>=Math.min(FIGHT_FEEL_TUNING.cleanRunMinSeconds,f.stateDuration*.42);
   if(clean)f.cleanRuns=(f.cleanRuns||0)+1;
   const chained=behavior.chainEvery>0&&f.runCount%behavior.chainEvery!==0;
   const turnWindow=Math.max(.1,Math.min(.55,Number.isFinite(f.stateDuration)?f.stateDuration*.7:.55));
   const earnedTurn=clean?clamp((f.runReward||0)/turnWindow,0,1):0;
   f.turnBonus=Math.max(clamp(Number.isFinite(f.turnBonus)?f.turnBonus:0,0,1),earnedTurn);
   f.fishState=chained?'windup':behavior.anchor?'anchor':'recover';f.stateAge=0;
   f.stateDuration=chained?Math.max(.48,behavior.windup*.85):behavior.anchor||behavior.recover+difficulty*.3;
   f.surge=0;f.stamina=clamp((f.stamina??1)-.12-(f.runReward||0)*.11,0,1);f.runReward=0;
  }
 }else if(state==='anchor'){
  f.surge=.19;f.surgeWarning=0;
  if(f.stateAge>=f.stateDuration){f.fishState='recover';f.stateAge=0;f.stateDuration=behavior.recover+difficulty*.3;f.surge=0}
 }else{
  f.surge=0;f.surgeWarning=0;
  const recovery=state==='recover';
  f.stamina=clamp((f.stamina??1)+h*(recovery?.018:held?.005:.024),0,1);
   if(f.stateAge>=f.stateDuration){
    f.fishState=recovery?'cruise':'windup';f.stateAge=0;
    f.stateDuration=recovery?1.1+difficulty*.45:Math.max(.48,behavior.windup-difficulty*.22-(f.pressure||0)*.16);
    if(recovery)f.turnBonus=0;
   if(!recovery)f.runReward=0;
  }
 }
 f.pressure=clamp((f.pressure||0)+h*(held?.14:-.16),0,1);
 f.fatigue=1-(f.stamina??1);
}
function physicsStep(f,held,h){
 const difficulty=clamp(Math.sqrt(f.weight)/4.3,0,1),breakForce=lineBreakForce(f);
 const behavior=fishBehavior(f.behaviorId);
 f.elapsed+=h;
 const fishTarget=.5+Math.sin(f.elapsed*(1.35+difficulty*.45)*behavior.lateral+f.seed)*.23+Math.sin(f.elapsed*(3.6+difficulty)*behavior.lateral+f.seed*.7)*.07+f.surge*Math.sin(f.elapsed*(9.5+difficulty*2)*behavior.lateral+f.seed*1.7)*.11;
 const previousPosition=f.fishPosition;f.fishPosition+=(fishTarget-f.fishPosition)*Math.min(1,h*(3.5+difficulty));f.fishVelocity=(f.fishPosition-previousPosition)/h;
 advanceFishState(f,h,held,difficulty);
 f.pumpAge=Math.max(0,(f.pumpAge||0)-h);f.pumpCooldown=Math.max(0,(f.pumpCooldown||0)-h);
 f.pumpPulse=f.pumpAge>0?Math.sin(Math.PI*(1-f.pumpAge/.68)):0;
 // Rod lift takes in line without turning the reel; the reel only moves while winding or paying out.
 const turnBonus=['recover','windup'].includes(f.fishState)?clamp(Number.isFinite(f.turnBonus)?f.turnBonus:0,0,1):0;
 const reelSpeed=(1.08+(f.levels.reel||0)*.13)*behavior.reelFactor*clamp(1-f.force/breakForce*.48,.36,1)*(f.fishState==='run'?.48:f.fishState==='anchor'?.3:1)*(1+turnBonus*FIGHT_FEEL_TUNING.turnReelBonus);
 const lifting=!held&&f.pumpAge>0;
 const spoolVelocity=held?-reelSpeed:lifting?0:f.force>1||f.slack<.15?.45+clamp(f.force/breakForce,0,1)*.65:0;
 const lineVelocity=lifting?-FIGHT_FEEL_TUNING.pumpLiftLineSpeed*(f.pumpQuality||0)*(.4+.6*f.pumpPulse):spoolVelocity;
 f.spoolVelocity=spoolVelocity;
 f.lineLength=clamp(f.lineLength+lineVelocity*h,LANDING_DISTANCE,f.startDistance+3.5);
 // Gear ratio for the visible handle: roughly one turn per 0.74 m of line.
 f.reelTurns-=spoolVelocity*h*1.35;
 // A unilateral spring: loose line carries no compression. Damping only acts while taut.
 const stretch=Math.max(0,f.distance-f.lineLength),relativeSpeed=f.radialVelocity-lineVelocity;
 const rodPull=(8+15*(f.pumpQuality||0))*f.pumpPulse*clamp(1-Math.max(0,f.lineLength-f.distance)/.58,0,1);
 f.force=(stretch>0?Math.max(0,76*stretch+4.5*relativeSpeed):0)+rodPull;
 const settle=clamp(f.elapsed/HOOKSET_DURATION,0,1),entryForce=.15+.85*settle*settle*(3-2*settle);
 const fishThrust=(2.2+difficulty*1.2)*entryForce*(1-turnBonus*FIGHT_FEEL_TUNING.turnThrustReduction)+f.surge*(15+difficulty*18)*behavior.thrust*(1-.32*(1-(f.stamina??1)))+(f.fishState==='anchor'?3.5:0);
 const acceleration=(fishThrust-f.force-4.8*f.radialVelocity-turnBonus*FIGHT_FEEL_TUNING.turnInwardForce)/(1.6+difficulty*.8);
 f.radialVelocity=clamp(f.radialVelocity+acceleration*h,-2.8,2.8);
 f.distance=clamp(f.distance+f.radialVelocity*h,LANDING_DISTANCE-0.1,f.startDistance+3.5);
 f.slack=Math.max(0,f.lineLength-f.distance);
 if(f.fishState==='run'&&!held&&f.spoolVelocity>0&&f.slack<.55)f.runReward=(f.runReward||0)+h;
 f.tension=clamp(f.force/breakForce,0,1.5);
 f.load+=(f.tension-f.load)*(1-Math.exp(-h*(f.tension>f.load?5:2.5)));
 if(held&&f.load>.68)f.warningAge=(f.warningAge||0)+h;else if(!held&&f.load<.36)f.warningAge=0;
 f.progress=clamp((f.startDistance-f.distance)/(f.startDistance-LANDING_DISTANCE),0,1);
 f.overload=f.force>breakForce?f.overload+h:Math.max(0,f.overload-h*.35);
 if(f.distance<=LANDING_DISTANCE){f.status='won';f.lossReason=null}
 else if(f.overload>FIGHT_LIMITS.overloadAge&&f.warningAge>FIGHT_LIMITS.lineWarningAge){f.status='lost';f.lossReason='line-break'}
 else if(f.distance>=f.startDistance+FIGHT_LIMITS.escapeExtra){f.status='lost';f.lossReason='escaped'}
 else if(f.elapsed>FIGHT_LIMITS.maxElapsed){f.status='lost';f.lossReason='exhausted'}
}
export function stepFight(f,held,dt){if(!f||f.status!=='active')return f;if(!Number.isFinite(f.lineLength)){f.startDistance=START_DISTANCE;f.distance=START_DISTANCE-clamp(f.progress||0,0,1)*(START_DISTANCE-LANDING_DISTANCE);f.lineLength=f.distance+.22;f.radialVelocity=0;f.force=0;f.slack=.22;f.reelTurns=0;f.physicsCarry=0}else if(f.startDistance>START_DISTANCE+.1){const oldDistance=f.distance,ratio=(oldDistance-LANDING_DISTANCE)/(f.startDistance-LANDING_DISTANCE);f.distance=LANDING_DISTANCE+clamp(ratio,0,1.3)*(START_DISTANCE-LANDING_DISTANCE);f.lineLength=clamp(f.distance+f.lineLength-oldDistance,LANDING_DISTANCE,START_DISTANCE+3.5);f.startDistance=START_DISTANCE;f.progress=clamp((START_DISTANCE-f.distance)/(START_DISTANCE-LANDING_DISTANCE),0,1);f.overload=0}if(!Number.isFinite(f.load))f.load=f.tension||0;if(!f.fishState){f.fishState='cruise';f.stateAge=0;f.stateDuration=1.4;f.stamina=1}dt=clamp(dt,0,.12);if(held!==f.held)f.inputPulse=1;else f.inputPulse=Math.max(0,f.inputPulse-dt*3.4);f.held=held;f.physicsCarry=(f.physicsCarry||0)+dt;let steps=0;while(f.physicsCarry>=1/120&&steps++<15&&f.status==='active'){physicsStep(f,held,1/120);f.physicsCarry-=1/120}return f;}
