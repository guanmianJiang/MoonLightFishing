import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/three.module.js';
import {FishingLine} from '../src/fishing-motion.js';
import {lostLineEnd} from '../src/angler-feedback.mjs';

test('paid-out line sags while a loaded taut line follows its endpoints',()=>{
 const a=new T.Vector3(0,2,0),b=new T.Vector3(6,.06,0),line=new FishingLine();
 const direct=a.distanceTo(b);
 for(let i=0;i<90;i++)line.update(a,b,1/60,{length:direct+.6,load:0});
 const midpoint=Math.floor(line.nodes.length/2),straight=a.y+(b.y-a.y)*midpoint/(line.nodes.length-1);
 assert.ok(line.nodes[midpoint].y<straight-.2);
 assert.equal(line.tension,0);
 const sag=straight-line.nodes[midpoint].y;
 line.update(a,b,1/60,{length:direct-.05,load:.8});
 assert.ok(straight-line.nodes[midpoint].y>0,'the line should not snap straight in one frame');
 assert.ok(straight-line.nodes[midpoint].y<sag,'load starts taking up slack immediately');
 for(let i=0;i<15;i++)line.update(a,b,1/60,{length:direct-.05,load:.8});
 assert.ok(Math.abs(line.nodes[midpoint].y-straight)<.02,'loaded line settles near straight');
 assert.equal(line.tension,.8);
 assert.ok(line.nodes[0].distanceTo(a)<1e-9);
 assert.ok(line.nodes.at(-1).distanceTo(b)<1e-9);
});

test('an empty line follows a returning float without looping behind it',()=>{
 const tip=new T.Vector3(0,2,0),float=new T.Vector3(6,.1,0),line=new FishingLine();
 for(let i=0;i<60;i++)line.update(tip,float,1/60,{slack:1.08,extra:.42});
 for(let i=0;i<18;i++){
  float.x=6-4*(i+1)/18;
  line.update(tip,float,1/60,{tight:true,extra:.07,reel:true});
 }
 assert.ok(line.reelGuide>.95);
 assert.ok(line.nodes.every((node,i)=>node.x>=-.01&&node.x<=float.x+.01&&(i===0||node.x>=line.nodes[i-1].x-.01)));
 assert.ok(line.nodes.at(-1).distanceTo(float)<1e-9);
});

test('a fish tug travels through the line without shifting either anchor',()=>{
 const tip=new T.Vector3(0,2,0),float=new T.Vector3(6,.1,0),line=new FishingLine();
 const length=tip.distanceTo(float);
 for(let i=0;i<20;i++)line.update(tip,float,1/60,{length,load:.8,impulse:0});
 line.update(tip,float,1/60,{length,load:.8,impulse:1});
 assert.ok(line.wave>0);
 assert.ok(line.nodes.some(node=>Math.abs(node.z)>.001));
 assert.ok(line.nodes[0].distanceTo(tip)<1e-9&&line.nodes.at(-1).distanceTo(float)<1e-9);
 for(let i=0;i<45;i++)line.update(tip,float,1/60,{length,load:.8,impulse:0});
 assert.ok(line.wave<.001);
 line.update(tip,float,1/60,{length:length+.8,load:0,impulse:1});
 assert.ok(line.tautness<1);
 line.update(tip,float,Number.NaN,{length,load:0,impulse:Number.NaN});
 assert.ok(line.nodes.every(node=>Number.isFinite(node.x)&&Number.isFinite(node.y)&&Number.isFinite(node.z)));
});

test('cutting a loaded line discards the detached span on the same frame',()=>{
 const tip=new T.Vector3(0,2,0),float=new T.Vector3(6,.1,0),line=new FishingLine();
 for(let i=0;i<30;i++)line.update(tip,float,1/60,{length:tip.distanceTo(float),load:.8});
 const free=lostLineEnd(0,tip,tip,float,0,'line-break');
 const freeTip=new T.Vector3(free.x,free.y,free.z);
 line.reset(tip,freeTip);
 line.update(tip,freeTip,1/60,{tight:false,slack:1.16,extra:.12,reel:true});
 assert.ok(line.nodes.at(-1).distanceTo(freeTip)<1e-9);
 assert.ok(line.nodes.every(node=>node.x<3),'no old segment may remain drawn toward the detached float');
});

test('the force packet travels from its physical source without replaying constant load',()=>{
 const a=new T.Vector3(0,2,0),b=new T.Vector3(6,.1,0),length=a.distanceTo(b);
 for(const origin of ['fish','rod']){
  const line=new FishingLine();for(let i=0;i<45;i++)line.update(a,b,1/60,{length,load:.8,impulse:0});
  line.update(a,b,1/60,{length,load:.8,impulse:1,impulseOrigin:origin});assert.equal(line.pulses.length,1);
  const center=()=>line.waveOffsets.reduce((s,p,i)=>s+i*Math.abs(p.z),0)/line.waveOffsets.reduce((s,p)=>s+Math.abs(p.z),0);
  const before=center();for(let i=0;i<4;i++)line.update(a,b,1/60,{length,load:.8,impulse:1,impulseOrigin:origin});const after=center();
  assert.ok(origin==='fish'?after<before-3:after>before+3,'packet must move along the line in the chosen direction');assert.equal(line.pulses.length,1);
  for(let i=0;i<50;i++)line.update(a,b,1/60,{length,load:.8,impulse:1});assert.equal(line.pulses.length,0);assert.ok(line.nodes.every(p=>Math.abs(p.z)<1e-5),'render pulses cannot accumulate into a snake');
 }
});

test('slack rejects transmitted pulses, finite options survive corruption and reset clears the old cast',()=>{
 const a=new T.Vector3(0,2,0),b=new T.Vector3(6,.1,0),line=new FishingLine(),length=a.distanceTo(b);
 for(let i=0;i<30;i++)line.update(a,b,1/60,{length:length+.6,load:0,impulse:1});assert.equal(line.pulses.length,0);
 for(let i=0;i<20;i++)line.update(a,b,1/60,{length,load:.8,impulse:0});line.update(a,b,1/60,{length,load:.8,impulse:1});assert.ok(line.pulses.length>0);
 line.reset(a,b);assert.equal(line.pulses.length,0);assert.equal(line.accumulator,0);assert.ok(line.waveOffsets.every(p=>p.lengthSq()===0));
 line.update(a,b,1/60,{length:NaN,slack:Infinity,extra:NaN,load:NaN,impulse:Infinity});assert.ok(Number.isFinite(line.rest)&&line.nodes.every(p=>p.toArray().every(Number.isFinite)));
});

test('line takes up slack at similar times at 30/60/120 fps',()=>{
 const a=new T.Vector3(0,2,0),b=new T.Vector3(6,.1,0),length=a.distanceTo(b),sags=[];
 for(const fps of [30,60,120]){const line=new FishingLine();for(let i=0;i<fps;i++)line.update(a,b,1/fps,{length:length+.6,load:0});for(let i=0;i<Math.round(fps*.2);i++)line.update(a,b,1/fps,{length,load:.8});const u=19/37;sags.push(Math.abs(line.nodes[19].y-(a.y+(b.y-a.y)*u)));}
 assert.ok(Math.max(...sags)-Math.min(...sags)<.02);assert.ok(Math.max(...sags)<.035);
});
