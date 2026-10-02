import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fightHapticSample,fightHapticEvent,fightHapticStrength,createHaptics} from '../src/haptics.mjs';

test('release water contact has one brief weight-dependent vibration and obeys visibility',()=>{
 let now=100,visible=true;const calls=[],h=createHaptics(p=>{calls.push(p);return true},()=>now,()=>visible);
 assert.equal(h.emit('release-water'),true);assert.equal(h.emit('release-water'),false);now+=400;
 assert.equal(h.emit('release-heavy'),true);assert.deepEqual(calls,[12,[20,22,8]]);
 now+=400;visible=false;assert.equal(h.emit('release-heavy'),false);
});

const base={status:'active',lossReason:null,tension:.3,load:.3,slack:0,spoolVelocity:-1,reelTurns:1.8,surge:0,warningAge:0,overload:0,held:true};

test('touch feedback follows transmitted line force, not a loose fish animation',()=>{
 const before=fightHapticSample(base);
 assert.equal(fightHapticEvent(before,{...base,tension:.55}),'impact');
 assert.equal(fightHapticEvent(before,{...base,tension:.55,slack:.6}),null);
 assert.equal(fightHapticEvent(before,{...base,surge:.7}),'surge');
 assert.equal(fightHapticEvent(before,{...base,surge:.7,slack:.6}),null);
});

test('payout and spool touches require actual motion on a taut line',()=>{
 const before=fightHapticSample(base);
 assert.equal(fightHapticEvent(before,{...base,spoolVelocity:.4}),'payout');
 assert.equal(fightHapticEvent(before,{...base,spoolVelocity:.4,slack:.5}),null);
 assert.equal(fightHapticEvent(before,{...base,reelTurns:2.1}),'spool');
 assert.equal(fightHapticEvent(before,{...base,reelTurns:2.1,held:false}),null);
 assert.equal(fightHapticEvent(before,{...base,reelTurns:2.1,load:.05}),null);
});

test('sustained overload and terminal outcomes outrank ordinary line motion',()=>{
 const before=fightHapticSample({...base,warningAge:.35,overload:.12});
 assert.equal(fightHapticEvent(before,{...base,warningAge:.43}),'line-warning');
 assert.equal(fightHapticEvent(before,{...base,warningAge:.7,overload:.18}),'line-critical');
 assert.equal(fightHapticEvent({...base,warningAge:.58,overload:.2},{...base,warningAge:.65,overload:.2}),'line-critical');
 assert.equal(fightHapticEvent(before,{...base,status:'lost',lossReason:'line-break',slack:1}),'line-break');
 assert.equal(fightHapticEvent(before,{...base,status:'lost',lossReason:'escaped',slack:1}),'escaped');
 assert.equal(fightHapticEvent(before,{...base,status:'won',slack:1}),'landed');
 assert.equal(fightHapticEvent({...base,status:'lost'},base),null);
});

test('short high-priority impacts preempt reel clicks without layering repeated patterns',()=>{
 let now=100;
 const calls=[];
 const haptics=createHaptics(pattern=>{calls.push(pattern);return true},()=>now);
 assert.equal(haptics.emit('spool'),true);
 now=105;assert.equal(haptics.emit('impact'),true);
 now=110;assert.equal(haptics.emit('spool'),false);
 now=115;assert.equal(haptics.emit('line-break'),true);
 now=116;assert.equal(haptics.emit('line-break'),false);
 assert.equal(haptics.emit('landed'),false);
 assert.deepEqual(calls,[7,[13,20,13],[29,18,10]]);
 now=900;assert.equal(haptics.emit('spool'),true);
});

