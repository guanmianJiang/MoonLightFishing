import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
function setup(pending=null) {
  const state={pending},nodes=new Map(),calls=[];
  const $=id=>{
    if(!nodes.has(id))nodes.set(id,{open:false,showModal(){calls.push('modal');this.open=true},close(){this.open=false},focus(){calls.push(id)}});
    return nodes.get(id);
  };
  const context=vm.createContext({state,$,catchProcessEvent:null,tab:'basket',renderBook(){calls.push('render')},toast(message){calls.push(message)}});
  vm.runInContext(source.slice(source.indexOf('function showBook('),source.indexOf("$('#journal').onclick=")),context);
  return {context,$,state,calls};
}

test('opening the journal starts on water exploration and isolates underlying touch input',()=>{
  const {context,$,calls,state}=setup();
  $('#tripDetails').open=true;$('#tripEnd').open=true;
  context.showBook();
  assert.equal(context.tab,'water');
  assert.equal($('#book').open,true);
  assert.equal($('#tripDetails').open,false);
  assert.equal($('#tripEnd').open,false);
  assert.deepEqual(calls,['render','modal','#closeBook']);
  assert.equal(state.pending,null);
});

test('an already open journal can switch page without opening a second modal',()=>{
  const {context,calls}=setup();
  context.showBook('collection');context.showBook('clues');
  assert.equal(context.tab,'clues');
  assert.equal(calls.filter(call=>call==='modal').length,1);
});

test('an active fight rejects the journal without releasing the fish or changing the page',()=>{
  const pending={phase:'cast',fight:{status:'active'}};
  const {context,$,state,calls}=setup(pending);
  context.showBook();
  assert.equal($('#book').open,false);
  assert.equal(state.pending,pending);
  assert.equal(context.tab,'basket');
  assert.deepEqual(calls,['先完成这次收线。']);
});

test('a short catch handling motion finishes before another journal page can cover it',()=>{
 const {context,$,calls}=setup();context.catchProcessEvent={action:'release'};
 context.showBook();assert.equal($('#book').open,false);assert.equal(calls.length,0);
 context.catchProcessEvent=null;context.showBook();assert.equal($('#book').open,true);
});
