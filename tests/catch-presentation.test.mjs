import test from 'node:test';
import assert from 'node:assert/strict';
import {catchActionPlan} from '../src/catch-presentation.mjs';
import {newSave,goalForTrip} from '../src/engine.mjs';
import {GAME_RULES} from '../src/config/game-rules.mjs';

test('ordinary repeat catch offers one goal based action',()=>{
 const save=newSave(),fish={id:'minnow',object:false,special:false};
 assert.deepEqual(catchActionPlan(save,{id:'minnow'},fish,3),{recommended:'study',notable:false});
 save.trip.goal=goalForTrip(2);
 assert.deepEqual(catchActionPlan(save,{id:'minnow'},fish,3),{recommended:'release',notable:false});
});

test('a first, unusual or tracked catch is marked as notable',()=>{
 const save=newSave(),common={id:'minnow'};
 assert.equal(catchActionPlan(save,{id:'minnow'},common,1).notable,true);
 assert.equal(catchActionPlan(save,{id:'minnow',mutation:'浅金体色'},common,4).notable,true);
 assert.equal(catchActionPlan(save,{id:'minnow',tagId:'tag-1'},common,4).notable,true);
 assert.equal(catchActionPlan(save,{id:'moon'}, {id:'moon',special:true},4).notable,true);
});

test('invalid recommendations fall back to a record while preserving choices',()=>{
 const save=newSave();save.trip.goal=goalForTrip(2);
 assert.equal(catchActionPlan(save,{id:'bottle'}, {id:'bottle',object:true},2).recommended,'study');
 save.trip.goal=goalForTrip(3);save.collection.length=GAME_RULES.collectionLimit;
 assert.equal(catchActionPlan(save,{id:'minnow'}, {id:'minnow'},2).recommended,'study');
 save.trip.goal.action='unknown';
 assert.equal(catchActionPlan(save,{id:'minnow'}, {id:'minnow'},2).recommended,'study');
});
