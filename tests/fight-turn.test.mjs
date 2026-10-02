import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight,stepFight} from '../src/reference-loop.mjs';
import {fightGuidance} from '../src/fight-guidance.mjs';

function play(id,weight,{fps=60,releaseRun=false,suppressTurn=false}={}){
 const fight=createFight({id,weight});
 for(let frame=0;frame<80*fps&&fight.status==='active';frame++){
  if(suppressTurn)fight.turnBonus=0;
  const held=!releaseRun||fight.fishState!=='run'&&fight.fishState!=='anchor';
  stepFight(fight,held,1/fps);
 }
 return fight;
}

test('a taut, released run creates a brief continuous turn toward shore',()=>{
 const clean=createFight({id:'carp',weight:.38}),hard=structuredClone(clean);
 for(const fish of [clean,hard]){
  fish.fishState='run';fish.stateAge=0;fish.stateDuration=.7;fish.runCount=1;
  fish.distance=7;fish.lineLength=7.08;fish.slack=.08;
 }
 for(let i=0;i<50;i++){stepFight(clean,false,1/60);stepFight(hard,true,1/60)}
 assert.equal(clean.fishState,'recover');
 assert.ok(clean.turnBonus>.5);
 assert.equal(hard.turnBonus,0);
 assert.ok(Math.abs(clean.distance-hard.distance)<1,'run resolution must not teleport either fish');
 assert.match(fightGuidance(clean,false).title,/回身/);
 const cleanBefore=clean.distance,hardBefore=hard.distance,cleanLineBefore=clean.lineLength,hardLineBefore=hard.lineLength;
 for(let i=0;i<35;i++){stepFight(clean,true,1/60);stepFight(hard,true,1/60)}
 assert.ok(clean.distance-cleanBefore<hard.distance-hardBefore-.08);
 assert.ok(clean.lineLength-cleanLineBefore<hard.lineLength-hardLineBefore-.15);
 for(let i=0;i<90&&clean.status==='active';i++)stepFight(clean,false,1/60);
 assert.equal(clean.turnBonus,0,'recovery advantage ends with the recovery');
});

test('letting out an already slack line does not earn a turn',()=>{
 const fish=createFight({id:'carp',weight:.38});
 fish.fishState='run';fish.stateAge=0;fish.stateDuration=.55;fish.runCount=1;
 fish.distance=7;fish.lineLength=8.5;fish.slack=1.5;
 for(let i=0;i<40;i++)stepFight(fish,false,1/60);
 assert.equal(fish.fishState,'recover');
 assert.equal(fish.cleanRuns,0);
 assert.equal(fish.turnBonus,0);
 const noPayout=createFight({id:'carp',weight:.38});
 noPayout.fishState='run';noPayout.stateDuration=.55;noPayout.distance=7;noPayout.lineLength=7.3;noPayout.slack=.3;noPayout.force=0;
 stepFight(noPayout,false,1/120);
 assert.equal(noPayout.spoolVelocity,0);
 assert.equal(noPayout.runReward,0);
 delete fish.turnBonus;
 stepFight(fish,true,1/60);
 assert.ok(Number.isFinite(fish.distance)&&Number.isFinite(fish.lineLength));
});

test('a clean first surge carries its turn into recovery after a chained surge',()=>{
 const fish=createFight({id:'perch',weight:.5});
 fish.fishState='run';fish.stateAge=0;fish.stateDuration=.65;fish.runCount=1;
 fish.distance=7;fish.lineLength=7.08;fish.slack=.08;
 for(let i=0;i<48;i++)stepFight(fish,false,1/60);
 assert.equal(fish.fishState,'windup');
 const earned=fish.turnBonus;
 assert.ok(earned>.5);
 assert.match(fightGuidance(fish,true).title,/趁间隙收线/);
 fish.fishState='run';fish.stateAge=0;fish.stateDuration=.65;fish.runCount=2;fish.runReward=0;
 for(let i=0;i<48;i++)stepFight(fish,true,1/60);
 assert.equal(fish.fishState,'recover');
 assert.equal(fish.turnBonus,earned);
});

test('reading a common fish run has a real payoff without making the first catch mandatory',()=>{
 for(const [id,weight] of [['carp',.38],['perch',.5]]){
  const patient=play(id,weight,{releaseRun:true});
  const noTurn=play(id,weight,{releaseRun:true,suppressTurn:true});
  const hardHold=play(id,weight);
  assert.equal(patient.status,'won',id);
  assert.equal(noTurn.status,'won',id);
  assert.equal(hardHold.status,'won',id);
  assert.ok(patient.elapsed<noTurn.elapsed-1.5,`${id}: rewarded letting line out should shorten the fight`);
  assert.ok(patient.elapsed<hardHold.elapsed-.5,`${id}: reading the surge should beat holding through it`);
  assert.ok(patient.cleanRuns>0);
 }
 const steady=play('minnow',.05),observant=play('minnow',.05,{releaseRun:true});
 assert.equal(steady.status,'won');
 assert.equal(observant.status,'won');
 assert.ok(observant.elapsed<steady.elapsed+1);
 for(const id of ['perch','catfish']){
  assert.equal(play(id,2).lossReason,'line-break',`${id}: hard reeling still carries a risk`);
  assert.equal(play(id,2,{releaseRun:true}).status,'won',`${id}: a controlled run remains winnable`);
 }
});

test('the turn payoff keeps the same result at 30, 60 and 120 frames per second',()=>{
 const times=[30,60,120].map(fps=>play('carp',.38,{fps,releaseRun:true}));
 assert.ok(times.every(fish=>fish.status==='won'&&fish.cleanRuns>0));
 assert.ok(Math.max(...times.map(fish=>fish.elapsed))-Math.min(...times.map(fish=>fish.elapsed))<.2);
});
