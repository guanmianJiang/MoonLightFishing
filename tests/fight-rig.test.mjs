import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight,pumpRod,stepFight} from '../src/reference-loop.mjs';
import {fightRigGeometry} from '../src/fight-rig.mjs';

test('the diagram follows real fish distance, line slack and rod load',()=>{
 const fight=createFight({weight:2});
 const far=fightRigGeometry(fight);
 fight.distance=3;fight.slack=.8;fight.load=.15;
 const nearAndLoose=fightRigGeometry(fight);
 assert.ok(nearAndLoose.fishX<far.fishX-100);
 assert.equal(nearAndLoose.state,'slack');
 assert.notEqual(nearAndLoose.line,far.line);
 fight.slack=0;fight.load=.85;
 const strained=fightRigGeometry(fight);
 assert.equal(strained.state,'strained');
 assert.notEqual(strained.rod,nearAndLoose.rod);
 assert.equal(fightRigGeometry({...fight,radialVelocity:-.8}).movement,'in');
 assert.equal(fightRigGeometry({...fight,radialVelocity:.8}).movement,'out');
});

test('a well-timed rod lift tires the fish and softens its next run',()=>{
 const ordinary=createFight({weight:2}),lifted=createFight({weight:2});
 ordinary.fishState=lifted.fishState='recover';ordinary.stateDuration=lifted.stateDuration=.1;
 assert.equal(pumpRod(lifted,false).ok,true);
 let warned=false,softened=false;
 for(let i=0;i<180;i++){
  stepFight(ordinary,false,.016);stepFight(lifted,false,.016);
  warned ||= ordinary.surgeWarning>.55;
  softened ||= ordinary.surge-lifted.surge>.035;
 }
 assert.ok(warned);
 assert.ok(softened);
 assert.ok(lifted.fatigue>0);
});
