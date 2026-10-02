import {REAL_AUDIO} from './data/audio-assets.mjs';
import {GAME_RULES} from './config/game-rules.mjs';
import {outcomeAudioScore,playOutcomeScore} from './outcome-feedback.mjs';

export function createAudioSystem({button}){
 let audio=null,soundOn=false,soundPreference=(()=>{try{return localStorage.getItem(GAME_RULES.soundKey)==='off'?false:null}catch{return null}})();
 let audioBus=null,ambientBus=null,ambientBed=null,realBuffers={},realElements={},realAudioReady=false,realAudioLoading=null,reverbBus=null,ambientLayers=[],reelLoop=null,castLine=null;
 let collectingOutcome=false,outcomeEpoch=0,outcomeVoices=[],graphReady=false,resumePending=null,playbackEpoch=0,lastError=null;
 const effectVoices=new Set();
 function ready(){return graphReady&&soundOn&&audio?.state==='running'&&!document.hidden}
 function renderSoundButton(){const playing=ready();button.textContent=playing?'声 · 开':soundPreference===false?'声 · 关':'声 · 待开启';button.setAttribute('aria-pressed',String(playing));button.setAttribute('aria-label',playing?'关闭环境声和音效':'开启游戏声音')}
 function trackOutcome(voice){effectVoices.add(voice);voice.onended=()=>effectVoices.delete(voice);if(collectingOutcome)outcomeVoices.push(voice)}
 function cancelOutcome(){outcomeEpoch++;for(const voice of outcomeVoices){try{voice.stop?.()}catch{}voice.pause?.()}outcomeVoices=[];if(ambientBus&&audio){ambientBus.gain.cancelScheduledValues(audio.currentTime);ambientBus.gain.setValueAtTime(.35,audio.currentTime)}}
 function interruptAudio(){playbackEpoch++;cancelOutcome();for(const voice of effectVoices){try{voice.stop?.()}catch{}voice.pause?.()}effectVoices.clear();for(const loop of [reelLoop,castLine])try{loop?.source.stop()}catch{}reelLoop=castLine=null;ambientBed?.pause();soundOn=false;renderSoundButton()}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){interruptAudio();if(audio?.state==='running')void audio.suspend().catch(()=>{})}else if(soundPreference===true)void ensureAudio()});
 function afterResume(play){if(!resumePending||soundPreference===false||document.hidden)return false;const epoch=playbackEpoch,at=Date.now();void resumePending.then(()=>{if(epoch===playbackEpoch&&ready()&&Date.now()-at<=250)play()}).catch(()=>{});return true}
function makeNoise(seconds=1,pink=false){const sr=audio.sampleRate,len=Math.ceil(sr*seconds),b=audio.createBuffer(1,len,sr),d=b.getChannelData(0);if(pink){let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.96900*b2+w*0.1538520;b3=0.86650*b3+w*0.3104080;b4=0.55000*b4+w*0.4830380;b5=-0.76777*b5-w*0.3026740;b6=w*0.5;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.115926)*0.18}}else{for(let i=0;i<len;i++)d[i]=Math.random()*2-1}return b}

