import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../src/config/gameplay/discoveries.json' with {type:'json'};
import {newSave,migrateSave,makeCast,finishCast,processCatch,settleEmptyCast} from '../src/engine.mjs';
import {recordDiscoveryEvidence,recordVisibleApproach,discoveryThread,discoveryJournal,discoveryResultLine,validateDiscoveryConfig} from '../src/discovery-notes.mjs';
import {nextCastThread} from '../src/next-cast-thread.mjs';
import {renderBookMarkup} from '../src/ui/book-markup.mjs';

function liveCast(save,start){
 save.pending=makeCast(save,start,()=>.5);
 save.pending.catch={id:'minnow',weight:.08,length:12,time:start,spot:'reed',bait:'grain'};
 return save.pending;
}
function follow(save,at){
 save.pending.teaseAt=at;
 save.pending.teaseCount=1;
 return recordDiscoveryEvidence(save,'bait_follow',at);
}

test('a visible approach and two independent light lifts form a persistent observation',()=>{
 const save=newSave(),first=liveCast(save,1000);
 assert.equal(recordDiscoveryEvidence(save,'live_approach',2000)?.state,'seen');
 assert.equal(discoveryJournal(save)[0].stateLabel,'亲眼看见');
 assert.equal(recordDiscoveryEvidence(save,'live_approach',2000),null);
 assert.equal(follow(save,3000)?.state,'hypothesis');
 assert.match(discoveryResultLine(first),/再找一次/);
 assert.equal(follow(save,3000),null);
 finishCast(save);
 const result=processCatch(save,'release');
 assert.match(result.discoveryText,/再找一次/);
 assert.equal(processCatch(save,'release'),null);
 save.pending=null;
 assert.equal(nextCastThread(save).kind,'discovery');
 assert.match(renderBookMarkup(save,'water',()=>''),/待再试/);
 const restored=migrateSave(structuredClone(save));
 const second=liveCast(restored,20000);
 assert.equal(follow(restored,22000)?.state,'supported');
 assert.notEqual(first.start,second.start);
 finishCast(restored);
 assert.match(processCatch(restored,'study').discoveryText,/两次不同/);
 restored.pending=null;
 assert.equal(discoveryJournal(restored)[0].stateLabel,'观察支持');
 assert.doesNotMatch(renderBookMarkup(restored,'water',()=>''),/待再试/);
 assert.notEqual(nextCastThread(restored)?.kind,'discovery');
});

test('an observed fish can escape, but an empty or object cast never invents evidence',()=>{
 const save=newSave(),pending=liveCast(save,1000);
 assert.equal(follow(save,3000)?.state,'hypothesis');
 pending.catch=null;
 assert.equal(recordDiscoveryEvidence(save,'bait_follow',3200),null);
 const result=settleEmptyCast(save);
 assert.match(result.discoveryText,/鱼影跟着/);
 assert.equal(save.pending,null);
 assert.equal(settleEmptyCast(save),null);
 assert.equal(discoveryJournal(save)[0].state,'hypothesis');
 const empty=liveCast(save,20000);
 empty.catch=null;
 assert.equal(recordDiscoveryEvidence(save,'live_approach',21000),null);
 assert.equal(follow(save,22000),null);
 empty.catch={id:'bottle'};
 assert.equal(recordDiscoveryEvidence(save,'live_approach',23000),null);
 assert.equal(follow(save,24000),null);
 assert.equal(discoveryJournal(save)[0].state,'hypothesis');
});

