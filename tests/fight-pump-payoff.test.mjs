import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight,stepFight,pumpOpportunity,pumpRod} from '../src/reference-loop.mjs';

function play(id,weight,{fps=60,lift=false}={}){
 const fight=createFight({id,weight});
 let liftingFrames=0;
 for(let frame=0;frame<80*fps&&fight.status==='active';frame++){
  let release=fight.fishState==='run'||fight.fishState==='anchor'||liftingFrames>0;
  if(liftingFrames>0)liftingFrames--;
  if(lift&&fight.fishState==='recover'&&liftingFrames===0&&pumpOpportunity(fight,false).ready){
   assert.equal(pumpRod(fight,false).ok,true);
   liftingFrames=Math.round(.5*fps);
   release=true;
  }
  stepFight(fight,!release,1/fps);
 }
 return fight;
}

test('a half-second rod lift captures line continuously while the fish moves inward',()=>{
 const fight=createFight({id:'carp',weight:.38});
 fight.fishState='recover';fight.distance=7;fight.lineLength=7.08;fight.slack=.08;
 const before={distance:fight.distance,lineLength:fight.lineLength,reelTurns:fight.reelTurns};
 assert.equal(pumpRod(fight,false).ok,true);
 assert.deepEqual({distance:fight.distance,lineLength:fight.lineLength,reelTurns:fight.reelTurns},before);
 stepFight(fight,false,1/60);
 assert.ok(fight.distance<before.distance);
 assert.ok(fight.lineLength<before.lineLength);
 assert.ok(before.lineLength-fight.lineLength<.1);
 assert.equal(fight.spoolVelocity,0);
 assert.equal(fight.reelTurns,before.reelTurns);
});

test('lifting on recovery and sliding back to reel has a real payoff',()=>{
 for(const fps of [30,60,120]){
  const patient=play('carp',.38,{fps,lift:true});
  const reelOnly=play('carp',.38,{fps});
  assert.equal(patient.status,'won');
  assert.equal(reelOnly.status,'won');
  assert.ok(patient.pumps>=1);
  assert.ok(patient.elapsed<reelOnly.elapsed-.5);
 }
 for(const [id,weight] of [['minnow',.05],['perch',.5],['catfish',2]]){
  const lifted=play(id,weight,{lift:true});
  assert.equal(lifted.status,'won',id);
  assert.ok(lifted.elapsed<=play(id,weight).elapsed+.2,id);
 }
});
