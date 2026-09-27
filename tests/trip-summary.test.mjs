import test from 'node:test';
import assert from 'node:assert/strict';
import {tripStory} from '../src/trip-summary.mjs';

test('trip recap groups repeated actions and keeps goal and ecology outcomes',()=>{
  const story=tripStory({
    goal:{name:'放回 2 个活体',progress:2,target:2,complete:true,reward:1},
    rule:{name:'底层水体翻动',triggers:0},
    changes:[
      '已放回红鳍鲈。追踪位已满，本次只改变鱼群数量。',
      '已放回红鳍鲈。追踪位已满，本次只改变鱼群数量。',
      '已记录岩底鲶，调查进度 +1。',
      '已记录岩底鲶，调查进度 +1。',
      '本轮目标完成：放回 2 个活体。调查进度 +1。',
      '水域事件：底层水体翻动，本轮触发 0 次。',
      '生态变化：白条数量上升，红鳍鲈的近岸出现率提高。',
      '生态变化：底层食物增加，岩底鲶的出现率提高。'
    ]
  });
  assert.match(story.lead,/红鳍鲈一次次游回水里/);
  assert.match(story.lead,/岩底鲶的模样留在了手记里/);
  assert.equal(story.notes.length,2);
  assert.match(story.notes[0].body,/调查进度 \+1/);
  assert.match(story.notes[1].body,/白条数量上升/);
  assert.match(story.notes[1].body,/底层食物增加/);
});

test('unfinished and quiet trips have a useful recap',()=>{
  const story=tripStory({goal:{name:'放回 2 个活体',progress:0,target:2,complete:false,reward:1},rule:{name:'潮间流',triggers:0},changes:['本竿为空钩，没有获得样本。','生态变化：当前鱼群结构基本稳定。']});
  assert.match(story.lead,/1 竿空钩/);
  assert.match(story.notes[0].body,/0\/2/);
  assert.match(story.notes[1].body,/鱼群分布暂时平稳/);
});
