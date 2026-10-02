import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catchRevealPresentation} from '../src/ui/catch-reveal.mjs';

test('catch reveal distinguishes honest first, record and ordinary identities',()=>{
 assert.equal(catchRevealPresentation({}, {}, '首次记录').mood,'first');
 assert.equal(catchRevealPresentation({}, {}, '重量纪录').mood,'record');
 assert.equal(catchRevealPresentation({}, {}, '重复记录').mood,'catch');
});
test('a returning individual takes priority over a special species',()=>{
 const caught={tagId:'fish-1',fightReport:{grade:'A'}};
 assert.deepEqual(catchRevealPresentation(caught,{special:true},'首次记录'),{title:'老朋友回来了',mood:'reunion',grade:'A'});
 assert.equal(catchRevealPresentation({}, {special:true}).mood,'special');
});
test('objects are discoveries and do not receive a fight medal',()=>{
 assert.deepEqual(catchRevealPresentation({tagId:'old',fightReport:{grade:'S'}},{object:true,special:true}),{title:'收获一份意外',mood:'discovery',grade:''});
});
test('only actual recognized fight grades appear on the reward badge',()=>{
 for(const grade of ['S','A','B','C'])assert.equal(catchRevealPresentation({fightReport:{grade}},{}).grade,grade);
 for(const grade of [undefined,null,'D','SS','<img src=x>',3])assert.equal(catchRevealPresentation({fightReport:{grade}},{}).grade,'');
 assert.deepEqual(catchRevealPresentation(),{title:'钓获上岸',mood:'catch',grade:''});
});
test('reveal cannot grant rewards or mutate a pending catch',()=>{
 const caught={tagId:'tag-1',weight:.15,fightReport:{grade:'A'}},fish={special:true};
 const before=structuredClone({caught,fish});catchRevealPresentation(caught,fish,'首次记录');
 assert.deepEqual({caught,fish},before);
});
test('the grade remains beside the name when the specimen stage folds away',()=>{
 const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 const stage=html.slice(html.indexOf('<div class="catch-stage">'),html.indexOf('<div class="catch-title-row">'));
 assert.match(stage,/id="specimen"/);
 assert.doesNotMatch(stage,/id="catchGrade"/);
 assert.match(html,/<div class="catch-title-row"><h2 id="catchName"><\/h2><div id="catchGrade" hidden>/);
});
