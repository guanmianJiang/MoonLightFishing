import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../src/config/gameplay/water-questions.json' with {type:'json'};
import {newSave,makeCast,finishCast,processCatch} from '../src/engine.mjs';
import {castPreset} from '../src/cast-target.mjs';
import {validateWaterQuestionConfig,waterQuestion,waterQuestionCastId,waterQuestionOutcome,waterQuestionWaitingLine,waterQuestionRecap} from '../src/water-question.mjs';
import {tripStory} from '../src/trip-summary.mjs';
import {waitingWaterLine} from '../src/next-cast-thread.mjs';

const copy=()=>structuredClone(config);
const laterSave=()=>{const save=newSave();save.casts=1;return save};

test('water questions are configured only for real reachable fish and known rules',()=>{
 assert.equal(validateWaterQuestionConfig(),true);
 const invalid=[
  data=>data.questions.push({...data.questions[0]}),
  data=>data.questions[0].ruleId='unknown',
  data=>data.questions[0].targetFish=['bottle'],
  data=>data.questions[0].targetFish=['catfish'],
  data=>data.questions[0].zone='offshore',
  data=>data.questions[0].copy.matched=''
 ];
 for(const change of invalid){const data=copy();change(data);assert.equal(validateWaterQuestionConfig(data),false)}
});

test('the optional question offers a distinct playable choice only when its water is open',()=>{
 const save=newSave();
 assert.equal(waterQuestion(save),null,'the first cast has one clear entrance');
 save.casts=1;
 const shoal=waterQuestion(save);
 assert.equal(shoal.id,'shoal-near-fish');
 assert.deepEqual(shoal.action,{kind:'water-question',id:'shoal-near-fish',spot:'reed',bait:'worm',zone:'near',label:'换蚯蚓试近水'});
 save.trip.rule.id='bottom';
 assert.equal(waterQuestion(save).action.bait,'glow');
 save.trip.rule.id='predator';
 assert.equal(waterQuestion(save),null,'the outer bay cannot be suggested while locked');
 save.knowledge=3;
 assert.equal(waterQuestion(save).action.spot,'bridge');
 save.trip.castsLeft=0;
 assert.equal(waterQuestion(save),null);
 save.trip.castsLeft=1;save.trip.rule.id='unknown';
 assert.equal(waterQuestion(save),null);
 save.trip.rule.id='shoal';save.pending={phase:'cast'};
 assert.equal(waterQuestion(save),null);
 assert.equal(waterQuestion(null),null);
});

test('the cast records a chosen question only if confirmed conditions still match',()=>{
 const save=laterSave(),question=waterQuestion(save);save.bait='worm';
 save.pending=makeCast(save,1000,()=>.1,castPreset('reed','near'));
 assert.equal(waterQuestionCastId(save,question.id),question.id);
 save.pending.waterQuestionId=question.id;
 assert.match(waitingWaterLine(save,save.pending),/换了蚯蚓试浅滩近水/);
 assert.equal(waterQuestionWaitingLine({...save.pending,bait:'grain'}),null);
 assert.equal(waterQuestionCastId(save,'old-id'),null);
 save.pending.castZone='far';assert.equal(waterQuestionCastId(save,question.id),null);
 save.pending.castZone='near';save.pending.bait='grain';assert.equal(waterQuestionCastId(save,question.id),null);
 save.pending.bait='worm';save.trip.rule.id='bottom';assert.equal(waterQuestionCastId(save,question.id),null);
 save.trip.rule.id='shoal';save.pending.phase='result';assert.equal(waterQuestionCastId(save,question.id),null);
});

test('choosing the shoal question truly trades the old trail for a different bait',()=>{
 const trail={fishId:'carp',spot:'reed',bait:'grain',reason:'missed'};
 const follow=laterSave();follow.waterTrail=trail;
 const oldFish=makeCast(follow,1000,()=>.6,castPreset('reed','near'));
 assert.equal(oldFish.followedTrail,true);
 const compare=laterSave();compare.waterTrail={...trail};
 const question=waterQuestion(compare);
 assert.equal(question.action.bait,'worm');
 compare.bait=question.action.bait;
 const newFish=makeCast(compare,1000,()=>.6,castPreset('reed','near'));
 assert.equal(newFish.followedTrail,false,'the water question does not secretly apply the previous fish trail');
 assert.equal(compare.waterTrail,null,'the one-cast trail is spent when the player chooses another direction');
 assert.equal(waterQuestionCastId({...compare,pending:newFish},question.id),question.id);
});

test('only the actual landed result answers the optional question',()=>{
 const base={phase:'result',waterQuestionId:'shoal-near-fish',spot:'reed',bait:'worm',castZone:'near'};
 assert.equal(waterQuestionOutcome({...base,catch:{id:'carp'}}).status,'other');
 assert.match(waterQuestionOutcome({...base,catch:{id:'minnow'}}).text,/白条/);
 assert.equal(waterQuestionOutcome({...base,catch:{id:'perch'}}).status,'other');
 assert.match(waterQuestionOutcome({...base,catch:{id:'perch'}}).text,/红鳍鲈/);
 for(const pending of [{...base,catch:{id:'bottle'}},{...base,catch:null,nearMiss:{fishId:'carp'}},{...base,catch:{id:'unknown'}}])assert.equal(waterQuestionOutcome(pending).status,'unresolved');
 assert.equal(waterQuestionOutcome({...base,castZone:'far',catch:{id:'carp'}}),null);
 assert.equal(waterQuestionOutcome({...base,waterQuestionId:'unknown',catch:{id:'carp'}}),null);
 assert.equal(waterQuestionOutcome({...base,phase:'cast',catch:{id:'minnow'}}),null,'a hidden pre-result draw cannot answer the question');
 assert.equal(waterQuestionWaitingLine({...base,waterQuestionId:'unknown'}),null);
 assert.equal(waterQuestionOutcome(null),null);
});

test('a completed chosen cast echoes once and can become a true trip memory',()=>{
 const save=laterSave(),question=waterQuestion(save);save.bait='worm';
 save.pending=makeCast(save,1000,()=>.6,castPreset('reed','near'));
 save.pending.waterQuestionId=waterQuestionCastId(save,question.id);
 assert.equal(waterQuestionOutcome(save.pending),null);
 const restored=structuredClone(save.pending);
 assert.deepEqual(waterQuestionOutcome(restored),waterQuestionOutcome(save.pending));
 assert.equal(finishCast(save),true);
 assert.equal(waterQuestionOutcome(save.pending).status,'matched');
 const result=processCatch(save,'study');
 assert.match(result.waterQuestionText,/符合刚才的判断/);
 assert.deepEqual(save.trip.moments[0].waterQuestion,{id:question.id,status:'matched'});
 assert.equal(processCatch(save,'study'),null);
 assert.equal(save.trip.moments.length,1);
 const story=tripStory(save.trip);
 assert.match(story.lead,/带着自己的问题/);
 assert.match(story.notes[0].body,/实际钓到/);
 assert.equal(waterQuestionRecap({fishId:'perch',waterQuestion:{id:question.id,status:'matched'}}),null);
});
