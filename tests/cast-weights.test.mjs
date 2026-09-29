import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave} from '../src/engine.mjs';
import {castWeightTable} from '../src/cast-weights.mjs';
import {CAST_TUNING} from '../src/config/fishing-tuning.mjs';

test('cast weights preserve the current bait, rule, ecology and zone effects',()=>{
 const save=newSave();save.trip.rule.id='shoal';save.ecosystem.carp=1.5;
 const near=castWeightTable(save,'mist','near');
 const far=castWeightTable(save,'mist','far');
 assert.equal(near.carp,40*1.5*1.55*2*1.35);
 assert.equal(far.carp,40*1.5*1.55*2*.75);
 assert.equal(near.perch,5*.72);
 assert.equal(CAST_TUNING.spotWeights.reed.carp,40);
});

test('special candidates obey clue, location, weather and bait gates',()=>{
 const save=newSave();save.spot='bridge';save.bait='grain';save.clues=['gold2'];
 assert.equal(castWeightTable(save,'mist').oldgold,undefined);
 assert.equal(castWeightTable(save,'rain').oldgold,45);
 save.spot='deep';save.bait='glow';save.clues=['moon2'];
 assert.equal(castWeightTable(save,'moon').moon,48);
});
