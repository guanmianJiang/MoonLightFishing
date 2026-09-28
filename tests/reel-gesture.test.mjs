import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFight} from '../src/reference-loop.mjs';
import {startReelGesture,moveReelGesture} from '../src/reel-gesture.mjs';

test('one gesture holds, lifts once, returns to reeling and can lift again',()=>{
 const f=createFight({weight:2});f.fishState='recover';f.slack=.1;
 let gesture=startReelGesture(7,500);
 let result=moveReelGesture(gesture,f,470);
 assert.equal(result.action,'none');assert.ok(result.gesture.progress>.6);
 result=moveReelGesture(result.gesture,f,450);
 assert.equal(result.action,'lift');assert.equal(result.gesture.lifted,true);
 result=moveReelGesture(result.gesture,f,420);
 assert.equal(result.action,'none','holding the finger high cannot repeat the lift');
 result=moveReelGesture(result.gesture,f,490);
 assert.equal(result.action,'reel');assert.equal(result.gesture.lifted,false);
 gesture=result.gesture;
 result=moveReelGesture(gesture,f,440);
 assert.equal(result.action,'lift','a new upward stroke may lift again when physics allows');
});

test('invalid timing and invalid coordinates keep the reel hold',()=>{
 const f=createFight({weight:2});
 const gesture=startReelGesture(4,500);
 assert.equal(moveReelGesture(gesture,f,430).action,'none','hookset cannot lift');
 f.fishState='run';assert.equal(moveReelGesture(gesture,f,430).action,'none','a run cannot lift');
 f.fishState='recover';f.slack=.8;assert.equal(moveReelGesture(gesture,f,430).action,'none','slack line cannot lift');
 assert.equal(moveReelGesture(gesture,f,Number.NaN).action,'none');
 assert.equal(startReelGesture(4,Number.NaN),null);
 assert.equal(moveReelGesture(null,f,430).action,'none');
});

test('fight UI presents the gesture on one touch control',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 const actions=html.split('<div class="fight-actions">')[1]?.split('</div>')[0]||'';
 assert.match(actions,/id="fightHold"/);
 assert.match(actions,/上划抬竿/);
 assert.doesNotMatch(actions,/fightPump/);
});
