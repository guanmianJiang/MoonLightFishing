import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,makeCast,finishCast,processCatch} from '../src/engine.mjs';
import {nextCastThread,waitingWaterLine} from '../src/next-cast-thread.mjs';

test('a released catch gives the next cast a visible, non-guaranteed direction',()=>{
 const save=newSave();
 save.pending=makeCast(save,0,()=>.4);
 finishCast(save);
 const result=processCatch(save,'release');
 assert.equal(result.action,'release');
 save.pending=null;
 const thread=nextCastThread(save);
 assert.equal(thread.kind,'release');
 assert.match(thread.detail,/可能/);
 assert.equal(thread.action.kind,'aim');
 assert.match(waitingWaterLine(save,{spot:save.spot}),/鱼影/);
});

test('one-cast water trail takes priority and disappears when spent',()=>{
 const save=newSave();
 save.clues=['reed'];
 save.waterTrail={fishId:'carp',spot:'reed',bait:'grain',reason:'missed'};
 assert.equal(nextCastThread(save).kind,'trail');
 assert.match(nextCastThread(save).detail,/下一竿可能/);
 const pending=makeCast(save,0,()=>.4);
 assert.equal(save.waterTrail,null);
 assert.equal(nextCastThread(save).kind,'clue');
 assert.match(waitingWaterLine(save,pending),/刚才鱼影/);
});

test('new water and clues guide without promising a catch',()=>{
 const save=newSave();
 save.knowledge=3;
 assert.deepEqual(nextCastThread(save).action,{kind:'spot',spot:'bridge',label:'前往栈桥外湾'});
 save.spot='bridge';save.bait='worm';save.clues=['gold1'];
 const thread=nextCastThread(save);
 assert.equal(thread.kind,'clue');
 assert.equal(thread.action.kind,'bait');
 assert.match(thread.detail,/雨后/);
});

test('invalid and object-only records safely fall back',()=>{
 assert.equal(nextCastThread(null),null);
 const save=newSave();
 save.waterTrail={fishId:'bottle',spot:'reed',bait:'grain',reason:'missed'};
 save.tracked=[{id:'bell',spot:'reed',lastSeen:2}];
 assert.equal(nextCastThread(save),null);
 assert.equal(waitingWaterLine(save,{}),null);
 save.waterTrail={fishId:'moon',spot:'deep',bait:'glow',reason:'missed'};
 save.knowledge=7;save.spot='deep';
 assert.equal(nextCastThread(save,'mist'),null);
});
