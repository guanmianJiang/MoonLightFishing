import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createAudioSystem} from '../src/audio-system.mjs';

test('application bootstrap does not start a gesture-gated audio request',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 const start=source.lastIndexOf('renderSetup();update();save();'),end=source.indexOf('if(document.modelContext?.registerTool)',start);let audioStarts=0;
 assert.ok(start>=0&&end>start);
 const context=vm.createContext({renderSetup(){},update(){},save(){},ensureAudio(){audioStarts++;return new Promise(()=>{})},setInterval(){},state:{pending:null,trip:{castsLeft:4}},document:{addEventListener(){}},world:null});
 vm.runInContext(source.slice(start,end),context);
 assert.equal(audioStarts,0,'autoplay must not leave a blocked resume promise before the first touch');
});

function harness(t,file=false){
 const keys=['window','document','localStorage','location','Audio','fetch','setTimeout'],prior=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 t.after(()=>{for(const key of keys){if(prior[key]===undefined)delete globalThis[key];else globalThis[key]=prior[key]}});
 const nodes=[],media=[],timers=[],contexts=[],listeners=new Map(),storage=new Map(),fail={};
 const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v}});
 const node=type=>{const n={kind:type,type,connect(){},frequency:param(),gain:param(),pan:param(),Q:param(),playbackRate:param(),starts:[],stops:[],start(...args){this.starts.push(args)},stop(...args){this.stops.push(args)}};nodes.push(n);return n};
 class AudioContext{
  sampleRate=100;currentTime=0;state='suspended';destination={};resumeCalls=0;
  constructor(){contexts.push(this)}
  resume(){this.resumeCalls++;if(fail.blockFirstResume&&this.resumeCalls===1)return new Promise(()=>{});this.state='running';return Promise.resolve()}suspend(){this.state='suspended';return Promise.resolve()}
  close(){this.state='closed';return Promise.resolve()}
  createGain(){return node('gain')}createOscillator(){return node('oscillator')}createBufferSource(){return node('source')}
  createBiquadFilter(){return node('filter')}createStereoPanner(){return node('panner')}createConvolver(){if(fail.reverb)throw Error('reverb unavailable');return node('reverb')}
  createMediaElementSource(){if(fail.ambience)throw Error('media source unavailable');return node('media')}
  createDynamicsCompressor(){if(fail.output)throw Error('output failed');return {connect(){},...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,param()]))}}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)}}
  decodeAudioData(){return Promise.resolve({duration:9})}
 }
 class Media{
  paused=true;duration=9;plays=0;pauses=0;
  constructor(url){this.url=url;media.push(this)}play(){this.paused=false;this.plays++;return Promise.resolve()}
  pause(){this.paused=true;this.pauses++}cloneNode(){return new Media(this.url)}
 }
 globalThis.window={AudioContext};globalThis.document={hidden:false,addEventListener:(type,fn)=>listeners.set(type,fn)};
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};globalThis.location={protocol:file?'file:':'http:'};globalThis.Audio=Media;
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
 globalThis.setTimeout=(fn)=>{timers.push(fn);return timers.length};
 const button={setAttribute(){},textContent:''},system=createAudioSystem({button});
 return {system,nodes,media,timers,listeners,contexts,storage,button,fail};
}

test('actual audio system schedules one score and cancels every voice on mute/background',async t=>{
 const h=harness(t);await h.system.ensureAudio(true);await new Promise(resolve=>setImmediate(resolve));
 const start=h.nodes.length;h.system.sound('outcome',{kind:'special',stage:'reveal'});
 const voices=h.nodes.slice(start).filter(n=>n.kind==='oscillator'||n.kind==='source');
 assert.equal(voices.length,12,'four notes with three harmonics each');
 assert.ok(voices.every(n=>n.starts.length===1&&n.starts[0][0]>=.06));
 await h.system.toggle();assert.ok(voices.every(n=>n.stops.some(args=>args.length===0)),'muting cancels scheduled notes, not just the audio clock');
 const mutedCount=h.nodes.length;h.system.sound('outcome',{kind:'catch',stage:'reveal'});assert.equal(h.nodes.length,mutedCount);
 await h.system.ensureAudio(true);const next=h.nodes.length;h.system.sound('outcome',{kind:'line-break',stage:'arrival'});
 const broken=h.nodes.slice(next).filter(n=>n.kind==='oscillator'||n.kind==='source');assert.equal(broken.length,3);
 assert.equal(broken[0].starts[0][0],0,'the break impact starts at the event time');
 document.hidden=true;h.listeners.get('visibilitychange')();assert.ok(broken.every(n=>n.stops.some(args=>args.length===0)));
 const backgroundCount=h.nodes.length;h.system.sound('outcome',{kind:'special',stage:'reveal'});assert.equal(h.nodes.length,backgroundCount);
});

