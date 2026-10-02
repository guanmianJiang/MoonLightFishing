import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newSave,migrateSave,makeCast,finishCast,processCatch,settleEmptyCast,startNextTrip,markNearMiss} from '../src/engine.mjs';
import {recordDiscoveryEvidence} from '../src/discovery-notes.mjs';
import {makeTripMoment,tripStory} from '../src/trip-summary.mjs';

const liveCatch=(save,time,id='minnow')=>{
 save.pending=makeCast(save,time,()=>.5);
 save.pending.catch={id,weight:.08,length:12,time,spot:'reed',bait:'grain'};
 return save.pending;
};

test('four settled casts leave four factual moments and a new trip starts clean',()=>{
 const save=newSave();
 for(let i=0;i<4;i++){
  liveCatch(save,1000+i*20000);
  finishCast(save);
  const result=processCatch(save,'release');
  assert.equal(result.tripEnded,i===3);
  assert.equal(processCatch(save,'release'),null);
  save.pending=null;
 }
 assert.equal(save.trip.moments.length,4);
 assert.deepEqual(save.trip.moments.map(x=>x.kind),['landed','landed','landed','landed']);
 assert.equal(tripStory(save.trip).notes[0].title,'遇见了细鳞白条');
 assert.equal(startNextTrip(save),true);
 assert.deepEqual(save.trip.moments,[]);
 assert.equal(save.trip.number,2);
});

test('real light-lift evidence wins the recap even when the fish escapes',()=>{
 const save=newSave(),pending=liveCatch(save,1000);
 assert.equal(recordDiscoveryEvidence(save,'live_approach',2000)?.state,'seen');
 pending.teaseAt=3000;pending.teaseCount=1;
 assert.equal(recordDiscoveryEvidence(save,'bait_follow',3000)?.state,'hypothesis');
 markNearMiss(pending,'missed');pending.catch=null;
 const result=settleEmptyCast(save);
 assert.equal(result.action,'study');
 assert.equal(save.trip.moments[0].kind,'near-miss');
 assert.equal(save.trip.moments[0].discovery.state,'hypothesis');
 const thread={title:'再看一次鱼影',detail:'留在浅滩，再轻提一次。',action:{kind:'aim',zone:'middle'}};
 const story=tripStory(save.trip,thread);
 assert.match(story.lead,/轻提/);
 assert.equal(story.notes[0].title,'鱼影跟着饵走了');
 assert.equal(story.notes[1].title,'再看一次鱼影');
 assert.equal(story.continueLabel,'沿线索继续');
});

test('a tagged return outranks ordinary catch and an untagged same species is not a reunion',()=>{
 const trip={moments:[
  {castId:'1:1000',kind:'landed',fishId:'minnow',action:'release'},
  {castId:'2:2000',kind:'landed',fishId:'minnow',action:'release',returned:true}
 ]};
 assert.match(tripStory(trip).notes[0].title,/认出了放回去的细鳞白条/);
 assert.equal(tripStory({moments:[trip.moments[0]]}).notes[0].title,'遇见了细鳞白条');
 const save=newSave(),pending=liveCatch(save,1000);
 pending.catch.tagId='tracked-fish';finishCast(save);processCatch(save,'study');
 assert.equal(save.trip.moments[0].returned,true);
});

test('object, identified near miss and truly quiet water receive different honest recaps',()=>{
 const save=newSave(),object=liveCatch(save,1000,'bottle');
 finishCast(save);processCatch(save,'release');
 assert.equal(save.trip.moments[0].kind,'object');
 assert.match(tripStory(save.trip).notes[0].title,/旧漂流瓶/);
 assert.doesNotMatch(tripStory(save.trip).lead,/一尾鱼/);
 save.pending=null;
 const lost=liveCatch(save,20000,'perch');markNearMiss(lost,'escaped');lost.catch=null;
 settleEmptyCast(save);
 const missedStory=tripStory({moments:[save.trip.moments[1]]});
 assert.match(missedStory.notes[0].title,/红鳍鲈/);
 assert.match(missedStory.notes[0].body,/不能认定是同一尾/);
 const expiredStory=tripStory({moments:[{castId:'4:40000',kind:'near-miss',fishId:'carp',missReason:'missed'}]});
 assert.match(expiredStory.notes[0].body,/咬实提示.*按住提竿/);
 const quiet=tripStory({moments:[{castId:'3:30000',kind:'quiet'}]});
 assert.match(quiet.lead,/没有新的可确认线索/);
 assert.doesNotMatch(quiet.notes[0].body,/鱼影|奖励|记录/);
});

