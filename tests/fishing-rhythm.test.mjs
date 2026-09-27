import test from 'node:test';
import assert from 'node:assert/strict';
import {fishingCue,rhythmPresentation,hookTiming,BITE_WINDOW_MS} from '../dist/fishing-rhythm.mjs';
import {biteGuidance} from '../dist/bite-guidance.mjs';

test('fish approach accelerates the water cue and a firm bite has the strongest pulse',()=>{
 const phases=['waiting','approach','reading','nibble','hooked'];
 const cues=phases.map(fishingCue);
 for(let i=1;i<cues.length;i++){
  assert.ok(cues[i].period<cues[i-1].period,`${phases[i]} should be faster than ${phases[i-1]}`);
  assert.ok(cues[i].intensity>cues[i-1].intensity,`${phases[i]} should be stronger than ${phases[i-1]}`);
 }
});

test('lost and empty bite settle below the waiting pulse',()=>{
 for(const phase of ['spooked','empty']){
  assert.ok(fishingCue(phase).intensity<fishingCue('waiting').intensity);
  assert.ok(fishingCue(phase).period>fishingCue('reading').period);
 }
});

test('passive cues describe the water while decisions keep one clear action',()=>{
 for(const phase of ['waiting','approach','reading','responding','nibble','spooked']){
  const cue=rhythmPresentation(phase);
  assert.ok(cue.title.length>0&&cue.hint.length>0);
  assert.doesNotMatch(cue.title+cue.hint,/点击|按空格|下一步|右下角/);
 }
 assert.match(rhythmPresentation('hooked').hint,/提竿/);
 assert.match(rhythmPresentation('empty').hint,/收回鱼线/);
 assert.equal(biteGuidance('broad').tactic,'wait');
 assert.equal(biteGuidance('dart').tactic,'tease');
 assert.equal(biteGuidance('deep').tactic,'shorten');
});

test('the hook has a forgiving sweet spot followed by a fading opportunity',()=>{
 const ready=100000;
 assert.equal(hookTiming(ready,ready+800).quality,1);
 assert.equal(hookTiming(ready,ready+800).grade,'clean');
 assert.ok(hookTiming(ready,ready+6500).quality<hookTiming(ready,ready+800).quality);
 assert.equal(hookTiming(ready,ready+6500).grade,'fading');
 assert.equal(hookTiming(ready,ready).remaining,BITE_WINDOW_MS/1000);
 assert.ok(hookTiming(ready,ready+3000).remaining>1.5);
 assert.equal(hookTiming(ready,ready+BITE_WINDOW_MS).remaining,0);
 assert.equal(hookTiming(ready,ready+6500,9500).remaining,3);
});
