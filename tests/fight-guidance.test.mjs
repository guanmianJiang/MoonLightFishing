import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight} from '../dist/reference-loop.mjs';
import {fightGuidance} from '../dist/fight-guidance.mjs';

test('fight guidance follows the line and gives a usable next action',()=>{
 const f=createFight({weight:.6});
 f.load=.72;
 assert.equal(fightGuidance(f,true).step,'release');
 assert.equal(fightGuidance(f,false).step,'wait');
 f.load=.2;f.slack=.7;
 assert.equal(fightGuidance(f,false).step,'reel');
 f.slack=.1;f.fishState='run';f.surge=.8;
 assert.equal(fightGuidance(f,false).step,'wait');
 f.fishState='recover';f.surge=0;
 assert.equal(fightGuidance(f,false).step,'lift');
 f.radialVelocity=.5;
 assert.equal(fightGuidance(f,false).step,'reel');
 f.radialVelocity=0;
 f.pumpAge=.3;
 assert.match(fightGuidance(f,false).title,/等它放下/);
 f.pumpAge=0;f.pumpCooldown=.3;
 assert.equal(fightGuidance(f,false).step,'reel');
});
