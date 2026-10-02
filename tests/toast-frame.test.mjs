import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/app-final.js',import.meta.url),'utf8');
function setup(withModal=false){
 const node=()=>({children:[],attributes:{},textContent:'',removed:false,setAttribute(k,v){this.attributes[k]=v},append(...items){this.children.push(...items)},remove(){this.removed=true}});
 const game=node(),modal=withModal?node():null,body=node(),created=[],timers=[],cleared=[];
 const document={body,createElement(){const element=node();created.push(element);return element},querySelector(selector){assert.equal(selector,'dialog:modal');return modal}};
 const $=selector=>selector==='#game'?game:created.findLast(item=>item.className?.startsWith('toast ')&&!item.removed);
 const context=vm.createContext({document,$,toastTimer:null,setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(id){cleared.push(id)}});
 vm.runInContext(source.slice(source.indexOf('function toast('),source.indexOf('function selectionNotice(')),context);
 return {context,game,modal,body,timers,cleared};
}

test('a notification belongs to the actual game frame rather than the viewport body',()=>{
 const {context,game,body}=setup();context.toast('鱼饵 · 蚯蚓',true,'ready');
 assert.equal(game.children.length,1);assert.equal(body.children.length,0);
 assert.equal(game.children[0].attributes.role,'status');
});

test('errors inside a native modal remain visible in that modal',()=>{
 const {context,game,modal,body}=setup(true);context.toast('收藏位已满',false,'warning');
 assert.equal(modal.children.length,1);assert.equal(game.children.length,0);assert.equal(body.children.length,0);
 assert.equal(modal.children[0].className,'toast toast-warning');
});

test('replacement and expiry preserve the existing short and standard timing',()=>{
 const {context,game,timers,cleared}=setup();
 context.toast('麦粒',true,'ready');context.toast('蚯蚓');
 assert.equal(game.children[0].removed,true);
 assert.deepEqual(timers.map(timer=>timer.ms),[1800,4000]);
 assert.equal(cleared.at(-1),1);
 timers.at(-1).fn();assert.equal(game.children[1].removed,true);
});

test('notification text remains plain text for markup-like messages',()=>{
 const {context,game}=setup();const message='<img src=x onerror=bad>&';context.toast(message);
 const toast=game.children[0];assert.equal(toast.children[1].children[1].textContent,message);
 assert.equal(toast.innerHTML,undefined);
});
