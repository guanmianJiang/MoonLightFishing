import test from 'node:test';
import assert from 'node:assert/strict';
import {catchChoiceMarkup,catchDecisionCopy} from '../src/ui/catch-choice-markup.mjs';
import {uiIcon} from '../src/ui/icons.mjs';
import {PROCESS_ACTIONS,newSave,processHint} from '../src/engine.mjs';

test('each real catch action keeps its name, consequence and icon in one touch button',()=>{
 const save=newSave(),caught={id:'minnow',weight:.13};
 for(const action of PROCESS_ACTIONS){
  const markup=catchChoiceMarkup(action,{recommended:true,hint:processHint(save,action.id,caught)});
  assert.match(markup,new RegExp(`data-process="${action.id}"`));
  assert.ok(markup.includes(`<strong>${action.name}</strong>`));
  assert.ok(markup.includes(uiIcon(action.id)));
  assert.ok(markup.includes(processHint(save,action.id,caught)));
  assert.match(markup,/type="button"/);
  assert.doesNotMatch(markup,/process-mark|建议/);
  assert.match(markup,/aria-describedby="resultChoiceTitle resultChoiceHelp"/);
 }
});

test('alternative choices do not repeat the recommendation badge',()=>{
 const markup=catchChoiceMarkup(PROCESS_ACTIONS[0]);
 assert.match(markup,/process-option/);
 assert.doesNotMatch(markup,/process-mark/);
 assert.match(markup,/process-arrow/);
});

test('action copy and attributes cannot introduce markup into the decision',()=>{
 const markup=catchChoiceMarkup({id:'x" onclick="bad',name:'<img src=x>'},{hint:'<script>&"\''});
 assert.doesNotMatch(markup,/<img|<script|onclick="bad/);
 assert.match(markup,/&lt;img/);
 assert.match(markup,/&amp;/);
 assert.match(markup,/&quot;/);
 assert.match(markup,/&#39;/);
});

test('missing actions and unknown icons safely fall back to a journal',()=>{
 assert.match(catchChoiceMarkup(),/data-process="study"/);
 assert.equal(uiIcon('unknown'),uiIcon('study'));
 assert.match(uiIcon('release'),/aria-hidden="true"/);
 assert.match(uiIcon('release'),/focusable="false"/);
});

test('the decision shows only the live goal and clamped progress without changing it',()=>{
 const goal={name:'放回 2 个活体',progress:1,target:2},before=structuredClone(goal);
 assert.deepEqual(catchDecisionCopy(goal),{title:goal.name,help:'本轮进度 1 / 2'});
 assert.deepEqual(goal,before);
 assert.equal(catchDecisionCopy({...goal,progress:-3}).help,'本轮进度 0 / 2');
 assert.equal(catchDecisionCopy({...goal,progress:NaN}).help,'本轮进度 0 / 2');
});

test('completed, absent and malformed goals leave a neutral explicit decision',()=>{
 for(const goal of [null,{}, {target:Infinity},{target:0},{target:2,complete:true}]){
  assert.equal(catchDecisionCopy(goal).title,'如何留下这次钓获？');
 }
 assert.equal(catchDecisionCopy({target:2,progress:3}).title,'这次约定已完成');
});
