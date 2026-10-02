import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newSave,migrateSave,spotUnlocked,makeCast,finishCast,processCatch} from '../src/engine.mjs';
import {castPreset,castAimChoices} from '../src/cast-target.mjs';
import {explorationProgress,progressionGuide,castDifficultyHint} from '../src/progression-guide.mjs';

const catches=(spot,count)=>Array.from({length:count},(_,index)=>({id:'carp',spot,weight:.2,length:20,time:index+1}));

test('ordinary catches unlock the next water without forcing a processing choice',()=>{
 const save=newSave();save.log=catches('reed',6);save.knowledge=0;
 assert.equal(explorationProgress(save),3);
 assert.equal(spotUnlocked(save,'bridge'),true);
 assert.equal(spotUnlocked(save,'deep'),false);
 assert.equal(progressionGuide(save).action.spot,'bridge');
 save.spot='bridge';save.log.push(...catches('bridge',8));
 assert.equal(explorationProgress(save),7);
 assert.equal(spotUnlocked(save,'deep'),true);
 assert.equal(progressionGuide(save).action.spot,'deep');
});

test('the guide changes from safe practice to a new water and then to deeper targets',()=>{
 const save=newSave();
 assert.equal(progressionGuide(save).action.zone,'near');
 save.log=catches('reed',4);
 assert.equal(progressionGuide(save).action.zone,'far');
 assert.match(progressionGuide(save).detail,/做成记录/);
 save.log=catches('reed',6);save.spot='bridge';
 assert.equal(progressionGuide(save).action.bait,'worm');
 save.bait='worm';assert.equal(progressionGuide(save).action.zone,'near');
 save.log.push(...catches('bridge',2));
 assert.equal(progressionGuide(save).action.zone,'far');
 save.knowledge=3;
 assert.equal(progressionGuide(save).action.spot,'deep');
 save.spot='deep';assert.equal(progressionGuide(save).action.bait,'glow');
});

test('old saves keep their catch based unlock and extra shore catches cannot skip the bridge',()=>{
 const save=newSave();save.knowledge=0;save.log=catches('reed',20);save.spot='bridge';
 assert.equal(migrateSave(save).spot,'bridge');
 assert.equal(explorationProgress(save),3);
 assert.equal(spotUnlocked(save,'deep'),false);
 save.log=null;assert.equal(explorationProgress(save),0);
 save.log=[null,{},...catches('reed',1)];assert.equal(explorationProgress(save),0);
});

test('empty casts and repeated result handling cannot farm exploration',()=>{
 const save=newSave();save.pending=makeCast(save,1000,()=>.5);save.pending.catch=null;
 finishCast(save);processCatch(save,'study');
 assert.equal(explorationProgress(save),0);
 save.pending=null;save.pending=makeCast(save,2000,()=>.5);finishCast(save);
 const once=explorationProgress(save);
 assert.equal(finishCast(save),false);
 processCatch(save,'release');
 assert.equal(processCatch(save,'release'),null);
 assert.equal(explorationProgress(save),once);
});

test('near casts offer more time and lighter targets while far casts invite stronger fish',()=>{
 const save=newSave();save.spot='bridge';save.bait='worm';
 let nearHeavy=0,farHeavy=0;
 for(let index=0;index<1000;index++){
  const roll=()=>index/1000;
  const near=makeCast(save,1000,roll,castPreset('bridge','near'));
  const far=makeCast(save,1000,roll,castPreset('bridge','far'));
  if(index===0)assert.equal(near.biteWindowMs-far.biteWindowMs,2000);
  nearHeavy+=['perch','catfish'].includes(near.catch.id)?1:0;
  farHeavy+=['perch','catfish'].includes(far.catch.id)?1:0;
 }
 assert.ok(farHeavy>nearHeavy+100,{nearHeavy,farHeavy});
 assert.match(castDifficultyHint('near'),/多 2 秒/);
 assert.match(castDifficultyHint('far'),/大鱼更多/);
 assert.match(castDifficultyHint('middle'),/点选/);
});

test('route action switches the spot or previews a zone without committing a cast',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 const actions=[];let pending=null,aiming=false;
 const context=vm.createContext({state:{get pending(){return pending},spot:'bridge'},get aiming(){return aiming},aimPoint:null,revealing:false,selectSpot:id=>actions.push(['spot',id]),selectBait:id=>actions.push(['bait',id]),beginCastAim(){aiming=true;return true},setAimPoint:point=>actions.push(['aim',point]),castPreset,castAimChoices,update(){}});
 vm.runInContext(source.slice(source.indexOf('function followGuide('),source.indexOf('const setupUI=')),context);
 context.followGuide({kind:'spot',spot:'deep'});
 context.followGuide({kind:'aim',zone:'near'});
 assert.deepEqual(actions[0],['spot','deep']);
 assert.deepEqual(actions[1],['aim',castPreset('bridge','near')]);
 pending={phase:'cast'};context.followGuide({kind:'spot',spot:'reed'});
 assert.equal(actions.length,2);
});