test('capacity rejection, duplicate settlement and bad old data cannot create a false moment',()=>{
 const save=newSave();liveCatch(save,1000);
 finishCast(save);
 save.collection=Array.from({length:6},()=>({id:'minnow'}));
 assert.match(processCatch(save,'keep').error,/满/);
 assert.deepEqual(save.trip.moments,[]);
 processCatch(save,'study');
 assert.equal(save.trip.moments.length,1);
 assert.equal(processCatch(save,'study'),null);
 const legacy=newSave();delete legacy.trip.moments;
 legacy.trip.changes=['本竿为空钩，没有获得样本。'];
 migrateSave(legacy);
 assert.deepEqual(legacy.trip.moments,[]);
 assert.match(tripStory(legacy.trip).lead,/空钩/);
 assert.doesNotMatch(tripStory(legacy.trip).notes[0].body,/鱼影|发现了鱼/);
 legacy.trip.moments=[{castId:'1:1000',kind:'landed',fishId:'unknown'}];
 assert.match(tripStory(legacy.trip).lead,/空钩/);
 legacy.trip.changes.unshift('已记录细鳞白条，调查进度 +1。');
 legacy.trip.moments=[{castId:'2:2000',kind:'quiet'}];
 assert.equal(tripStory(legacy.trip).notes[0].title,'旧行程的收获');
 assert.match(tripStory(legacy.trip).notes[0].body,/之后每竿会单独记录/);
 assert.equal(makeTripMoment({casts:1},null,'study'),null);
});

test('invalid next action stays off the recap; valid next actions do not promise a catch',()=>{
 const trip={moments:[{castId:'1:1000',kind:'quiet'}]};
 assert.equal(tripStory(trip,{title:'假的方向',detail:'内容',action:{kind:'unknown'}}).hasNextAction,false);
 const story=tripStory(trip,{title:'试试近岸',detail:'鱼影可能还在。',action:{kind:'spot',spot:'reed'}});
 assert.equal(story.hasNextAction,true);
 assert.equal(story.notes.length,2);
 assert.match(story.notes[1].body,/可能/);
});

test('the recap continue button starts a fresh trip and hands off one route action without casting',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 const handler=source.slice(source.indexOf("$('#nextTrip').onclick="),source.indexOf('function showBook('));
 const state=newSave();state.trip.castsLeft=0;
 const nodes=new Map(),actions=[];
 const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',close(){this.open=false}});return nodes.get(selector)};
 const action={kind:'aim',zone:'middle',label:'再观察一竿'};
 const context=vm.createContext({state,$,Date,weatherAt:()=>({id:'mist'}),nextCastThread:()=>({action}),startNextTrip,save(){},renderSetup(){},update(){},followGuide(next){actions.push(next)}});
 vm.runInContext(handler,context);
 $('#nextTrip').onclick();
 assert.equal(state.trip.number,2);
 assert.equal(state.trip.castsLeft,4);
 assert.equal(state.pending,null,'entering aim must still require a separate cast confirmation');
 assert.deepEqual(actions,[action]);
 assert.equal($('#tripEnd').open,false);
 state.trip.castsLeft=0;
 context.nextCastThread=()=>null;
 $('#nextTrip').onclick();
 assert.equal(state.trip.number,3);
 assert.equal(actions.length,1,'no stale action should run after the direction disappears');
});
