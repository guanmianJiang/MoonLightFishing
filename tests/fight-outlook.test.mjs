import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight,stepFight,lineBreakForce} from '../src/reference-loop.mjs';
import {fightOutlook,fightOutlookDisplay,fightLossCopy} from '../src/fight-outlook.mjs';

test('compact fight copy keeps one quiet status and preserves urgent warnings',()=>{
 assert.deepEqual(fightOutlookDisplay({state:'steady',remaining:3.24,title:'鱼还在水中'}),{distance:'3.2 米',statusTitle:'',lineStatus:'鱼线平稳'});
 assert.deepEqual(fightOutlookDisplay({state:'line-critical',remaining:.04,title:'鱼线快断了'}),{distance:'0.0 米',statusTitle:'鱼线快断了',lineStatus:''});
 assert.deepEqual(fightOutlookDisplay({state:'escaping',remaining:4.11,title:'鱼快游脱了'}),{distance:'4.1 米',statusTitle:'鱼快游脱了',lineStatus:''});
 assert.deepEqual(fightOutlookDisplay({state:'steady',remaining:NaN}),{distance:'0.0 米',statusTitle:'',lineStatus:'鱼线平稳'});
});

test('near shore still shows the remaining landing distance and warns before a line break',()=>{
 const fight=createFight({id:'carp',weight:6});
 fight.distance=2.15;
 const near=fightOutlook(fight);
 assert.equal(near.state,'near');
 assert.ok(Math.abs(near.remaining-.35)<.001);
 assert.ok(near.approach<1);
 fight.load=.95;fight.force=lineBreakForce(fight)*1.15;fight.warningAge=.78;fight.overload=.25;
 const endangered=fightOutlook(fight);
 assert.equal(endangered.state,'line-critical');
 assert.match(endangered.action,/下压让线/);
 assert.ok(endangered.lineRisk>.75);
 assert.ok(endangered.approach<1,'distance alone must never imply a landed fish');
});

test('giving line lets visible risk settle while distance remains a separate measure',()=>{
 const fight=createFight({id:'catfish',weight:12});
 fight.distance=5;fight.load=.9;fight.force=lineBreakForce(fight)*1.1;fight.warningAge=.8;fight.overload=.25;
 const before=fightOutlook(fight);
 fight.load=.2;fight.force=0;fight.warningAge=0;fight.overload=0;
 const after=fightOutlook(fight);
 assert.ok(after.lineRisk<before.lineRisk);
 assert.equal(after.approach,before.approach);
 assert.equal(after.state,'steady');
});

test('releasing a real overstrained line clears the warning before a break',()=>{
 const fight=createFight({id:'catfish',weight:12});
 for(let i=0;i<300&&fight.status==='active'&&fightOutlook(fight).state!=='line-critical';i++)stepFight(fight,true,.016);
 const before=fightOutlook(fight);
 assert.equal(before.state,'line-critical');
 for(let i=0;i<200&&fight.status==='active';i++)stepFight(fight,false,.016);
 assert.equal(fight.status,'active');
 assert.ok(fightOutlook(fight).lineRisk<before.lineRisk);
 assert.notEqual(fightOutlook(fight).state,'line-critical');
});

test('outward escape and long stalemate have distinct advance warnings',()=>{
 const fight=createFight({id:'perch',weight:2});
 fight.distance=fight.startDistance+2.6;fight.radialVelocity=.8;
 assert.equal(fightOutlook(fight).state,'escaping');
 fight.distance=5;fight.radialVelocity=0;fight.elapsed=70;
 assert.equal(fightOutlook(fight).state,'exhausted');
 fight.slack=.8;fight.elapsed=0;
 assert.equal(fightOutlook(fight).state,'slack');
});

test('physics records why the catch was lost and gives matching copy',()=>{
 const hardPull=createFight({id:'catfish',weight:12});
 for(let i=0;i<3000&&hardPull.status==='active';i++)stepFight(hardPull,true,.016);
 assert.equal(hardPull.status,'lost');
 assert.equal(hardPull.lossReason,'line-break');
 assert.match(fightLossCopy(hardPull).reaction,/断线/);
 const abandoned=createFight({id:'carp',weight:2});
 for(let i=0;i<5000&&abandoned.status==='active';i++)stepFight(abandoned,false,.016);
 assert.equal(abandoned.status,'lost');
 assert.equal(abandoned.lossReason,'escaped');
 assert.match(fightLossCopy(abandoned).toast,/脱钩/);
 const stalemate=createFight({id:'carp',weight:2});
 stalemate.elapsed=80;stalemate.distance=4;
 stepFight(stalemate,false,1/60);
 assert.equal(stalemate.lossReason,'exhausted');
 assert.match(fightLossCopy(stalemate).reaction,/僵持/);
});

test('landing is confirmed only by the physics threshold',()=>{
 const fight=createFight({id:'perch',weight:1});
 fight.distance=1.79;fight.lineLength=1.8;
 stepFight(fight,false,1/120);
 assert.equal(fight.status,'won');
 assert.equal(fight.lossReason,null);
 assert.equal(fightOutlook(fight).remaining,0);
});

test('missing and old states produce finite feedback without mutating the fight',()=>{
 const empty=fightOutlook(null);
 assert.equal(empty.state,'steady');
 assert.ok(Number.isFinite(empty.approach));
 const old={status:'active',distance:NaN,load:Infinity,force:NaN,slack:-1};
 const before={...old};
 const outlook=fightOutlook(old);
 assert.ok(Number.isFinite(outlook.remaining)&&Number.isFinite(outlook.lineRisk));
 assert.deepEqual(old,before);
 assert.match(fightLossCopy({status:'lost'}).reaction,/挣脱/);
});
