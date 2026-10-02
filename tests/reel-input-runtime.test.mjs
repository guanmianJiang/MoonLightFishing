import test from 'node:test';
import assert from 'node:assert/strict';
import {reelInputSample as sample} from './helpers/reel-input-runtime-sample.mjs';

test('real pointer binding drives all directions and side input without bypassing lift lane',()=>{
 const s=sample();s.down(7);assert.equal(s.snapshot().held,true);assert.equal(s.nodes.fightHold.attributes['aria-pressed'],'true');
 for(const [dx,dy] of [[-60,0],[60,0],[-40,-40],[40,40]]){
  s.move(dx,dy,7);assert.equal(s.snapshot().gesture.lifted,false);assert.equal(s.snapshot().held,true);
  assert.ok(Math.abs(parseFloat(s.styles['--grip-x']))>0);
 }
 s.move(0,24,7);assert.equal(s.snapshot().gesture.paying,true);assert.equal(s.snapshot().held,false);
 s.move(0,11,7);assert.equal(s.snapshot().held,false);s.move(0,10,7);assert.equal(s.snapshot().held,true);
});
test('engine accepted lift alone confirms and return-to-center resumes the same captured input',()=>{
 const s=sample();s.down();s.move(0,-42);assert.equal(s.state.pending.fight.pumps,0);
 s.move(31,-60);assert.equal(s.state.pending.fight.pumps,0);
 s.move(0,-43);assert.equal(s.state.pending.fight.pumps,1);assert.equal(s.snapshot().held,false);assert.equal(s.snapshot().gesture.lifted,true);
 assert.equal(s.nodes.confirm.hidden,false);s.move(0,-60);assert.equal(s.state.pending.fight.pumps,1);
 s.move(0,-12);assert.equal(s.snapshot().held,true);
 s.up();assert.equal(s.snapshot().held,false);assert.equal(s.snapshot().gesture,null);
 const pumps=s.state.pending.fight.pumps;s.tick(147);s.tick(420);assert.equal(s.state.pending.fight.pumps,pumps);assert.equal(s.frames(),0);
});
test('engine rejection never confirms or leaves a false lifted gesture',()=>{
 const s=sample({reject:true});s.down();s.move(0,-60);
 assert.equal(s.state.pending.fight.pumps,0);assert.equal(s.snapshot().gesture.lifted,false);assert.equal(s.snapshot().held,true);
 assert.equal(s.nodes.confirm.hidden,true);assert.equal(s.nodes.correction.textContent,'先收紧');
 assert.ok(s.calls.some(c=>c[0]==='haptic'&&c[1]==='invalid'));
});
test('second pointer cannot replace or release the captured gesture',()=>{
 const s=sample();s.down(1);s.down(2);s.move(-60,0,2);s.up('pointerup',2);
 assert.equal(s.snapshot().gesture.pointerId,1);assert.equal(s.snapshot().held,true);assert.equal(s.styles['--grip-x'],'0px');
 s.move(-60,0,1);s.up();assert.equal(s.snapshot().held,false);assert.equal(s.frames(),1);
 s.down(3);assert.equal(s.frames(),0);assert.equal(s.snapshot().gesture.pointerId,3);
});
test('cancel, lost capture, blur and background stop physical hold, sound and animation',()=>{
 for(const cancel of [s=>s.up('pointercancel'),s=>s.up('lostpointercapture'),s=>s.blur(),s=>s.hide()]){
  const s=sample();s.down();s.move(0,-60);cancel(s);
  assert.equal(s.snapshot().held,false);assert.equal(s.snapshot().gesture,null);assert.equal(s.frames(),0);assert.equal(s.nodes.confirm.hidden,true);
  assert.ok(s.calls.some(c=>c[0]==='stop-audio'));assert.equal(s.styles['--grip-depth'],'0px');
 }
});
test('same strike touch enters real reeling hold; object retrieval remains one tap',()=>{
 const strike=sample({mode:'strike'});strike.down();assert.equal(strike.calls.filter(c=>c[0]==='reel').length,1);assert.equal(strike.snapshot().held,true);assert.equal(strike.snapshot().gesture.pointerId,1);
 const retrieval=sample({mode:'retrieve'});retrieval.down();assert.equal(retrieval.calls.filter(c=>c[0]==='reel').length,1);assert.equal(retrieval.snapshot().gesture,null);assert.equal(retrieval.frames(),0);
});
test('real danger and stale slack opportunity suppress the lift guidance',()=>{
 const s=sample();s.state.pending.fight.load=.9;s.down();assert.equal(s.root.dataset.load,'danger');assert.equal(s.nodes.confirm.hidden,true);assert.equal(s.nodes.correction.textContent,'松手');
 const t=sample();t.state.pending.fight.slack=.5;t.down();assert.equal(t.nodes.edge.attributes.opacity,'0','slack cannot advertise an upper opportunity');
});