function loadRealAudio(){if(realAudioReady||!audio)return Promise.resolve();if(realAudioLoading)return realAudioLoading;const entries=Object.entries(REAL_AUDIO);for(const[id,url]of entries){const element=new Audio(url);element.preload='auto';realElements[id]=element}if(location.protocol==='file:'){realAudioReady=true;return Promise.resolve()}realAudioLoading=Promise.all(entries.map(async([id,url])=>{try{const response=await fetch(url);if(!response.ok)throw Error('audio '+response.status);realBuffers[id]=await audio.decodeAudioData(await response.arrayBuffer())}catch(error){lastError=id+': '+(error?.message||String(error));console.warn('Audio load failed:',id,error)}})).then(()=>{realAudioReady=true;realAudioLoading=null});return realAudioLoading}
function realSound(id,{delay=0,gain=.5,rate=1,pan=0,offset=0,duration,reverb=0}={}){if(!ready())return false;const epoch=collectingOutcome?outcomeEpoch:null;if(realBuffers[id]){const at=audio.currentTime+delay,buf=realBuffers[id],dur=Math.max(.01,Math.min((buf.duration-Math.min(offset,Math.max(0,buf.duration-.05)))/rate,duration||2)),source=audio.createBufferSource(),gainNode=audio.createGain(),panner=audio.createStereoPanner();source.buffer=buf;source.playbackRate.value=rate;panner.pan.value=pan;gainNode.gain.setValueAtTime(.0001,at);gainNode.gain.linearRampToValueAtTime(gain,at+.008);gainNode.gain.setValueAtTime(gain,at+dur*.6);gainNode.gain.exponentialRampToValueAtTime(.0001,at+dur);source.connect(gainNode);gainNode.connect(panner);panner.connect(audioBus);if(reverb&&reverbBus){const rg=audio.createGain();rg.gain.value=reverb;panner.connect(rg);rg.connect(reverbBus)}trackOutcome(source);source.start(at,Math.min(offset,Math.max(0,buf.duration-.05)));source.stop(at+dur+.01);return true}const template=realElements[id];if(!template)return false;const play=()=>{if(!ready()||epoch!==null&&epoch!==outcomeEpoch)return;const element=template.cloneNode();trackOutcome(element);if(epoch!==null&&!collectingOutcome)outcomeVoices.push(element);element.volume=Math.min(1,gain);element.playbackRate=rate;element.currentTime=Math.min(offset,Math.max(0,(template.duration||offset+.1)-.05));element.play().catch(error=>{lastError=error?.message||String(error);console.warn('Audio playback failed:',id,error)});if(duration)setTimeout(()=>{element.volume=0;element.pause()},duration*1000)};delay?setTimeout(play,delay*1000):play();return true}
function startReelLoop(level=.65){if(!ready())return false;const buffer=realBuffers.reel;if(!buffer)return false;if(reelLoop){if(Math.abs(level-reelLoop.level)>.04){reelLoop.gain.gain.setTargetAtTime(level,audio.currentTime,.08);reelLoop.level=level}return true}const source=audio.createBufferSource(),gain=audio.createGain(),at=audio.currentTime;source.buffer=buffer;source.loop=true;source.loopStart=.48;source.loopEnd=Math.min(4.98,buffer.duration);gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(level,at+.08);source.connect(gain);gain.connect(audioBus);source.start(at,.48);reelLoop={source,gain,level};return true}
function stopReelLoop(){if(!reelLoop||!audio)return;const {source,gain}=reelLoop,at=audio.currentTime;reelLoop=null;gain.gain.cancelScheduledValues(at);gain.gain.setTargetAtTime(.0001,at,.04);source.stop(at+.22)}
function startCastLine(){if(!ready()||castLine)return;const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=makeNoise(.4);source.loop=true;filter.type='bandpass';filter.frequency.value=1500;filter.Q.value=.7;gain.gain.value=.0001;source.connect(filter);filter.connect(gain);gain.connect(audioBus);source.start();castLine={source,filter,gain}}
function updateCastLine(speed,progress){if(!castLine||!audio||!soundOn)return;const {filter,gain}=castLine,at=audio.currentTime,pace=Math.min(1,Math.max(0,speed/25)),fade=Math.sin(Math.PI*Math.min(1,Math.max(0,progress)));filter.frequency.setTargetAtTime(1000+pace*2600,at,.035);gain.gain.setTargetAtTime(.012+fade*(.035+pace*.052),at,.035)}
function stopCastLine(){if(!castLine||!audio)return;const {source,gain}=castLine,at=audio.currentTime;castLine=null;gain.gain.cancelScheduledValues(at);gain.gain.setTargetAtTime(.0001,at,.035);source.stop(at+.18)}
function blip({delay=0,freq=880,dur=.08,gain=.04,pan=0,type='sine'}={}){if(!ready())return;const at=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain(),p=audio.createStereoPanner(),lp=audio.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(freq*1.03,at+dur*.15);o.frequency.exponentialRampToValueAtTime(freq*.85,at+dur);lp.type='lowpass';lp.frequency.value=Math.max(freq*4,2000);lp.Q.value=.5;g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(gain,at+.002);g.gain.exponentialRampToValueAtTime(.0001,at+dur);p.pan.value=pan;o.connect(lp);lp.connect(g);g.connect(p);p.connect(audioBus);trackOutcome(o);o.start(at);o.stop(at+dur+.02)}
function chimeNote({delay=0,freq=523,dur=.6,gain=.05,pan=0}={}){if(!ready())return;const at=audio.currentTime+delay,harmonics=[{f:1,g:1,dec:1},{f:2,g:.35,dec:.6},{f:3,g:.12,dec:.35}],p=audio.createStereoPanner();p.pan.value=pan;p.connect(audioBus);if(reverbBus){const rg=audio.createGain();rg.gain.value=.22;p.connect(rg);rg.connect(reverbBus)}for(const h of harmonics){const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq*h.f+Math.random()*.3-.15,at);g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(gain*h.g,at+.004);g.gain.exponentialRampToValueAtTime(.0001,at+dur*h.dec);o.connect(g);g.connect(p);trackOutcome(o);o.start(at);o.stop(at+dur+.05)}}
function toneSweep({delay=0,freqStart=200,freqEnd=400,dur=.3,gain=.03,pan=0,type='sine'}={}){if(!ready())return;const at=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain(),p=audio.createStereoPanner();o.type=type;o.frequency.setValueAtTime(freqStart,at);o.frequency.exponentialRampToValueAtTime(freqEnd,at+dur);g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(gain,at+.01);g.gain.exponentialRampToValueAtTime(.0001,at+dur);p.pan.value=pan;o.connect(g);g.connect(p);p.connect(audioBus);trackOutcome(o);o.start(at);o.stop(at+dur+.02)}
function sound(kind,detail){if(!ready()){if(audio&&!resumePending&&soundPreference!==false&&!document.hidden)void ensureAudio();return afterResume(()=>sound(kind,detail))}
 if(kind==='outcome'){
  if(document.hidden)return;
  const duck=(level,duration)=>{if(!ambientBus)return;const at=audio.currentTime,param=ambientBus.gain;param.cancelScheduledValues(at);param.setValueAtTime(param.value,at);param.linearRampToValueAtTime(.35*level,at+.035);param.setValueAtTime(.35*level,at+duration);param.linearRampToValueAtTime(.35,at+duration+.45)};
  cancelOutcome();collectingOutcome=true;
  try{playOutcomeScore(outcomeAudioScore(detail?.kind,detail?.stage),{realSound,chimeNote,toneSweep,duck})}finally{collectingOutcome=false}return true;
 }
 if(kind==='ui'){realSound('uiClick',{gain:.4});blip({freq:988,dur:.035,gain:.02})}
 if(kind==='spot'){blip({freq:740,dur:.05,gain:.025,pan:-.05});realSound('uiSwitch',{delay:.02,gain:.38});realSound('splashSmall',{delay:.06,gain:.3,rate:1.3,pan:.15});blip({delay:.08,freq:988,dur:.04,gain:.015,pan:.12})}
 if(kind==='bait'){realSound('uiSwitchSoft',{gain:.32});blip({delay:.03,freq:494,dur:.05,gain:.022,pan:-.05});realSound('bubble2',{delay:.05,gain:.22,pan:.1})}
 if(kind==='cast'){stopCastLine();realSound('uiClickSoft',{gain:.28,rate:.85,duration:.10});realSound('whooshShort',{delay:.29,gain:.31,rate:1.05,offset:.16,duration:.20,pan:-.15})}
 if(kind==='castRelease'){realSound('whoosh',{gain:.72,rate:.96,offset:.17,duration:.46,pan:-.14});toneSweep({freqStart:680,freqEnd:250,dur:.34,gain:.018,pan:.08,type:'triangle'});startCastLine()}
 if(kind==='castLand'){stopCastLine();realSound('splashSmallMP3',{gain:.58,rate:1.08,offset:.16,duration:.32,pan:.15});realSound('splashTiny',{delay:.06,gain:.25,rate:1.15,pan:.22})}
 if(kind==='aim'){realSound('uiClickSoft',{gain:.22,rate:1.22,duration:.08});realSound('splashTiny',{delay:.025,gain:.15,rate:1.4,duration:.12,pan:.12})}
 if(kind==='invalidAim'){realSound('uiClickSoft',{gain:.15,rate:.75,duration:.08});toneSweep({delay:.02,freqStart:240,freqEnd:170,dur:.12,gain:.008,type:'triangle'})}
 if(kind==='approach'){realSound('bubble1',{gain:.11,rate:1.15,duration:.20,pan:.16});realSound('bubble3',{delay:.20,gain:.08,rate:1.25,duration:.16,pan:.1})}
 if(kind==='waitingRipple'){realSound('splashTiny',{gain:.10,rate:1.3,duration:.15,pan:.14});realSound('bubble1',{delay:.08,gain:.07,duration:.13,pan:.16})}
 if(kind==='reading'){
  if(detail==='deep'){toneSweep({freqStart:175,freqEnd:125,dur:.34,gain:.016,type:'triangle'});realSound('bubble3',{delay:.13,gain:.11,rate:.82,duration:.23,pan:.08})}
  else if(detail==='dart'){realSound('splashTiny',{gain:.19,rate:1.38,duration:.13,pan:-.12});realSound('splashTiny',{delay:.16,gain:.14,rate:1.5,duration:.12,pan:.16})}
  else if(detail==='peck'){realSound('splashTiny',{gain:.12,rate:1.5,duration:.11,pan:.12});realSound('splashTiny',{delay:.23,gain:.13,rate:1.38,duration:.11,pan:.12})}
  else if(detail==='broad'){realSound('splashSmall',{gain:.15,rate:.82,duration:.30,pan:.16});realSound('bubble1',{delay:.16,gain:.10,duration:.18,pan:.08})}
  else{realSound('bubble1',{gain:.15,rate:1.2,duration:.18,pan:.12});realSound('splashTiny',{delay:.10,gain:.12,rate:1.3,duration:.15,pan:.15})}
 }
 if(kind==='nibble'){realSound('splashTiny',{gain:.25,rate:1.12,duration:.22,pan:.12});toneSweep({delay:.02,freqStart:230,freqEnd:180,dur:.15,gain:.009,type:'triangle'})}
 if(kind==='bite'){realSound('splashTightMP3',{gain:.64,rate:1.0,duration:.45,reverb:.06,pan:.12});realSound('bubble2',{delay:.07,gain:.24,duration:.26,pan:.16});toneSweep({delay:.04,freqStart:160,freqEnd:95,dur:.24,gain:.025,type:'triangle'})}
 if(kind==='surge'){realSound('splashMedium',{gain:.31,rate:.90,duration:.36,pan:.18});toneSweep({delay:.02,freqStart:155,freqEnd:115,dur:.24,gain:.015,type:'triangle'})}
 if(kind==='surgeWarning'){toneSweep({freqStart:145,freqEnd:195,dur:.24,gain:.014,type:'triangle'});realSound('reel',{delay:.05,gain:.13,rate:.75,offset:1.2,duration:.17,pan:-.10})}
 if(kind==='lineStrain'){realSound('reel',{gain:.22,rate:.72,offset:3.1,duration:.20,pan:-.12});toneSweep({freqStart:300,freqEnd:210,dur:.20,gain:.009,type:'sawtooth'})}
 if(kind==='linePayOut'){realSound('reel',{gain:.32,rate:.83,offset:4.2,duration:.28,pan:-.10});realSound('uiClickSoft',{delay:.18,gain:.10,rate:.72,duration:.08})}
 if(kind==='fishBreach'){realSound('splashMedium',{gain:.45,rate:.95,duration:.42,pan:.18});realSound('splashTight',{delay:.11,gain:.18,rate:1.15,duration:.22,pan:.22})}
 if(kind==='landingLift'){realSound('splashSmallMP3',{gain:.43,rate:.93,offset:.12,duration:.38,pan:.17});realSound('reel',{delay:.05,gain:.24,rate:.88,offset:2.2,duration:.31,pan:-.10})}
 if(kind==='tacticGood'){realSound('uiClickSoft',{gain:.22,duration:.12});realSound('bubble1',{delay:.07,gain:.13,duration:.18,pan:.1})}
 if(kind==='tacticMiss'){realSound('uiClickSoft',{gain:.18,rate:.75,duration:.12});toneSweep({delay:.04,freqStart:210,freqEnd:150,dur:.16,gain:.01,type:'triangle'})}
 if(kind==='retrieve'){realSound('reel',{gain:.30,rate:1.13,offset:1.8,duration:.34,pan:-.06});realSound('splashTiny',{delay:.18,gain:.16,rate:1.2,duration:.17,pan:.12})}
 if(kind==='escape'){if(['line-break','escaped','exhausted'].includes(detail)){realSound('whooshShort',{gain:detail==='line-break'?.39:.27,rate:detail==='line-break'?1.48:1.25,duration:.15,pan:-.12});if(detail==='line-break')realSound('uiClickSoft',{gain:.20,rate:1.5,duration:.06,pan:.1})}realSound('reel',{gain:.25,rate:.78,offset:2.5,duration:.22,pan:-.06});toneSweep({delay:.04,freqStart:220,freqEnd:95,dur:.30,gain:.018,type:'triangle'});realSound('splashSmall',{delay:.15,gain:.24,rate:.9,duration:.28,pan:.12})}
 if(kind==='hook'){realSound('whooshShort',{gain:.42,rate:1.06,duration:.22,pan:-.10});realSound('splashTight',{delay:.10,gain:.31,rate:1.15,duration:.28,pan:.14});toneSweep({delay:.03,freqStart:140,freqEnd:310,dur:.22,gain:.022,type:'triangle'})}
 if(kind==='pump'){realSound('whoosh',{gain:.28,rate:1.22,pan:-.08,duration:.17});realSound('splashTight',{delay:.08,gain:.17,rate:1.3,pan:.12});toneSweep({delay:.02,freqStart:210,freqEnd:360,dur:.16,gain:.012,type:'triangle'})}
 if(kind==='reel'){const baseRate=.96+Math.random()*.10,level=detail==='retrieve'?.42:.65;realSound('reel',{gain:level,rate:baseRate,pan:-.07,offset:Math.random()*8,duration:.46});realSound('uiClickSoft',{delay:.08,gain:level*.24,rate:.9,duration:.08,pan:-.05});realSound('uiClickSoft',{delay:.24,gain:level*.20,rate:.96,duration:.08,pan:-.05})}
 if(kind==='release'){realSound('whooshShort',{gain:.22,rate:1.15,duration:.21,pan:.10});chimeNote({delay:.10,freq:392,dur:.5,gain:.022,pan:.1});chimeNote({delay:.25,freq:523,dur:.4,gain:.016,pan:-.08})}
 if(kind==='releaseLand'){realSound('splashMedium',{gain:.50,rate:.94,duration:.46,pan:.17});realSound('splashTiny',{delay:.15,gain:.22,rate:1.25,duration:.22,pan:.20})}
 if(kind==='landingSuccess'){realSound('uiRollover',{gain:.42,rate:.92,duration:.36});chimeNote({delay:.04,freq:392,dur:.48,gain:.065});chimeNote({delay:.15,freq:587,dur:.52,gain:.055,pan:.1});chimeNote({delay:.27,freq:784,dur:.62,gain:.05,pan:-.08})}
 if(kind==='catch'){const special=!!detail?.special,first=!!detail?.first,heavy=(detail?.weight||0)>=2.5,notes=special?[392,587,784,1175]:first?[523,659,880,1047]:[440,554,659,880];realSound('whooshShort',{gain:.34,rate:1.25,offset:.16,duration:.19,pan:-.12});realSound('uiRollover',{delay:.12,gain:special?.52:.42,reverb:.12});notes.forEach((freq,i)=>chimeNote({delay:.08+i*(special?.13:.15),freq,dur:.66-i*.05,gain:(special?.095:.078)-i*.007,pan:i%2?.09:-.08}));if(heavy)toneSweep({delay:.11,freqStart:190,freqEnd:105,dur:.42,gain:.022,type:'triangle'});if(special){realSound('bubble3',{delay:.39,gain:.18,rate:1.25,duration:.24,pan:.12});chimeNote({delay:.65,freq:1568,dur:.74,gain:.046,pan:.1})}}
 if(kind==='empty'){realSound('uiSwitchSoft',{gain:.28,rate:.82,duration:.22});chimeNote({delay:.02,freq:392,dur:.30,gain:.035});chimeNote({delay:.17,freq:330,dur:.42,gain:.033});realSound('bubble2',{delay:.12,gain:.16,duration:.26,pan:.1})}
 if(kind==='lost'){realSound('uiSwitchSoft',{gain:.32,rate:.74,duration:.24});toneSweep({delay:.02,freqStart:330,freqEnd:175,dur:.36,gain:.025,type:'triangle'});realSound('splashTiny',{delay:.20,gain:.15,rate:.9,duration:.18,pan:.12})}
 if(kind==='keep'){realSound('uiRollover',{gain:.35,reverb:.12});chimeNote({delay:.08,freq:659,dur:.5,gain:.035,pan:.05});blip({delay:.16,freq:988,dur:.04,gain:.015,pan:.08});realSound('splashSmall',{delay:.12,gain:.12,rate:.9,pan:0})}
 if(kind==='analyze'){realSound('uiSwitch',{gain:.32});toneSweep({delay:.05,freqStart:440,freqEnd:880,dur:.2,gain:.02,pan:0,type:'sawtooth'});blip({delay:.22,freq:1047,dur:.05,gain:.018,pan:.05});realSound('bubble3',{delay:.15,gain:.15,pan:-.05})}
 if(kind==='study'){realSound('uiClickSoft',{gain:.25,duration:.1});blip({delay:.06,freq:440,dur:.04,gain:.012,pan:0})}}
