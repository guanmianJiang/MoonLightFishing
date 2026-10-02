// Isolated, temporary QA page. The normal game entry and save are untouched.
import {readFile,writeFile} from 'node:fs/promises';
const game=await readFile('src/index.html','utf8');
const script=`<output id="processProbe" hidden></output><script type="module">
import {newSave,weatherAt} from './engine.mjs';
import {GAME_RULES} from './config/game-rules.mjs';
const query=new URLSearchParams(location.search),id=query.get('fish')||'carp',s=newSave(),now=Date.now();
const caught={id,weight:id==='minnow'?.14:id==='bottle'?.3:2.8,length:id==='bottle'?18:32,variation:'普通',time:now,spot:'reed'};
s.knowledge=15;s.casts=1;s.log=[caught];s.spot='reed';s.trip.castsLeft=query.has('last')?1:4;
s.pending={start:now-5000,phase:'result',catch:caught,spot:'reed',bait:'grain',weather:weatherAt(now),readyAt:now-1000};
if(query.has('fresh'))Object.assign(s,newSave());
localStorage.setItem(GAME_RULES.saveKey,JSON.stringify(s));
const NativeContext=window.AudioContext;let analyser,context,mode='',peak=0,rmsPeak=0,notes=[],started=0,report=null;
window.AudioContext=class extends NativeContext{
 constructor(...args){super(...args);context=this}
 createDynamicsCompressor(){const n=super.createDynamicsCompressor();analyser=this.createAnalyser();analyser.fftSize=2048;n.connect(analyser);return n}
 createOscillator(){const n=super.createOscillator(),set=n.frequency.setValueAtTime.bind(n.frequency),start=n.start.bind(n);let freq=0;n.frequency.setValueAtTime=(v,t)=>{freq=v;return set(v,t)};n.start=(...args)=>{notes.push({freq:Math.round(freq),at:Date.now()});return start(...args)};return n}
};
const frames=new Float32Array(2048);
setInterval(()=>{
 const next=document.querySelector('#game')?.dataset.uiMode||'';
 if(next==='processing'&&mode!==next){peak=rmsPeak=0;notes=notes.filter(n=>n.at>Date.now()-150);started=Date.now();report=null}
 if(analyser&&next==='processing'){analyser.getFloatTimeDomainData(frames);let energy=0;for(const v of frames){peak=Math.max(peak,Math.abs(v));energy+=v*v}rmsPeak=Math.max(rmsPeak,Math.sqrt(energy/frames.length))}
 if(mode==='processing'&&next!=='processing')report={id,duration:Date.now()-started,peak,rmsPeak,notes,state:context?.state};
 mode=next;document.querySelector('#processProbe').textContent=JSON.stringify(report||{mode,peak,rmsPeak,notes,state:context?.state});
},10);
await import('./app-final.js');
</script>`;
await writeFile('src/__catch-process-preview.html',game.replace('<script type="module" src="app-final.js"></script>',script));
