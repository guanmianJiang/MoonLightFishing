// Draft presentation geometry only; never sends a game input or updates saves.
const fishingSurfaceCount=64;
const fishingSurfaceNumber=v=>Number.isFinite(v)?v:0;
const fishingSurfaceClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fishingSurfaceFormat=v=>Number(v.toFixed(3));

function fishingSurfaceCurve(points,i){
 const n=points.length,p=points[(i+n-1)%n],a=points[i],b=points[(i+1)%n],q=points[(i+2)%n];
 return {a,b,c1:{x:a.x+(b.x-p.x)/6,y:a.y+(b.y-p.y)/6},c2:{x:b.x-(q.x-a.x)/6,y:b.y-(q.y-a.y)/6}};
}
function fishingSurfaceXY(p){return `${fishingSurfaceFormat(p.x)} ${fishingSurfaceFormat(p.y)}`;}
function fishingSurfaceSegment(c,reverse=false){return reverse?`C${fishingSurfaceXY(c.c2)} ${fishingSurfaceXY(c.c1)} ${fishingSurfaceXY(c.a)}`:`C${fishingSurfaceXY(c.c1)} ${fishingSurfaceXY(c.c2)} ${fishingSurfaceXY(c.b)}`;}
function fishingSurfacePath(points){
 return `M${fishingSurfaceXY(points[0])} `+points.map((_,i)=>fishingSurfaceSegment(fishingSurfaceCurve(points,i))).join(' ')+' Z';
}

export function fishingSurfaceReturn(progress){
 const p=fishingSurfaceClamp(fishingSurfaceNumber(progress),0,1);
 if(p===0)return 1;if(p===1)return 0;
 // A finite underdamped release: one perceptible reverse swing, then settle.
 const spring=t=>Math.exp(-6*t)*(Math.cos(9*t)+(6/9)*Math.sin(9*t));
 const tail=spring(1);
 return fishingSurfaceClamp((spring(p)-tail)/(1-tail),-.14,1);
}

export function fishingSurfaceGeometry({dx=0,dy=0,pressed=0,guide=false,risk=false}={}){
 let x=fishingSurfaceNumber(dx),y=fishingSurfaceNumber(dy);
 const angle=Math.atan2(y,x),length=Math.min(18,Math.hypot(x,y)*.375);
 x=length?Math.cos(angle)*length:0;y=length?Math.sin(angle)*length:0;
 const press=fishingSurfaceClamp(fishingSurfaceNumber(pressed),0,1),thickness=7-4*press;
 const origin={x:74,y:70},center={x:origin.x+x*.35,y:origin.y+y*.35+4*press};
 const top=[],foot=[];
 for(let i=0;i<fishingSurfaceCount;i++){
  const theta=i*2*Math.PI/fishingSurfaceCount,c=Math.cos(theta),s=Math.sin(theta);
  const r=1/Math.pow(Math.pow(Math.abs(c)/60,4)+Math.pow(Math.abs(s)/54,4),.25);
  // Rear edge stays at the attachment point; side and leading edges deform continuously.
  const dot=length?(c*x+s*y)/length:0,weight=length?Math.pow((1+dot)/2,2):0;
  const base={x:origin.x+c*r,y:origin.y+s*r};
  const nx=length?-y/length:0,ny=length?x/length:0;
  const transverse=(c*r*nx+s*r*ny)*.05*(length/18);
  // Squash and lateral bulge belong to the face, never a detached moving block.
  top.push({x:origin.x+c*r*(1+.018*press)-nx*transverse+x*weight,y:origin.y+s*r*(1-.025*press)-ny*transverse+y*weight+4*press});
  foot.push({x:base.x+x*weight*.15,y:base.y+y*weight*.15+7});
 }
 const inset=top.map(p=>({x:center.x+(p.x-center.x)*.945,y:center.y+(p.y-center.y)*.945}));
 // Every wall patch shares its exact top and bottom boundary curves with those surfaces.
 const wallPath=top.map((_,i)=>{
  const t=fishingSurfaceCurve(top,i),b=fishingSurfaceCurve(foot,i);
  return `M${fishingSurfaceXY(t.a)} ${fishingSurfaceSegment(t)} L${fishingSurfaceXY(b.b)} ${fishingSurfaceSegment(b,true)} Z`;
 }).join(' ');
 const edgeAngle=length>2?angle:risk?Math.PI/2:-Math.PI/2;
 const edge=[];
 for(let i=0;i<=12;i++){
  const theta=edgeAngle-.36+i*.06,index=((theta/(2*Math.PI)*64)%64+64)%64;
  const j=Math.floor(index),a=inset[j],b=inset[(j+1)%64],f=index-j;
  edge.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
 }
 const edgePath='M'+edge.map(fishingSurfaceXY).join(' L');
 return {offset:{x,y},center,top,foot,inset,wallPath,facePath:fishingSurfacePath(top),innerPath:fishingSurfacePath(inset),footPath:fishingSurfacePath(foot),edgePath,edgeVisible:!!risk||!!guide||length>2,thickness,light:{x1:28-x*.8,y1:16-y*.8,x2:118+x*.5,y2:126+y*.5}};
}
