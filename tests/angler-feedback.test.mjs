import test from 'node:test';
import assert from 'node:assert/strict';
import {castWhip,castFeedback,biteStrike,landingHoldBlend,lostFightRecoil,fightLossCue} from '../src/angler-feedback.mjs';

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

test('lost fish releases the loaded rod, overshoots, then settles before empty retrieval',()=>{
 const start=lostFightRecoil(0,1.2,1.32,.82,'line-break');
 const snap=lostFightRecoil(.09,1.2,1.32,.82,'line-break');
 const settle=lostFightRecoil(.62,1.2,1.32,.82,'line-break');
 assert.equal(start.bend,1.2,'the transition starts at the last loaded bend');
 assert.equal(start.angle,1.32,'the grip angle must not jump on the transition frame');
 assert.ok(snap.bend<0,'the tip rebounds past its relaxed line within a tenth of a second');
 assert.ok(snap.angle>start.angle,'the grip follows the line release');
 assert.ok(snap.slack>0,'the line is briefly slack before empty retrieval');
 assert.equal(settle.active,false);
 assert.equal(settle.bend,0);
 assert.equal(settle.angle,.82);
 assert.equal(settle.slack,0);
 const heavilyLoaded=lostFightRecoil(0,4,2.4,.82,'line-break');
 assert.equal(heavilyLoaded.bend,4);
 assert.equal(heavilyLoaded.angle,2.4);
});

test('a snapped line recoils more than an unhooked fish and bad inputs stay finite',()=>{
 const snapped=lostFightRecoil(.09,1,1.1,.8,'line-break');
 const unhooked=lostFightRecoil(.09,1,1.1,.8,'escaped');
 assert.ok(snapped.kick>unhooked.kick);
 assert.ok(snapped.bend<unhooked.bend);
 const invalid=lostFightRecoil(Number.NaN,Infinity,Number.NaN,Infinity);
 assert.equal(invalid.active,false);
 assert.ok(Number.isFinite(invalid.angle)&&Number.isFinite(invalid.bend));
});

test('only a lost fish creates a one-cast recoil event',()=>{
 assert.deepEqual(fightLossCue({status:'lost',lossReason:'line-break'},123,456),{at:456,castStart:123,reason:'line-break'});
 assert.equal(fightLossCue({status:'won'},123,456),null);
 assert.equal(fightLossCue(null,123,456),null);
 assert.equal(fightLossCue({status:'lost'},Number.NaN,456),null);
 assert.equal(fightLossCue({status:'lost'},123,Infinity),null);
 assert.equal(fightLossCue({status:'lost',lossReason:'unknown'},123,456).reason,'escaped');
});
