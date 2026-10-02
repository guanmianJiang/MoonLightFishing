import test from 'node:test';
import assert from 'node:assert/strict';
import {castWhip,castFeedback,biteStrike,landingHoldBlend,lostFightRecoil,fightLossCue,lostLineEnd,brokenLineReveal} from '../src/angler-feedback.mjs';

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

test('release keeps the loaded rod displacement and velocity continuous',()=>{
 const bendVelocity=1.8,angleVelocity=.42,start=lostFightRecoil(0,1.45,1.38,.82,'line-break',bendVelocity,angleVelocity);
 const next=lostFightRecoil(.00001,1.45,1.38,.82,'line-break',bendVelocity,angleVelocity);
 assert.equal(start.bend,1.45);
 assert.equal(start.angle,1.38);
 assert.ok(Math.abs((next.bend-start.bend)/.00001-bendVelocity)<.02);
 assert.ok(Math.abs((next.angle-start.angle)/.00001-angleVelocity)<.02);
});

test('stored bending energy controls the rebound instead of a fixed failure kick',()=>{
 const light=lostFightRecoil(.085,.25,1.1,.82,'line-break');
 const heavy=lostFightRecoil(.085,2,1.1,.82,'line-break');
 const still=lostFightRecoil(.085,0,.82,.82,'line-break');
 assert.ok(heavy.kick>light.kick*4);
 assert.ok(Math.abs(heavy.bend)>Math.abs(light.bend)*4);
 assert.equal(still.kick,0);
 assert.equal(still.bend,0);
 const moving=lostFightRecoil(.085,0,.82,.82,'line-break',8);
 assert.ok(moving.kick>0,'moving rod retains kinetic energy even when momentarily straight');
 assert.ok(Number.isFinite(lostFightRecoil(.12,Infinity,NaN,.8,'escaped',Infinity,NaN).angle));
});

test('stylized release gives a clear bounded whip without inventing force at low load',()=>{
 const light=lostFightRecoil(.11,.25,1.32,.82,'line-break');
 const heavy=lostFightRecoil(.11,2,1.32,.82,'line-break');
 const unhooked=lostFightRecoil(.11,2,1.32,.82,'escaped');
 assert.ok(heavy.bend<-1,'a heavily loaded rod visibly passes its relaxed line');
 assert.ok(Math.abs(heavy.bend)>Math.abs(light.bend)*6);
 assert.ok(heavy.bend<unhooked.bend&&heavy.angle>unhooked.angle);
 assert.ok(lostFightRecoil(.11,6,2,.82,'line-break').bend>=-2.3,'the first swing stays inside the character-safe limit');
 const late=lostFightRecoil(.5,2,1.32,.82,'line-break');
 assert.ok(Math.abs(late.bend)<.02&&late.kick<.01);
});

test('a loaded line break snaps across the neutral rod before an unhooked fish',()=>{
 const brokenEarly=lostFightRecoil(.05,2,1.32,.82,'line-break');
 const unhookedEarly=lostFightRecoil(.05,2,1.32,.82,'escaped');
 assert.ok(brokenEarly.bend<0&&unhookedEarly.bend>0);
 const brokenPeak=lostFightRecoil(.09,2,1.32,.82,'line-break');
 const unhookedPeak=lostFightRecoil(.09,2,1.32,.82,'escaped');
 assert.ok(brokenPeak.bend<unhookedPeak.bend-.75);
 assert.equal(lostFightRecoil(.09,0,.82,.82,'line-break').bend,0);
 assert.ok(lostFightRecoil(.09,6,2,.82,'line-break').bend>=-2.3);
});

test('only a lost fish creates a one-cast recoil event',()=>{
 assert.deepEqual(fightLossCue({status:'lost',lossReason:'line-break'},123,456),{at:456,castStart:123,reason:'line-break'});
 assert.equal(fightLossCue({status:'won'},123,456),null);
 assert.equal(fightLossCue(null,123,456),null);
 assert.equal(fightLossCue({status:'lost'},Number.NaN,456),null);
 assert.equal(fightLossCue({status:'lost'},123,Infinity),null);
 assert.equal(fightLossCue({status:'lost',lossReason:'unknown'},123,456).reason,'escaped');
});

test('a broken line ends before the old float and falls while the free segment reels in',()=>{
 const tip={x:0,y:3,z:0},float={x:4,y:.1,z:2};
 const start=lostLineEnd(0,tip,tip,float,0,'line-break');
 const fallen=lostLineEnd(.4,tip,tip,float,0,'line-break');
 const reeled=lostLineEnd(.4,tip,tip,float,1,'line-break');
 assert.ok(start.x>0&&start.x<float.x);
 assert.ok(fallen.y<start.y);
 assert.ok(reeled.x<fallen.x&&reeled.z<fallen.z);
 assert.equal(lostLineEnd(0,tip,tip,float,0,'escaped'),null);
 assert.equal(lostLineEnd(0,tip,tip,{...float,x:Infinity},0,'line-break'),null);
 assert.deepEqual(lostLineEnd(NaN,tip,tip,float,NaN,'line-break'),start);
});

test('a snapped line disappears during the whip and then reveals only its free segment',()=>{
 assert.equal(brokenLineReveal(-1),0);
 assert.equal(brokenLineReveal(NaN),0);
 assert.equal(brokenLineReveal(.09),0);
 assert.ok(brokenLineReveal(.16)>0&&brokenLineReveal(.16)<1);
 assert.equal(brokenLineReveal(.23),1);
 assert.equal(brokenLineReveal(1),1);
});
