import {createRenderSettingsPanel} from './render-settings-panel.js?v=shading-7-absorption-range';
import{createWorld,createSpecimenViewer}from'./scene.js?v=beach-relief-20-force-surface';
import{phaseOf}from'./fishing-motion.js?v=line-physics-3-natural-bite';
import{fishingCue,rhythmPresentation,hookTiming,BITE_WINDOW_MS}from'./fishing-rhythm.mjs?v=quiet-cues-1';
import{fightRigGeometry}from'./fight-rig.mjs?v=2';
import{fightPerformance}from'./fight-performance.mjs?v=3-force-surface';
import{fightGuidance,liftOutcomeText}from'./fight-guidance.mjs?v=3';
import{fightOutlook,fightOutlookDisplay,fightLossCopy}from'./fight-outlook.mjs';
import{fightLossCue}from'./angler-feedback.mjs?v=loss-recoil-3';
import{createHaptics,fightHapticSample,fightHapticEvent}from'./haptics.mjs';
import{startReelGesture,moveReelGesture,controlOrigin,joystickVisual,joystickReleaseFrames,membranePath,gestureRodInput}from'./reel-gesture.mjs?v=convex-glass-9';
import{createReelSurface,reelSurfaceState,reelControlCaption}from'./reel-material.mjs';
import{fightControlMode}from'./fight-control.mjs';
import{isObjectCatch}from'./catch-kind.mjs';
import{fishBehavior,fightReport,bestFightReport,migrateFightRecords}from'./fish-behavior.mjs';
import{biteGuidance}from'./bite-guidance.mjs?v=2';
import{tripStory}from'./trip-summary.mjs';
import{SHOP,saleValue,sellBasket,buyUpgrade,createFight,stepFight,pumpOpportunity,pumpRod}from'./reference-loop.mjs?v=reel-ease-2-fight-panel-5-loss-reason';
import{SPOTS,BAITS,FISH,CLUES,GEAR,PROCESS_ACTIONS,signalFor,migrateBiteMode,weatherAt,newSave,migrateSave,validSave,spotUnlocked,equipGear,makeCast,expireHookWindow,markNearMiss,finishCast,settleEmptyCast,trackRelease,processHint,processCatch,startNextTrip}from'./engine.mjs?v=bite-action-2';
import {castPreset,castZone,confirmedCastPoint,openingCastPoint} from './cast-target.mjs';
import {castNeedsAimCamera} from './camera-interaction.mjs';
import {mountSetupUI} from './ui/setup.jsx';
import {mountJournalUI} from './ui/journal.jsx';
import {renderBookMarkup} from './ui/book-markup.mjs';
import {mountTripRoute} from './ui/trip-route.jsx';
import {GAME_RULES} from './config/game-rules.mjs';
import {catchActionPlan} from './catch-presentation.mjs';
import {shouldStartLanding} from './reel-transition.mjs';
import {explorationProgress,castDifficultyHint} from './progression-guide.mjs';
import {createAudioSystem} from './audio-system.mjs';
import {waitingWaterLine} from './next-cast-thread.mjs';
import {isOpeningCast} from './opening-cast.mjs';
const $=s=>document.querySelector(s),KEY=GAME_RULES.saveKey;
const haptics=createHaptics(pattern=>navigator.vibrate?.(pattern)??false,()=>performance.now(),()=>!document.hidden);
let state,storageOK=true;
try{const data=migrateSave(JSON.parse(localStorage.getItem(KEY)));state=validSave(data)?data:newSave()}catch{state=newSave()}
state.fightRecords=migrateFightRecords(state.fightRecords);
if(state.pending?.fight?.status==='active')stepFight(state.pending.fight,false,0);
if(state.pending?.phase==='cast'&&state.pending.catch){state.pending.signal=signalFor(state.pending.catch.id);migrateBiteMode(state.pending)}
let world=null,viewer=null,revealStart=0,fightLoss=null,thumbnails={},focusSpot=null,focusPulseAt=0,lastRelease=null,castEmotionAt=0,aimPoint=null,aimReturnState=null,aimSession=0,castQueued=false,inspectBiteAt=0,hookStrikeAt=0;
let tab='basket',revealing=false,aiming=false,overview=false,keepFishingView=!!state.pending?.landedFromFight,lastWeather='',toastTimer,lastAmbientAt=0,nextWaitMomentAt=0,waitMomentTimer=null,holdPointer=false,holdSpace=false,fightFrame=0,fightLast=0,fightSaved=0,pressBeganAt=0,tapHintUntil=0,tapFlashUntil=0,pumpHintUntil=0,pumpHintText='',pumpStartDistance=null,lastReelTick=0,lastFightDanger=false,lastReelSoundAt=0,lastFightHeldAudio=false,lastPayOutAt=0,lastSurgeAudio=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{storageOK=false;$('#saveState').textContent='当前浏览器无法保存进度'}}
function toast(t,brief=false,tone='tip'){$('.toast')?.remove();const el=document.createElement('div');el.className=`toast toast-${tone}`;el.setAttribute('role','status');const mark=document.createElement('span'),body=document.createElement('span'),label=document.createElement('small'),message=document.createElement('strong');mark.className='toast-mark';mark.setAttribute('aria-hidden','true');mark.textContent=tone==='warning'?'!':tone==='reward'?'✦':'✓';body.className='toast-body';label.textContent={tip:'水边提示',ready:'已就绪',reward:'新收获',warning:'留意'}[tone]||'水边提示';message.textContent=t;body.append(label,message);el.append(mark,body);document.body.append(el);clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),brief?1800:4000)}
function selectionNotice(t){toast(t,true,'ready')}
function setCastAction(available){const button=$('#cast');button.hidden=!available;button.disabled=!available;$('#game').classList.toggle('no-cast-action',!available)}
function thumb(id){if(!thumbnails[id]&&viewer)thumbnails[id]=viewer.thumbnail(id);return thumbnails[id]||''}
function selectSpot(id){if(state.pending)return;const spot=SPOTS.find(s=>s.id===id);if(!spotUnlocked(state,id)){toast(`还需 ${spot.unlock-explorationProgress(state)} 点探索进度，就能前往${spot.name}`,false,'warning');return}ensureAudio().then(()=>sound('spot'));state.spot=id;aimPoint=null;focusSpot=id;focusPulseAt=Date.now();save();renderSetup();selectionNotice(`钓点 · ${spot.name}`);$('#observation').textContent=id==='bridge'?'木桩下有大鱼绕行，留心鱼线。':id==='deep'?'外海看不清鱼影，多留意线的动静。':'浅滩有小鱼结群，麦粒更容易引来鱼口。';update()}
function selectBait(id){if(state.pending||state.bait===id)return;ensureAudio().then(()=>sound('bait'));state.bait=id;save();renderSetup();selectionNotice(`鱼饵 · ${BAITS.find(b=>b.id===id).name}`);update()}
function followGuide(action){
 if(!action||state.pending||aiming||revealing)return;
 if(action.kind==='spot'){selectSpot(action.spot);return}
 if(action.kind==='bait'){selectBait(action.bait);return}
 if(action.kind==='aim'&&beginCastAim()){setAimPoint(action.point||castPreset(state.spot,action.zone));update()}
}
const setupUI=mountSetupUI($('#spots'),$('#baits'),selectSpot,selectBait);
const tripRoute=mountTripRoute($('#tripRoute'),()=>showBook('water'),followGuide);
let bookTabAnimation=null;
const journalUI=mountJournalUI($('#bookHeading'),$('#bookTabs'),id=>{
 sound('ui');tab=id;renderBook();
 if(!reduced&&$('#book').open){bookTabAnimation?.cancel();bookTabAnimation=$('#bookContent').animate(
  [{opacity:.45,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],
  {duration:190,easing:'cubic-bezier(.22,1,.36,1)'});}
});
function renderTripSummary(){tripRoute.update(state);$('#tripState').textContent=`第 ${state.trip.number} 轮 · 剩 ${state.trip.castsLeft} 竿`;$('#knowledge').textContent=`探索 ${explorationProgress(state)}`;$('#tripGoal').textContent=state.trip.goal.name;$('#tripProgress').textContent=`已完成 ${state.trip.goal.progress} / ${state.trip.goal.target}`;$('#tripEvent').textContent=state.trip.rule.name;$('#tripTracking').textContent=`已触发 ${state.trip.rule.triggers||0} 次 · 追踪 ${state.tracked.length} / 3`}
function renderSetup(){
 setupUI.update(state);
 const spot=SPOTS.find(s=>s.id===state.spot);$('#location').textContent=`${spot.name} · 水深 ${spot.depth}`;renderTripSummary();
}
const audioSystem=createAudioSystem({button:$('#sound')});
const {sound,realSound,ensureAudio,shoreWave,startReelLoop,stopReelLoop,updateCastLine,stopCastLine}=audioSystem;
$('#sound').onclick=async()=>{try{if(!await audioSystem.toggle())toast('请再次点击开启环境声')}catch{toast('这个浏览器暂时无法播放环境声')}};
function unlockAudioOnGesture(e){if(!audioSystem.wantsGesture()||e.target?.closest?.('#sound'))return;void ensureAudio()}
document.addEventListener('pointerdown',unlockAudioOnGesture,{capture:true});
document.addEventListener('keydown',unlockAudioOnGesture,{capture:true});
function beginCastAim(){if(state.pending||aiming)return false;if($('#book').open)$('#book').close();if($('#tripEnd').open)$('#tripEnd').close();$('#tripDetails').open=false;aimReturnState={overview,keepFishingView};aimSession++;aiming=true;aimPoint=isOpeningCast(state)?openingCastPoint():castPreset(state.spot);overview=false;keepFishingView=true;world?.prepareCast();void ensureAudio();update();return true}
function setAimPoint(point){if(!aiming||!point||castQueued)return;aimPoint=point}
function startAimFromWater(point){if(!point||!beginCastAim())return false;setAimPoint(point);haptics.emit('tap');return true}
function inspectBite(){if(phaseOf(state.pending)!=='reading')return;inspectBiteAt=Date.now();haptics.emit('tap')}
async function cast(){const point=confirmedCastPoint(state.spot,aiming,aimPoint);if(state.pending||!point||castQueued)return;castQueued=true;const session=aimSession,castFromOverview=overview,waitForCamera=castNeedsAimCamera(castFromOverview),started=performance.now();update();while(waitForCamera&&world&&!world.isAimReady()&&performance.now()-started<1800){await new Promise(resolve=>setTimeout(resolve,16));if(session!==aimSession||!aiming)return}if(session!==aimSession||!aiming)return;if(waitForCamera&&world&&!world.isAimReady())world.finishAimTransition();if(state.trip.castsLeft<=0){startNextTrip(state);save();renderSetup()}world?.commitCastAim();aimReturnState=null;aiming=false;overview=castFromOverview;keepFishingView=true;castEmotionAt=Date.now();state.pending=makeCast(state,castEmotionAt,Math.random,point);aimPoint=null;castQueued=false;save();renderSetup();update();await ensureAudio();sound('cast');}
function cancelCastAim(){if(!aiming)return;aimSession++;castQueued=false;aiming=false;aimPoint=null;overview=aimReturnState?.overview??false;keepFishingView=aimReturnState?.keepFishingView??false;aimReturnState=null;world?.cancelCastAim();update()}
$('#cancelAim').onclick=cancelCastAim;
const fightUI=Object.fromEntries([
 'fight','fightRig','fightRigRod','fightRigLine','fightRigFish','fightRigWake','fightRigLineTip',
 'fightLineState','fightTravel','fightPercent','fightMode','fightSpecies','fightBeat','fightBeatTitle',
 'fightBeatHint','fightOutlook','fightOutlookTitle','fightLineStatus','fightApproachFill','fightHold',
 'fightHoldLabel','fightHoldHint','fightFeedback'
].map(id=>[id,document.getElementById(id)]));
const reelSurface=createReelSurface(document.getElementById('fightSurface'),fightUI.fightHold);
const fightText=(node,value)=>{if(node.textContent!==value)node.textContent=value};
const fightAttr=(node,name,value)=>{if(node.getAttribute(name)!==value)node.setAttribute(name,value)};
const fightData=(node,name,value)=>{if(node.dataset[name]!==value)node.dataset[name]=value};
const fightClass=(node,name,enabled)=>{if(node.classList.contains(name)!==enabled)node.classList.toggle(name,enabled)};
let joystickReleaseFrame=0;
function setMembraneScale(scale,button=fightUI.fightHold){
 const quantized=Number.isFinite(scale)?Math.round(Math.max(.35,Math.min(3,scale))*200)/200:1;
 if(button.dataset.membraneScale===String(quantized))return;
 button.dataset.membraneScale=String(quantized);
 button.style.setProperty('--membrane-squash',quantized<1?String(1+(quantized-1)*.5):'1');
 button.style.setProperty('--membrane-tension',String(Math.max(0,(quantized-1)/2)));
 const d=membranePath(Math.max(1,quantized));
 for(const id of ['fightMembraneMask','fightMembraneHalo','fightMembraneFill','fightMembraneDepth','fightMembraneRim'])fightAttr(document.getElementById(id),'d',d);
}
function setMembraneAngle(button,angle){
 const degrees=Number.isFinite(angle)?angle:0;
 button.dataset.membraneAngle=String(degrees);
 button.style.setProperty('--blob-angle',`${degrees}deg`);
 const fixedLight=`rotate(${-degrees} 0 0)`;
 for(const id of ['fightGlassBody','fightGlassDepth','fightGlassGlint'])fightAttr(document.getElementById(id),'gradientTransform',fixedLight);
}
function cancelJoystickRelease(button=fightUI.fightHold){
 cancelAnimationFrame(joystickReleaseFrame);joystickReleaseFrame=0;
 button.classList.remove('releasing');
}
function releaseJoystick(button,scale){
 cancelJoystickRelease(button);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){setMembraneScale(1,button);setMembraneAngle(button,0);return}
 button.classList.add('releasing');
 const frames=joystickReleaseFrames(scale),started=performance.now();
 function tick(now){
  const progress=Math.min(1,(now-started)/200),end=progress<=frames[1].offset?1:2,start=end-1;
  const local=(progress-frames[start].offset)/(frames[end].offset-frames[start].offset);
  setMembraneScale(frames[start].scale+(frames[end].scale-frames[start].scale)*local,button);
  if(progress<1)joystickReleaseFrame=requestAnimationFrame(tick);
  else{joystickReleaseFrame=0;setMembraneAngle(button,0);button.classList.remove('releasing')}
 }
 joystickReleaseFrame=requestAnimationFrame(tick);
}
function renderFight(f){
 if(!f)return;
 const held=holdPointer||holdSpace,pressed=!!reelGesture||holdSpace,paying=!!reelGesture?.paying,now=performance.now(),load=f.load??f.tension,outlook=fightOutlook(f),outlookDisplay=fightOutlookDisplay(outlook),danger=load>.68||outlook.state==='line-critical',pose=fightPerformance(f);
 const opening=pumpOpportunity(f,held),windup=(f.surgeWarning||0)>.48&&(f.surge||0)<.35;
 const beatState=danger?'strain':opening.state==='lifting'||opening.state==='lowering'?opening.state:(f.surge||0)>.52?'surge':windup?'gathering':opening.state;
 const guide=outlook.state==='line-critical'?{step:'release',title:'下压让线',reason:outlook.action,beat:'断线边缘'}:outlook.state==='escaping'||outlook.state==='exhausted'?{step:'reel',title:'稳住收线',reason:outlook.action,beat:'鱼正远去'}:paying?{...fightGuidance(f,false),title:'正在让线，守住张力',reason:'滑回中位继续收线',beat:'放线缓冲'}:fightGuidance(f,held);
 const behavior=fishBehavior(f.behaviorId);
 const rig=fightRigGeometry(f),rigEl=fightUI.fightRig;
 fightData(rigEl,'line',rig.state);fightData(rigEl,'beat',beatState);fightData(rigEl,'movement',rig.movement);
 rigEl.style.setProperty('--surge',Math.min(1,f.surge||0).toFixed(2));
 rigEl.style.setProperty('--fish-x',`${rig.fishX/4.2}%`);
 fightAttr(fightUI.fightRigRod,'d',rig.rod);fightAttr(fightUI.fightRigLine,'d',rig.line);
 fightAttr(fightUI.fightRigFish,'transform',rig.fish);fightAttr(fightUI.fightRigWake,'transform',rig.wake);
 fightAttr(fightUI.fightRigLineTip,'cy',String(rig.tipY));
 fightText(fightUI.fightLineState,rig.lineText);
 fightText(fightUI.fightTravel,rig.movement==='in'?'← 正被拉近':rig.movement==='out'?'正在往外游 →':'鱼在原地挣扎');
 fightText(fightUI.fightPercent,outlookDisplay.distance);
 fightData(fightUI.fightOutlook,'state',outlook.state);
 fightText(fightUI.fightOutlookTitle,outlookDisplay.statusTitle);fightText(fightUI.fightLineStatus,outlookDisplay.lineStatus);
 fightUI.fightApproachFill.style.width=`${(outlook.approach*100).toFixed(1)}%`;
 fightText(fightUI.fightSpecies,`${behavior.name} · ${behavior.habit}`);
 fightText(fightUI.fightMode,guide.title);fightData(fightUI.fight,'next',guide.step);
 fightClass(fightUI.fight,'danger',danger);fightClass(fightUI.fight,'warning',load>.48);fightClass(fightUI.fight,'pulling',held);
 fightData(fightUI.fightBeat,'state',beatState);
 fightText(fightUI.fightBeatTitle,guide.beat);fightText(fightUI.fightBeatHint,guide.reason);
 const holdButton=fightUI.fightHold;
 const swipeReady=pumpOpportunity(f,false).ready,gestureLifted=!!reelGesture?.lifted;
 fightData(holdButton.parentElement,'mode','reel');
 fightData(holdButton,'mode','reel');
 fightClass(holdButton,'held',pressed);fightClass(holdButton,'paying',paying);fightClass(holdButton,'tap-flash',now<tapFlashUntil);
 fightClass(holdButton,'lift-ready',swipeReady&&!gestureLifted);fightClass(holdButton,'lifting',gestureLifted||pose.lift>.07);
 const viewport=window.visualViewport;
 const gameBounds=$('#game').getBoundingClientRect();
 const buttonBounds=holdButton.getBoundingClientRect();
 const viewportBounds={left:viewport?.offsetLeft??0,right:(viewport?.offsetLeft??0)+(viewport?.width??window.innerWidth),top:viewport?.offsetTop??0,bottom:(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight)};
 const visual=reelGesture?joystickVisual(reelGesture.startX,reelGesture.startY,reelGesture.currentX,reelGesture.currentY,buttonBounds.left+reelGesture.origin.x,buttonBounds.top+reelGesture.origin.y,gameBounds,viewportBounds):null;
 fightClass(holdButton,'dragging',!!visual?.active);
 if(visual){setMembraneScale(visual.scale,holdButton);setMembraneAngle(holdButton,Number((-visual.angle).toFixed(1)))}
 fightAttr(holdButton,'aria-pressed',String(pressed));
 fightData(holdButton,'spool',(f.spoolVelocity||0)>.06?'paying':held?'winding':'idle');
 holdButton.style.setProperty('--spool-angle',`${Math.round((Number.isFinite(f.reelTurns)?f.reelTurns:0)*40)}deg`);
 fightText(fightUI.fightHoldLabel,reelControlCaption({held,paying,lifted:gestureLifted,danger,ready:swipeReady}));
 fightText(fightUI.fightHoldHint,paying?'正在让线，滑回中位继续收线':gestureLifted?'抬竿拉近鱼，滑回中位继续收线':danger?'线太紧，下压或松手让线':swipeReady?'鱼放缓了，上提抬竿':opening.state==='settling'?'先收紧线，观察竿弯':opening.state==='lowering'?'竿回落，按住收线守住':held?'按住收线，等鱼放缓':pose.payout>.15?'鱼正在游远，等它放缓':'按住收线 · 下压或松手让线');
 fightData(holdButton,'cue',danger?'release':paying?'payout':gestureLifted?'return':swipeReady?'lift':'hold');
 fightAttr(holdButton,'aria-label',`${fightUI.fightHoldLabel.textContent}，${fightUI.fightHoldHint.textContent}。按住收线，鱼放缓时上提抬竿，下压或松手让线，左右调整竿向，滑回中位继续收线`);
 reelSurface.render(reelSurfaceState({fight:f,held,paying,ready:swipeReady,visual:{scale:Number(holdButton.dataset.membraneScale)||1,angle:Number(holdButton.dataset.membraneAngle)||0},now,reducedMotion:reduced}));
 fightText(fightUI.fightFeedback,now<pumpHintUntil?(pumpStartDistance===null||f.pumpAge>.02?pumpHintText:liftOutcomeText(f,pumpStartDistance)):now<tapHintUntil?'要按住线轮持续收线':'');
}
function renderStrikeControl(mode='strike'){
 const button=fightUI.fightHold;
 fightData(button.parentElement,'mode',mode);
 fightData(button,'mode',mode);fightClass(button,'held',false);fightClass(button,'paying',false);fightClass(button,'lift-ready',false);fightClass(button,'lifting',false);fightClass(button,'dragging',false);
 setMembraneScale(1,button);setMembraneAngle(button,0);fightData(button,'cue','hold');fightAttr(button,'aria-pressed','false');
 fightText(fightUI.fightHoldLabel,reelControlCaption({mode}));fightText(fightUI.fightHoldHint,mode==='retrieve'?'钩上似乎挂了东西，点按收回':'按住提竿，继续收线');
 fightAttr(button,'aria-label',mode==='retrieve'?'钩上似乎挂了东西，点按收回':'鱼已咬稳，按住提竿并继续收线');
 button.style.setProperty('--spool-angle','0deg');reelSurface.render(reelSurfaceState({now:performance.now(),reducedMotion:reduced}));
}
function pumpFish(){const f=state.pending?.fight;if(!f||f.status!=='active')return;const startDistance=f.distance,outcome=pumpRod(f,holdPointer||holdSpace);if(outcome.ok){pumpStartDistance=startDistance;sound('pump');haptics.emit('pump');pumpHintText='抬竿正在拉近；竿回落后按住收线。';pumpHintUntil=performance.now()+2000;save()}else{pumpStartDistance=null;pumpHintText={lifting:'竿还在抬起。',lowering:'竿正在回落，按住收线。',slack:'线松了，先收紧。',reeling:'先松开线轮，再抬竿。',gathering:'鱼正在蓄力，先等它停下。',surge:'鱼在冲刺，先让线。',moving:'鱼正往远处游，先收线稳住。'}[outcome.state]||'鱼还在发力，等它放缓再抬竿。';pumpHintUntil=performance.now()+900;haptics.emit('invalid')}renderFight(f)}
function expireBite(now=Date.now()){if(!expireHookWindow(state,now))return false;sound('escape');save();return true}
function stopFight(won){stopReelLoop();cancelAnimationFrame(fightFrame);fightFrame=0;holdPointer=holdSpace=false;reelGesture=null;cancelJoystickRelease();setMembraneScale(1);setMembraneAngle(fightUI.fightHold,0);fightUI.fightHold.classList.remove('dragging');resetPull();lastFightDanger=false;$('#fight').hidden=true;$('#fightControl').hidden=true;$('#game').classList.remove('fighting');state.pending.landedFromFight=won;if(!won){const loss=fightLossCopy(state.pending.fight);fightLoss=fightLossCue(state.pending.fight,state.pending.start,Date.now());const reason=fightLoss?.reason||'escaped';markNearMiss(state.pending,'escaped');state.pending.catch=null;state.pending.reaction=loss.reaction;sound('escape',reason);haptics.emit(reason==='line-break'?'line-break':'escaped');toast(loss.toast,false,'warning')}else if(state.pending.catch){fightLoss=null;const c=state.pending.catch,report=fightReport(state.pending.fight);c.fightReport=report;if(!FISH.find(x=>x.id===c.id)?.object){const old=state.fightRecords[c.id];state.fightRecords[c.id]=bestFightReport([{id:c.id,fightReport:old},{id:c.id,fightReport:report}],c.id)}}state.pending.fight=null;save();if(won){overview=false;keepFishingView=true;$('#story').textContent='';sound('landingSuccess');haptics.emit('landed')}finishReel()}
function tickFight(now){const f=state.pending?.fight;if(!f||f.status!=='active'||document.hidden){fightFrame=0;return}const dt=fightLast?Math.min(.06,(now-fightLast)/1000):0;fightLast=now;const held=holdPointer||holdSpace;const beforeHaptic=fightHapticSample(f);stepFight(f,held,dt);const physicalCue=fightHapticEvent(beforeHaptic,f);if(physicalCue)haptics.emit(physicalCue);const reelTick=Math.floor(f.reelTurns||0);if(held&&reelTick>lastReelTick){realSound('uiClickSoft',{gain:.11+Math.min(.12,f.load*.12),rate:1.17-Math.min(.22,f.load*.20),duration:.07,pan:-.1});lastReelTick=reelTick}else if(!held)lastReelTick=reelTick;if(held&&(f.spoolVelocity||0)<-.08){if(!startReelLoop(.62+Math.min(.18,f.load*.18))&&now-lastReelSoundAt>280){realSound('reel',{gain:.43,rate:1.0,offset:Math.abs((f.reelTurns||0)*.37)%7,duration:.38,pan:-.06});lastReelSoundAt=now}}else stopReelLoop();if(!held&&(f.spoolVelocity||0)>.12&&(lastFightHeldAudio||now-lastPayOutAt>1600)){sound('linePayOut');lastPayOutAt=now}lastFightHeldAudio=held;const windup=f.surgeWarning>.7&&f.surge<.3;if(windup&&!f.windupCue){sound('surgeWarning')}f.windupCue=windup;const surging=f.surge>.55;if(surging&&!lastSurgeAudio)sound('surge');lastSurgeAudio=surging;const danger=f.load>.68;if(danger&&!lastFightDanger){sound('lineStrain')}lastFightDanger=danger;renderFight(f);if(now-fightSaved>500){save();fightSaved=now}if(f.status!=='active'){stopFight(f.status==='won');return}fightFrame=requestAnimationFrame(tickFight)}
function startFight(){if(!state.pending?.catch||isObjectCatch(state.pending.catch)||state.pending.fight?.status==='active'&&fightFrame)return;fightLoss=null;if(state.pending.fight?.status!=='active'||!Number.isFinite(state.pending.fight.fishPosition)||!Number.isFinite(state.pending.fight.lineLength)){const struckAt=Date.now(),timing=hookTiming(state.pending.readyAt,struckAt,state.pending.biteWindowMs||BITE_WINDOW_MS);state.pending.liftedAt=struckAt;state.pending.hookQuality=timing.quality;state.pending.fight=createFight(state.pending.catch,state.economy.upgrades,{hookQuality:timing.quality});hookStrikeAt=struckAt;sound('hook');haptics.emit('hook')}else state.pending.liftedAt ||= Date.now();$('#fight').hidden=false;$('#fightControl').hidden=false;$('#landFish').hidden=true;$('#game').classList.add('fighting');$('#sceneAction').hidden=true;$('#biteReadout').hidden=true;$('#cast').disabled=true;$('#cast').textContent='正在收线';lastReelTick=Math.floor(state.pending.fight.reelTurns||0);lastFightDanger=false;lastReelSoundAt=0;lastFightHeldAudio=false;lastPayOutAt=0;lastSurgeAudio=false;pumpHintUntil=0;pumpStartDistance=null;reelGesture=null;cancelJoystickRelease();setMembraneScale(1);setMembraneAngle(fightUI.fightHold,0);renderFight(state.pending.fight);fightLast=0;save();update();fightFrame=requestAnimationFrame(tickFight)}
function settleEmptyResult(){const p=state.pending;if(!p||p.catch)return;const escaped=/挣脱|脱钩|断线/.test(p.reaction||''),result=settleEmptyCast(state);if(!result)return;aiming=false;overview=false;keepFishingView=true;world?.reset();save();$('#observation').textContent=state.waterTrail?`${p.reaction||'鱼口散了。'} 刚才的鱼影仍在附近，同钓点同鱼饵再抛，可能追上它。`:escaped?`${p.reaction||'鱼挣脱了。'} 下一竿再试。`:p.reaction||'鱼口散了。水面重新平静，可以再抛一竿。';$('#story').textContent='';sound(escaped?'lost':'empty');renderSetup();update();if(result.tripEnded)showTripEnd()}
function finishReel(){if(revealing||state.pending?.phase!=='cast')return;revealing=true;revealStart=Date.now();void ensureAudio();const caught=!!state.pending.catch,showcase=caught&&!!state.pending.landedFromFight,escaped=!caught&&/挣脱|脱钩|断线/.test(state.pending.reaction||'');$('#sceneAction').hidden=true;$('#fightControl').hidden=true;$('#biteReadout').hidden=true;$('#landFish').hidden=true;$('#landingCue').hidden=false;$('#cast').disabled=true;$('#cast').textContent=showcase?'展示钓获':caught&&isObjectCatch(state.pending.catch)?'收回挂物':caught?'收鱼中':'收回空线';$('#story').textContent=caught?'':escaped?`${state.pending.reaction} 慢慢收回鱼线。`:'浮漂回稳，带着鱼饵收回鱼线。';if(!caught&&!escaped)sound('retrieve');update();let reelPulseTimer=null;const beginEmptyReelAudio=()=>{if(!revealing)return;if(!startReelLoop(.55)){sound('reel','retrieve');reelPulseTimer=setInterval(()=>{if(revealing)sound('reel','retrieve');else clearInterval(reelPulseTimer)},390)}};if(!showcase){if(escaped)setTimeout(beginEmptyReelAudio,350);else beginEmptyReelAudio()}setTimeout(()=>{stopReelLoop();clearInterval(reelPulseTimer);if(!revealing)return;$('#landingCue').hidden=true;if(caught){finishCast(state);save();showResult();if(showcase){renderSetup();update();return}}revealing=false;if(!caught)settleEmptyResult();renderSetup();update()},caught?3200:2200)}
async function reel(){const now=Date.now();expireBite(now);const phase=phaseOf(state.pending,now);if(!state.pending||revealing||state.pending.phase==='result'||!['hooked','empty'].includes(phase))return;if(phase==='hooked'&&state.pending.catch){if(isObjectCatch(state.pending.catch)){state.pending.liftedAt=now;save();finishReel()}else startFight();return}finishReel()}
$('#cast').onclick=()=>{if(state.pending){reel();return}if(!aiming)beginCastAim();else void cast()};
$('#sceneAction').onclick=reel;
let reelGesture=null;
function resetPull(){fightUI.fightHold.style.setProperty('--thumb-shift','0px')}
$('#fightHold').addEventListener('pointerdown',e=>{if(reelGesture)return;let mode=fightControlMode(state.pending,Date.now(),revealing);if(mode==='hidden')return;e.preventDefault();if(mode==='retrieve'){void reel();return}if(mode==='strike'){void reel();mode=fightControlMode(state.pending,Date.now(),revealing)}if(mode!=='reel')return;reelGesture=startReelGesture(e.pointerId,e.clientY,e.clientX);if(!reelGesture)return;const button=$('#fightHold'),origin=controlOrigin(button.getBoundingClientRect());cancelJoystickRelease(button);reelGesture={...reelGesture,origin};setMembraneAngle(button,0);setMembraneScale(1,button);resetPull();holdPointer=true;pressBeganAt=performance.now();tapHintUntil=0;button.setPointerCapture(e.pointerId);renderFight(state.pending?.fight);if(!startReelLoop(.65))sound('reel');lastReelSoundAt=performance.now();});
$('#fightHold').addEventListener('click',e=>{if(e.detail===0&&['strike','retrieve'].includes(fightControlMode(state.pending,Date.now(),revealing)))void reel()});
$('#fightHold').addEventListener('pointermove',e=>{if(!reelGesture||e.pointerId!==reelGesture.pointerId)return;const next=moveReelGesture(reelGesture,state.pending?.fight,e.clientY,e.clientX);reelGesture=next.gesture;if(next.action==='lift'){holdPointer=false;stopReelLoop();pumpFish()}else if(next.action==='payout'){holdPointer=false;stopReelLoop();sound('linePayOut');lastPayOutAt=performance.now();lastFightHeldAudio=false;renderFight(state.pending?.fight)}else if(next.action==='reel'){holdPointer=true;renderFight(state.pending?.fight)}else renderFight(state.pending?.fight)});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#fightHold').addEventListener(event,e=>{if(!reelGesture||e.pointerId!==reelGesture.pointerId)return;const button=$('#fightHold');if(event==='pointerup'&&Number.isFinite(e.clientX)&&Number.isFinite(e.clientY))reelGesture={...reelGesture,currentX:e.clientX,currentY:e.clientY};const rect=button.getBoundingClientRect(),visual=joystickVisual(reelGesture.startX,reelGesture.startY,reelGesture.currentX,reelGesture.currentY,rect.left+reelGesture.origin.x,rect.top+reelGesture.origin.y,$('#game').getBoundingClientRect(),{left:0,top:0,right:innerWidth,bottom:innerHeight});const releaseScale=visual.scale;reelGesture=null;resetPull();const wasHeld=holdPointer;holdPointer=false;stopReelLoop();const now=performance.now();if(wasHeld&&now-pressBeganAt<160){tapHintUntil=now+1000;tapFlashUntil=now+330}renderFight(state.pending?.fight);releaseJoystick(button,releaseScale)});
function setResultActionsExpanded(expanded){const dialog=$('#result'),button=$('#moreCatchActions');dialog.dataset.expanded=String(expanded);button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'收起其他处理方式':'换一种处理方式'}
function renderResultChoices(c,f,sameCount){
 const goal=state.trip.goal,{recommended,notable}=catchActionPlan(state,c,f,sameCount),chosen=PROCESS_ACTIONS.find(action=>action.id===recommended);
 $('#resultChoiceTitle').textContent=goal&&!goal.complete?`本轮目标：${goal.name}`:'本轮目标已完成';
 $('#resultChoiceHelp').textContent=notable?'这次钓获值得多看一眼，再决定如何留下记录。':goal&&!goal.complete?`进度 ${goal.progress}/${goal.target} · 可直接采用建议，也可换一种处理方式`:'可直接做成记录，也可换一种处理方式';
 const ordered=[chosen,...PROCESS_ACTIONS.filter(action=>action.id!==recommended)];
 const actionButton=(action,index)=>`<button class="${index?'process-option':'process-recommended'}" data-process="${action.id}"><span class="process-mark">${index?'其他选择':'建议'}</span><strong>${action.name}</strong><small>${processHint(state,action.id,c)}</small><span class="process-arrow" aria-hidden="true">›</span></button>`;
 $('#processActions').innerHTML=actionButton(ordered[0],0);
 $('#otherCatchActions').innerHTML=ordered.slice(1).map((action,index)=>actionButton(action,index+1)).join('');
 setResultActionsExpanded(notable);
}
function showResult(playSound=true){const p=state.pending;if(!p||p.phase!=='result')return;if(!p.catch){settleEmptyResult();return}const c=p.catch,f=c?FISH.find(f=>f.id===c.id):null,same=c?state.log.filter(x=>x.id===c.id):[],escaped=!c&&/挣脱|脱钩|断线/.test(p.reaction||'');$('#resultLabel').textContent=!c?escaped?'本竿 · 鱼挣脱':'本竿 · 未钓到鱼':c.tagId?'追踪个体再次出现':f.special?'特殊个体':same.length===1?'首次记录':c.weight>=Math.max(...same.map(x=>x.weight))?'重量纪录':'重复记录';
 $('#specimen').style.display=c?'block':'none';$('#result').classList.toggle('no-catch',!c);$('#result').classList.toggle('bait-remains',!c&&!p.liftedAt);if(c&&viewer){viewer.set(c.id,c.variation);viewer.show(true);}$('#catchName').textContent=f?.name||(escaped?'鱼挣脱了':'钩上没有鱼');$('#catchDesc').textContent=f?.desc||(escaped?'这一竿没留住它。下次线绷紧时，先松手放线。':`${p.reaction||'鱼没有咬牢。'} 鱼饵还在，下一竿继续试试。`);$('#catchStats').innerHTML=c?`<div>${c.weight<.1?Math.round(c.weight*1000)+' g':c.weight.toFixed(2)+' kg'}<small>${f.object?'物体重量':'本次重量'}</small></div><div>${c.length}<small>厘米</small></div>${c.tagId?`<div>${c.returnCount}<small>已放流次数</small></div>`:c.mutation?`<div>${c.mutation}<small>个体特征</small></div>`:''}`:'';$('#catchMemory').textContent=c?p.reaction||(p.clue?CLUES[p.clue]:`${c.variation} · ${SPOTS.find(s=>s.id===p.spot).name} · ${p.weather.name}`):'';if(c?.fightReport){$('#catchStats').insertAdjacentHTML('beforeend',`<div>${c.fightReport.grade}<small>搏鱼评级</small></div>`);$('#catchMemory').textContent=`成功让线 ${c.fightReport.cleanRuns}/${c.fightReport.runsSeen} 次 · 有效抬竿 ${c.fightReport.goodPumps} 次 · ${c.fightReport.seconds} 秒。 `+$('#catchMemory').textContent}const opening=!$('#result').open;if(opening)$('#result').showModal();if(c){renderResultChoices(c,f,same.length);if(opening&&playSound)sound('catch',{special:!!f?.special||!!c.tagId,first:same.length===1,weight:c.weight})}else if(opening&&playSound)sound(escaped?'lost':'empty')}
