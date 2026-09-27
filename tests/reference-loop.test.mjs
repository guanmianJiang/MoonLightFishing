import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,migrateSave,processCatch,finishCast,makeCast} from '../dist/engine.mjs';
import {createFight,stepFight,pumpOpportunity,pumpRod,saleValue,sellBasket,buyUpgrade} from '../dist/reference-loop.mjs';

test('an old save gains an empty wallet without losing its progress',()=>{
 const save=newSave();save.knowledge=4;delete save.economy;
 const migrated=migrateSave(save);
 assert.equal(migrated.knowledge,4);assert.equal(migrated.economy.coins,0);assert.deepEqual(migrated.economy.basket,[]);
});

test('a catch can be stored, sold once, and used to buy an upgrade',()=>{
 const save=newSave();save.pending=makeCast(save,1000,()=>.5);finishCast(save);
 const catchValue=saleValue(save.pending.catch);
 assert.equal(processCatch(save,'basket').action,'basket');
 assert.equal(save.economy.basket.length,1);
 assert.equal(processCatch(save,'basket'),null);
 const sold=sellBasket(save.economy);
 assert.deepEqual(sold,{earned:catchValue,count:1});
 assert.equal(sellBasket(save.economy).earned,0);
 save.economy.coins=120;
 assert.equal(buyUpgrade(save.economy,'reel').ok,true);
 assert.equal(save.economy.coins,0);
 assert.equal(save.economy.upgrades.reel,1);
});

test('releasing on high load can land a fish, while no input eventually loses it',()=>{
 const fight=createFight({weight:2});
 for(let i=0;i<4500&&fight.status==='active';i++){
  stepFight(fight,fight.tension<.72,.016);
 }
 assert.equal(fight.status,'won');
 const idle=createFight({weight:2});
 for(let i=0;i<5000&&idle.status==='active';i++)stepFight(idle,false,.016);
 assert.equal(idle.status,'lost');
});

test('holding winds in line while the fish swims on its own path',()=>{
 const pulling=createFight({weight:2}),releasing=createFight({weight:2});
 stepFight(pulling,true,.08);stepFight(releasing,false,.08);
 assert.equal(pulling.fishPosition,releasing.fishPosition);
 assert.ok(pulling.lineLength<releasing.lineLength);
 assert.ok(pulling.reelTurns>releasing.reelTurns);
 assert.ok(pulling.spoolVelocity<0);
 assert.equal(releasing.spoolVelocity,0);
 assert.equal(pulling.tension,0,'initial slack should carry no load');
 assert.equal(pulling.held,true);
 assert.equal(releasing.held,false);
});

test('line load comes from stretch, and paying out line relieves it',()=>{
 const fight=createFight({weight:2});
 for(let i=0;i<90;i++)stepFight(fight,true,.016);
 const loaded=fight.tension,shortLength=fight.lineLength;
 assert.ok(loaded>.1);
 stepFight(fight,false,.016);
 assert.ok(fight.spoolVelocity>0,'loaded line should pay out when the player lets go');
 for(let i=0;i<45;i++)stepFight(fight,false,.016);
 assert.ok(fight.lineLength>shortLength);
 assert.ok(fight.tension<loaded);
 assert.ok(fight.slack>=0);
});

test('fixed physics step gives the same result at different display frame rates',()=>{
 const a=createFight({weight:2}),b=createFight({weight:2});
 for(let i=0;i<600;i++)stepFight(a,true,1/60);
 for(let i=0;i<1200;i++)stepFight(b,true,1/120);
 assert.ok(Math.abs(a.distance-b.distance)<.02);
 assert.ok(Math.abs(a.lineLength-b.lineLength)<.02);
});

test('a heavy fish needs pressure relief rather than an uninterrupted hold',()=>{
 const held=createFight({weight:12}),managed=createFight({weight:12});
 for(let i=0;i<5000&&held.status==='active';i++)stepFight(held,true,.016);
 for(let i=0;i<5000&&managed.status==='active';i++)stepFight(managed,managed.tension<.72,.016);
 assert.equal(held.status,'lost');
 assert.equal(managed.status,'won');
});

