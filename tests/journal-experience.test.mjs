import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {newSave} from '../src/engine.mjs';
import {emptyWaterChronicle} from '../src/spot-chronicle.mjs';
import {journalAchievements,renderJournalOverview,renderEncounterAtlas,validJournalPage} from '../src/ui/journal-achievements.mjs';
import {renderBookMarkup} from '../src/ui/book-markup.mjs';
import postcss from 'postcss';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('new and missing saves show honest empty progress without disclosing fish',()=>{
 for(const save of [newSave(),{},null]){const a=journalAchievements(save);assert.equal(a.fishKnown,0);assert.equal(a.placesOpen,1);assert.equal(a.supported,0);assert.equal(a.latest.length,0);}
 const requested=[];const html=renderEncounterAtlas({},id=>{requested.push(id);return './assets/'+id+'.png';});
 assert.deepEqual(requested,[]);assert.ok(!html.includes('银月鱼'));assert.ok(html.includes('未留记录'));
 assert.ok(renderJournalOverview({},()=>null).includes('第一尾，还在水里等你'));
});

test('existing records deduplicate across sources and survive collection release',()=>{
 const save=newSave();save.log=[{id:'carp',weight:.5,spot:'reed'},{id:'carp',weight:1.2,spot:'bridge'},{id:'bottle',weight:.3,spot:'reed'}];save.collection=[{id:'carp',weight:1.2}];save.tracked=[{id:'carp',weight:1}];
 save.fightRecords={carp:{grade:'A'},catfish:{grade:'B'},moon:{grade:'invalid'}};
 const before=JSON.stringify(save),a=journalAchievements(save);assert.equal(JSON.stringify(save),before);
 assert.equal(a.fishKnown,2);assert.equal(a.objectsKnown,1);assert.equal(a.records.find(x=>x.id==='carp').bestWeight,1.2);
 assert.deepEqual(a.records.find(x=>x.id==='carp').places,['近岸浅滩','栈桥外湾']);assert.equal(a.records.find(x=>x.id==='moon').known,false);
 save.collection=[];assert.equal(journalAchievements(save).fishKnown,2);
});

test('chronicle evidence preserves encountered species but misses and pending do not reveal them',()=>{
 const save=newSave();save.waterChronicle=emptyWaterChronicle();save.waterChronicle.spots.reed.fish.minnow=2;
 save.pending={catch:{id:'moon',weight:3}};save.log=[{id:'unknown',weight:99},{id:'carp',weight:NaN},{id:'carp',weight:Infinity}];
 const a=journalAchievements(save);assert.equal(a.fishKnown,2);assert.equal(a.records.find(x=>x.id==='carp').bestWeight,null);assert.equal(a.records.find(x=>x.id==='moon').known,false);
 assert.ok(!renderJournalOverview(save,()=>null).includes('data-prepare-spot='));
 assert.ok(renderJournalOverview(save,()=>null).includes('这一竿结束后'));
});

test('observation counts distinguish hypothesis from support and do not change save',()=>{
 const save=newSave();save.discoveryNotes=[{topicId:'reed-bait-follow',evidence:[{castId:'1:1',eventType:'bait_follow',observedAt:1}]}];
 assert.equal(journalAchievements(save).supported,0);assert.equal(journalAchievements(save).observations,1);
 save.discoveryNotes[0].evidence.push({castId:'2:2',eventType:'bait_follow',observedAt:2});assert.equal(journalAchievements(save).supported,1);
});

test('atlas escapes image URLs, hides unknown artwork and renders actual detail evidence',()=>{
 const save=newSave();save.log=[{id:'carp',weight:.55,spot:'reed'}];
 const requested=[];const html=renderEncounterAtlas(save,id=>{requested.push(id);return './assets/fish.png" onerror="bad';});
 assert.deepEqual(requested,['carp']);assert.ok(html.includes('&quot;'));assert.ok(!html.includes('src="./assets/fish.png" onerror='));
 assert.ok(html.includes('0.550 kg'));assert.ok(html.includes('近岸浅滩'));assert.ok(html.includes('<details class="atlas-card"'));
 assert.ok(renderEncounterAtlas(save,()=> 'javascript:bad').includes('银背鲫'));assert.ok(!renderEncounterAtlas(save,()=> 'javascript:bad').includes('javascript:'));
});

test('book markup exposes overview and an independent atlas while preserving legacy pages',()=>{
 const save=newSave();assert.ok(renderBookMarkup(save,'water',()=>null).includes('journal-overview'));
 assert.ok(renderBookMarkup(save,'water',()=>null).includes('journal-water-details'));
 assert.ok(renderBookMarkup(save,'atlas',()=>null).includes('encounter-atlas'));
 for(const page of ['collection','clues','gear','basket','shop'])assert.ok(renderBookMarkup(save,page,()=>null).length>0);
});

test('actual journal page navigation validates targets and expands detail without changing game state',()=>{
 const source=read('src/app-final.js'),start=source.indexOf('function navigateJournalPage('),end=source.indexOf("$('#bookContent').addEventListener",start);
 let renders=0;const details={open:false},content={scrollTop:90,querySelector:()=>details};
 const context=vm.createContext({validJournalPage,catchProcessEvent:null,tab:'water',renderBook(){renders++;},$:()=>content});
 vm.runInContext(source.slice(start,end),context);
 assert.equal(context.navigateJournalPage('atlas'),true);assert.equal(context.tab,'atlas');assert.equal(content.scrollTop,0);
 assert.equal(context.navigateJournalPage('water',true),true);assert.equal(details.open,true);
 assert.equal(context.navigateJournalPage('__proto__'),false);assert.equal(renders,2);
 context.catchProcessEvent={};assert.equal(context.navigateJournalPage('collection'),false);
});

test('journal uses touch-sized primary navigation and scrollable two-column atlas',()=>{
 const jsx=read('src/ui/journal.jsx');assert.ok(jsx.includes("primary=['water','atlas','collection']"));assert.ok(jsx.includes('journal-secondary-nav'));
 assert.ok(jsx.includes('aria-pressed={active() === id}'));
 const rules=[];postcss.parse(read('src/journal-experience.css')).walkRules(rule=>rules.push(rule));
 const property=(selector,key)=>rules.find(rule=>rule.selector===selector)?.nodes.find(node=>node.prop===key)?.value;
 assert.equal(property('#book .atlas-grid','grid-template-columns'),'repeat(2,minmax(0,1fr))');
 assert.equal(property('#book #bookTabs .journal-primary-tabs button','min-height'),'58px');
 assert.equal(property('#book .journal-art','display'),'none');
});
