import {fishingSurfaceGeometry,fishingSurfaceReturn} from '../reel-surface.mjs';

// Presentation only. The gesture button and all engine inputs remain owned by the app.
export function createReelSurfaceView(root,{requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,now=()=>performance.now(),motion=matchMedia('(prefers-reduced-motion: reduce)')}={}){
 const nodes=Object.fromEntries(['face','wall','inner','shadow','edge','light','wall-tone','correction','confirm'].map(k=>[k,root.querySelector('[data-reel="'+k+'"]')]));
 let state={mode:'strike',dx:0,dy:0,pressed:false,guide:false,risk:false,result:false,correction:''},frame=0,returning=null,lastGeometry='';
 const attr=(n,k,v)=>{const value=String(v);if(n.getAttribute(k)!==value)n.setAttribute(k,value);};
 function paint(x=state.dx,y=state.dy,pressure=state.pressed?1:0){
  const key=[x,y,pressure,state.guide,state.risk].join('|');
  if(key===lastGeometry)return;lastGeometry=key;
  const g=fishingSurfaceGeometry({dx:x,dy:y,pressed:pressure,guide:state.guide,risk:state.risk});
  for(const [name,path] of Object.entries({face:g.facePath,wall:g.wallPath,inner:g.innerPath,shadow:g.footPath,edge:g.edgePath}))attr(nodes[name],'d',path);
  attr(nodes.edge,'opacity',g.edgeVisible?1:0);attr(nodes.edge,'stroke',state.risk?'#ad634c':'#fff1cb');
  attr(nodes['wall-tone'],'stop-color',state.risk?'#bf7b61':'#b28b59');
  for(const [key,value] of Object.entries(g.light))attr(nodes.light,key,value);
  root.style.setProperty('--grip-x',g.offset.x*.35+'px');root.style.setProperty('--grip-y',g.offset.y*.35+'px');
  root.style.setProperty('--grip-depth',Math.max(0,Math.min(1,pressure))*4+'px');root.style.setProperty('--grip-tilt',g.offset.x*.3+'deg');
 }
 function stop(){cancelFrame(frame);frame=0;returning=null;}
 function update(input={}){
  const mode=['strike','reel','retrieve'].includes(input.mode)?input.mode:'hidden';
  if(mode!==state.mode||input.pressed||mode==='hidden')stop();
  state={mode,dx:mode!=='hidden'&&Number.isFinite(input.dx)?input.dx:0,dy:mode!=='hidden'&&Number.isFinite(input.dy)?input.dy:0,pressed:mode!=='hidden'&&!!input.pressed,guide:mode==='reel'&&!!input.guide&&!input.risk,risk:mode==='reel'&&!!input.risk,result:mode!=='hidden'&&!!input.result&&!input.risk,correction:typeof input.correction==='string'?input.correction:''};
  root.dataset.load=state.risk?'danger':'steady';
  nodes.confirm.hidden=!state.result;
  if(nodes.correction.textContent!==state.correction)nodes.correction.textContent=state.correction;
  nodes.correction.hidden=!state.correction||mode==='hidden';
  if(returning)paint(returning.x,returning.y,returning.pressure);else paint();
 }
 function release({dx=state.dx,dy=state.dy,cancelled=false}={}){
  stop();state={...state,dx:0,dy:0,pressed:false};
  if(cancelled||motion?.matches||state.mode!=='reel'){paint();return;}
  const offset=fishingSurfaceGeometry({dx,dy}).offset,start=now();
  returning={x:offset.x/.375,y:offset.y/.375,pressure:1};
  function tick(time){
   if(!returning)return;
   const p=Math.max(0,Math.min(1,(time-start)/420)),weight=fishingSurfaceReturn(p);
   returning={x:offset.x/.375*weight,y:offset.y/.375*weight,pressure:Math.pow(1-p,3)};
   paint(returning.x,returning.y,returning.pressure);
   if(p>=1){frame=0;returning=null;paint();}else frame=requestFrame(tick);
  }
  paint(returning.x,returning.y,1);frame=requestFrame(tick);
 }
 function reset(){stop();update({mode:'hidden'});}
 function motionChanged(){if(motion?.matches){stop();paint();}}
 motion?.addEventListener?.('change',motionChanged);
 paint();
 return {update,release,reset,destroy(){reset();motion?.removeEventListener?.('change',motionChanged);}};
}