window.__seagullCry=(pan,vol)=>{if(!ready())return;const ids=['seagull1','seagull2','seagull3','seagull4','seagull5','seagullBig'];const id=ids[Math.floor(Math.random()*ids.length)];realSound(id,{gain:vol,rate:.9+Math.random()*.2,pan,reverb:.25})}
let lastHornAt=0;window.__shipHorn=(pan,vol)=>{if(!ready()||!reverbBus)return;const now=Date.now();if(now-lastHornAt<60000)return;lastHornAt=now;const at=audio.currentTime;const dur=4.5;const fund=110;const harmonics=[{f:1,g:1,type:'sawtooth'},{f:2,g:.6,type:'sawtooth'},{f:3,g:.3,type:'square'},{f:4,g:.15,type:'sine'},{f:.5,g:.25,type:'sine'}];const master=audio.createGain(),p=audio.createStereoPanner(),lp=audio.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(800,at);lp.Q.value=1.2;master.gain.setValueAtTime(.0001,at);master.gain.linearRampToValueAtTime(vol,at+.4);master.gain.setValueAtTime(vol,at+2.5);master.gain.linearRampToValueAtTime(.0001,at+dur);p.pan.value=pan;for(const h of harmonics){const o=audio.createOscillator(),g=audio.createGain();o.type=h.type;o.frequency.setValueAtTime(fund*h.f+Math.random()*.4-.2,at);o.frequency.linearRampToValueAtTime(fund*h.f*1.005,at+dur);g.gain.value=h.g;o.connect(g);g.connect(lp);o.start(at);o.stop(at+dur+.1)}const rg=audio.createGain();rg.gain.value=.35;lp.connect(master);master.connect(p);p.connect(audioBus);lp.connect(rg);rg.connect(reverbBus)}
function makeImpulse(dur=2.5,decay=2){const sr=audio.sampleRate,len=Math.ceil(sr*dur),b=audio.createBuffer(2,len,sr);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++){const t=i/len;d[i]=(Math.random()*2-1)*Math.pow(1-t,decay)}}return b}
function startOutput(){
 audioBus=audio.createGain();audioBus.gain.value=1;
 const compressor=audio.createDynamicsCompressor();compressor.threshold.value=-24;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.01;compressor.release.value=.3;
 audioBus.connect(compressor);compressor.connect(audio.destination);
 ambientBus=audio.createGain();ambientBus.gain.value=.35;ambientBus.connect(audioBus);
 graphReady=true;
 try{reverbBus=audio.createGain();reverbBus.gain.value=.5;const convolver=audio.createConvolver();convolver.buffer=makeImpulse(3,2.5);const reverbGain=audio.createGain();reverbGain.gain.value=.25;reverbBus.connect(convolver);convolver.connect(reverbGain);reverbGain.connect(audioBus)}catch(error){reverbBus=null;lastError=error?.message||String(error)}
 try{startAmbience()}catch(error){ambientBed?.pause();ambientBed=null;lastError=error?.message||String(error)}
}
function startAmbience(){ambientBed=new Audio(REAL_AUDIO.ocean1);ambientBed.loop=true;ambientBed.preload='auto';const bedSource=audio.createMediaElementSource(ambientBed),bedFilter=audio.createBiquadFilter(),bedGain=audio.createGain(),swell=audio.createOscillator(),swellDepth=audio.createGain();bedFilter.type='lowpass';bedFilter.frequency.value=950;bedGain.gain.value=.045;swell.frequency.value=.035;swellDepth.gain.value=.025;swell.connect(swellDepth);swellDepth.connect(bedGain.gain);bedSource.connect(bedFilter);bedFilter.connect(bedGain);bedGain.connect(ambientBus);swell.start();ambientLayers=[]}
let nextShoreWaveAt=Date.now()+8000;
function shoreWave(){if(!ready())return;const now=Date.now();if(now<nextShoreWaveAt)return;nextShoreWaveAt=now+12000+Math.random()*8000;const id=Math.random()<.5?'ocean3':'ocean5',buffer=realBuffers[id];if(!buffer){realSound(id,{gain:.035,rate:.9+Math.random()*.1});return}const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),pan=audio.createStereoPanner(),at=audio.currentTime,duration=Math.min(buffer.duration,5);source.buffer=buffer;source.playbackRate.value=.9+Math.random()*.1;filter.type='lowpass';filter.frequency.value=1300;pan.pan.value=Math.random()*.5-.25;gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.08,at+Math.min(1.8,duration*.4));gain.gain.setValueAtTime(.08,at+duration*.6);gain.gain.linearRampToValueAtTime(.0001,at+duration);source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(ambientBus);source.start(at);source.stop(at+duration)}
async function ensureAudio(force=false){
 if(document.hidden||soundPreference===false&&!force)return false;
 if(force)soundPreference=true;
 try{
  // Set the media session during the gesture, before resuming the context.
  try{if(typeof navigator!=='undefined'&&navigator.audioSession)navigator.audioSession.type='playback'}catch{}
  if(!audio||audio.state==='closed'){
   graphReady=false;resumePending=null;audio=new (window.AudioContext||window.webkitAudioContext)();startOutput();
   const context=audio;audio.onstatechange=()=>{if(audio!==context)return;if(audio.state!=='running')interruptAudio();else if(soundPreference!==false&&!document.hidden){soundOn=true;renderSoundButton()}};
  }
  // Media element playback must start in the gesture too, not after await resume.
  if(ambientBed?.paused)void ambientBed.play().catch(error=>{lastError=error?.message||String(error)});
  if(audio.state!=='running'){
   // A blocked autoplay resume can stay pending forever. A new gesture must
   // issue its own resume immediately, while that gesture is still active.
   const attempt=Promise.resolve(audio.resume()),pending=attempt.finally(()=>{if(resumePending===pending)resumePending=null});
   resumePending=pending;await pending;
  }
  if(soundPreference===false||document.hidden||audio.state!=='running'){soundOn=false;renderSoundButton();return false}
  soundOn=true;if(soundPreference===null)soundPreference=true;renderSoundButton();void loadRealAudio();return true;
 }catch(error){
  lastError=error?.message||String(error);soundOn=false;
  if(!graphReady){const failed=audio;audio=null;audioBus=ambientBus=reverbBus=null;void failed?.close?.().catch(()=>{})}
  renderSoundButton();return false;
 }
}

 async function toggle(){
  if(soundOn){
   soundPreference=false;interruptAudio();
   try{localStorage.setItem(GAME_RULES.soundKey,'off')}catch{}
   ambientBed?.pause();await audio?.suspend();
   button.textContent='声 · 关';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','开启环境声');
   return true;
  }
  soundPreference=true;
  try{localStorage.setItem(GAME_RULES.soundKey,'on')}catch{}
  const playing=await ensureAudio(true);if(playing){chimeNote({freq:659,dur:.24,gain:.075});chimeNote({delay:.13,freq:880,dur:.26,gain:.065})}return playing;
 }
 return {sound,realSound,ensureAudio,shoreWave,startReelLoop,stopReelLoop,updateCastLine,stopCastLine,toggle,wantsGesture:()=>soundPreference!==false&&!ready(),getStatus:()=>({enabled:soundPreference!==false,state:audio?.state||'uninitialized',ready:ready(),decodedAssets:Object.keys(realBuffers).length,lastError})};
}
