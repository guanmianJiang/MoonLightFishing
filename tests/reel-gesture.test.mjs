import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFight} from '../src/reference-loop.mjs';
import {startReelGesture,moveReelGesture,verticalLiftProgress,controlOrigin,joystickVisual,joystickReleaseFrames,gestureRodInput} from '../src/reel-gesture.mjs';

test('video-style droplet follows every direction independently of pump timing',()=>{
 const bounds={left:0,right:390,top:0,bottom:844},start=[300,690,300,690];
 const visual=(x,y)=>joystickVisual(start[0],start[1],x,y,start[2],start[3],bounds,bounds);
 assert.equal(visual(300,684).active,false,'small thumb motion leaves the rooted pearl');
 const up=visual(300,620),down=visual(300,760),left=visual(230,690),right=visual(370,690),diagonal=visual(260,640);
 for(const pose of [up,down,left,right,diagonal])assert.equal(pose.active,true);
 assert.equal(up.angle,90);assert.equal(down.angle,-90);assert.equal(Math.abs(left.angle),180);assert.ok(right.angle===0);
 assert.ok(diagonal.angle>90&&diagonal.angle<180);
 assert.ok(up.scale>1&&left.scale>1);
 const f=createFight({weight:2});
 assert.equal(moveReelGesture(startReelGesture(1,690,300),f,620,300).action,'none','pump is still gated during hookset');
 assert.ok(up.scale>1.5,'visual remains full length during hookset');
});

test('droplet is clamped to both axes of the visible game rectangle',()=>{
 const game={left:0,right:390,top:0,bottom:844};
 const viewport={left:0,right:360,top:0,bottom:760};
 const right=joystickVisual(300,690,400,690,300,690,game,viewport);
 const down=joystickVisual(300,690,300,790,300,690,game,viewport);
 assert.equal(right.scale,1+((360-8-300)-44)/21);
 assert.equal(down.scale,1+((760-8-690)-44)/21);
 assert.equal(joystickVisual(300,690,400,690,350,690,game,viewport).active,false);
 assert.equal(joystickVisual(300,690,Number.NaN,690,300,690,game,viewport).active,false);
});

test('demo sensitivity drives a short soft tail and caps input at triple width',()=>{
 const bounds={left:0,right:600,top:0,bottom:900};
 const visual=distance=>joystickVisual(300,450,300,450-distance,300,450,bounds,bounds);
 assert.equal(visual(10).scale,1);
 assert.ok(Math.abs(visual(11).scale-(1+11/75))<1e-9);
 assert.equal(visual(75).scale,2);
 assert.equal(visual(150).scale,3);
 assert.equal(visual(300).scale,3);
 assert.equal(44+21*(visual(300).scale-1),86,'the directional line stays inside the visible edge');
 assert.deepEqual(joystickReleaseFrames(3),[{scale:3,offset:0},{scale:1+(1-3)*.307,offset:.57},{scale:1,offset:1}]);
 assert.deepEqual(joystickReleaseFrames(Number.NaN),[{scale:1,offset:0},{scale:1,offset:.57},{scale:1,offset:1}]);
});

test('gesture changes rod intention on both axes and load resists upward lift',()=>{
 assert.deepEqual(gestureRodInput(100,100,100,100),{side:0,lift:0,lower:0,force:0});
 const up=gestureRodInput(100,100,100,10,.8),down=gestureRodInput(100,100,100,190),side=gestureRodInput(100,100,190,100),diagonal=gestureRodInput(100,100,190,10);
 assert.ok(up.lift>0&&up.lift<1);assert.equal(up.lower,0);
 assert.equal(down.lower,1);assert.equal(down.lift,0);
 assert.equal(side.side,1);assert.equal(side.lift,0);
 assert.equal(diagonal.side,1);assert.equal(diagonal.lift,1);
 assert.deepEqual(gestureRodInput(100,100,Number.NaN,10),{side:0,lift:0,lower:0,force:0});
});

test('pull feedback follows only an upward stroke inside the narrow lane',()=>{
 assert.equal(verticalLiftProgress(100,500,100,479),.5);
 assert.equal(verticalLiftProgress(100,500,100,455,90),.5,'visual drag can keep extending after the action threshold');
 assert.equal(verticalLiftProgress(100,500,130,458),1);
 assert.equal(verticalLiftProgress(100,500,131,450),0);
 assert.equal(verticalLiftProgress(100,500,100,520),0);
 assert.equal(verticalLiftProgress(100,500,Number.NaN,450),0);
 assert.equal(verticalLiftProgress(100,500,100,450,0),0);
});

