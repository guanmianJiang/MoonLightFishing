import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaterFlow,interactionDriveFromSpeed,sampleInteractionStroke} from '../dist/water-flow.js';

test('fast pointer jumps are sampled continuously and independent of event batching',()=>{
 const radius=2.2,whole=sampleInteractionStroke(.8,0,.8,0,radius);
 assert.ok(whole.samples.length>=8);
 assert.ok(whole.step<=.11+1e-9);
 assert.ok(Math.abs(whole.samples.at(-1).x-.8)<1e-9);
 const fast=createWaterFlow(112),split=createWaterFlow(112),drive=interactionDriveFromSpeed(8);
 const deposit=(flow,stroke)=>{
  for(const point of stroke.samples)flow.inject(point.x/radius,point.z/radius,
   stroke.dirX,stroke.dirZ,stroke.step/5,drive);
 };
 deposit(fast,whole);
 for(let i=1;i<=8;i++)deposit(split,sampleInteractionStroke(i*.1,0,.1,0,radius));
 const a=fast.writePixels(),b=split.writePixels();
 let maxDifference=0;
 for(let i=0;i<a.length;i+=4)maxDifference=Math.max(maxDifference,Math.abs(a[i]-b[i]));
 assert.ok(maxDifference<1e-5,{maxDifference});
});

test('a fast stroke crosses field boundaries at sampled positions',()=>{
 const radius=2.2,{samples,step}=sampleInteractionStroke(2,0,2,0,radius);
 let center=0,crossings=0,previous=0;
 for(const point of samples){
  assert.ok(point.x-previous<=step+1e-9);
  if(Math.abs(point.x-center)>radius*.48){center=point.x;crossings++;}
  previous=point.x;
 }
 assert.ok(crossings>=1);
 assert.ok(Math.abs(previous-2)<1e-9);
});

function outerEnergy(flow,innerRadius=.35){
 const {size,pixels}=flow;
 let energy=0;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const x=i/(size-1)*2-1,z=j/(size-1)*2-1;
  if(Math.hypot(x,z)>innerRadius){const h=pixels[(j*size+i)*4];energy+=h*h;}
 }
 return energy;
}

test('a local push propagates away from its source without growing unbounded',()=>{
 const flow=createWaterFlow();
 for(let i=0;i<35;i++){flow.inject(0,0,1,0,1/120);flow.step(1/120);}
 flow.writePixels();
 const early=outerEnergy(flow);
 for(let i=0;i<55;i++)flow.step(1/120);
 flow.writePixels();
 const later=outerEnergy(flow);
 assert.ok(later>early*.8,{early,later});
 assert.ok([...flow.pixels].every(Number.isFinite));
 assert.ok(Math.max(...flow.pixels.filter((_,i)=>i%4===0).map(Math.abs))<=.7);
});

test('held interaction makes a forward crest with a shallower return trough',()=>{
 const flow=createWaterFlow();
 for(let i=0;i<20;i++){flow.inject(0,0,1,0,1/120);flow.step(1/120);}
 const front=flow.sampleHeight(.21,0),back=flow.sampleHeight(-.15,0);
 const left=flow.sampleHeight(0,.15),right=flow.sampleHeight(0,-.15);
 assert.ok(front>.10,{front});
 assert.ok(back<-.02&&Math.abs(back)<front*.6,{front,back});
 assert.ok(Math.abs(left-right)<.04,{left,right});
 assert.ok(Math.abs(flow.sampleHeight(0,0))<Math.max(front,-back),{front,back});
});

test('the visible crest bends back at its sides instead of forming a mound',()=>{
 const flow=createWaterFlow();
 for(let i=0;i<20;i++){flow.inject(0,0,1,0,1/120);flow.step(1/120);}
 const peakAtSide=side=>{
  let result={x:0,height:-Infinity};
  for(let x=.02;x<=.32;x+=.01){const height=flow.sampleHeight(x,side);if(height>result.height)result={x,height};}
  return result;
 };
 const center=peakAtSide(0),wing=peakAtSide(.26);
 assert.ok(center.x-wing.x>.04,{center,wing});
 assert.ok(wing.height>center.height*.40,{center,wing});
});

