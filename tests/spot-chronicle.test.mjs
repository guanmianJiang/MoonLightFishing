import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {SPOTS,newSave,migrateSave,makeCast,finishCast,processCatch,startNextTrip,spotUnlocked} from '../src/engine.mjs';
import {emptyWaterChronicle,normalizeWaterChronicle,addWaterChronicleMoment,spotChronicleView,spotDecisionGuide,spotMarkerView,waterChronicleCoverage,validateSpotContent} from '../src/spot-chronicle.mjs';
import {tripStory} from '../src/trip-summary.mjs';
import {renderWaterChronicles} from '../src/ui/book-markup.mjs';
import content from '../src/config/gameplay/spot-content.json' with {type:'json'};

const moment=(number,spot,kind,fishId=null)=>({castId:`${number}:${number*1000}`,spot,kind,...(fishId?{fishId}:{}),zone:'middle',at:number*1000});

test('each configured place has a valid first step and no content claim is generated from a cast count alone',()=>{
 assert.equal(validateSpotContent(),true);
 assert.equal(validateSpotContent({...content,spots:[...content.spots,content.spots[0]]}),false);
 assert.equal(validateSpotContent({...content,spots:content.spots.map(item=>item.id==='reed'?{...item,bait:'missing'}:item)}),false);
 const save=newSave(),view=spotChronicleView(save,'reed');
 assert.equal(view.casts,0);assert.equal(view.latest,null);assert.match(view.next,/麦粒/);
 assert.equal(spotChronicleView(save,'missing'),null);
 assert.deepEqual(spotChronicleView(save,'reed').action,{spot:'reed',bait:'grain',zone:'near'});
 assert.match(spotDecisionGuide(save,'reed').title,/近岸浅滩/);
});

test('map markers distinguish three authored water choices without claiming a sighting',()=>{
 const save=newSave();
 assert.deepEqual(SPOTS.map(spot=>spotMarkerView(save,spot.id,true).hint),['浅水看漂相','桥桩看线势','深水看微光']);
 assert.deepEqual(SPOTS.map(spot=>spotMarkerView(save,spot.id,true).glyph),['≈','║','✧']);
 assert.equal(spotMarkerView(save,'reed',true).state,'new');
 assert.equal(spotMarkerView(save,'reed',true).shortStatus,'初试');
 assert.match(spotMarkerView(save,'reed',true).aria,/此版尚无抛竿/);
 assert.equal(spotMarkerView(save,'missing',true),null);
 assert.equal(validateSpotContent({...content,spots:content.spots.map(item=>item.id==='reed'?{...item,mapHint:''}:item)}),false);
 assert.equal(validateSpotContent({...content,spots:content.spots.map(item=>item.id==='deep'?{...item,mapGlyph:'too long'}:item)}),false);
 assert.equal(validateSpotContent({...content,spots:content.spots.map(item=>item.id==='deep'?{...item,mapGlyph:'≈'}:item)}),false);
});

test('locked and legacy map labels are honest about access and old records',()=>{
 const save=newSave();save.casts=8;save.knowledge=2;
 const locked=spotMarkerView(save,'bridge',false);
 assert.equal(locked.state,'locked');assert.match(locked.detail,/探索 2\/3 解锁/);
 assert.doesNotMatch(locked.aria,/上次上岸/);
 assert.equal(spotMarkerView(save,'bridge',true).state,'legacy');
 assert.match(spotMarkerView(save,'bridge',true).status,/旧竿未归点/);
 save.waterChronicle.spots.reed.casts=1;
 const incomplete=spotMarkerView(save,'reed',true);
 assert.equal(incomplete.state,'legacy');assert.match(incomplete.detail,/最近结果未记下/);
});

test('map status follows the latest settled event, including quiet after a catch',()=>{
 const cases=[['landed','minnow','上次上岸'],['near-miss','perch','上次失手'],['object','bottle','上次挂物'],['quiet',null,'上次平静']];
 for(const [kind,fishId,status] of cases){
  const save=newSave();save.casts=1;
  save.waterChronicle=addWaterChronicleMoment(save.waterChronicle,moment(1,'reed',kind,fishId));
  assert.equal(spotMarkerView(save,'reed',true).state,kind);
  assert.equal(spotMarkerView(save,'reed',true).status,status);
  assert.match(spotMarkerView(save,'reed',true).shortStatus,/上岸|失手|挂物|平静/);
 }
 const save=newSave();save.casts=2;
 save.waterChronicle=addWaterChronicleMoment(save.waterChronicle,moment(1,'reed','landed','minnow'));
 save.waterChronicle=addWaterChronicleMoment(save.waterChronicle,moment(2,'reed','quiet'));
 assert.equal(spotMarkerView(save,'reed',true).status,'上次平静');
 assert.equal(spotMarkerView(save,'bridge',true).state,'new');
});

