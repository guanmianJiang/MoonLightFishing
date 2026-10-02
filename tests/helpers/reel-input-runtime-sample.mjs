import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {startReelGesture,moveReelGesture} from '../../src/reel-gesture.mjs';
import {reelControlFeedback} from '../../src/reel-control-feedback.mjs';
import {fightControlMode} from '../../src/fight-control.mjs';
import {createFight,pumpRod,pumpOpportunity} from '../../src/reference-loop.mjs';
import {fightOutlook,fightOutlookDisplay} from '../../src/fight-outlook.mjs';
import {fightRigGeometry} from '../../src/fight-rig.mjs';
import {fightPerformance} from '../../src/fight-performance.mjs';
import {fightGuidance} from '../../src/fight-guidance.mjs';
import {fishBehavior} from '../../src/fish-behavior.mjs';
import {reelSurfaceSample} from './reel-surface-runtime-sample.mjs';
const source=readFileSync(new URL('../../src/app-final.js',import.meta.url),'utf8');

// Runs the actual app's render, pump and event functions with the real gesture/engine.
export function reelInputSample({mode='reel',reject=false}={}){
 const s=reelSurfaceSample(),nodes={},events=new Map(),globalEvents=new Map(),documentEvents=new Map(),calls=[];
 const node=()=>({attributes:{},dataset:{},styles:{},textContent:'',hidden:false,classList:{contains(){return false;},toggle(){},remove(){}},style:{setProperty(){}},getAttribute(k){return this.attributes[k];},setAttribute(k,v){this.attributes[k]=String(v);},setPointerCapture(id){calls.push(['capture',id]);},addEventListener(k,f){const a=events.get(k)||[];a.push(f);events.set(k,a);}});
 const ids=source.match(/const fightUI=Object.fromEntries\(\[([\s\S]*?)\]\.map/)[1].match(/'([^']+)'/g).map(v=>v.slice(1,-1));
 for(const id of ids)nodes[id]=node();nodes.fightHold.parentElement=s.root;nodes.fightFeedback=s.nodes.correction;
 const fresh=()=>Object.assign(createFight({weight:.4}),{fishState:'recover',load:.3,slack:0,radialVelocity:0,pumpAge:0,pumpCooldown:0});
 const state={pending:{phase:'cast',start:0,directHooked:true,catch:{id:mode==='retrieve'?'boot':'silver'},fight:mode==='reel'?fresh():null}};
 const context=vm.createContext({state,performance:{now:()=>0},Date:{now:()=>10000},revealing:false,holdPointer:false,holdSpace:false,pressBeganAt:0,tapHintUntil:0,lastReelSoundAt:0,lastPayOutAt:0,lastFightHeldAudio:false,
  reelSurface:s.view,fightUI:nodes,$:selector=>nodes[selector.slice(1)],startReelGesture,moveReelGesture,reelControlFeedback,fightControlMode,pumpOpportunity,pumpRod:(...args)=>reject?{ok:false,state:'slack'}:pumpRod(...args),fightOutlook,fightOutlookDisplay,fightRigGeometry,fightPerformance,fightGuidance,fishBehavior,
  sound:k=>calls.push(['sound',k]),haptics:{emit:k=>calls.push(['haptic',k]),stop:()=>calls.push(['haptic-stop'])},save:()=>calls.push(['save']),stopReelLoop:()=>calls.push(['stop-audio']),startReelLoop:()=>true,
  addEventListener:(k,f)=>globalEvents.set(k,f),document:{hidden:false,addEventListener:(k,f)=>documentEvents.set(k,f)},
  reel(){calls.push(['reel']);if(mode==='strike'){state.pending.fight=fresh();}},
 });
 const helpers=source.slice(source.indexOf('const fightText='),source.indexOf('const reelSurface='));
 const rendering=source.slice(source.indexOf('function renderFight('),source.indexOf('function expireBite('));
 const bindings=source.slice(source.indexOf('let reelGesture=null;'),source.indexOf('function setResultActionsExpanded('));
 const globalLine=source.split('\n').find(line=>line.startsWith("addEventListener('keyup'"));
 vm.runInContext(helpers+'\nlet reelConfirmUntil=0,reelCorrectionUntil=0,reelCorrection="";\n'+rendering+'\n'+bindings+'\n'+globalLine,context);
 if(mode==='reel')context.renderFight(state.pending.fight);else context.renderStrikeControl(mode);
 const emit=(type,pointerId=1,dx=0,dy=0)=>{for(const fn of events.get(type)||[])fn({pointerId,clientX:100+dx,clientY:100+dy,preventDefault(){}});};
 return {...s,calls,state,nodes:{...s.nodes,...nodes},down:id=>emit('pointerdown',id),move:(dx,dy,id=1)=>emit('pointermove',id,dx,dy),up:(type='pointerup',id=1)=>emit(type,id),blur:()=>globalEvents.get('blur')(),hide(){context.document.hidden=true;documentEvents.get('visibilitychange')();},snapshot:()=>vm.runInContext('({gesture:reelGesture,held:holdPointer,confirm:reelConfirmUntil,correction:reelCorrection})',context)};
}
