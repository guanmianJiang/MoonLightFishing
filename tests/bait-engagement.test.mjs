import test from 'node:test';
import assert from 'node:assert/strict';
import {baitEngagement,baitFishOpacity} from '../src/bait-engagement.mjs';

test('the fish tests the bait before committing its mouth to the hook',()=>{
 const early=baitEngagement('reading',0),probe=baitEngagement('reading',.3);
 assert.ok(early>0&&probe>early&&probe<1);
 assert.ok(baitEngagement('responding')>early);
 assert.ok(baitEngagement('nibble')>baitEngagement('responding'));
 assert.equal(baitEngagement('hooked'),1);
 assert.equal(baitEngagement('spooked'),0);
});

test('the fish is legible in the water-level close-up',()=>{
 assert.ok(baitFishOpacity('reading',1)>.4);
 assert.ok(baitFishOpacity('hooked',0)>baitFishOpacity('reading',0));
 assert.ok(baitFishOpacity('reading',1)>baitFishOpacity('reading',0));
});