test('a common fish telegraphs a run and rewards releasing during it',()=>{
 const held=createFight({weight:2}),managed=createFight({weight:2});
 const states=new Set();
 for(let i=0;i<5000&&held.status==='active';i++){states.add(held.fishState);stepFight(held,true,.016)}
 for(let i=0;i<5000&&managed.status==='active';i++)stepFight(managed,managed.fishState!=='run'&&managed.load<.66,.016);
 assert.ok(states.has('windup')&&states.has('run'));
 assert.equal(held.status,'lost');
 assert.equal(managed.status,'won');
 assert.ok(managed.stamina<1);
});

test('a human-paced hold and release lands a common heavy fish without rapid tapping',()=>{
 const fight=createFight({weight:6});let held=true,modeTime=0,switches=0;
 for(let i=0;i<2000&&fight.status==='active';i++){
  if(held&&fight.load>.68&&modeTime>.35){held=false;modeTime=0;switches++}
  else if(!held&&fight.load<.36&&modeTime>.45){held=true;modeTime=0;switches++}
  stepFight(fight,held,.016);modeTime+=.016;
 }
 assert.equal(fight.status,'won');
 assert.ok(fight.elapsed<25);
 assert.ok(switches<=10);
});

test('one second of reeling makes visible headway',()=>{
 const fight=createFight({weight:2});
 for(let i=0;i<60;i++)stepFight(fight,true,1/60);
 assert.ok(fight.progress>.07);
});

test('an ongoing fight keeps its progress when the shorter reel distance is applied',()=>{
 const fight=createFight({weight:2});
 fight.startDistance=11;fight.distance=6.4;fight.lineLength=6.6;fight.progress=.5;
 stepFight(fight,false,0);
 assert.equal(fight.startDistance,9);
 assert.ok(Math.abs(fight.progress-.5)<.01);
 assert.ok(Math.abs(fight.lineLength-fight.distance-.2)<.01);
});

test('small fish can be reeled steadily and a large fish gives time after the warning',()=>{
 const small=createFight({weight:.5});
 for(let i=0;i<1000&&small.status==='active';i++)stepFight(small,true,.016);
 assert.equal(small.status,'won');
 const large=createFight({weight:12});let firstWarning=null;
 for(let i=0;i<1000&&large.status==='active';i++){
  stepFight(large,true,.016);
  if(firstWarning===null&&large.load>.68)firstWarning=large.elapsed;
 }
 assert.equal(large.status,'lost');
 assert.ok(large.elapsed-firstWarning>.8);
});

test('lifting the rod needs an opening and creates a measurable pull on the fish',()=>{
 const ordinary=createFight({weight:2}),lifted=createFight({weight:2});
 assert.equal(pumpOpportunity(lifted,false).ready,true);
 assert.equal(pumpOpportunity(lifted,true).state,'reeling');
 lifted.surgeWarning=.9;
 assert.equal(pumpOpportunity(lifted,false).state,'gathering');
 lifted.surgeWarning=0;
 assert.equal(pumpRod(lifted,false).ok,true);
 assert.equal(pumpOpportunity(lifted,false).state,'lifting');
 for(let i=0;i<54;i++){stepFight(ordinary,false,.016);stepFight(lifted,false,.016)}
 assert.ok(lifted.distance<ordinary.distance-.2);
 assert.equal(lifted.pumps,1);
 assert.equal(pumpOpportunity(lifted,false).state,'lowering');
});

test('reeling after a lift keeps the gained line instead of giving it back',()=>{
 const reelOnly=createFight({weight:2}),liftThenReel=createFight({weight:2});
 assert.equal(pumpRod(liftThenReel,false).ok,true);
 for(let i=0;i<45;i++){stepFight(reelOnly,false,.016);stepFight(liftThenReel,false,.016)}
 for(let i=0;i<45;i++){stepFight(reelOnly,true,.016);stepFight(liftThenReel,true,.016)}
 assert.ok(liftThenReel.distance<reelOnly.distance-.05);
 assert.ok(liftThenReel.lineLength<reelOnly.lineLength-.1);
});

test('a timely hook starts the same fish closer to shore',()=>{
 const early=createFight({weight:2},{},{hookQuality:1});
 const late=createFight({weight:2},{},{hookQuality:.65});
 assert.ok(late.distance-early.distance>.35);
 assert.ok(early.progress>late.progress);
});
