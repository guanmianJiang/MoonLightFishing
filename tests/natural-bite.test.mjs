import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,makeCast,migrateBiteMode,expireHookWindow,chooseTactic,missBite} from '../src/engine.mjs';
import {phaseOf} from '../src/fishing-motion.js';

const fixed=()=>.5;

test('a new cast moves through visible fish cues without a choice',()=>{
 const save=newSave(),p=makeCast(save,1000,fixed);
 assert.equal(p.biteMode,'natural');
 assert.equal(phaseOf(p,p.decisionAt-1),'approach');
 assert.equal(phaseOf(p,p.decisionAt),'reading');
 assert.equal(phaseOf(p,p.readyAt-2201),'reading');
 assert.equal(phaseOf(p,p.readyAt-2199),'nibble');
 assert.equal(phaseOf(p,p.readyAt),'hooked');
 assert.ok(p.catch);
 assert.equal(chooseTactic({...save,pending:p},'wait',p.decisionAt+1),null);
 assert.equal(missBite({...save,pending:p},p.decisionAt+7000),null);
 assert.equal(save.skill.streak,0);
});

test('a real bite has a generous hook window and expires only once',()=>{
 const save=newSave(),p=save.pending=makeCast(save,1000,fixed),deadline=p.readyAt+p.biteWindowMs;
 assert.equal(expireHookWindow(save,deadline-1),false);
 assert.equal(phaseOf(p,deadline-1),'hooked');
 assert.equal(expireHookWindow(save,deadline),true);
 assert.equal(p.catch,null);
 assert.equal(phaseOf(p,deadline),'empty');
 assert.equal(expireHookWindow(save,deadline+1),false);
 assert.equal(save.observations.length,0);
});

test('a lifted fish and a running fight cannot expire',()=>{
 const save=newSave(),p=save.pending=makeCast(save,1000,fixed),later=p.readyAt+p.biteWindowMs+1;
 p.liftedAt=p.readyAt;
 assert.equal(expireHookWindow(save,later),false);
 delete p.liftedAt;p.fight={status:'active'};
 assert.equal(expireHookWindow(save,later),false);
 assert.ok(p.catch);
});

test('an unresolved older cast resumes as a natural bite with time to see it',()=>{
 const save=newSave(),p=makeCast(save,1000,fixed),now=p.readyAt+30_000;
 delete p.biteMode;delete p.decisionAt;
 migrateBiteMode(p,now);
 assert.equal(p.biteMode,'natural');
 assert.ok(p.readyAt>=now+2200);
 assert.equal(phaseOf(p,now),'reading');
 const readyAt=p.readyAt;migrateBiteMode(p,now+100);
 assert.equal(p.readyAt,readyAt);
});

test('an already resolved legacy choice keeps its outcome',()=>{
 const save=newSave(),p=makeCast(save,1000,fixed);
 delete p.biteMode;p.tactic='wait';p.tacticSuccess=true;p.reactedAt=p.decisionAt+100;
 migrateBiteMode(p,p.reactedAt+100);
 assert.equal(p.biteMode,undefined);
 assert.equal(phaseOf(p,p.reactedAt+100),'responding');
});
