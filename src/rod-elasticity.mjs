const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));

// Exact constant-load response; position and velocity survive target changes.
export function stepRodSpring(position,velocity,target,dt,frequency=14,damping=.68){
 const x=clamp(finite(position),-8,8),v=clamp(finite(velocity),-80,80),goal=clamp(finite(target),-8,8),step=clamp(dt,0,.1),omega=clamp(frequency,1,40),zeta=clamp(damping,.1,.95);
 if(step===0)return {position:x,velocity:v};
 const decay=omega*zeta,w=omega*Math.sqrt(1-zeta*zeta),y=x-goal,c=(v+decay*y)/w;
 const e=Math.exp(-decay*step),cos=Math.cos(w*step),sin=Math.sin(w*step),motion=y*cos+c*sin;
 return {position:goal+e*motion,velocity:e*(-decay*motion-y*w*sin+c*w*cos)};
}

export function rodStoredEnergy(bend,velocity=0){return clamp(Math.hypot(finite(bend),finite(velocity)/20)/2.4,0,1);}

// Integrate unit tangents instead of adding displacement to a straight shaft.
export function writeRodCurve(points,start,axis,pull,bend=0,lag=0,length=3.55){
 if(!points?.length)return points;
 let ax=finite(axis?.x),ay=finite(axis?.y,1),az=finite(axis?.z),norm=Math.hypot(ax,ay,az)||1;ax/=norm;ay/=norm;az/=norm;
 if(Math.hypot(ax,ay,az)<.1){ax=0;ay=1;az=0;}
 let px=finite(pull?.x),py=finite(pull?.y,-1),pz=finite(pull?.z),dot=px*ax+py*ay+pz*az;px-=dot*ax;py-=dot*ay;pz-=dot*az;
 if(Math.hypot(px,py,pz)<1e-6){dot=-ay;px=-dot*ax;py=-1-dot*ay;pz=-dot*az;if(Math.hypot(px,py,pz)<1e-6){dot=az;px=-dot*ax;py=-dot*ay;pz=1-dot*az;}}
 norm=Math.hypot(px,py,pz);px/=norm;py/=norm;pz/=norm;
 let x=finite(start?.x),y=finite(start?.y),z=finite(start?.z);
 points[0].x=x;points[0].y=y;points[0].z=z;
 const segment=clamp(length,.1,8)/Math.max(1,points.length-1),angle=Math.tanh(finite(bend)*.78)*2.15,inertia=clamp(lag,-.9,.9)*.38;
 for(let i=1;i<points.length;i++){
  const u=(i-.5)/(points.length-1),flex=clamp((u-.18)/.82,0,1),theta=angle*flex*flex+inertia*Math.pow(flex,1.5),c=Math.cos(theta),s=Math.sin(theta);
  x+=(ax*c+px*s)*segment;y+=(ay*c+py*s)*segment;z+=(az*c+pz*s)*segment;
  points[i].x=x;points[i].y=y;points[i].z=z;
 }
 return points;
}

export function rodCameraBeat(bendVelocity,reduced=false){return reduced?0:clamp(finite(bendVelocity)/18,-1,1)*.065;}

// Pull back along the existing view direction so the elastic silhouette stays visible.
export function frameRodCamera(shot,points,aspect,fov,zoom=1){
 if(!points?.length||!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(fov)||fov<=0)return shot;
 const offset=shot.position.clone().sub(shot.aim),radius=offset.length();if(!Number.isFinite(radius)||radius<.01)return shot;
 const forward=offset.clone().multiplyScalar(-1/radius),right=forward.clone().cross({x:0,y:1,z:0}).normalize(),up=right.clone().cross(forward);
 const vertical=Math.tan(clamp(fov,10,120)*Math.PI/360)/clamp(zoom,.5,2),horizontal=vertical*aspect;
 let distance=radius;const d=shot.aim.clone();
 for(const point of points){if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))continue;d.copy(point).sub(shot.aim);const x=d.dot(right),y=d.dot(up),along=d.dot(forward);distance=Math.max(distance,Math.abs(x)/(horizontal*.86)-along,Math.abs(y)/(vertical*.82)-along);}
 shot.position.copy(shot.aim).addScaledVector(offset,distance/radius);return shot;
}

export function lossLeanTarget(base,kick){return clamp(finite(base)-clamp(kick,0,1.8)*.18,-.65,.65);}
