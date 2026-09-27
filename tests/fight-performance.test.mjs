import test from 'node:test';
import assert from 'node:assert/strict';
import {fightPerformance} from '../dist/fight-performance.mjs';

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
 assert.equal(payout.reel,0);
 assert.equal(lift.payout,0);
 assert.equal(lift.lift,.8);
 assert.ok(lift.brace>payout.brace);
});
