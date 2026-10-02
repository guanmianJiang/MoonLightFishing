import test from 'node:test';
import assert from 'node:assert/strict';
import {anglerExpressionTarget,createAnglerExpression} from '../src/angler-expression.mjs';
const caught={id:'carp',weight:2},pending={start:1000,readyAt:5000,catch:caught,phase:'cast'};
test('waiting, aiming, approach and bite have distinct restrained expressions',()=>{
 assert.equal(anglerExpressionTarget({}).mood,'relaxed');assert.equal(anglerExpressionTarget({aiming:true}).mood,'focused');
 for(const phase of ['approach','reading','responding','nibble'])assert.equal(anglerExpressionTarget({pending,phase},4900).mood,'attentive');
 assert.equal(anglerExpressionTarget({pending,phase:'hooked'},5100).mood,'bite-surprise');assert.equal(anglerExpressionTarget({pending,phase:'hooked'},5400).mood,'expectant');
 assert.notEqual(anglerExpressionTarget({pending:{...pending,readyAt:NaN},phase:'hooked'},5400).mood,'bite-surprise');
});
test('effort follows actual load and falls when the line is slack; objects cannot strain',()=>{
 const context=f=>({pending:{...pending,fight:{status:'active',...f}},phase:'hooked'}),low=anglerExpressionTarget(context({tension:.1,load:.1})),high=anglerExpressionTarget(context({tension:1,load:1})),slack=anglerExpressionTarget(context({tension:1,load:1,slack:.5}));
 assert.ok(high.eyeOpen<low.eyeOpen);assert.ok(high.browTilt>low.browTilt);assert.equal(slack.browTilt,0);
 const object=anglerExpressionTarget({pending:{...pending,catch:{id:'bottle'},fight:{status:'active',tension:1,load:1}},phase:'hooked'},5100);assert.equal(object.mood,'observing');
});
test('success, objects and choices have truthful different moods',()=>{
 const success=anglerExpressionTarget({pending,revealing:true},6000),special=anglerExpressionTarget({pending,revealing:true,outcomeEvent:{kind:'special',at:5900}},6000);
 assert.equal(success.mood,'pleased');assert.ok(special.smile>success.smile);
 assert.equal(anglerExpressionTarget({pending:{...pending,catch:{id:'bottle'}},revealing:true},6000).mood,'curious');
 assert.equal(anglerExpressionTarget({catchProcessEvent:{action:'release'}}).mood,'gentle');assert.equal(anglerExpressionTarget({catchProcessEvent:{action:'study'}}).mood,'studying');
 assert.equal(anglerExpressionTarget({catchProcessEvent:{action:'release',object:true},outcomeEvent:{kind:'line-break',at:0}},0).mood,'curious');
});
test('line loss shocks briefly, becomes regret, recovers and cannot leak into a new cast',()=>{
 const context={outcomeEvent:{kind:'line-break',at:1000}};
 assert.equal(anglerExpressionTarget(context,1100).mood,'startled');assert.equal(anglerExpressionTarget(context,1500).mood,'regret');
 assert.ok(anglerExpressionTarget(context,3000).smile>anglerExpressionTarget(context,1500).smile);assert.equal(anglerExpressionTarget(context,3200).mood,'relaxed');
 assert.equal(anglerExpressionTarget({...context,pending:{start:1100}},1100).mood,'relaxed');
 for(const event of [{kind:'line-break',at:NaN},{kind:'line-break'},{kind:'empty',at:1000}])assert.equal(anglerExpressionTarget({outcomeEvent:event},1100).mood,'relaxed');
});
test('animation eases expression changes, blinks only in calm moods and respects reduced motion',()=>{
 const driver=createAnglerExpression(),cue=driver.update({outcomeEvent:{kind:'line-break',at:1000}},1100,.016);
 assert.ok(cue.eyeOpen>1&&cue.eyeOpen<1.38);assert.ok(cue.mouthOpen>0&&cue.mouthOpen<1);
 assert.ok(createAnglerExpression().update({},4400,.016).eyeOpen<.1);assert.equal(createAnglerExpression().update({},4400,.016,true).eyeOpen,1);
 assert.ok(createAnglerExpression().update({pending,phase:'hooked'},4400,.016).eyeOpen>.9);
 for(const dt of [NaN,Infinity,-100,0,.016,100])for(const now of [NaN,Infinity,-10,0,5100]){
  const v=driver.update({pending:{...pending,fight:{status:'active',tension:Infinity,load:NaN,slack:-2}}},now,dt);
  assert.ok(Object.entries(v).filter(([k])=>k!=='mood').every(([,n])=>Number.isFinite(n)));
 }
});
