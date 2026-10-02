// Local diagnostic page only. Production entry and audio module remain the source.
import {readFile,writeFile} from 'node:fs/promises';
await writeFile('src/__audio-output-preview.html', `<!doctype html><meta charset="utf-8"><title>结果声音输出检查</title>
<style>body{font:16px sans-serif;background:#edf7f2;color:#173c33;padding:20px;max-width:700px}button{padding:14px;margin:6px}pre{white-space:pre-wrap}audio{width:100%}</style>
<h1>结果声音输出检查</h1><button id="sound">声 · 关</button>
<button data-kind="first">首次上鱼</button><button data-kind="line-break">断线</button><button data-kind="escaped">脱钩</button><button data-kind="whoosh">断线回弹片段</button><button data-kind="muted">静音检查</button>
<pre id="output">点击一种结果，检查正式音频模块的实际输出。</pre><audio id="recording" controls></audio><a id="download" hidden>下载录音</a>
<script type="module">
const NativeContext=window.AudioContext;let analyser,capture;
window.AudioContext=class extends NativeContext{createDynamicsCompressor(){const n=super.createDynamicsCompressor(),connect=n.connect.bind(n);analyser=this.createAnalyser();analyser.fftSize=2048;capture=this.createMediaStreamDestination();connect(analyser);connect(capture);return n}};
const {createAudioSystem}=await import('./audio-system.mjs');const {outcomeAudioScore}=await import('./outcome-feedback.mjs');
const system=createAudioSystem({button:document.querySelector('#sound')});
document.querySelector('#sound').onclick=()=>system.toggle();
for(const button of document.querySelectorAll('[data-kind]'))button.onclick=async()=>{
 button.disabled=true;
 try{
  if(!await system.ensureAudio(true))throw Error('音频未启动');
  // All declared assets must finish decoding before comparing outcome crops.
  await new Promise(r=>setTimeout(r,1800));
  const frames=new Float32Array(analyser.fftSize),chunks=[],recorder=new MediaRecorder(capture.stream);
  recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();let peak=0,rmsPeak=0;
  const measure=setInterval(()=>{analyser.getFloatTimeDomainData(frames);let energy=0;for(const v of frames){peak=Math.max(peak,Math.abs(v));energy+=v*v}rmsPeak=Math.max(rmsPeak,Math.sqrt(energy/frames.length))},10);
  const kind=button.dataset.kind;
  if(kind==='muted')await system.toggle();
  else if(kind==='whoosh'){const cue=outcomeAudioScore('line-break').sounds.find(c=>c.id==='whooshShort');system.realSound(cue.id,cue)}
  else{system.sound('outcome',{kind,stage:'arrival'});if(kind==='first')setTimeout(()=>system.sound('outcome',{kind,stage:'reveal'}),1050)}
  await new Promise(r=>setTimeout(r,kind==='first'?2200:1700));clearInterval(measure);
  const ended=new Promise(r=>recorder.onstop=r);recorder.stop();await ended;
  const blob=new Blob(chunks,{type:recorder.mimeType});await fetch('http://127.0.0.1:53991/'+kind,{method:'POST',body:blob});
  const decoder=new NativeContext();let recordedPeak=0,recordedRms=0,recordedFrames=0;
  try{const decoded=await decoder.decodeAudioData(await blob.arrayBuffer());let energy=0;recordedFrames=decoded.length;for(let c=0;c<decoded.numberOfChannels;c++)for(const v of decoded.getChannelData(c)){recordedPeak=Math.max(recordedPeak,Math.abs(v));energy+=v*v}recordedRms=Math.sqrt(energy/(decoded.length*decoded.numberOfChannels))}catch(error){if(kind!=='muted')throw error}finally{await decoder.close()}
  const url=URL.createObjectURL(blob);
  document.querySelector('#recording').src=url;const link=document.querySelector('#download');link.href=url;link.download=kind+'.webm';link.hidden=false;
  document.querySelector('#output').textContent=JSON.stringify({kind,peak,rmsPeak,recordedPeak,recordedRms,recordedFrames,status:system.getStatus?.()},null,2);
 }catch(e){document.querySelector('#output').textContent=e.message}finally{button.disabled=false}
};
</script>`);
console.log('src/__audio-output-preview.html');

const game=await readFile('src/index.html','utf8');
const probe=`<div style="position:fixed;top:65px;left:5px;z-index:9999;font:10px monospace;background:#fff9;max-width:375px;pointer-events:none" id="audioOutputReadout">音频输出尚未解锁</div>
<script type="module">
const NativeContext=window.AudioContext;let context,analyser,peak=0,notes=[];
window.AudioContext=class extends NativeContext{constructor(...args){super(...args);context=this}createDynamicsCompressor(){const n=super.createDynamicsCompressor();analyser=this.createAnalyser();analyser.fftSize=2048;n.connect(analyser);return n}createOscillator(){const n=super.createOscillator(),set=n.frequency.setValueAtTime.bind(n.frequency),start=n.start.bind(n);let freq=0;n.frequency.setValueAtTime=(v,t)=>{freq=v;return set(v,t)};n.start=(...args)=>{if(freq>=400)notes.push({freq:Math.round(freq),at:Date.now()});notes=notes.slice(-18);return start(...args)};return n}};
setInterval(()=>{if(!context||!analyser)return;const frames=new Float32Array(2048);analyser.getFloatTimeDomainData(frames);let energy=0;for(const v of frames){peak=Math.max(peak,Math.abs(v));energy+=v*v}document.querySelector('#audioOutputReadout').textContent=JSON.stringify({state:context.state,peak,rms:Math.sqrt(energy/frames.length),notes})},100);
await import('./app-final.js');
</script>`;
await writeFile('src/__audio-game-preview.html',game.replace('<script type="module" src="app-final.js"></script>',probe));