test('a gesture retries resume even if an earlier autoplay request never resolves',async t=>{
 const h=harness(t);h.fail.blockFirstResume=true;
 void h.system.ensureAudio();const ctx=h.contexts[0];
 assert.equal(ctx.state,'suspended');assert.equal(ctx.resumeCalls,1);
 const enabled=h.system.toggle();
 assert.equal(ctx.resumeCalls,2,'the click must call resume in the new gesture instead of awaiting the autoplay promise');
 assert.equal(await enabled,true);assert.equal(h.system.getStatus().ready,true);assert.equal(h.button.textContent,'声 · 开');
 await h.system.toggle();assert.equal(h.button.textContent,'声 · 关');
 assert.equal(await h.system.toggle(),true);assert.equal(h.button.textContent,'声 · 开');
});

test('an interrupted context clears old voices and the next gesture restores actual playback',async t=>{
 const h=harness(t);await h.system.ensureAudio(true);h.system.sound('outcome',{kind:'first',stage:'reveal'});
 const voices=h.nodes.filter(n=>n.kind==='oscillator'&&n.starts.length&&n.frequency.value>1),ctx=h.contexts[0];
 ctx.state='interrupted';ctx.onstatechange();
 assert.equal(h.system.wantsGesture(),true);assert.equal(h.system.getStatus().ready,false);assert.equal(h.button.textContent,'声 · 待开启');
 assert.ok(voices.every(n=>n.stops.some(args=>args.length===0)));
 await h.system.ensureAudio();assert.equal(h.system.getStatus().ready,true);assert.equal(h.button.textContent,'声 · 开');
 const count=h.nodes.length;assert.equal(h.system.sound('outcome',{kind:'catch',stage:'arrival'}),true);
 assert.ok(h.nodes.length>count,'new outcome can play after recovery');
 await h.system.toggle();assert.equal(h.system.wantsGesture(),false);assert.equal(await h.system.ensureAudio(),false);
});

test('output initialization retries from a new context and optional ambience never blocks a result',async t=>{
 const h=harness(t);h.fail.output=true;
 assert.equal(await h.system.ensureAudio(),false);assert.equal(h.contexts[0].state,'closed');assert.equal(h.system.getStatus().ready,false);
 h.fail.output=false;h.fail.reverb=h.fail.ambience=true;
 assert.equal(await h.system.ensureAudio(),true);assert.equal(h.contexts.length,2);
 assert.equal(h.system.sound('outcome',{kind:'first',stage:'reveal'}),true);
 assert.ok(h.nodes.filter(n=>n.kind==='oscillator'&&n.starts.length).length>=9);
});

test('resume failure cannot show sound on, and enabling confirms audibly without downloaded files',async t=>{
 const h=harness(t,true);await h.system.ensureAudio(true);const ctx=h.contexts[0];ctx.state='interrupted';ctx.onstatechange();
 ctx.resume=()=>Promise.reject(Error('gesture required'));
 assert.equal(await h.system.ensureAudio(),false);assert.equal(h.system.getStatus().ready,false);assert.match(h.system.getStatus().lastError,/gesture/);
 assert.equal(h.button.textContent,'声 · 待开启');
 ctx.resume=()=>{ctx.state='running';return Promise.resolve()};
 const start=h.nodes.length;assert.equal(await h.system.toggle(),true);
 assert.equal(h.nodes.slice(start).filter(n=>n.kind==='oscillator'&&n.starts.length).length,6,'two confirmation notes are synthesized');
 assert.equal(h.system.getStatus().decodedAssets,0);
});

