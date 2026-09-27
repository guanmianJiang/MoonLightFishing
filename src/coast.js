import {renderSettings as settings,glslNumber,settingsGLSL} from './render-settings.js';
import * as T from './three.module.js';

const shoreRetreat=x=>Math.min(1800,Math.max(0,Math.abs(x)-18)**2*.018);
export const shore = x => -3.8 + Math.sin(x * .22) * .85 + Math.cos(x * .51) * .24-shoreRetreat(x);
export const shoreGLSL = `${settingsGLSL}
float shoreRetreat(float x){float f=max(abs(x)-18.,0.);return min(1800.,f*f*.018);}
float shoreRetreatSlope(float x){float f=max(abs(x)-18.,0.);return f*f*.018<1800.?-.036*f*sign(x):0.;}
float shore(float x){return -3.8+sin(x*.22)*.85+cos(x*.51)*.24-shoreRetreat(x);}
float shoreSlope(float x){return .187*cos(x*.22)-.1224*sin(x*.51)+shoreRetreatSlope(x);}
float seabedHeight(vec2 p){
 float d=max(0.,p.y-shore(p.x));
 float descent=.105*d+.48*(1.-exp(-d/16.));
 float nearFade=smoothstep(0.,6.,d);
 float shelf=.12*exp(-pow((p.x+11.)/21.,2.)-pow((d-15.)/15.,2.));
 float hollow=-.075*exp(-pow((p.x-14.)/23.,2.)-pow((d-25.)/24.,2.));
 return .14-min(24.,descent)+nearFade*(shelf+hollow);
}
float shoreEventDuration(){return uSetting_shorePeriod;}
// Shared world-space bathymetry drift. Large wavelengths and slow phase motion
// keep it readable in shallow water without turning it into surface grain.
float lowFrequencyDepthNoise(vec2 p,float t){
 float a=sin(dot(p,vec2(.155,.061))+t*.072);
 float b=sin(dot(p,vec2(-.074,.128))-t*.051+1.73);
 float c=sin(dot(p,vec2(.038,-.047))+t*.029+2.41);
 return (a*.50+b*.32+c*.18);
}
float shoreEventDelay(float x){return .16*sin(x*.31)+.08*sin(x*.73+1.4);}
float shoreEventPhase(float x,float t){return fract((t-shoreEventDelay(x))/shoreEventDuration());}
float shoreEventCycle(float x,float t){return floor((t-shoreEventDelay(x))/shoreEventDuration());}
float shoreCycleAmplitude(float x,float cycle){return .88+.12*sin(cycle*2.17+x*.19+sin(x*.37));}
float shoreEventSurge(float phase){
 if(phase<.12)return 0.;
 if(phase<.43){float q=(phase-.12)/.31;return 1.-pow(1.-q,3.);}
 if(phase<.50)return 1.;
 if(phase<.94){float q=(phase-.50)/.44;return 1.-q*q*q*(q*(q*6.-15.)+10.);}
 return 0.;
}
float shoreRushMask(float phase){return smoothstep(.12,.16,phase)*(1.-smoothstep(.43,.50,phase));}
float shoreFoamLife(float phase){return smoothstep(.15,.24,phase)*(1.-smoothstep(.60,.92,phase));}
// Horizontal metres; static variation shared by wet sand and the water film.
float shoreRunupDistance(vec2 p){
 float d=p.y-shore(p.x),s=shoreSlope(p.x);
 float shape=.045*sin(p.x*1.13+p.y*.73)+.025*sin(p.x*2.91-p.y*1.31);
 return -d/sqrt(1.+s*s)+shape*smoothstep(0.,.30,-d);
}
float shoreRunupReach(float x,float t){return mix(-.12,uSetting_shoreReach*shoreCycleAmplitude(x,shoreEventCycle(x,t)),shoreEventSurge(shoreEventPhase(x,t)));}
float shoreRunupContactD(float x,float t){return -shoreRunupReach(x,t);}
// Signed horizontal metres from the moving water contact, positive seaward.
// Use the same un-noised front as shoreWaterHeight, so its optical width does
// not expand when the water/terrain height gradient flattens on retreat.
float shoreContactDistance(vec2 p,float t){
 float s=shoreSlope(p.x);
 return (p.y-shore(p.x))/sqrt(1.+s*s)+shoreRunupReach(p.x,t);
}
// Height and derivative of the nearshore liquid cross-section. Both stages
// use this same curve so geometric lift, refraction and highlights agree.
vec2 shoreMeniscusCurve(float normalized,float crownPosition){
 float x=clamp(normalized,0.,1.),crown=clamp(crownPosition,.12,.55);
 float riseU=clamp(x/crown,0.,1.);
 float rise=sqrt(max(riseU*(2.-riseU),0.));
 float riseSlope=(1.-riseU)/(crown*max(rise,.12));
 float fallU=clamp((x-crown)/(1.-crown),0.,1.);
 float fall=1.-fallU*fallU*(3.-2.*fallU);
 float fallSlope=-6.*fallU*(1.-fallU)/(1.-crown);
 return x<=crown?vec2(rise,riseSlope):vec2(fall,fallSlope);
}
float shoreRunupCoverage(vec2 p,float t,float footprint){
 return smoothstep(0.,max(.62,footprint*1.5),shoreRunupReach(p.x,t)-shoreRunupDistance(p));
}
// Raise the actual sea to the sand height at the current runup front.
// The same displacement drives water geometry, contact optics and wet sand.
float shoreWaterHeight(vec2 p,float t){
 float d=p.y-shore(p.x);
 float reach=shoreRunupReach(p.x,t);
 float contactD=-reach*sqrt(1.+pow(shoreSlope(p.x),2.));
 float z=shore(p.x)+contactD;
 float ripple=sin(p.x*.31+z*.13)*.075+sin(p.x*.12-z*.27+1.8)*.045;
 float height=contactD<0.?-contactD*.115+ripple*min(1.,-contactD/1.8):seabedHeight(vec2(p.x,z))-.14;
 return height*(1.-smoothstep(1.,7.,d));
}
float sandWetness(vec3 p,float t,float footprint){
 // A broad persistent wet footprint, independent from the narrow foam band.
 float distanceToSea=shoreRunupDistance(p.xz);
 float edge=max(uSetting_wetSandFeather,footprint*1.5);
 return (1.-smoothstep(uSetting_wetSandReach-edge,uSetting_wetSandReach+edge,distanceToSea))*uSetting_wetSandStrength;
}`;
export function terrainY(x,z){
 const d=z-shore(x);
 const broad=Math.sin(x*.31+z*.13)*.075+Math.sin(x*.12-z*.27+1.8)*.045;
 const shoreBlend=Math.min(1,Math.abs(d)/1.8);
 if(d>=0){
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
  const descent=.105*d+.48*(1-Math.exp(-d/16));
  const nearFade=smooth(0,6,d);
  const shelf=.12*Math.exp(-Math.pow((x+11)/21,2)-Math.pow((d-15)/15,2));
  const hollow=-.075*Math.exp(-Math.pow((x-14)/23,2)-Math.pow((d-25)/24,2));
  return .14-Math.min(24,descent)+nearFade*(shelf+hollow);
 }
 const inland=-d,backshore=Math.max(0,inland-2);
 const rise=.115*Math.min(inland,2)+2.6*(1-Math.exp(-backshore/24));
 const duneT=Math.min(1,Math.max(0,(inland-4)/14));
 const duneFade=duneT*duneT*(3-2*duneT);
 const farFade=1-Math.min(1,Math.max(0,(inland-100)/100));
 const dune=(Math.sin(x*.13+inland*.08)+.45*Math.sin(x*.31-inland*.06+1.1))*.34*duneFade*farFade;
 const nearRidge=inland-(10+2.2*Math.sin(x*.105+.6));
 const backRidge=inland-(30+4.5*Math.sin(x*.075-1.1));
 const ridgeT=Math.min(1,Math.max(0,(inland-1.5)/2.5)),ridgeGate=ridgeT*ridgeT*(3-2*ridgeT);
 const sandRidges=ridgeGate*((.62+.12*Math.sin(x*.18))*Math.exp(-nearRidge*nearRidge/55)
  +(1.12+.18*Math.sin(x*.09+1.4))*Math.exp(-backRidge*backRidge/260));
 return .14+rise+broad*shoreBlend+dune+sandRidges;
}
// A continuous grid: 25 cm near the pier, exponentially larger cells offshore.
// Shore-relative rows preserve the same continuous coastline at every density.
export function coastGeometry(water=false,{shoreMin=-Infinity,shoreMax=Infinity,stride=1,shoreDense=false}={}){
 let axis=[];
 for(let i=-96;i<=96;i++)axis.push(i*.25);
 for(let d=24.5,step=.5;d<12000;d+=step,step*=1.075){axis.push(d);axis.unshift(-d);}
 const sampleAxis=near=>axis.filter((v,i)=>stride<=1||i%stride===0||i===axis.length-1||Math.abs(v)<=near);
 // Preserve 25 cm cells where the moving water intersects sand, but keep
 // the decimated grid away from the visible coastline.
 const xAxis=sampleAxis(shoreDense&&!water?24:0);
 const rowAxis=sampleAxis(shoreDense&&!water?3:0);
 // A film uses the exact terrain grid cells, but only in its narrow shore strip.
 // The optical meniscus is only ~40 cm wide; the sea needs a few-centimetre
 // shore strip to carry its real curve. Do not densify the sand or far sea.
 const waterRows=water?[...rowAxis,...Array.from({length:49},(_,i)=>-1.2+i*.05)].sort((a,b)=>a-b)
  .filter((d,i,all)=>i===0||d-all[i-1]>1e-4):rowAxis;
 const rows=waterRows.filter(d=>d>=shoreMin&&d<=shoreMax);
 const n=xAxis.length,positions=[],uvs=[],indices=[];
 for(let j=0;j<rows.length;j++)for(let i=0;i<n;i++){
  const x=xAxis[i],z=rows[j]+shore(x);
  positions.push(x,water?.14:terrainY(x,z),z);uvs.push(x*.65,z*.65);
 }
 for(let j=0;j<rows.length-1;j++)for(let i=0;i<n-1;i++){
  const a=j*n+i;indices.push(a,a+n,a+1,a+1,a+n,a+n+1);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
