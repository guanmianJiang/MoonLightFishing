import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {reelControlFeedback,reelLeverPose} from '../src/reel-control-feedback.mjs';

test('one reel shows the action available in each phase',()=>{
 assert.equal(reelControlFeedback({mode:'strike'}).caption,'按住提竿');
 assert.equal(reelControlFeedback({mode:'retrieve'}).caption,'点按收回');
 assert.equal(reelControlFeedback().caption,'按住收线');
 assert.equal(reelControlFeedback({held:true}).caption,'正在收线');
 assert.equal(reelControlFeedback({ready:true}).cue,'lift');
 assert.equal(reelControlFeedback({ready:true}).caption,'上提抬竿');
 assert.equal(reelControlFeedback({fight:{load:.9},ready:true}).cue,'release','line risk takes priority over a lift opportunity');
 assert.equal(reelControlFeedback({fight:{load:.9},paying:true}).cue,'payout');
 assert.equal(reelControlFeedback({lifted:true}).cue,'return');
});

test('tension arc follows physical load and fades with slack',()=>{
 assert.equal(reelControlFeedback({fight:{load:.5,slack:0}}).tensionDash,'38 100');
 assert.equal(reelControlFeedback({fight:{load:.9,slack:.6}}).loadState,'slack');
 assert.equal(reelControlFeedback({fight:{load:.9,slack:.6}}).tensionDash,'27 100');
 assert.equal(reelControlFeedback({fight:{load:Infinity,slack:-1,reelTurns:NaN}}).tensionDash,'0 100');
 assert.equal(reelControlFeedback({mode:'strike',fight:{load:1}}).tensionDash,'0 100');
 assert.equal(reelControlFeedback({fight:{reelTurns:2.5}}).spoolAngle,'100deg');
 assert.equal(reelControlFeedback({gesture:{dx:200,dy:-200}}).rodTilt,'16deg');
 assert.equal(reelControlFeedback({gesture:{dx:NaN,dy:Infinity}}).rodTilt,'0deg');
});

test('the lever moves with the thumb and returns to its rooted center',()=>{
 assert.deepEqual(reelLeverPose(),{x:0,y:0});
 assert.deepEqual(reelLeverPose(3,-90),{x:0,y:-42});
 assert.deepEqual(reelLeverPose(3,90),{x:0,y:42});
 assert.deepEqual(reelLeverPose(3,0),{x:42,y:0});
 assert.deepEqual(reelLeverPose(3,180),{x:-42,y:0});
 assert.deepEqual(reelLeverPose(99,0),{x:42,y:0});
 assert.deepEqual(reelLeverPose(NaN,Infinity),{x:0,y:0});
});

test('elastic control has explicit fallback paths and retains its fixed input',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/reel-surface.css',import.meta.url),'utf8');
 const control=html.split('<div id="fightControl"')[1]?.split('<button id="landFish"')[0]||'';
 assert.match(control,/data-surface="elastic"/);assert.match(control,/width:124px;height:124px/);
 for(const name of ['face','wall','inner','shadow','edge'])assert.ok(control.includes('data-reel="'+name+'" d="M'));
 assert.match(control,/assets\/ui\/fishing-hook.svg/);assert.match(control,/stop-color="#f7dfb9"/);
 assert.doesNotMatch(control,/fightLever|fightSpool|fightTensionArc|fight-motion-guide|fight-control-caption|<canvas/);
 assert.match(css,/transform:none!important;filter:none!important/);
 assert.match(css,/\[hidden\]/);
});

test('strike and object retrieval explain different inputs without advertising fight gestures',()=>{
 for(const mode of ['strike','retrieve']){
  const feedback=reelControlFeedback({mode,fight:{load:1},ready:true});
  assert.equal(feedback.showDirections,false);
  assert.equal(feedback.cue,'hold');
  assert.equal(feedback.hint,mode==='strike'?'鱼已咬稳\n按住后继续收线':'钩上挂了东西\n点一下收回');
 }
 assert.equal(reelControlFeedback().showDirections,true);
});

test('line risk and existing thumb actions explain the immediate next input',()=>{
 assert.match(reelControlFeedback({paying:true,ready:true,critical:true}).hint,/正在让线\n滑回/);
 assert.match(reelControlFeedback({lifted:true,ready:true}).hint,/拉近\n滑回/);
 assert.match(reelControlFeedback({fight:{load:.9},ready:true}).hint,/绷紧.*\n下压或松手/);
 assert.match(reelControlFeedback({ready:true}).hint,/放缓.*\n上提/);
 assert.match(reelControlFeedback({fight:{fishState:'hookset'}}).hint,/先按住收紧/);
});

test('slack cannot advertise a lift even with a stale opportunity flag',()=>{
 const feedback=reelControlFeedback({fight:{load:.9,slack:.45},ready:true,critical:true});
 assert.equal(feedback.cue,'hold');
 assert.equal(feedback.caption,'按住收线');
 assert.equal(feedback.loadState,'slack');
 assert.match(feedback.hint,/鱼线松了\n按住收紧/);
 assert.equal(reelControlFeedback({fight:{load:.9,slack:.449},ready:true}).cue,'release');
});

test('missing and nonfinite inputs produce legible two-line hints without changing physical state',()=>{
 const input={fight:{load:Infinity,slack:NaN,reelTurns:-1},ready:false};
 const before=structuredClone(input);
 for(const value of [{},input,{held:true},{ready:true},{paying:true},{lifted:true},{mode:'strike'},{mode:'retrieve'}]){
  const lines=reelControlFeedback(value).hint.split('\n');
  assert.equal(lines.length,2);
  assert.ok(lines.every(line=>line.length<=10));
 }
 assert.deepEqual(input,before);
});

test('starting the next strike clears previous result without replacing the gesture button',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 const button={parentElement:{},dataset:{}};
 const fightUI={fightHold:button,fightFeedback:{textContent:'上一竿'},fightHoldHint:{}};
 const view={update({mode}){this.mode=mode;fightUI.fightFeedback.textContent='';}};
 const context=vm.createContext({fightUI,reelSurface:view,reelConfirmUntil:1,reelCorrectionUntil:1,reelControlFeedback,fightText(node,text){node.textContent=text},fightData(){},fightClass(){},fightAttr(){}});
 vm.runInContext(source.slice(source.indexOf('function renderStrikeControl('),source.indexOf('function pumpFish(')),context);
 for(const mode of ['strike','retrieve']){
  fightUI.fightFeedback.textContent='上一竿';context.renderStrikeControl(mode);
  assert.equal(fightUI.fightHold,button);assert.equal(view.mode,mode);assert.equal(fightUI.fightFeedback.textContent,'');
  assert.equal(context.reelConfirmUntil,0);assert.equal(context.reelCorrectionUntil,0);
  assert.equal(fightUI.fightHoldHint.textContent,reelControlFeedback({mode}).hint);
 }
});