test('hidden, unsupported and invalid events do not start device vibration',()=>{
 let visible=false,now=100;
 const calls=[];
 const haptics=createHaptics(pattern=>{calls.push(pattern);return true},()=>now,()=>visible);
 assert.equal(haptics.emit('bite'),false);
 visible=true;assert.equal(haptics.emit('unknown'),false);
 assert.equal(haptics.emit('bite'),true);
 haptics.stop();assert.deepEqual(calls,[[18,32,23],0]);
 const unavailable=createHaptics(()=>false,()=>now);
 assert.equal(unavailable.emit('bite'),false);
 now=NaN;assert.equal(haptics.emit('tap'),false);
});

test('restored or malformed fight snapshots stay silent and finite',()=>{
 assert.equal(fightHapticEvent(null,base),null);
 assert.equal(fightHapticEvent(base,null),null);
 const before=fightHapticSample({...base,tension:Infinity,load:NaN,slack:Infinity});
 assert.equal(before.tension,0);
 assert.equal(before.load,0);
 assert.equal(before.slack,1);
 assert.equal(fightHapticEvent(before,{...base,slack:Infinity,tension:Infinity}),null);
});

test('slack take-up is one contact cue and only actual transmitted load changes its strength',()=>{
 const before={...base,slack:.2},after={...base,slack:.1};assert.equal(fightHapticEvent(before,after),'take-up');assert.equal(fightHapticEvent(after,after),null);
 assert.equal(fightHapticEvent(before,{...after,load:.1}),null);assert.equal(fightHapticStrength({...base,slack:.6}),0);
 assert.ok(fightHapticStrength({...base,tension:1,load:1})>fightHapticStrength(base)*2);assert.equal(fightHapticStrength(null),0);
});

test('release strength changes short vibration duration without changing priority or inventing amplitude support',()=>{
 let now=100;const calls=[],h=createHaptics(p=>{calls.push(p);return true},()=>now);
 h.emit('line-break',{strength:0});now+=800;h.emit('line-break',{strength:1});assert.ok(calls[0][0]<calls[1][0]);assert.equal(calls[0][1],calls[1][1]);
 now+=800;h.emit('line-break',{strength:Infinity});assert.deepEqual(calls[2],calls[1]);now+=800;h.emit('take-up',{strength:.4});assert.ok(calls[3]>=3&&calls[3]<=10);
});

test('actual app terminal transition emits exactly once using the last loaded rod strength',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 const functions=source.slice(source.indexOf('function stopFight('),source.indexOf('function startFight('));
 for(const reason of ['line-break','escaped']){
  const calls=[],noop=()=>{},f={status:'active',held:false,tension:1,load:.8,slack:0,lossReason:reason},node={hidden:false,classList:{remove(){}}};
  const ctx=vm.createContext({state:{pending:{start:1,fight:f,catch:{id:'carp'}}},world:{getRodFeedback:()=>({strength:.91})},
   fightFrame:1,fightLast:100,fightSaved:0,holdPointer:false,holdSpace:false,reelGesture:null,reelSurface:{reset:noop},reelConfirmUntil:0,reelCorrectionUntil:0,lastFightDanger:false,lastReelTick:0,lastFightHeldAudio:false,lastPayOutAt:0,lastSurgeAudio:false,lastReelSoundAt:0,
   fightHapticSample,fightHapticEvent,fightHapticStrength,haptics:{emit:(...args)=>calls.push(args)},document:{hidden:false},$:()=>node,Date,
   stepFight:current=>{current.status='lost'},stopReelLoop:noop,cancelAnimationFrame:noop,requestAnimationFrame:()=>assert.fail('terminal fight scheduled again'),renderFight:noop,save:noop,realSound:noop,sound:noop,startReelLoop:()=>false,
   fightLossCopy:()=>({reaction:'失手',toast:'失手'}),fightLossCue:()=>({reason}),markNearMiss:noop,presentOutcome:noop,toast:noop,finishReel:noop});
  vm.runInContext(functions+'\ntickFight(116);',ctx);
  assert.equal(calls.length,1);assert.equal(calls[0][0],reason);assert.equal(calls[0][1].strength,.91);assert.equal(ctx.state.pending.fight,null);
 }
});