function showTripEnd(){if($('#tripEnd').open)return;const story=tripStory(state.trip);$('#tripTitle').textContent=`第 ${state.trip.number} 轮 · 收竿`;$('.trip-end-intro').textContent=story.lead;const summary=$('#tripSummary');summary.replaceChildren();for(const note of story.notes){const card=document.createElement('article'),label=document.createElement('span'),title=document.createElement('h3'),body=document.createElement('p');card.className=`trip-note trip-note-${note.kind}`;label.textContent=note.label;title.textContent=note.title;body.textContent=note.body;card.append(label,title,body);summary.append(card)}$('#tripEnd').show()}
function handleProcess(action){const caught=state.pending?.catch,clue=state.pending?.clue,result=processCatch(state,action);if(!result)return;if(result.error){toast(result.error);return}revealing=false;if(action==='release'&&caught&&!FISH.find(f=>f.id===caught.id)?.object)lastRelease={...caught,at:Date.now(),spot:state.pending.spot};state.pending=null;aiming=false;overview=false;keepFishingView=true;if(typeof world!=='undefined')world?.reset();sound(action==='release'?'release':action==='keep'?'keep':action==='analyze'?'analyze':'study');save();viewer?.show(false);$('#result').close();$('#observation').textContent=result.text;$('#story').textContent=result.text;if(result.tracking)toast(result.trackingText,false,'reward');else if(result.eventTriggered)toast(`水域事件：${state.trip.rule.name}`,false,'reward');renderSetup();update();if(result.tripEnded)showTripEnd();else if(clue)setTimeout(()=>{$('#observation').textContent=CLUES[clue]},1800)}
for(const id of ['processActions','otherCatchActions'])$("#"+id).addEventListener('click',e=>{const b=e.target.closest('[data-process]');if(b)handleProcess(b.dataset.process)});$('#result').addEventListener('cancel',e=>{e.preventDefault();if(!state.pending?.catch)handleProcess('study')});
$('#moreCatchActions').onclick=()=>setResultActionsExpanded($('#result').dataset.expanded!=='true');
$('#result').addEventListener('click',e=>{if(e.target===$('#result')&&!state.pending?.catch)handleProcess('study')});
$('#nextTrip').onclick=()=>{startNextTrip(state);save();$('#tripEnd').close();$('#story').textContent='新一轮开始，水下又有了新动静。';renderSetup();update()};$('#dismissTrip').onclick=()=>$('#tripEnd').close();
function showBook(nextTab='basket'){if(state.pending?.fight?.status==='active'){toast('先完成这次收线。');return}$('#tripDetails').open=false;if($('#tripEnd').open)$('#tripEnd').close();tab=nextTab;renderBook();if(!$('#book').open)$('#book').show();$('#closeBook').focus()}
$('#journal').onclick=()=>{ensureAudio().then(()=>sound('ui'));showBook()};$('#clueButton').onclick=()=>{ensureAudio().then(()=>sound('ui'));showBook('clues')};$('#tripOpenWater').onclick=()=>showBook('water');$('#closeBook').onclick=()=>{sound('ui');$('#book').close();$('#journal').focus()};
document.addEventListener('pointerdown',e=>{if($('#tripDetails').open&&!e.target.closest('#tripDetails'))$('#tripDetails').open=false});
function renderBook(){journalUI.update(tab);$('#bookContent').innerHTML=renderBookMarkup(state,tab,thumb)}
$('#bookContent').addEventListener('click',e=>{const ret=e.target.closest('[data-return]');if(ret){const [c]=state.collection.splice(Number(ret.dataset.return),1);if(c&&!FISH.find(f=>f.id===c.id)?.object){state.ecosystem[c.id]=Math.min(2.5,(state.ecosystem[c.id]||1)+.18);const tracking=trackRelease(state,c,c.spot);toast(tracking.tracked?'已放回水域并加入追踪名单。':'已放回水域；追踪位已满。')}save();renderBook();renderSetup();return}const gear=e.target.closest('[data-gear]');if(gear&&equipGear(state,gear.dataset.gearSlot,gear.dataset.gear)){sound('ui');save();renderBook();renderSetup()}});
$('#bookContent').addEventListener('click',e=>{const sale=e.target.closest('[data-sell],[data-sell-all]');if(sale){const result=sellBasket(state.economy,sale.hasAttribute('data-sell-all')?null:Number(sale.dataset.sell));if(result.count){sound('ui');toast(`售出 ${result.count} 条鱼，获得 ${result.earned} 金币`,false,'reward');save();renderBook();update()}return}const button=e.target.closest('[data-upgrade]');if(button){const result=buyUpgrade(state.economy,button.dataset.upgrade);if(result.ok){sound('ui');toast(`${result.name}升级完成`,false,'reward');save();renderBook();update()}else toast(result.reason)}});
let lastRhythmPhase='';
function renderRhythmHud(phase,readout){const cue=fishingCue(phase),view=rhythmPresentation(phase),aura=$('#rhythmAura');readout.dataset.state=phase;readout.style.setProperty('--rhythm-duration',`${cue.period}s`);aura.style.setProperty('--rhythm-duration',`${cue.period}s`);readout.querySelector('.bite-readout-copy strong').textContent=view.title;readout.querySelector('.bite-readout-copy small').textContent=view.hint;if(lastRhythmPhase!==phase){readout.classList.remove('phase-enter');void readout.offsetWidth;readout.classList.add('phase-enter');lastRhythmPhase=phase}}
function renderSceneAction(button,p,phase,now){
 const hooked=phase==='hooked';
 button.dataset.action=hooked?'lift':'retrieve';
 if(!hooked){
  button.dataset.urgency='';
  button.querySelector('strong').textContent='收回鱼线';
  button.querySelector('.action-copy small').textContent='空钩了，再试一竿';
  button.setAttribute('aria-label','收回空线');
  return;
 }
 button.dataset.urgency='';
 button.querySelector('strong').textContent='提竿';
 button.querySelector('.action-copy small').textContent='鱼线绷紧了';
 button.setAttribute('aria-label','鱼线绷紧了，点按提竿');
}
function update(){
 const now=Date.now(),w=weatherAt(now);expireBite(now);$('#weather').textContent=w.name;renderTripSummary();world?.setWeather(w.id);
 const showAim=aiming&&!state.pending;$('#cancelAim').hidden=!showAim;
 if(state.pending?.phase==='cast'&&!revealing&&phaseOf(state.pending,now)==='empty'&&now-state.pending.readyAt>900){finishReel();return}
 $('#coinCount').textContent=`◎ ${state.economy.coins} 金币`;
 if(w.id!==lastWeather){lastWeather=w.id;if(!state.pending)$('#observation').textContent=w.hint}
 if(state.pending?.fight?.status==='active'){$('#game').classList.add('fighting');$('#game').dataset.phase='fighting';renderFight(state.pending.fight);$('#fight').hidden=false;$('#fightControl').hidden=false;$('#landFish').hidden=true;$('#sceneAction').hidden=true;$('#biteReadout').hidden=true;$('#rhythmAura').hidden=true;setCastAction(false);$('#cast').disabled=true;$('#stepLabel').textContent='搏鱼中';$('#status').textContent=fightOutlook(state.pending.fight).title;return}$('#game').classList.remove('fighting');
 if(shouldStartLanding(state.pending,revealing)){finishReel();return}$('#landFish').hidden=true;
 const p=state.pending,btn=$('#cast'),phase=phaseOf(p,now),objectReady=phase==='hooked'&&isObjectCatch(p?.catch),step=$('#stepLabel'),sceneAction=$('#sceneAction'),readout=$('#biteReadout'),aura=$('#rhythmAura'),canReel=!!p&&['hooked','empty'].includes(phase);$('#game').dataset.phase=phase;$('#game').classList.toggle('fishing',!!p);$('#game').classList.toggle('aiming',aiming);$('#game').classList.toggle('casting',phase==='casting');$('#game').classList.toggle('reading',phase==='reading');$('#game').classList.toggle('spooked',phase==='spooked');$('#game').classList.toggle('responding',phase==='responding');$('#game').classList.toggle('reeling',revealing);$('#game').classList.toggle('release-moment',!!lastRelease&&now-lastRelease.at<2200);$('#game').classList.toggle('overview',overview);$('#game').classList.toggle('bite',phase==='hooked'&&!objectReady&&!revealing);const closeView=(!!p||aiming||keepFishingView)&&!overview;$('#viewToggleLabel').textContent=closeView?'顶视':'近景';$('#viewToggle').dataset.target=closeView?'top':'near';$('#viewToggle').setAttribute('aria-label',closeView?'切到顶视':'切到近景');const controlMode=fightControlMode(p,now,revealing);$('#fightControl').hidden=!['strike','retrieve'].includes(controlMode);$('#fight').hidden=true;if(controlMode==='strike'||controlMode==='retrieve')renderStrikeControl(controlMode);sceneAction.hidden=phase!=='empty'||revealing;sceneAction.dataset.action='retrieve';readout.hidden=!p||revealing||overview||p.phase==='result'||!(phase==='spooked'||p.openingCast&&phase==='hooked'&&!objectReady);aura.hidden=readout.hidden||phase==='hooked';if(!readout.hidden){renderRhythmHud(phase,readout);if(p.openingCast&&phase==='hooked')readout.querySelector('.bite-readout-copy small').textContent='按住右下圆形控件提竿，继续按住就能收线。'}renderSceneAction(sceneAction,p,phase,now);if(!lastRelease||now-lastRelease.at>=2200)$('#story').textContent='';
 if(revealing){setCastAction(false);const reelAge=(now-revealStart)/1000,showcase=!!p?.catch&&!!p.landedFromFight,escaped=!p?.catch&&/挣脱|脱钩|断线/.test(p?.reaction||'');if(showcase){$('#landingCueStep').textContent='近看钓获';$('#landingCueText').textContent='镜头跟随鱼上岸';}else if(p?.catch){$('#landingCueStep').textContent=isObjectCatch(p.catch)?(reelAge<1.6?'收回挂物':'近看钓获'):reelAge<.75?'鱼到岸边':reelAge<1.6?'提鱼出水':'近看钓获';$('#landingCueText').textContent=isObjectCatch(p.catch)?'钩上的东西正沿鱼线靠近':reelAge<.75?'鱼已到岸，正顺着鱼线拉起':reelAge<1.6?'鱼离开水面，镜头跟上':'近看这次钓获';}else{$('#landingCueStep').textContent='收线中';$('#landingCueText').textContent=escaped?p.reaction||'鱼已挣脱，正在收回鱼线':'鱼口已停，正在收回鱼线';}step.textContent=p?.catch&&isObjectCatch(p.catch)?'收回挂物':p?.catch?'钓获上岸':'收回鱼线';$('#status').textContent=showcase?'鱼已靠岸，正在展示钓获。':p?.catch&&isObjectCatch(p.catch)?'正平稳收回钩上的东西。':p?.catch?'鱼已靠岸，正在拉起并展示钓获。':escaped?p.reaction||'鱼已挣脱，正在收回松线。':'浮漂已回稳，鱼饵正随鱼线收回。';$('#hint').textContent=p?.catch?'特写结束后查看钓获':'鱼线正在收回，稍后可以继续抛竿';return}
 btn.disabled=p?.phase==='result';btn.classList.toggle('ready',phase==='hooked'&&!objectReady);btn.classList.toggle('retrieve',phase==='empty');
 if(!p){setCastAction(true);if(aiming){step.textContent='选落点';btn.disabled=castQueued;btn.textContent=castQueued?'准备抛竿…':'抛竿 ↗';btn.setAttribute('aria-label',castQueued?'准备抛竿':'抛竿');$('#status').textContent=castQueued?'即将抛竿':isOpeningCast(state)?'点水面可调整落点，确认后抛竿':castDifficultyHint(castZone(state.spot,aimPoint));$('#hint').textContent='';return}const trailReady=state.waterTrail?.spot===state.spot&&state.waterTrail?.bait===state.bait;step.textContent='准备抛竿';btn.innerHTML='选落点 <span>↗</span>';btn.setAttribute('aria-label','选落点');$('#status').textContent=trailReady?'原钓点同鱼饵，再抛可能追上刚才的鱼影':isOpeningCast(state)?'选一处水面，看看会有什么动静':keepFishingView&&!overview?'点水面选落点，或点按钮':'选好鱼饵，看看想抛向哪里';$('#hint').textContent='';return}
 if(p.phase==='result'){setCastAction(false);step.textContent='查看钓获';return}
 step.textContent=objectReady?'收回挂物':phase==='casting'?'抛竿中':phase==='reading'?'观察鱼口':phase==='responding'||phase==='nibble'?'等待咬稳':phase==='spooked'?'鱼口已散':phase==='empty'?'收回鱼线':canReel?'提竿时机':'守候鱼口';
 setCastAction(false);btn.disabled=!canReel;btn.textContent=objectReady?'收回鱼线':phase==='hooked'?'现在提竿':phase==='empty'?'收回空线':'';
 btn.setAttribute('aria-label',objectReady?'钩上似乎挂了东西，收回鱼线':phase==='hooked'?'鱼已咬稳，现在提竿':phase==='empty'?'鱼口已停止，收回空线':btn.textContent);
 const labels={casting:'浮漂正在飞向落点。',waiting:'浮漂平稳。',approach:p.trailReturned?'刚才那道鱼影又靠近了。':'落点附近有水纹。',reading:`${biteGuidance(p.signal?.id).seen}。`,responding:p.reaction||'鱼影仍在饵旁。',spooked:p.reaction||'鱼影散开。',nibble:'鱼嘴正在靠近鱼饵。',hooked:'鱼线绷紧。',empty:'浮漂回稳。'};
 $('#status').textContent=objectReady?'浮漂轻沉，钩上似乎挂了东西。':labels[phase]||'等待状态更新。';$('#hint').textContent=objectReady?'点按收回鱼线':phase==='hooked'?'鱼线绷紧，可以提竿':phase==='empty'?'鱼口已停，可以收线':phase==='reading'?'留意鱼影和水纹':overview?'拖动查看水域':'拖动调整视角';
}

