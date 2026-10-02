import {createReelSurfaceView} from '../../src/ui/reel-surface-view.mjs';

export function reelSurfaceSample(){
 const nodes={},styles={};let writes=0,time=0,next=0;const frames=new Map(),listeners=new Map();
 const node=()=>({attributes:{},textContent:'',hidden:true,getAttribute(k){return this.attributes[k];},setAttribute(k,v){writes++;this.attributes[k]=String(v);}});
 for(const k of ['face','wall','inner','shadow','edge','light','wall-tone','correction','confirm'])nodes[k]=node();
 const root={dataset:{},style:{setProperty(k,v){styles[k]=v;}},querySelector(selector){const key=selector.match(/"(.+)"/)[1];if(!nodes[key])throw Error('Unknown node '+key);return nodes[key];}};
 const motion={matches:false,addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}};
 const view=createReelSurfaceView(root,{requestFrame:f=>{frames.set(++next,f);return next;},cancelFrame:id=>frames.delete(id),now:()=>time,motion});
 return {nodes,root,styles,view,motion,writes:()=>writes,frames:()=>frames.size,tick(t){time=t;const batch=[...frames.values()];frames.clear();for(const f of batch)f(t);},reduce(){motion.matches=true;listeners.get('change')();}};
}
