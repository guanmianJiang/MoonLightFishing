// Seed a disposable origin against a fixed production build, without Vite HMR.
import {readFile,writeFile} from 'node:fs/promises';
import {newSave,weatherAt} from '../src/engine.mjs';
import {GAME_RULES} from '../src/config/game-rules.mjs';
const html=await readFile('build/index.html','utf8'),entry=html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
if(!entry)throw new Error('No built game entry');
const seed=`<script type="module">
const s=${JSON.stringify(newSave())},q=new URLSearchParams(location.search),now=Date.now();
if(!q.has('fresh')){const id=q.get('fish')||'carp',c={id,weight:id==='bottle'?.3:2.8,length:32,variation:'普通',time:now,spot:'reed'};s.knowledge=15;s.casts=1;s.log=[c];s.pending={start:now-5000,phase:'result',catch:c,spot:'reed',bait:'grain',weather:${JSON.stringify(weatherAt(Date.now()))},readyAt:now-1000};}
localStorage.setItem(${JSON.stringify(GAME_RULES.saveKey)},JSON.stringify(s));
await import(${JSON.stringify(entry[1])});
</script>`;
await writeFile('build/__built-catch-preview.html',html.replace(entry[0],seed));
