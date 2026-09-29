const clamp=(value,min=0,max=1)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):min;

export function reelSurfaceState({fight,held=false,paying=false,ready=false,visual,now=0,reducedMotion=false}={}){
 const load=clamp(fight?.load??fight?.tension);
 const surge=clamp(fight?.surge);
 const turns=Number.isFinite(fight?.reelTurns)?Math.max(0,fight.reelTurns):0;
 const scale=clamp(visual?.scale??1,1,3);
 const angle=Number.isFinite(visual?.angle)?clamp(-visual.angle,-360,360)*Math.PI/180:0;
 return {
  load,surge,turns,scale,angle,
  held:held?1:0,paying:paying?1:0,ready:ready?1:0,
  time:reducedMotion?0:Number.isFinite(now)?Math.max(0,now)/1000:0
 };
}

export function reelControlCaption({mode='reel',held=false,paying=false,lifted=false,danger=false,ready=false}={}){
 if(mode==='retrieve')return '点按收回';
 if(mode==='strike')return '按住提竿';
 if(paying)return '下压让线';
 if(lifted)return '滑回收线';
 if(danger)return '松手让线';
 if(ready)return '上提抬竿';
 return held?'正在收线':'按住收线';
}

const vertexSource=`attribute vec2 aPosition;
void main(){gl_Position=vec4(aPosition,0.0,1.0);}`;

const fragmentSource=`precision mediump float;
uniform vec2 uResolution;
uniform float uLoad,uSurge,uTurns,uScale,uAngle,uHeld,uPaying,uReady,uTime;

float ellipseDistance(vec2 p,vec2 radius){
 return (length(p/radius)-1.0)*min(radius.x,radius.y);
}

void main(){
 vec2 point=(gl_FragCoord.xy-uResolution*.5)/uResolution.y*220.0;
 float cs=cos(uAngle),sn=sin(uAngle);
 vec2 p=vec2(cs*point.x+sn*point.y,-sn*point.x+cs*point.y);
 float extension=21.0*(uScale-1.0);
 float distanceToEdge=ellipseDistance(p-vec2(extension*.5,0.0),vec2(44.0+extension*.5,44.0));
 float alpha=1.0-smoothstep(-1.2,1.4,distanceToEdge);
 if(alpha<.004)discard;

 float height=clamp((p.y+44.0)/88.0,0.0,1.0);
 vec3 deep=vec3(.055,.245,.252);
 vec3 sea=vec3(.165,.425,.409);
 vec3 color=mix(deep,sea,.18+.48*height);
 float facing=exp(-dot((p-vec2(-19.0,23.0))/vec2(45.0,39.0),(p-vec2(-19.0,23.0))/vec2(45.0,39.0)));
 color+=vec3(.080,.106,.079)*facing;

 float direction=mix(1.0,-1.0,uPaying);
 float phase=uTurns*.36+uTime*(uHeld*.63+uPaying*.36)*direction;
 float current=p.y-5.0*sin(p.x*.067+phase)-4.0*cos(p.x*.037-phase*.45);
 float flowing=exp(-pow((current+8.0)/15.0,2.0))*(.045+.095*uHeld+.075*uPaying);
 color+=vec3(.10,.19,.15)*flowing;

 float strain=smoothstep(.38,.86,uLoad)*(.68+.32*uSurge);
 color=mix(color,color+vec3(.145,.075,-.008),strain*.60);
 float rim=exp(-abs(distanceToEdge)/2.2);
 vec3 rimColor=mix(vec3(.58,.67,.56),vec3(.83,.60,.34),strain);
 color=mix(color,rimColor,rim*(.24+.19*strain+.09*uReady));
 float inner=exp(-abs(distanceToEdge+5.0)/7.0)*(.035+.06*uLoad);
 color+=vec3(.12,.16,.11)*inner;

 gl_FragColor=vec4(color*alpha,alpha);
}`;

export function createReelSurface(canvas,button){
 let gl=null,program=null,uniforms=null,failed=false,lastDraw=-Infinity;
 const names=['uResolution','uLoad','uSurge','uTurns','uScale','uAngle','uHeld','uPaying','uReady','uTime'];
 function shader(type,source){
  const item=gl.createShader(type);
  gl.shaderSource(item,source);gl.compileShader(item);
  if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){gl.deleteShader(item);return null}
  return item;
 }
 function init(){
  if(failed)return false;
  try{
   gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
   if(!gl){failed=true;return false}
   const vertex=shader(gl.VERTEX_SHADER,vertexSource),fragment=shader(gl.FRAGMENT_SHADER,fragmentSource);
   if(!vertex||!fragment){failed=true;return false}
   program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
   gl.deleteShader(vertex);gl.deleteShader(fragment);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS)){failed=true;return false}
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   gl.useProgram(program);
   const position=gl.getAttribLocation(program,'aPosition');
   gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   uniforms=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
   gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
   return true;
  }catch{failed=true;return false}
 }
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();button.classList.remove('shader-ready');gl=null;program=null;uniforms=null;lastDraw=-Infinity});
 canvas.addEventListener('webglcontextrestored',()=>{failed=false;gl=null;program=null;uniforms=null;lastDraw=-Infinity});
 return {
  render(state,{force=false}={}){
   if(!canvas.isConnected||button.parentElement?.hidden)return false;
   if(!gl&&!init())return false;
   const milliseconds=performance.now();
   if(!force&&milliseconds-lastDraw<1000/30)return true;
   try{
    const density=Math.min(1.5,Math.max(1,window.devicePixelRatio||1));
    const pixels=Math.round(220*density);
    if(canvas.width!==pixels||canvas.height!==pixels){canvas.width=pixels;canvas.height=pixels}
    gl.viewport(0,0,pixels,pixels);gl.useProgram(program);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.uResolution,pixels,pixels);
    for(const name of names.slice(1))gl.uniform1f(uniforms[name],state[name.slice(1).toLowerCase()]??0);
    gl.drawArrays(gl.TRIANGLES,0,6);
    button.classList.add('shader-ready');lastDraw=milliseconds;
    return true;
   }catch{
    button.classList.remove('shader-ready');failed=true;gl=null;
    return false;
   }
  }
 };
}