test('asset errors are observable while synthesized outcome voices still reach the output graph',async t=>{
 const h=harness(t),priorWarn=console.warn;let warnings=0;
 console.warn=()=>{warnings++};t.after(()=>{console.warn=priorWarn});globalThis.fetch=async()=>({ok:false,status:404});
 await h.system.ensureAudio(true);await new Promise(r=>setImmediate(r));
 assert.ok(warnings>0);assert.match(h.system.getStatus().lastError,/404/);assert.equal(h.system.getStatus().decodedAssets,0);
 const start=h.nodes.length;assert.equal(h.system.sound('outcome',{kind:'first',stage:'reveal'}),true);
 assert.equal(h.nodes.slice(start).filter(n=>n.kind==='oscillator'&&n.starts.length).length,9);
});

test('the current gesture outcome waits briefly for resume, but expired outcomes are discarded',async t=>{
 const h=harness(t);await h.system.ensureAudio(true);const ctx=h.contexts[0];
 const priorNow=Date.now;let now=1000;Date.now=()=>now;t.after(()=>{Date.now=priorNow});
 const deferred=()=>{ctx.state='interrupted';ctx.onstatechange();let resume;ctx.resume=()=>new Promise(r=>{resume=()=>{ctx.state='running';r()}});return ()=>resume()};
 let finish=deferred(),attempt=h.system.ensureAudio(),start=h.nodes.length;
 assert.equal(h.system.sound('outcome',{kind:'first',stage:'reveal'}),true);finish();await attempt;await new Promise(r=>setImmediate(r));
 assert.equal(h.nodes.slice(start).filter(n=>n.kind==='oscillator'&&n.starts.length).length,9);
 finish=deferred();attempt=h.system.ensureAudio();start=h.nodes.length;h.system.sound('outcome',{kind:'first',stage:'reveal'});now+=251;finish();await attempt;await new Promise(r=>setImmediate(r));
 assert.equal(h.nodes.length,start,'old result does not play after slow recovery');
});

test('a background transition discards pending result audio even when resume finishes afterwards',async t=>{
 const h=harness(t);await h.system.ensureAudio(true);const ctx=h.contexts[0];ctx.state='interrupted';ctx.onstatechange();let finish;
 ctx.resume=()=>new Promise(r=>{finish=()=>{ctx.state='running';r()}});
 const attempt=h.system.ensureAudio(),start=h.nodes.length;h.system.sound('outcome',{kind:'first',stage:'reveal'});
 document.hidden=true;h.listeners.get('visibilitychange')();finish();assert.equal(await attempt,false);await new Promise(r=>setImmediate(r));
 assert.equal(h.nodes.length,start);assert.equal(h.system.getStatus().ready,false);
});

test('explicit mute wins over an in-flight resume and cannot replay a queued result',async t=>{
 const h=harness(t);await h.system.ensureAudio(true);const ctx=h.contexts[0];
 // The platform has suspended audio but has not dispatched statechange yet.
 ctx.state='suspended';let finish;ctx.resume=()=>new Promise(r=>{finish=()=>{ctx.state='running';r()}});
 const attempt=h.system.ensureAudio(),start=h.nodes.length;h.system.sound('outcome',{kind:'first',stage:'reveal'});
 await h.system.toggle();finish();assert.equal(await attempt,false);await new Promise(r=>setImmediate(r));
 assert.equal(h.nodes.length,start);assert.equal(h.system.getStatus().enabled,false);assert.equal(h.system.wantsGesture(),false);
});

test('HTML audio fallback discards delayed outcome clips after mute and resume',async t=>{
 const h=harness(t,true);await h.system.ensureAudio(true);
 h.system.sound('outcome',{kind:'line-break',stage:'arrival'});
 const immediate=h.media.filter(m=>m.plays>0&&!m.loop);assert.equal(immediate.length,1);
 await h.system.toggle();assert.ok(immediate.every(m=>m.pauses>0));
 await h.system.ensureAudio(true);for(const fn of h.timers)fn();
 assert.equal(h.media.filter(m=>m.plays>0&&!m.loop).length,1,'the delayed whoosh must not start after unmuting');
});
