import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {GAME_RULES} from '../src/config/game-rules.mjs';
import {SPOTS,BAITS,FISH,GEAR,SHOP,WEATHERS} from '../src/data/catalog.mjs';
import {REAL_AUDIO} from '../src/data/audio-assets.mjs';
import {biteWindowForTrip,weatherAt,newSave,processHint} from '../src/engine.mjs';
import {newEconomy,addToBasket,migrateEconomy,saleValue} from '../src/reference-loop.mjs';

test('game catalog keeps stable save IDs and valid boundaries',()=>{
 for(const group of [SPOTS,BAITS,FISH,SHOP,WEATHERS]){
  const ids=group.map(item=>item.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.every(id=>/^[a-z][a-z0-9]*$/.test(id)));
 }
 assert.deepEqual(SPOTS.map(spot=>spot.id),['reed','bridge','deep']);
 assert.ok(WEATHERS.some(weather=>weather.id==='moon'),'saved weather ID remains compatible');
 for(const fish of FISH)assert.ok(fish.min>0&&fish.max>=fish.min&&fish.length>0);
 for(const slot of Object.keys(GEAR))assert.ok(GEAR[slot].length>0);
 for(const item of SHOP)assert.equal(item.levels.length,item.prices.length+1);
});

test('shared rules drive first and later trips without changing the save schema',()=>{
 assert.equal(biteWindowForTrip(1),GAME_RULES.biteWindowsMs[0]);
 assert.equal(biteWindowForTrip(2),GAME_RULES.biteWindowsMs[1]);
 assert.equal(biteWindowForTrip(100),GAME_RULES.biteWindowsMs.at(-1));
 assert.equal(weatherAt(GAME_RULES.weatherPeriodMs).id,WEATHERS[1].id);
 assert.equal(weatherAt(GAME_RULES.weatherPeriodMs*WEATHERS.length).id,WEATHERS[0].id);
 const save=newSave();
 assert.equal(save.version,GAME_RULES.saveVersion);
 assert.equal(save.trip.castsLeft,GAME_RULES.castsPerTrip);
 assert.equal(GAME_RULES.saveKey,'moonwater-v1');
 assert.ok(Object.isFrozen(GAME_RULES)&&Object.isFrozen(GAME_RULES.biteWindowsMs));
});

test('every declared audio resource is inside the published asset tree',async()=>{
 const urls=Object.values(REAL_AUDIO);
 assert.ok(urls.length>20);
 assert.equal(new Set(urls).size,urls.length);
 for(const url of urls){
  assert.match(url,/^\.\/assets\/audio\/source\/[\w.-]+$/);
  await access(new URL(`../public/${url.slice(2)}`,import.meta.url));
 }
});

test('economy limit and sale hint share the same business rule',()=>{
 const catchData={id:'carp',weight:1.2,mutation:'浅金体色'};
 assert.ok(processHint(newSave(),'basket',catchData).includes(String(saleValue(catchData))));
 const economy=newEconomy();
 for(let i=0;i<GAME_RULES.basketLimit;i++)assert.equal(addToBasket(economy,catchData),true);
 assert.equal(addToBasket(economy,catchData),false);
 assert.equal(economy.basket.length,GAME_RULES.basketLimit);
 assert.equal(migrateEconomy({...economy,basket:[...economy.basket,catchData]}).basket.length,GAME_RULES.basketLimit);
});