test('map component uses marker semantics and keeps selection separate from casting',()=>{
 const source=readFileSync(new URL('../src/ui/setup.jsx',import.meta.url),'utf8');
 assert.match(source,/spotMarkerView\(selection\(\), spot\.id, unlocked\(\)\)/);
 assert.match(source,/data-state=\{marker\(\)\.state\}/);
 assert.match(source,/aria-label=\{`选择钓点：\$\{marker\(\)\.aria\}`\}/);
 assert.match(source,/onClick=\{\(\) => onSelect\(spot\.id\)\}/);
 assert.doesNotMatch(source,/makeCast\(/);
 const css=readFileSync(new URL('../src/responsive-ui.css',import.meta.url),'utf8');
 assert.match(css,/min-height:48px/);assert.match(css,/#game:not\(\.overview\) #spots \.spot small \{display:block/);
});

test('each real outcome produces a distinct reversible place preparation without inventing a catch',()=>{
 const cases=[
  ['near-miss','minnow','near','near',/同一鱼饵再观察/],
  ['quiet',null,'middle','far',/很平静.*换到远水/],
  ['object','bottle','far','middle',/沉水物.*换到中段/],
  ['landed','minnow','near','middle',/有鱼上岸.*换到中段/]
 ];
 for(const [kind,fishId,from,to,copy] of cases){
  const save=newSave();save.casts=1;
  save.waterChronicle=addWaterChronicleMoment(save.waterChronicle,{...moment(1,'reed',kind,fishId),zone:from,bait:'worm'});
  const view=spotChronicleView(save,'reed'),guide=spotDecisionGuide(save,'reed');
  assert.equal(view.action.zone,to);assert.equal(view.action.bait,'worm');assert.match(view.next,copy);
  assert.equal(guide.action.kind,'spot-plan');assert.equal(guide.action.zone,to);
  assert.equal(save.pending,null);assert.equal(save.casts,1);
 }
});

test('old place events missing bait or zone use the configured safe preparation',()=>{
 const save=newSave();save.casts=1;
 save.waterChronicle=addWaterChronicleMoment(save.waterChronicle,moment(1,'bridge','quiet'));
 const view=spotChronicleView(save,'bridge');
 assert.deepEqual(view.action,{spot:'bridge',bait:'worm',zone:'middle'});
 assert.doesNotMatch(view.next,/刚才.*中段/);
 assert.equal(spotDecisionGuide(save,'unknown'),null);
});

test('one factual cast belongs to one place, one outcome and one known fish only',()=>{
 let history=emptyWaterChronicle();
 history=addWaterChronicleMoment(history,moment(1,'reed','landed','minnow'));
 history=addWaterChronicleMoment(history,moment(2,'bridge','near-miss','perch'));
 history=addWaterChronicleMoment(history,moment(3,'deep','object','bottle'));
 history=addWaterChronicleMoment(history,moment(4,'reed','quiet'));
 assert.equal(history.total,4);
 assert.equal(history.spots.reed.casts,2);
 assert.deepEqual(history.spots.reed.outcomes,{landed:1,object:0,nearMiss:0,quiet:1});
 assert.equal(history.spots.reed.fish.minnow,1);
 assert.deepEqual(history.spots.bridge.fish,{});
 assert.equal(history.spots.bridge.outcomes.nearMiss,1);
 assert.equal(history.spots.deep.outcomes.object,1);
 assert.match(spotChronicleView({casts:4,waterChronicle:history},'bridge').latest,/红鳍鲈.*没能留住/);
});

test('duplicate, old and invalid events do not add content; recent excerpts stay bounded',()=>{
 let history=emptyWaterChronicle();
 for(let n=1;n<=8;n++)history=addWaterChronicleMoment(history,moment(n,'reed',n%2?'landed':'quiet',n%2?'carp':null));
 assert.equal(history.spots.reed.casts,8);assert.equal(history.spots.reed.recent.length,4);
 assert.equal(history.spots.reed.fish.carp,4);
 for(const bad of [moment(8,'reed','quiet'),moment(3,'reed','landed','carp'),moment(9,'unknown','quiet'),moment(9,'reed','landed','unknown'),{...moment(9,'reed','quiet'),castId:'bad'}]){
  const after=addWaterChronicleMoment(history,bad);assert.deepEqual(after,history);
 }
 const broken=normalizeWaterChronicle({version:1,total:999,lastOrdinal:-1,spots:{reed:{casts:-3,outcomes:{landed:Infinity},fish:{fake:20,carp:-1},recent:[moment(1,'unknown','landed','carp')]}}});
 assert.equal(broken.total,0);assert.deepEqual(broken.spots.reed.fish,{});assert.deepEqual(broken.spots.reed.recent,[]);
});

test('the engine records at successful settlement and retains the place across trips',()=>{
 const save=newSave();save.trip.castsLeft=1;
 save.pending=makeCast(save,1000,()=>.5);save.pending.catch={id:'minnow',weight:.08,length:13,time:1000,spot:'reed',bait:'grain'};
 finishCast(save);
 assert.equal(save.waterChronicle.total,0,'an unresolved result is not yet a settled place memory');
 const result=processCatch(save,'release');assert.equal(result.tripEnded,true);
 assert.equal(save.waterChronicle.total,1);assert.equal(save.waterChronicle.spots.reed.fish.minnow,1);
 assert.equal(save.trip.moments[0].spot,'reed');assert.equal(save.trip.moments[0].bait,'grain');
 assert.equal(processCatch(save,'release'),null);assert.equal(save.waterChronicle.total,1);
 assert.equal(startNextTrip(save),true);assert.deepEqual(save.trip.moments,[]);assert.equal(save.waterChronicle.total,1);
});

test('old saves do not invent missing place history or classify old catches as quiet casts',()=>{
 const old=newSave();old.casts=12;old.log=[{id:'minnow',spot:'reed',weight:.08,length:13,time:1000}];delete old.waterChronicle;
 migrateSave(old);
 assert.equal(old.waterChronicle.total,0);assert.equal(old.waterChronicle.spots.reed.casts,0);
 const view=spotChronicleView(old,'reed');assert.equal(view.legacy,true);assert.equal(view.latest,null);
 assert.match(renderWaterChronicles(old),/旧记录缺少完整逐竿地点/);
 assert.doesNotMatch(renderWaterChronicles(old),/最近一竿：钓起了细鳞白条/);
 const current=newSave();current.casts=1;current.pending={phase:'result'};
 assert.equal(waterChronicleCoverage(current).hasOlderCasts,false,'unsettled current cast is not mistaken for an old save');
 current.pending=null;assert.equal(waterChronicleCoverage(current).hasOlderCasts,true);
});

test('trip recap ties real outcomes to places and older moments remain safely placeless',()=>{
 const trip={moments:[moment(1,'reed','landed','minnow'),moment(2,'bridge','near-miss','perch'),moment(3,'reed','quiet'),moment(4,'bridge','object','bottle')]};
 const story=tripStory(trip);
 assert.deepEqual(story.route.map(place=>[place.id,place.casts,place.result]),[
  ['reed',2,'上岸 1 · 平静 1'],['bridge',2,'沉水物 1 · 失手 1']
 ]);
 assert.match(story.notes[0].label,/近岸浅滩/);
 assert.deepEqual(tripStory({moments:[{castId:'1:1000',kind:'quiet'}]}).route,[]);
 assert.deepEqual(tripStory({moments:[{castId:'1:1000',kind:'quiet'},moment(2,'reed','quiet')]}).route,[],
  'mixed old and new moments cannot be presented as a complete trip route');
});

test('water book shows recorded places and an actionable preparation only when available',()=>{
 const save=newSave();save.knowledge=7;
 save.waterChronicle=addWaterChronicleMoment(save.waterChronicle,moment(1,'reed','landed','minnow'));save.casts=1;
 const html=renderWaterChronicles(save);
 assert.match(html,/水域履历 · 总共 1 竿/);
 assert.match(html,/近岸浅滩/);assert.match(html,/上岸 1/);assert.match(html,/细鳞白条 1 次/);
 assert.match(html,/data-prepare-spot="bridge"/);
 assert.match(html,/data-prepare-spot="reed"/);
 save.pending={phase:'cast'};assert.doesNotMatch(renderWaterChronicles(save),/data-prepare-spot=/);
});

test('water-book place action delegates to preparation without casting',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8'),start=source.indexOf("$('#bookContent').addEventListener('click',e=>{const prepare="),end=source.indexOf('\n',start);
 assert.ok(start>=0&&end>start);
 const calls=[];let handler;const context=vm.createContext({$:()=>({addEventListener(_kind,fn){handler=fn}}),sound(type){calls.push(type)},prepareSpotPlan(id){calls.push(id);return id==='bridge'}});
 vm.runInContext(source.slice(start,end),context);
 const click=id=>handler({target:{closest:selector=>selector==='[data-prepare-spot]'?{dataset:{prepareSpot:id}}:null}});
 click('bridge');click('unknown');assert.deepEqual(calls,['bridge','ui','unknown']);
});

test('place preparation selects valid spot, bait and aim preview but never confirms a cast',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 const start=source.indexOf('function prepareSpotPlan(id){'),end=source.indexOf('function followWaterQuestion',start);
 assert.ok(start>=0&&end>start);
 const save=newSave(),calls=[];save.knowledge=7;
 const context=vm.createContext({state:save,aiming:false,revealing:false,catchProcessEvent:null,spotUnlocked,spotChronicleView,
  castPreset:()=>({x:0,y:0}),castAimChoices:()=>({choices:[{id:'middle',point:{x:1,y:2}}]}),
  selectSpot(id){save.spot=id;calls.push(`spot:${id}`)},selectBait(id){save.bait=id;calls.push(`bait:${id}`)},
  beginCastAim(){calls.push('aim');return true},setAimPoint(point){calls.push(`point:${point.x}`)},update(){calls.push('update')}});
 vm.runInContext(source.slice(start,end),context);
 assert.equal(vm.runInContext("prepareSpotPlan('bridge')",context),true);
 assert.deepEqual(calls,['spot:bridge','bait:worm','aim','point:1','update']);
 assert.equal(save.casts,0);assert.equal(save.pending,null);
 calls.length=0;save.pending={phase:'cast'};
 assert.equal(vm.runInContext("prepareSpotPlan('deep')",context),false);assert.deepEqual(calls,[]);
 save.pending=null;assert.equal(vm.runInContext("prepareSpotPlan('missing')",context),false);
});