function waitingMoment(){const now=Date.now(),p=state.pending,phase=phaseOf(p,now);if(!p||revealing||phase!=='waiting'){nextWaitMomentAt=0;return}if(!nextWaitMomentAt)nextWaitMomentAt=p.start+2300;if(now<nextWaitMomentAt)return;nextWaitMomentAt=Infinity;const lines={bridge:'木桩旁泛起一圈细纹，浮漂仍稳稳停着。',deep:'远水有一阵缓浪，先看着浮漂。',reed:'浅滩水面轻轻晃动，鱼线仍松弛。'};$('#observation').textContent=waitingWaterLine(state,p)||lines[p.spot]||'水面轻轻晃动，浮漂仍平稳。';world?.waitingRipple?.();sound('waitingRipple')}

try{world=createWorld($('#world'),()=>({...state,aiming,aimPoint,overview,keepFishingView,revealing,revealStart,fightLoss,focusSpot,focusPulseAt,lastRelease,castEmotionAt,inspectBiteAt,hookStrikeAt,fightGesture:reelGesture?gestureRodInput(reelGesture.startX,reelGesture.startY,reelGesture.currentX,reelGesture.currentY,state.pending?.fight?.load):null,onAimPoint:setAimPoint,onReadyWaterTap:startAimFromWater,onInspectBite:inspectBite,onCastRelease:()=>{sound('castRelease');haptics.emit('cast')},onCastFlight:(speed,progress)=>updateCastLine(speed,progress),onCastLand:fresh=>{stopCastLine();if(fresh){sound('castLand');haptics.emit('splash')}},onApproach:()=>sound('approach'),onReading:signal=>sound('reading',signal),onNibble:()=>sound('nibble'),onBite:objectCatch=>{sound(objectCatch?'retrieve':'bite');haptics.emit(objectCatch?'object':'bite')},onFishBreach:()=>sound('fishBreach'),onFishLift:()=>sound('landingLift'),onReleaseLand:()=>sound('releaseLand'),onReel:reel}),selectSpot);viewer=createSpecimenViewer($('#specimen'));createRenderSettingsPanel(world);}catch(error){console.error(error);window.__moonGameBootFailure?.(error);$('#renderError').hidden=false;}
$('#zoomIn').onclick=()=>{ensureAudio().then(()=>sound('ui'));world?.zoom(.15)};$('#zoomOut').onclick=()=>{ensureAudio().then(()=>sound('ui'));world?.zoom(-.15)};
$('#cameraReset').onclick=()=>{ensureAudio().then(()=>sound('ui'));world?.resetFightView()};
function showTopView(){overview=true;world?.topView();update()}
function toggleView(){const closeView=(!!state.pending||aiming||keepFishingView)&&!overview;if(closeView)showTopView();else{keepFishingView=true;overview=false;world?.reset();update()}}
$('#viewToggle').onclick=()=>{ensureAudio().then(()=>sound('ui'));toggleView()};
addEventListener('pointerdown',e=>{if(e.target.closest('button,dialog,footer,header'))world?.cancelIntro()},{capture:true});
addEventListener('keydown',e=>{world?.cancelIntro();if(e.key==='Escape'&&$('#book').open){$('#book').close();$('#journal').focus();return}if(e.key==='Escape'&&$('#tripEnd').open){$('#tripEnd').close();return}if($('#book').open||$('#result').open||$('#tripEnd').open)return;if(e.code==='Backquote'&&!e.repeat&&!e.target?.closest?.('input,textarea,[contenteditable]')){e.preventDefault();toggleView();return}if(e.key==='Escape'){e.preventDefault();if(aiming){cancelCastAim();return}if(state.pending||keepFishingView){$('#tripDetails').open=false;showTopView();return}if($('#tripDetails').open){$('#tripDetails').open=false;return}world?.reset();update();return}if(state.pending?.fight?.status==='active'&&['ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(!e.repeat)pumpFish();return}if(e.code==='Space'){e.preventDefault();if(state.pending?.fight?.status==='active'){if(!holdSpace){holdSpace=true;pressBeganAt=performance.now();tapHintUntil=0;renderFight(state.pending.fight);if(!startReelLoop(.65))sound('reel');lastReelSoundAt=performance.now();}return}if(!e.repeat&&!$('#cast').disabled)$('#cast').click();return}if(e.code==='ArrowUp'&&phaseOf(state.pending)==='hooked'&&!revealing){e.preventDefault();if(!e.repeat)reel();return}if(!state.pending&&['1','2','3'].includes(e.key))selectBait(BAITS[Number(e.key)-1].id)});
addEventListener('keyup',e=>{if(e.code==='Space'&&holdSpace){holdSpace=false;const now=performance.now();if(now-pressBeganAt<160){tapHintUntil=now+1000;tapFlashUntil=now+330}renderFight(state.pending?.fight)}});addEventListener('blur',()=>{holdPointer=holdSpace=false;reelGesture=null;cancelJoystickRelease();setMembraneScale(1);setMembraneAngle(fightUI.fightHold,0);resetPull();stopReelLoop();haptics.stop();renderFight(state.pending?.fight)});document.addEventListener('visibilitychange',()=>{if(document.hidden)haptics.stop()});
let observationTimer;const observationPanel=$('.waterside');function revealObservation(){observationPanel.classList.add('is-visible');clearTimeout(observationTimer);observationTimer=setTimeout(()=>observationPanel.classList.remove('is-visible'),4800)}new MutationObserver(revealObservation).observe($('#observation'),{childList:true,characterData:true,subtree:true});
renderSetup();update();save();void ensureAudio();setInterval(()=>{update();waitingMoment();shoreWave()},500);if(state.pending?.phase==='result')showResult(false);else if(state.trip.castsLeft===0)setTimeout(showTripEnd,0);if(state.pending?.fight?.status==='active')startFight();document.addEventListener('visibilitychange',()=>{if(!document.hidden){update();if(state.pending?.fight?.status==='active')startFight()}});if(world)requestAnimationFrame(()=>requestAnimationFrame(()=>window.__moonGameBootComplete?.()));
if(document.modelContext?.registerTool){const lifecycle=new AbortController();for(const tool of [{name:'read_fishing_state',description:'Read current cast, bait, location and discovered clues.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({spot:state.spot,bait:state.bait,pending:!!state.pending,ready:!!state.pending&&Date.now()>=state.pending.readyAt,casts:state.casts,clues:state.clues})},{name:'start_fishing_cast',description:'Select bait and water location, then cast at the middle target. Fails if a cast already exists.',inputSchema:{type:'object',properties:{spot:{type:'string',enum:SPOTS.map(s=>s.id)},bait:{type:'string',enum:BAITS.map(b=>b.id)}},required:['spot','bait'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||!SPOTS.some(s=>s.id===input.spot)||!BAITS.some(b=>b.id)||state.pending||!spotUnlocked(state,input.spot))throw Error('Invalid selection or a cast already exists');state.spot=input.spot;state.bait=input.bait;beginCastAim();await cast();return{cast:true,readyAt:state.pending.readyAt}}}]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}}addEventListener('pagehide',e=>{if(!e.persisted)lifecycle.abort()},{once:true})}
