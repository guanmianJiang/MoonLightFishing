import test from 'node:test';
import assert from 'node:assert/strict';
import {fightPerformance,fightSurfacePulse} from '../src/fight-performance.mjs';

test('a taut, loaded line braces the angler while slack releases the pose',()=>{
 const taut=fightPerformance({slack:0,tension:.65,load:.5,surge:.4,spoolVelocity:-1.2});
 const slack=fightPerformance({slack:.7,tension:.65,load:.5,surge:.4,spoolVelocity:0});
 assert.ok(taut.brace>.4);
 assert.ok(taut.reel>.5);
 assert.equal(slack.taut,0);
 assert.equal(slack.resistance,0);
 assert.equal(slack.brace,0);
});

test('paying out and lifting give different channels for reel animation and IK',()=>{
 const payout=fightPerformance({slack:0,spoolVelocity:.45,load:.3,tension:.4});
 const lift=fightPerformance({slack:0,spoolVelocity:0,pumpPulse:.8,load:.3,tension:.4});
 assert.ok(payout.payout>.7);
 assert.ok(payout.give>.7);
 assert.equal(payout.reel,0);
 assert.equal(lift.payout,0);
 assert.equal(lift.give,0);
 assert.equal(lift.lift,.8);
 assert.ok(lift.brace>payout.brace);
});

test('holding the reel against a run does not animate a deliberate line release',()=>{
 const run={slack:0,spoolVelocity:.5,load:.7,tension:.8,surge:.5};
 const released=fightPerformance({...run,held:false});
 const holding=fightPerformance({...run,held:true});
 assert.ok(released.give>holding.give+.5);
 assert.ok(holding.brace>released.brace);
});

test('fish struggle transfers a bounded shock only through a taut line',()=>{
 const base={slack:0,tension:.8,load:.35,surge:.7,fishVelocity:1.2};
 const hooked=fightPerformance(base),loose=fightPerformance({...base,slack:.8});
 assert.ok(hooked.shock>.3&&hooked.struggle>.3);
 assert.equal(loose.shock,0);
 assert.ok(loose.struggle>.3,'the fish can still fight while the loose line stops transmitting force');
 const invalid=fightPerformance({tension:Infinity,load:NaN,fishVelocity:Infinity,surge:Infinity});
 assert.ok(Number.isFinite(invalid.shock)&&invalid.shock<=1);
});

test('pressing or releasing an unloaded reel cannot kick the rod by itself',()=>{
 const loaded=fightPerformance({slack:0,tension:.7,load:.6,inputPulse:1});
 const loose=fightPerformance({slack:.8,tension:.7,load:.6,inputPulse:1});
 assert.ok(loaded.recoil>.2);
 assert.equal(loose.recoil,0);
});

test('surface water responds to actual load and spool travel, not a held-button change',()=>{
 const f={status:'active',elapsed:0,slack:0,tension:.6,load:.5,pumpPulse:0,reelTurns:1.8,held:false,surge:0,surgeWarning:0};
 const initial=fightSurfacePulse(f);
 assert.equal(initial.amount,0);
 const pressed=fightSurfacePulse({...f,held:true},initial.tracker);
 assert.equal(pressed.amount,0);
 const reeled=fightSurfacePulse({...f,held:true,reelTurns:2.1},pressed.tracker);
 assert.equal(reeled.kind,'reel');
 const loose=fightSurfacePulse({...f,held:true,reelTurns:4.2,slack:.6},reeled.tracker);
 assert.equal(loose.amount,0);
 assert.equal(fightSurfacePulse({...f,held:true,reelTurns:4.2},loose.tracker).amount,0,'a loose-line beat must not play later');
 const lifted=fightSurfacePulse({...f,pumpPulse:.4},initial.tracker);
 assert.equal(lifted.kind,'pump');
 assert.equal(fightSurfacePulse({...f,pumpPulse:.4,slack:.6},initial.tracker).amount,0);
});

test('surge and warning splashes follow simulation time across render frame rates',()=>{
 const f={status:'active',elapsed:0,slack:0,tension:.6,load:.5,pumpPulse:0,reelTurns:0,held:false,surge:0,surgeWarning:0};
 const initial=fightSurfacePulse(f);
 const surge=fightSurfacePulse({...f,elapsed:1,surge:.7},initial.tracker);
 assert.equal(surge.kind,'surge');
 assert.equal(fightSurfacePulse({...f,elapsed:1.1,surge:.7},surge.tracker).amount,0);
 assert.equal(fightSurfacePulse({...f,elapsed:1.3,surge:.7},surge.tracker).kind,'surge');
 const warning=fightSurfacePulse({...f,elapsed:2,surgeWarning:.8},initial.tracker);
 assert.equal(warning.kind,'warning');
 assert.equal(fightSurfacePulse({...f,elapsed:2.1,surgeWarning:.8},warning.tracker).amount,0);
 assert.equal(fightSurfacePulse({...f,elapsed:3,surge:.8,slack:.8},warning.tracker).amount,0);
 assert.equal(fightSurfacePulse({...f,status:'lost'},warning.tracker).tracker,null);
});

test('fish thrashes in short beats and transmits those beats only through a taut line',()=>{
 const fish={slack:0,tension:.9,load:.35,surge:.7,fishVelocity:.8,fishState:'hookset',stateAge:.2,seed:.4};
 const beats=Array.from({length:24},(_,i)=>fightPerformance(fish,i/30));
 assert.ok(Math.max(...beats.map(b=>b.thrash))>.35);
 assert.ok(Math.min(...beats.map(b=>b.thrash))<-.35);
 assert.ok(Math.max(...beats.map(b=>b.shock))-Math.min(...beats.map(b=>b.shock))>.14);
 for(const beat of beats){
  assert.ok(Math.abs(beat.thrash)<=1&&beat.shock>=0&&beat.shock<=1);
  const loose=fightPerformance({...fish,slack:.8},.1);
  assert.equal(loose.shock,0);
 }
 const calm=fightPerformance({slack:0,tension:.06,load:.02,surge:0,fishVelocity:0,fishState:'recover'},.1);
 assert.ok(Math.abs(calm.thrash)<.08);
});