test('wrong conditions, invalid events, times and old saves do not advance the note',()=>{
 const save=newSave(),pending=liveCast(save,1000);
 assert.equal(recordDiscoveryEvidence(save,'unknown',2000),null);
 pending.spot='bridge';
 assert.equal(recordDiscoveryEvidence(save,'live_approach',2000),null);
 pending.spot='reed';pending.bait='worm';
 assert.equal(follow(save,3000),null);
 pending.bait='grain';pending.biteMode='legacy';
 assert.equal(follow(save,3000),null);
 pending.biteMode='natural';pending.teaseAt=3000;
 assert.equal(recordDiscoveryEvidence(save,'bait_follow',3001),null);
 assert.equal(recordDiscoveryEvidence(save,'live_approach',NaN),null);
 assert.equal(recordDiscoveryEvidence(save,'live_approach',pending.readyAt),null);
 assert.equal(discoveryJournal(save).length,0);
 const legacy=newSave();delete legacy.discoveryNotes;
 legacy.log=[{id:'minnow',weight:.08,length:12,time:1000,spot:'reed',bait:'grain'}];
 legacy.clues=['reed'];
 migrateSave(legacy);
 assert.deepEqual(legacy.discoveryNotes,[]);
 assert.equal(discoveryThread(legacy),null);
 legacy.discoveryNotes=[{topicId:'missing',state:'supported',evidence:[{castId:'1:1000',eventType:'bait_follow',observedAt:2000}]}];
 assert.deepEqual(discoveryJournal(legacy),[]);
 assert.equal(discoveryThread(legacy),null);
});

test('a hidden or covered fish approach is not recorded as personally seen',()=>{
 const save=newSave();liveCast(save,1000);
 for(const view of [null,{overview:true},{hidden:true},{modalOpen:true}])assert.equal(recordVisibleApproach(save,view,2000),null);
 assert.equal(discoveryJournal(save).length,0);
 assert.equal(recordVisibleApproach(save,{overview:false,hidden:false,modalOpen:false},2000)?.state,'seen');
});

test('evidence controls state, and the next-cast card keeps the immediate trail first',()=>{
 const save=newSave(),pending=liveCast(save,1000);
 assert.equal(recordDiscoveryEvidence(save,'live_approach',2000)?.state,'seen');
 save.discoveryNotes[0].state='supported';
 assert.equal(discoveryThread(save)?.kind,'discovery');
 assert.match(discoveryThread(save).detail,/轻点浮漂/);
 save.spot='bridge';
 assert.deepEqual(discoveryThread(save)?.action,{kind:'spot',spot:'reed',label:'前往近岸浅滩'});
 save.spot='reed';save.bait='worm';
 assert.equal(discoveryThread(save)?.action.kind,'bait');
 save.bait='grain';save.waterTrail={fishId:'carp',spot:'reed',bait:'grain',reason:'missed'};
 assert.equal(nextCastThread(save).kind,'trail');
 pending.phase='result';
 assert.equal(recordDiscoveryEvidence(save,'live_approach',2500),null);
});

test('refreshing an unfinished cast and even reusing a timestamp cannot duplicate its evidence',()=>{
 const save=newSave();liveCast(save,1000);
 assert.equal(recordDiscoveryEvidence(save,'live_approach',2000)?.state,'seen');
 const resumed=migrateSave(structuredClone(save));
 assert.equal(recordDiscoveryEvidence(resumed,'live_approach',2000),null);
 assert.equal(follow(resumed,3000)?.state,'hypothesis');
 assert.equal(resumed.discoveryNotes[0].evidence.length,2);
 finishCast(resumed);processCatch(resumed,'study');resumed.pending=null;
 liveCast(resumed,1000);
 assert.equal(follow(resumed,3000)?.state,'supported');
 assert.deepEqual(resumed.discoveryNotes[0].evidence.filter(item=>item.eventType==='bait_follow').map(item=>item.castId),['1:1000','2:1000']);
});

test('discovery content is finite validated JSON and rejects unsupported conditions',()=>{
 assert.equal(validateDiscoveryConfig(config),true);
 const duplicate=structuredClone(config);duplicate.topics.push(structuredClone(duplicate.topics[0]));
 assert.equal(validateDiscoveryConfig(duplicate),false);
 const invalid=structuredClone(config);invalid.topics[0].conditions.spots=['missing'];
 assert.equal(validateDiscoveryConfig(invalid),false);
 invalid.topics[0].conditions.spots=['reed'];invalid.topics[0].supportDistinctCasts=1;
 assert.equal(validateDiscoveryConfig(invalid),false);
 invalid.topics[0].supportDistinctCasts=2;invalid.topics[0].events.response='custom_script';
 assert.equal(validateDiscoveryConfig(invalid),false);
});
