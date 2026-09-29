import test from 'node:test';
import assert from 'node:assert/strict';
import {fightHapticSample,fightHapticEvent,createHaptics} from '../src/haptics.mjs';

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
