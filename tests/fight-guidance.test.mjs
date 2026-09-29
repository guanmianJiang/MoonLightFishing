import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight} from '../src/reference-loop.mjs';
import {fightGuidance,canSwipePump,liftOutcomeText} from '../src/fight-guidance.mjs';

test('fight guidance follows the line and gives a usable next action',()=>{
 const f=createFight({weight:.6});
 assert.equal(fightGuidance(f,false).step,'reel');
 assert.match(fightGuidance(f,false).title,/刚上钩/);
 f.fishState='cruise';
 f.load=.72;
 assert.equal(fightGuidance(f,true).step,'release');
 assert.match(fightGuidance(f,true).title,/下压让线/);
 assert.equal(fightGuidance(f,false).step,'wait');
 f.load=.2;f.slack=.7;
 assert.equal(fightGuidance(f,false).step,'reel');
 f.slack=.1;f.fishState='run';f.surge=.8;
 assert.equal(fightGuidance(f,false).step,'wait');
 f.fishState='recover';f.surge=0;
 assert.equal(fightGuidance(f,false).step,'lift');
 assert.equal(fightGuidance(f,true).step,'lift','the same hold surface offers the upward stroke');
 assert.match(fightGuidance(f,true).reason,/滑回原位/);
 f.radialVelocity=.5;
 assert.equal(fightGuidance(f,false).step,'reel');
 f.radialVelocity=0;
 f.pumpAge=.3;
 assert.match(fightGuidance(f,false).title,/正在拉近/);
 f.pumpAge=0;f.pumpCooldown=.3;
 assert.equal(fightGuidance(f,false).step,'reel');
});

test('a swipe pumps only during a real opening',()=>{
 const f=createFight({weight:2});
 assert.equal(canSwipePump(f,500,440),false,'a fresh hook should keep reeling');
 f.fishState='recover';f.slack=.1;
 assert.equal(canSwipePump(f,500,460),false,'short finger travel should remain a hold');
 assert.equal(canSwipePump(f,500,440),true);
 f.fishState='run';assert.equal(canSwipePump(f,500,440),false);
 f.fishState='recover';f.slack=.8;assert.equal(canSwipePump(f,500,440),false);
 assert.equal(canSwipePump(f,Number.NaN,440),false);
});

test('lift guidance explains the pull and reports only distance actually gained',()=>{
 const f=createFight({weight:2});f.fishState='recover';f.slack=.1;
 assert.match(fightGuidance(f,false).title,/拉近/);
 assert.match(fightGuidance(f,false).reason,/收线守住/);
 assert.match(liftOutcomeText({...f,distance:8.43},9),/0.6 米/);
 assert.match(liftOutcomeText({...f,distance:8.98},9),/没有净拉近/);
 assert.match(liftOutcomeText(null,9),/守住鱼距/);
});
