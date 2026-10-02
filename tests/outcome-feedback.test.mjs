import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {outcomeKind,createOutcomeDirector,outcomeCameraCue,outcomeShowcaseReady,outcomeAudioScore,playOutcomeScore} from '../src/outcome-feedback.mjs';
import {REAL_AUDIO} from '../src/data/audio-assets.mjs';
import {FISH} from '../src/data/catalog.mjs';

test('identity feedback starts on visible landing before the dialog, with result restore excluded',()=>{
 const p={phase:'cast',catch:{id:'carp'}};
 assert.equal(outcomeShowcaseReady(p,true,1.05,.55),true);
 for(const [pending,revealing,age,height]of [[p,false,2,1],[p,true,1.04,1],[p,true,2,.54],[{...p,phase:'result'},true,2,1],[{...p,catch:null},true,2,1],[p,true,NaN,1],[p,true,2,NaN]])assert.equal(outcomeShowcaseReady(pending,revealing,age,height),false);
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 assert.match(source,/onOutcomeShowcase:\(\)=>presentOutcome\('reveal'\)/);
 const scene=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
 assert.match(scene,/outcomeShowcaseReady\(p,state.revealing,reelAge,catchEndpoint.y\)/);
 const played=[],state={pending:{start:1,phase:'cast',catch:{id:'carp'}},log:[]};
 const context=vm.createContext({state,FISH,Date,document:{hidden:false},outcomeDirector:createOutcomeDirector(),outcomeEvent:null,fightLoss:null,sound:(kind,event)=>played.push(event)});
 vm.runInContext(source.slice(source.indexOf('function presentOutcome('),source.indexOf("let tab='basket'")),context);
 context.presentOutcome('arrival');context.presentOutcome('reveal');
 assert.equal(played.length,2);assert.equal(played[1].kind,'first');
 state.log=[state.pending.catch];state.pending.phase='result';context.presentOutcome('reveal','首次记录');
 assert.equal(played.length,2,'opening the dialog cannot replay the earlier visible showcase');
 assert.ok(outcomeAudioScore('first','reveal').sounds.every(c=>c.gain>=.06),'identity melody must be audible rather than a tiny decorative tone');
 assert.ok(Math.abs(outcomeCameraCue({kind:'special',stage:'reveal'},.6).fov)>=3.5,'special shot needs a readable framing change');
});

test('outcomes prioritize objects, reunion and special identity before first/record',()=>{
 assert.equal(outcomeKind({caught:{id:'bottle',tagId:'x'},fish:{special:true},label:'首次记录'}),'discovery');
 assert.equal(outcomeKind({caught:{id:'carp',tagId:'x'},fish:{special:true},label:'重量纪录'}),'reunion');
 assert.equal(outcomeKind({caught:{id:'oldgold'},fish:{special:true},label:'首次记录'}),'special');
 for(const [label,kind]of [['首次记录','first'],['重量纪录','record'],['重复记录','catch']])assert.equal(outcomeKind({caught:{id:'carp'},label}),kind);
 for(const [detail,kind]of [[{lossReason:'line-break'},'line-break'],[{lossReason:'escaped'},'escaped'],[{lossReason:'exhausted'},'escaped'],[{reaction:'鱼松口离开了'},'missed'],[{},'empty']])assert.equal(outcomeKind(detail),kind);
 const caught={id:'carp',weight:.8},before=structuredClone(caught);outcomeKind({caught});assert.deepEqual(caught,before);
});

test('one cast emits arrival/reveal once, restoration is consumed and next cast resets',()=>{
 const d=createOutcomeDirector(),cast={start:10},detail={caught:{id:'carp'}};
 assert.equal(d.emit(cast,'arrival',detail,100).at,100);
 assert.equal(d.emit(cast,'arrival',detail,120),null);
 assert.equal(d.emit(cast,'reveal',detail,200).stage,'reveal');
 assert.equal(d.emit(cast,'reveal',detail,300),null);
 assert.equal(d.emit(null,'arrival'),null);assert.equal(d.emit(cast,'other'),null);
 assert.equal(d.emit({start:11},'arrival',{},NaN).at,0);
});

