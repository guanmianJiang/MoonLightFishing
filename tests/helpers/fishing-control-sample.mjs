import {readFileSync} from 'node:fs';
import vm from 'node:vm';
export const fishingFragment=readFileSync(new URL('../../docs/design/prototypes/fishing-control-v6.html',import.meta.url),'utf8');
const source=fishingFragment.match(/<script>([\s\S]*?)<\/script>/)[1];

export function fishingControlSample({reduced=false}={}){
 const selectors=['#moon-grip-scene','#moon-grip-play','.moon-grip-control','.moon-grip-input','.moon-grip-correction','.moon-grip-reader','.moon-grip-action','.moon-grip-face','.moon-grip-wall','.moon-grip-inner','.moon-grip-shadow','.moon-grip-edge','#moon-surface-face','.moon-grip-wall-tone'];
 const node=()=>({textContent:'',value:'',dataset:{},attributes:{},styles:{},events:new Map(),setAttribute(k,v){this.attributes[k]=String(v);},setPointerCapture(){},addEventListener(k,fn){const list=this.events.get(k)||[];list.push(fn);this.events.set(k,list);},emit(k,args={}){for(const fn of this.events.get(k)||[])fn({preventDefault(){},...args});}});
 const nodes=Object.fromEntries(selectors.map(s=>[s,node()]));
 for(const n of Object.values(nodes))n.style={setProperty:(k,v)=>n.styles[k]=String(v)};
 const root={querySelector:s=>{if(!nodes[s])throw Error('Unknown node '+s);return nodes[s];}},window=node(),document=node(),motion=node();
 document.getElementById=id=>{if(id!=='moon-fishing-control-v6')throw Error('Wrong root');return root;};motion.matches=reduced;window.matchMedia=()=>motion;
 let nextId=0;const frames=new Map(),timers=new Map();
 vm.runInNewContext(source,{document,window,setTimeout:fn=>{const id=++nextId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{const id=++nextId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 const input=nodes['.moon-grip-input'],control=nodes['.moon-grip-control'];
 const choose=value=>{nodes['#moon-grip-scene'].value=value;nodes['#moon-grip-scene'].emit('change');};
 return {nodes,input,control,choose,window,document,motion,
  down:(pointerId=1)=>input.emit('pointerdown',{pointerId,clientX:100,clientY:100}),
  move:(dx,dy,pointerId=1)=>input.emit('pointermove',{pointerId,clientX:100+dx,clientY:100+dy}),
  up:(type='pointerup',pointerId=1)=>input.emit(type,{pointerId}),
  play:()=>nodes['#moon-grip-play'].emit('click'),
  tick:time=>{const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(time);},
  expire:()=>{const batch=[...timers.values()];timers.clear();for(const fn of batch)fn();},
  frameCount:()=>frames.size,
 };
}