test('faster dragging produces a taller crest while a stopped pointer adds no wave',()=>{
 assert.equal(interactionDriveFromSpeed(0),0);
 const slow=createWaterFlow(),fast=createWaterFlow();
 for(let i=0;i<22;i++){
  slow.inject(0,0,1,0,1/120,interactionDriveFromSpeed(1));
  fast.inject(0,0,1,0,1/120,interactionDriveFromSpeed(8));
  slow.step(1/120);fast.step(1/120);
 }
 const crestHeight=flow=>Math.max(...[.12,.16,.20,.24,.28,.32].map(x=>flow.sampleHeight(x,0)));
 const slowHeight=crestHeight(slow),fastHeight=crestHeight(fast);
 assert.ok(fastHeight>slowHeight*2,{slowHeight,fastHeight});
 const renderedPeak=Math.max(...fast.writePixels().filter((_,i)=>i%4===0));
 assert.ok(renderedPeak<.55,{renderedPeak});
});

test('a short slow push leaves a visible crest that continues outward',()=>{
 const flow=createWaterFlow(112),drive=interactionDriveFromSpeed(.25);
 for(let i=0;i<10;i++){
  flow.inject(i*.01,0,1,0,.01/5,drive);
  flow.step(1/60);
 }
 const crest=()=>{
  let peak={x:0,height:-Infinity};
  for(let x=.05;x<.8;x+=.01){
   const height=flow.sampleHeight(x,0);
   if(height>peak.height)peak={x,height};
  }
  return peak;
 };
 const initial=crest();
 for(let i=0;i<30;i++)flow.step(1/60);
 const later=crest();
 assert.ok(initial.height>.012,{initial});
 assert.ok(later.x>initial.x+.08,{initial,later});
 assert.ok(later.height>initial.height*.7,{initial,later});
});

test('a dragged wave keeps its raised lip ahead and its trough behind',()=>{
 const flow=createWaterFlow();
 for(let i=0;i<18;i++){
  flow.inject(-.35+i*.035,0,1,0,.035/5,interactionDriveFromSpeed(5));
  flow.step(1/60);
 }
 const pixels=flow.writePixels(),size=flow.size;
 let forwardCrest=0,reverseCrest=0,forwardTrough=0,reverseTrough=0;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const x=i/(size-1)*2-1,h=pixels[(j*size+i)*4];
  if(x>.25){forwardCrest+=Math.max(0,h)**2;forwardTrough+=Math.min(0,h)**2;}
  if(x<-.25){reverseCrest+=Math.max(0,h)**2;reverseTrough+=Math.min(0,h)**2;}
 }
 assert.ok(forwardCrest>reverseCrest*20,{forwardCrest,reverseCrest});
 assert.ok(reverseTrough>forwardTrough*20,{forwardTrough,reverseTrough});
});

test('moving the local patch preserves an existing wave in world space',()=>{
 const flow=createWaterFlow();
 for(let i=0;i<25;i++){flow.inject(0,0,1,0,1/120);flow.step(1/120);}
 const before=flow.sampleHeight(.22,.04);
 flow.shift(.10,0);
 const after=flow.sampleHeight(.12,.04);
 assert.ok(Math.abs(before-after)<.02,{before,after});
});

test('a new turning push leaves distant existing waves in place',()=>{
 const flow=createWaterFlow();
 for(let i=0;i<20;i++){flow.inject(-.35,0,1,0,1/120);flow.step(1/120);}
 const before=flow.sampleHeight(-.28,0);
 flow.inject(.35,.35,0,1,1/120);
 assert.ok(Math.abs(flow.sampleHeight(-.28,0)-before)<1e-4);
});

test('a turn changes the nearby wake without rotating the distant water',()=>{
 const straight=createWaterFlow(),turning=createWaterFlow();
 for(let i=0;i<40;i++)for(const flow of [straight,turning]){
  flow.inject(0,0,1,0,1/120);flow.step(1/120);
 }
 const difference=(minRadius,maxRadius)=>{
  const a=straight.writePixels(),b=turning.writePixels(),size=straight.size;
  let energy=0;
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
   const x=i/(size-1)*2-1,z=j/(size-1)*2-1;
   const radius=Math.hypot(x,z);
   if(radius>minRadius&&radius<maxRadius){const delta=a[(j*size+i)*4]-b[(j*size+i)*4];energy+=delta*delta;}
  }
  return energy;
 };
 for(let i=0;i<18;i++){
  straight.inject(0,0,1,0,1/120);
  turning.inject(0,0,0,1,1/120);
  straight.step(1/120);turning.step(1/120);
 }
 const earlyNear=difference(0,.45),earlyOuter=difference(.75,2);
 for(let i=0;i<80;i++){straight.step(1/120);turning.step(1/120);}
 const lateNear=difference(0,.45),lateOuter=difference(.75,2);
 assert.ok(earlyNear>earlyOuter*100,{earlyNear,earlyOuter});
 assert.ok(lateNear>lateOuter*100,{lateNear,lateOuter});
 assert.ok(lateOuter<.002,{lateOuter});
});