test('downward pressure pays line out and returning to center resumes reeling',()=>{
 const f=createFight({weight:2});f.fishState='recover';f.slack=.1;
 let gesture=startReelGesture(9,500,100);
 let result=moveReelGesture(gesture,f,523,100);
 assert.equal(result.action,'none','a small thumb wobble stays in the reel state');
 assert.equal(result.gesture.currentY,523,'the visual and rod pose receive the latest pointer position');
 result=moveReelGesture(result.gesture,f,525,100);
 assert.equal(result.action,'payout');assert.equal(result.gesture.paying,true);
 result=moveReelGesture(result.gesture,f,550,100);
 assert.equal(result.action,'none','holding down does not repeatedly fire payout');
 result=moveReelGesture(result.gesture,f,509,100);
 assert.equal(result.action,'reel');assert.equal(result.gesture.paying,false);
 result=moveReelGesture(result.gesture,f,454,100);
 assert.equal(result.action,'lift','the same pointer can lift after paying out');
 result=moveReelGesture(result.gesture,f,532,100);
 assert.equal(result.action,'payout','a pull can cross center directly into payout');
 assert.equal(result.gesture.lifted,false);
});

test('horizontal drags change pose without firing line actions',()=>{
 const gesture=startReelGesture(3,500,100),f=createFight({weight:1});
 const result=moveReelGesture(gesture,f,540,131);
 assert.equal(result.action,'none');assert.equal(result.gesture.progress,0);
 assert.ok(gestureRodInput(100,500,131,540).side>0);
});

test('the membrane pivots at the button center regardless of touch point',()=>{
 const rect={left:200,top:400,width:108,height:108};
 assert.deepEqual(controlOrigin(rect),{x:54,y:54});
 assert.deepEqual(controlOrigin({width:90,height:110}),{x:45,y:55});
 assert.deepEqual(controlOrigin({width:Number.NaN,height:0}),{x:54,y:54});
});

test('one gesture holds, lifts once, returns to reeling and can lift again',()=>{
 const f=createFight({weight:2});f.fishState='recover';f.slack=.1;
 let gesture=startReelGesture(7,500);
 let result=moveReelGesture(gesture,f,470);
 assert.equal(result.action,'none');assert.ok(result.gesture.progress>.6);
 result=moveReelGesture(result.gesture,f,450);
 assert.equal(result.action,'lift');assert.equal(result.gesture.lifted,true);
 result=moveReelGesture(result.gesture,f,420);
 assert.equal(result.action,'none','holding the finger high cannot repeat the lift');
 assert.ok(joystickVisual(0,500,0,420,100,500,{left:0,right:390,top:0,bottom:844},{left:0,right:390,top:0,bottom:844}).scale>1,'the waterdrop keeps growing after the lift action fires');
 result=moveReelGesture(result.gesture,f,490);
 assert.equal(result.action,'reel');assert.equal(result.gesture.lifted,false);
 gesture=result.gesture;
 result=moveReelGesture(gesture,f,440);
 assert.equal(result.action,'lift','a new upward stroke may lift again when physics allows');
});

test('invalid timing and invalid coordinates keep the reel hold',()=>{
 const f=createFight({weight:2});
 const gesture=startReelGesture(4,500,100);
 assert.equal(moveReelGesture(gesture,f,430).action,'none','hookset cannot lift');
 f.fishState='run';assert.equal(moveReelGesture(gesture,f,430).action,'none','a run cannot lift');
 f.fishState='recover';f.slack=.8;assert.equal(moveReelGesture(gesture,f,430).action,'none','slack line cannot lift');
 f.slack=.1;
 assert.equal(moveReelGesture(gesture,f,450,140).action,'none','diagonal motion cannot lift');
 assert.equal(moveReelGesture(gesture,f,450,140).gesture.progress,0);
 assert.equal(moveReelGesture(gesture,f,450,130).action,'lift','edge of the lane still permits a vertical lift');
 assert.equal(moveReelGesture(gesture,f,Number.NaN).action,'none');
 assert.equal(startReelGesture(4,Number.NaN),null);
 assert.equal(startReelGesture(4,500,Number.NaN),null);
 assert.equal(moveReelGesture(null,f,430).action,'none');
});

test('fight UI presents the gesture on one touch control',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 const actions=html.split('<div id="fightControl" class="fight-actions"')[1]?.split('</div>')[0]||'';
 assert.match(actions,/id="fightHold"/);
 assert.match(actions,/data-surface="elastic"/);
 assert.match(actions,/data-reel="face"/);
 assert.match(actions,/data-reel="edge"/);
 assert.match(actions,/reel-surface-hook/);
 assert.doesNotMatch(actions,/fightLever|fightTensionArc|fight-motion-guide/);
 assert.doesNotMatch(actions,/<canvas|fight-membrane/);
 assert.doesNotMatch(actions,/fight-gesture-guide|按住 <b>收线<\/b>/);
 assert.doesNotMatch(actions,/fight-pull-track|fight-stick-track|fight-drag-head|fightCueArrow/);
 assert.match(actions,/按住提竿/);
 assert.match(actions,/继续收线/);
 assert.doesNotMatch(actions,/fightPump/);
});