test('map spot selection shows a factual latest result and never invents an encounter',()=>{
 const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
 const start=source.indexOf('function selectSpot(id){'),end=source.indexOf('\n',start);
 assert.ok(start>=0&&end>start);
 const save=newSave(),focus=[],observation={textContent:''},warnings=[];save.knowledge=7;
 save.waterChronicle=addWaterChronicleMoment(save.waterChronicle,{...moment(1,'bridge','near-miss','perch'),bait:'worm'});
 const context=vm.createContext({state:save,SPOTS,spotUnlocked,explorationProgress:()=>save.knowledge,
  catchProcessEvent:null,selectedWaterQuestionId:null,aimPoint:null,focusSpot:null,focusPulseAt:0,
  toast(message){warnings.push(message)},ensureAudio:()=>Promise.resolve(),sound(){},tripRoute:{focusSpot(id){focus.push(id)}},
  save(){},renderSetup(){},selectionNotice(){},spotChronicleView,$:()=>observation,update(){}});
 vm.runInContext(source.slice(start,end),context);
 vm.runInContext("selectSpot('bridge')",context);
 assert.equal(save.spot,'bridge');assert.deepEqual(focus,['bridge']);
 assert.match(observation.textContent,/红鳍鲈.*靠近过/);
 assert.doesNotMatch(observation.textContent,/大鱼绕行/);
 save.pending={phase:'cast'};vm.runInContext("selectSpot('deep')",context);assert.equal(save.spot,'bridge');
 save.pending=null;vm.runInContext("selectSpot('unknown')",context);assert.equal(save.spot,'bridge');
 save.knowledge=0;vm.runInContext("selectSpot('deep')",context);assert.equal(save.spot,'bridge');assert.equal(warnings.length,1);
});
