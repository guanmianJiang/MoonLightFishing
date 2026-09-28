import test from 'node:test';
import assert from 'node:assert/strict';
import {castWhip,castFeedback,biteStrike,landingHoldBlend} from '../src/angler-feedback.mjs';

test('cast release whips forward then recoils before settling',()=>{
 assert.equal(castWhip(-.1),0);
 assert.ok(castWhip(.06)>.5);
 assert.ok(castWhip(.22)<0);
 assert.equal(castWhip(.5),0);
 assert.equal(castWhip(Number.NaN),0);
});

test('distant cast carries a stronger release and follow through without moving the target',()=>{
 const near=castFeedback(.06,3),far=castFeedback(.06,13);
 assert.ok(far.effort>near.effort);
 assert.ok(far.recoil>near.recoil);
 assert.ok(far.followThrough>near.followThrough);
 assert.equal(castFeedback(.8,13).followThrough,0);
 assert.ok(Number.isFinite(castFeedback(.1,Infinity).recoil));
});

test('a bite produces a brief impact without continuing to shake the rod',()=>{
 assert.equal(biteStrike(-.01),0);
 assert.ok(biteStrike(.05)>.4);
 assert.ok(biteStrike(.3)<biteStrike(.05));
 assert.equal(biteStrike(.7),0);
 assert.equal(biteStrike(Infinity),0);
});

test('the landed pose blends smoothly from the final fight angle',()=>{
 assert.equal(landingHoldBlend(-1),0);
 assert.ok(landingHoldBlend(.1)>0&&landingHoldBlend(.1)<1);
 assert.equal(landingHoldBlend(.28),1);
 assert.equal(landingHoldBlend(Infinity),0);
});