test('camera emotion is bounded, continuous and does not compete with line-break whip',()=>{
 const signatures=new Set();
 for(const kind of ['catch','first','record','special','reunion','discovery','empty','missed','escaped','line-break']){
  const event={kind,stage:'reveal'};let prior=null,maxWeight=0,signature='';
  for(let age=0;age<3;age+=.01){
   const cue=outcomeCameraCue(event,age);
   assert.ok(Object.values(cue).every(Number.isFinite));
   assert.ok(Math.abs(cue.push)<=.61&&Math.abs(cue.side)<=.51&&Math.abs(cue.lift)<=.19&&Math.abs(cue.fov)<=4.51);
   if(prior)assert.ok(Math.abs(prior.fov-cue.fov)<.21,'no abrupt FOV jump');
   if(cue.weight>maxWeight){maxWeight=cue.weight;signature=JSON.stringify(cue)}prior=cue;
  }
  signatures.add(signature);
  assert.equal(outcomeCameraCue(event,0).weight,0);assert.equal(outcomeCameraCue(event,3).weight,0);
  assert.equal(outcomeCameraCue(event,-1).weight,0);assert.equal(outcomeCameraCue(event,NaN).weight,0);
  assert.equal(outcomeCameraCue(event,.8,true).weight,0);
 }
 assert.equal(signatures.size,10);
 for(const age of [0,.07,.2,.39,.4])assert.equal(outcomeCameraCue({kind:'line-break'},age).weight,0);
});

test('audio palettes use existing resources, limited nodes and distinct melodies/impacts',()=>{
 const signatures=new Set();
 for(const kind of ['catch','first','record','special','reunion','discovery','empty','missed','escaped','line-break']){
  const stages=['arrival','reveal'].map(stage=>outcomeAudioScore(kind,stage));
  signatures.add(JSON.stringify(stages));
  for(const score of stages){
   assert.ok(score.duck>=.4&&score.duck<=1&&score.duration<=1);
   assert.ok(score.sounds.length<=4);
   for(const cue of score.sounds){
    assert.ok(cue.delay>=0&&cue.delay<1&&cue.gain>0&&cue.gain<=.5);
    if(cue.type==='real')assert.ok(existsSync(new URL('../public/'+REAL_AUDIO[cue.id].slice(2),import.meta.url)));
   }
  }
 }
 assert.equal(signatures.size,10);
 assert.equal(outcomeAudioScore('discovery','reveal').sounds.filter(c=>c.type==='note').length,2);
 assert.equal(outcomeAudioScore('line-break').sounds[0].delay,0);
 assert.equal(outcomeAudioScore('empty','reveal').sounds.length,0);
});

test('score execution routes real sounds, notes and sweeps through the existing audio voices',()=>{
 const played=[],voices={realSound:(id,options)=>played.push({type:'real',id,options}),chimeNote:options=>played.push({type:'note',options}),toneSweep:options=>played.push({type:'sweep',options}),duck:(level,duration)=>played.push({type:'duck',level,duration})};
 playOutcomeScore(outcomeAudioScore('line-break'),voices);
 assert.equal(played[0].type,'duck');assert.equal(played[0].level,.40);
 assert.equal(played[1].id,'uiClickSoft');assert.equal(played[3].options.type,'triangle');
 played.length=0;playOutcomeScore(outcomeAudioScore('reunion','reveal'),voices);
 assert.equal(played.filter(c=>c.type==='note').length,4);
});

test('landing has an immediate success voice and break whoosh starts beyond its silent lead-in',()=>{
 for(const kind of ['catch','first','record','special','reunion']){
  const score=outcomeAudioScore(kind,'arrival');
  assert.ok(score.sounds.some(c=>c.type==='real'&&c.delay===0));
  assert.ok(score.sounds.some(c=>c.type==='note'&&c.freq>=440&&c.delay<=.05),'success is readable before the showcase');
 }
 const whoosh=outcomeAudioScore('line-break').sounds.find(c=>c.id==='whooshShort');
 assert.ok(whoosh.offset>=.20&&whoosh.offset<=.22&&whoosh.duration>=.13,'measured source onset is at 0.2016 seconds');
 assert.equal(outcomeAudioScore('line-break').sounds[0].delay,0);
});

test('application consumes quiet restores and repeats without a second outcome cue',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8'),played=[];
 const state={pending:{start:1,catch:{id:'bottle'}},log:[]};
 const context=vm.createContext({state,FISH,Date,document:{hidden:false},outcomeDirector:createOutcomeDirector(),outcomeEvent:null,fightLoss:null,sound:(kind,event)=>played.push({kind,event})});
 vm.runInContext(source.slice(source.indexOf('function presentOutcome('),source.indexOf("let tab='basket'")),context);
 context.presentOutcome('arrival');context.presentOutcome('arrival');assert.equal(played.length,1);assert.equal(played[0].event.kind,'discovery');
 context.presentOutcome('reveal','',false);context.presentOutcome('reveal');assert.equal(played.length,1);
 state.pending={start:2,catch:null};context.fightLoss={castStart:2,reason:'line-break'};
 context.presentOutcome('arrival');assert.equal(played.at(-1).event.kind,'line-break');
 state.pending={start:3,catch:{id:'carp'}};context.document.hidden=true;context.presentOutcome('arrival');context.document.hidden=false;context.presentOutcome('arrival');assert.equal(played.length,2);
});
