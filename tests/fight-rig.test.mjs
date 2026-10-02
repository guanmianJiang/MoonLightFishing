import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight,pumpRod,stepFight} from '../src/reference-loop.mjs';
import {fightRigGeometry} from '../src/fight-rig.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('the animated fish and real rig belong to the same compact status heading',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 const stack=[],parents=new Map();
 for(const [,closing,tag,attrs] of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g)){
  if(closing){stack.pop();continue;}
  const id=attrs.match(/\bid="([^"]+)"/)?.[1];
  if(id)parents.set(id,stack.map(item=>item.attrs).join(' '));
  if(!/\/\s*$/.test(attrs)&&!['meta','link','img','input','br','hr'].includes(tag))stack.push({tag,attrs});
 }
 for(const id of ['fightBeat','fightRig'])assert.match(parents.get(id),/class="fight-heading"/);
 assert.match(parents.get('fightBeat'),/class="fight-summary"/);
 assert.match(parents.get('fightMode'),/class="fight-summary"/);
 assert.match(parents.get('fightPercent'),/class="fight-summary"/);
 assert.match(parents.get('fightRig'),/class="fight-summary"/,'the diagram is part of the same status card');
 assert.match(parents.get('fightMode'),/class="fight-message"/);
 for(const id of ['fightTravel','fightOutlook'])assert.match(parents.get(id),/class="fight-status-footer"/);
 assert.doesNotMatch(parents.get('fightTravel'),/id="fightRig"/,'direction text cannot float over the drawing');
 assert.match(html,/viewBox="18 16 390 130" preserveAspectRatio="xMidYMid meet"/);
 assert.doesNotMatch(html.match(/<div id="fightRig"[\s\S]*?<\/svg>/)?.[0]||'',/preserveAspectRatio="none"/);
 assert.doesNotMatch(parents.get('fightHold'),/class="fight-heading"/,'the gesture target stays separate');
});

test('the displayed rig receives live distance, slack and strain geometry without changing physics',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf(' const rig=fightRigGeometry(f)'),source.indexOf(' fightText(fightUI.fightPercent'));
 const node=()=>({dataset:{},attributes:{},style:{setProperty(){}},textContent:''});
 const fightUI=Object.fromEntries(['fightRig','fightRigRod','fightRigLine','fightRigFish','fightRigWake','fightRigLineTip','fightLineState','fightTravel'].map(id=>[id,node()]));
 const context=vm.createContext({fightUI,fightRigGeometry,beatState:'surge',fightData:(el,key,value)=>el.dataset[key]=value,fightAttr:(el,key,value)=>el.attributes[key]=value,fightText:(el,value)=>el.textContent=value});
 for(const f of [{...createFight({weight:2}),distance:3,slack:.8,load:.1,radialVelocity:-.8},{...createFight({weight:2}),distance:10,slack:0,load:.85,radialVelocity:.8},{...createFight({weight:2}),radialVelocity:0}]){
  const before=structuredClone(f);context.f=f;vm.runInContext('{'+code+'}',context);
  const expected=fightRigGeometry(f);
  assert.equal(fightUI.fightRigFish.attributes.transform,expected.fish);
  assert.equal(fightUI.fightRigLine.attributes.d,expected.line);
  assert.equal(fightUI.fightRigRod.attributes.d,expected.rod);
  assert.equal(fightUI.fightRig.dataset.line,expected.state);
  assert.match(fightUI.fightTravel.textContent,expected.movement==='in'?/拉近/:expected.movement==='out'?/外游/:/停住/);
  assert.deepEqual(f,before);
 }
});

test('the diagram follows real fish distance, line slack and rod load',()=>{
 const fight=createFight({weight:2});
 const far=fightRigGeometry(fight);
 fight.distance=3;fight.slack=.8;fight.load=.15;
 const nearAndLoose=fightRigGeometry(fight);
 assert.ok(nearAndLoose.fishX<far.fishX-100);
 assert.equal(nearAndLoose.state,'slack');
 assert.notEqual(nearAndLoose.line,far.line);
 fight.slack=0;fight.load=.85;
 const strained=fightRigGeometry(fight);
 assert.equal(strained.state,'strained');
 assert.notEqual(strained.rod,nearAndLoose.rod);
 assert.equal(fightRigGeometry({...fight,radialVelocity:-.8}).movement,'in');
 assert.equal(fightRigGeometry({...fight,radialVelocity:.8}).movement,'out');
});

test('the compact proportional viewport contains near, far, loose and lifted geometry',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 const [,bounds]=html.match(/id="fightRig"[\s\S]*?viewBox="([^"]+)"/);
 const [left,top,width,height]=bounds.split(' ').map(Number);
 const base=createFight({id:'perch',weight:2});
 for(const distance of [-10,3,base.startDistance+3.5,100])
  for(const slack of [0,1.5])for(const load of [0,.85,1.4])for(const pumpPulse of [0,1])
   for(const radialVelocity of [-.8,.8]){
    const f={...base,distance,slack,load,pumpPulse,radialVelocity,fishPosition:1,surge:1};
    const before=structuredClone(f),rig=fightRigGeometry(f);
    for(const path of [rig.rod,rig.line]){
     const values=path.match(/-?\d+(?:\.\d+)?/g).map(Number);
     for(let i=0;i<values.length;i+=2){
      assert.ok(values[i]>=left&&values[i]<=left+width,'horizontal rig coordinates fit');
      assert.ok(values[i+1]>=top&&values[i+1]<=top+height,'vertical rig coordinates fit');
     }
    }
    const [,x,y,direction]=rig.fish.match(/translate\(([^ ]+) ([^)]+)\) scale\(([^ ]+) 1\)/).map((v,i)=>i?Number(v):v);
    const fishLeft=x+(direction===1?-28:-18),fishRight=x+(direction===1?18:28);
    assert.ok(fishLeft>=left&&fishRight<=left+width,'the larger fish stays visible in either direction');
    assert.ok(y-14>=top&&y+14<=top+height);
    assert.deepEqual(f,before);
   }
});

test('a well-timed rod lift tires the fish and softens its next run',()=>{
 const ordinary=createFight({weight:2}),lifted=createFight({weight:2});
 ordinary.fishState=lifted.fishState='recover';ordinary.stateDuration=lifted.stateDuration=.1;
 assert.equal(pumpRod(lifted,false).ok,true);
 let warned=false,softened=false;
 for(let i=0;i<180;i++){
  stepFight(ordinary,false,.016);stepFight(lifted,false,.016);
  warned ||= ordinary.surgeWarning>.55;
  softened ||= ordinary.surge-lifted.surge>.035;
 }
 assert.ok(warned);
 assert.ok(softened);
 assert.ok(lifted.fatigue>0);
});
