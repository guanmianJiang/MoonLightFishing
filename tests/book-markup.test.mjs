import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave} from '../src/engine.mjs';
import {renderBookMarkup} from '../src/ui/book-markup.mjs';

test('every journal page renders its current action and empty state',()=>{
 const save=newSave(),thumb=()=>'';
 assert.match(renderBookMarkup(save,'basket',thumb),/鱼篓还是空的/);
 assert.match(renderBookMarkup(save,'shop',thumb),/data-upgrade="rod"/);
 assert.match(renderBookMarkup(save,'collection',thumb),/当前没有收藏/);
 assert.match(renderBookMarkup(save,'gear',thumb),/data-gear-slot="rod"/);
 assert.match(renderBookMarkup(save,'water',thumb),/探索进度 0/);
 assert.match(renderBookMarkup(save,'clues',thumb),/搏鱼手记/);
});

test('tracked fish and a caught specimen remain visible in the journal',()=>{
 const save=newSave();
 save.tracked=[{id:'carp',spot:'reed',releases:1,weight:.4}];
 save.economy.basket=[{id:'carp',weight:.4,variation:'普通体色'}];
 assert.match(renderBookMarkup(save,'water',()=>''),/银背鲫/);
 assert.match(renderBookMarkup(save,'basket',()=>'/fish.png'),/data-sell="0"/);
});
