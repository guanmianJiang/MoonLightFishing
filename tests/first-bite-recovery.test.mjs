import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,makeCast,markNearMiss,settleEmptyCast,migrateSave} from '../src/engine.mjs';
import {firstBiteRecovery} from '../src/first-bite-recovery.mjs';
import {nextCastThread} from '../src/next-cast-thread.mjs';
import {actionCuePresentation} from '../src/ui/action-guidance.mjs';

function firstMiss(reason='missed'){
 const save=newSave();
 save.pending=makeCast(save,1000,()=>.5);
 save.pending.catch={id:'minnow',weight:.08,length:12,time:1000,spot:'reed',bait:'grain'};
 assert.equal(markNearMiss(save.pending,reason),true);
 save.pending.catch=null;
 settleEmptyCast(save);
 return save;
}

test('a real first bite timeout becomes one actionable next cast reminder without a guaranteed fish',()=>{
 const save=firstMiss();
 assert.equal(save.casts,1);
 assert.equal(save.trip.moments[0].missReason,'missed');
 const recovery=firstBiteRecovery(save);
 assert.match(recovery.cue,/鱼线绷紧.*按住右下钓钩/);
 const thread=nextCastThread(save);
 assert.equal(thread.kind,'trail');
 assert.match(thread.detail,/按住右下钓钩/);
 assert.match(thread.detail,/不保证/);
 assert.equal(thread.action.kind,'aim');
 const cue=actionCuePresentation({mode:'prepare',trailReady:true,recovery});
 assert.equal(cue.key,'prepare:first-miss');
 assert.equal(cue.text,recovery.cue);
 assert.equal(cue.target,'#cast');
 assert.equal(cue.announce,false);
});

test('the reminder yields to selection feedback and stays out of occupied modes',()=>{
 const recovery=firstBiteRecovery(firstMiss());
 const feedback={kind:'bait',name:'蚯蚓',key:1,expiresAt:2000};
 assert.equal(actionCuePresentation({mode:'prepare',recovery,feedback,now:1000}).kind,'confirmed');
 assert.equal(actionCuePresentation({mode:'prepare',recovery,feedback,now:2000}).key,'prepare:first-miss');
 for(const mode of ['aim','watch','strike','fight','landing','processing','result']){
  const cue=actionCuePresentation({mode,recovery});
  if(mode==='aim')assert.equal(cue.key,'aim:choose');
  else assert.equal(cue,null);
 }
});

test('second cast, fight escape, quiet water, malformed and old data cannot create a false reminder',()=>{
 const save=firstMiss();
 save.pending=makeCast(save,20000,()=>.5);
 assert.equal(firstBiteRecovery(save),null,'a pending second cast must hide the reminder before casts increments');
 save.pending=null;save.casts=2;
 assert.equal(firstBiteRecovery(save),null);
 assert.equal(firstBiteRecovery(firstMiss('escaped')),null);
 const quiet=newSave();quiet.pending=makeCast(quiet,1000,()=>.5);quiet.pending.catch=null;settleEmptyCast(quiet);
 assert.equal(firstBiteRecovery(quiet),null);
 const malformed=firstMiss();malformed.trip.moments[0].fishId='bottle';
 assert.equal(firstBiteRecovery(malformed),null);
 malformed.trip.moments[0].fishId='minnow';malformed.trip.moments[0].castId='1:broken';
 assert.equal(firstBiteRecovery(malformed),null);
 const legacy=newSave();legacy.casts=1;legacy.trip.moments=undefined;migrateSave(legacy);
 assert.equal(firstBiteRecovery(legacy),null);
});
