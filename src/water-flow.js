// Small, local shallow-water field. Coordinates are normalized to the patch
// radius; the surrounding sea mesh and its topology are never modified.
export function interactionDriveFromSpeed(speed){
 if(!Number.isFinite(speed)||speed<=0)return 0;
 const normalized=Math.min(1.6,Math.max(0,speed)/5);
 // Displacement still pushes water during a slow drag. Speed adds impact,
 // rather than being the only source of force.
 return .85+2.55*Math.pow(normalized/1.6,.65);
}
// Pointer events are timed samples, not a continuous path. Stamp the swept
// segment at a spacing smaller than the crest's longitudinal half-width.
export function sampleInteractionStroke(x,z,dx,dz,radius){
 const distance=Math.hypot(dx,dz);
 if(!Number.isFinite(distance)||distance<=0)return {samples:[],dirX:0,dirZ:0,step:0};
 const dirX=dx/distance,dirZ=dz/distance;
 // Three local fields can retain only the latest part of an extreme jump.
 const retained=Math.min(distance,radius*1.55);
 const count=Math.max(1,Math.ceil(retained/Math.min(.11,radius*.05)));
 const step=retained/count,startX=x-dirX*retained,startZ=z-dirZ*retained;
 const samples=Array.from({length:count},(_,i)=>({x:startX+dirX*step*(i+1),z:startZ+dirZ*step*(i+1)}));
 return {samples,dirX,dirZ,step};
}
export function createWaterFlow(size=80){
 const count=size*size,scale=(size-1)*.5,cell=1/scale;
 let height=new Float32Array(count),flowX=new Float32Array(count),flowZ=new Float32Array(count);
 let nextHeight=new Float32Array(count),nextX=new Float32Array(count),nextZ=new Float32Array(count);
 const pixels=new Float32Array(count*4);
 const swap=()=>{
  [height,nextHeight]=[nextHeight,height];
  [flowX,nextX]=[nextX,flowX];
  [flowZ,nextZ]=[nextZ,flowZ];
 };
 const sample=(field,x,z)=>{
  if(x<0||z<0||x>=size-1||z>=size-1)return 0;
  const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,k=j*size+i;
  return (field[k]*(1-fx)+field[k+1]*fx)*(1-fz)
   +(field[k+size]*(1-fx)+field[k+size+1]*fx)*fz;
 };
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const hash=(x,z)=>{let n=Math.imul(x,374761393)+Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 const noise=(x,z)=>{
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)
   +(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;
 };
 const grid=new Float32Array(size),crestNoise=new Float32Array(count),widthNoise=new Float32Array(count);
 for(let i=0;i<size;i++)grid[i]=i*cell-1;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const k=j*size+i,px=i*cell,pz=j*cell;
  crestNoise[k]=noise(px*3.8,pz*3.8)-.5;
  widthNoise[k]=.86+.28*noise(px*2.4+.7,pz*2.4);
 }
 return {
  size,pixels,
  clear(){height.fill(0);flowX.fill(0);flowZ.fill(0);nextHeight.fill(0);nextX.fill(0);nextZ.fill(0);pixels.fill(0);},
  shift(dx,dz){
   const sx=dx*scale,sz=dz*scale;
   if(Math.abs(sx)+Math.abs(sz)<1e-5)return;
   for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const k=j*size+i,x=i+sx,z=j+sz;
    nextHeight[k]=sample(height,x,z);
    nextX[k]=sample(flowX,x,z);
    nextZ[k]=sample(flowZ,x,z);
   }
   swap();
  },
  inject(x,z,dirX,dirZ,dt,strength=1){
   // A moving paddle pushes a bowed crest and pulls a wider trough behind it.
   // The opposing lobes have similar volume, so the solver carries a travelling
   // wave instead of accumulating a raised puddle around the pointer.
   const speedShape=Math.min(1,Math.max(0,(strength-.5)/2.8));
   const crestAhead=.17+.045*speedShape;
   const crestLength=.080+.012*speedShape;
   const crestWidth=.255+.020*speedShape;
   const reach=.70;
   const left=Math.max(1,Math.floor((x-reach+1)*scale));
   const right=Math.min(size-2,Math.ceil((x+reach+1)*scale));
   const bottom=Math.max(1,Math.floor((z-reach+1)*scale));
   const top=Math.min(size-2,Math.ceil((z+reach+1)*scale));
   for(let j=bottom;j<=top;j++)for(let i=left;i<=right;i++){
    const rx=grid[i]-x,rz=grid[j]-z;
    const k=j*size+i;
    const ahead=rx*dirX+rz*dirZ,side=rx*dirZ-rz*dirX;
    // Most of the square bounding box is outside both the bow and its wake.
    if(Math.abs(side)>.55||ahead<-.70||ahead>.49)continue;
    const lateral=side/crestWidth;
    const irregular=crestNoise[k];
    const envelope=Math.exp(-.5*lateral**4)*widthNoise[k];
    // A mostly transverse front with only a slight curl at its tapered tips.
    // Pulling the wings far behind the middle turns the crest into a C ring.
    const tip=Math.max(0,Math.abs(lateral)-.7);
    const bow=crestAhead-.032*lateral*lateral-.016*tip**3+.014*lateral+.035*irregular;
    const crest=Math.exp(-.5*((ahead-bow)/crestLength)**2)*envelope;
    const troughLength=crestLength*1.35;
    const drawdown=Math.exp(-.5*((ahead-bow+.17)/troughLength)**2)*envelope;
    const returnLength=crestLength*2.8;
    const returnFlow=Math.exp(-.5*((ahead-bow+.45)/returnLength)**2)*envelope;
    // Two low diagonal shoulders peel away from the back of the bow. They
    // leave a moving wake after a long drag, instead of one isolated C arc.
    const wakeSide=Math.abs(side);
    const wakeEnvelope=Math.exp(-.5*((wakeSide-.30)/.11)**2);
    const wakeLine=-.08-.70*wakeSide;
    const wakeCrest=Math.exp(-.5*((ahead-wakeLine)/.065)**2)*wakeEnvelope;
    const wakeTrough=Math.exp(-.5*((ahead-wakeLine+.10)/.095)**2)*wakeEnvelope;
    height[k]+=dt*strength*.92*(crest-drawdown*.42-returnFlow*.16
     +wakeCrest*.20-wakeTrough*.095);
    // Momentum lives mostly on the crest. A weaker return flow in the trough
    // keeps the wake moving without advecting the whole patch as one slab.
    const current=crest*.64-drawdown*.12;
    flowX[k]+=dt*strength*.55*dirX*current;
    flowZ[k]+=dt*strength*.55*dirZ*current;
   }
  },
  step(dt){
   // The sea already has broad travelling swells. Keep this small interaction
   // field in the shallow, momentum-led regime so a dragged bow does not
   // immediately radiate into a stack of perfect concentric rings.
   const c2=.26*.26,grad=.5/cell;
   // Carry the existing surface and momentum through the local velocity
   // field. A turn enters near the pointer first and bends older waves only
   // as that momentum reaches them; no global wave orientation is rotated.
   nextHeight.fill(0);nextX.fill(0);nextZ.fill(0);
   for(let j=1;j<size-1;j++)for(let i=1;i<size-1;i++){
    const k=j*size+i;
    const backX=i-flowX[k]*dt*scale;
    const backZ=j-flowZ[k]*dt*scale;
    nextHeight[k]=sample(height,backX,backZ);
    nextX[k]=sample(flowX,backX,backZ);
    nextZ[k]=sample(flowZ,backX,backZ);
   }
   swap();
   nextHeight.fill(0);nextX.fill(0);nextZ.fill(0);
   for(let j=1;j<size-1;j++)for(let i=1;i<size-1;i++){
    const k=j*size+i,x=i*cell-1,z=j*cell-1;
    const edgeLoss=smooth(.70,.99,Math.hypot(x,z));
    const damp=Math.exp(-dt*(.27+16*edgeLoss));
    nextX[k]=(flowX[k]-c2*(height[k+1]-height[k-1])*grad*dt)*damp;
    nextZ[k]=(flowZ[k]-c2*(height[k+size]-height[k-size])*grad*dt)*damp;
   }
   for(let j=1;j<size-1;j++)for(let i=1;i<size-1;i++){
    const k=j*size+i,x=i*cell-1,z=j*cell-1;
    const edgeLoss=smooth(.70,.99,Math.hypot(x,z));
    const divergence=(nextX[k+1]-nextX[k-1]+nextZ[k+size]-nextZ[k-size])*grad;
    nextHeight[k]=(height[k]-divergence*dt)*Math.exp(-dt*(.30+18*edgeLoss));
   }
   swap();
  },
  writePixels(){
   for(let k=0;k<count;k++){
    const p=k*4;
    // Soft limiting preserves a crest profile even during a fast gesture.
    pixels[p]=.25*Math.tanh(height[k]/.25);
    pixels[p+1]=Math.max(-1,Math.min(1,flowX[k]));
    pixels[p+2]=Math.max(-1,Math.min(1,flowZ[k]));
    pixels[p+3]=1;
   }
   return pixels;
  },
  sampleHeight(x,z){return sample(height,(x+1)*scale,(z+1)*scale);}
 };
}
