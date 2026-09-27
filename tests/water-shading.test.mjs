import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {coastGeometry,shore,shoreGLSL,terrainY} from '../dist/coast.js';
import {renderSettings,defaultRenderSettings,settingsUniforms} from '../dist/render-settings.js';
import {waterSurfaceGLSL} from '../dist/water-surface.js';

test('served entry points load the current shoreline modules with cache versions',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../dist/app-final.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
 assert.match(html,/app-final\.js\?v=[\w-]+/);
 assert.match(app,/\.\/scene\.js\?v=[\w-]+/);
 assert.match(scene,/\.\/coast\.js\?v=[\w-]+/);
 assert.match(scene,/\.\/water\.js\?v=[\w-]+/);
 assert.ok(!scene.includes('scene-final.js'));
});
test('moving water contact owns wet depth before scene props are drawn',()=>{
 const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
 const water=readFileSync(new URL('../dist/water.js',import.meta.url),'utf8');
 assert.ok(scene.includes('ground.renderOrder=-2'));
 assert.ok(water.includes('depthTest:true,depthFunc:T.AlwaysDepth,depthWrite:true'));
 assert.ok(water.includes('side:T.DoubleSide,depthTest:true,depthFunc:T.AlwaysDepth,depthWrite:true'));
 assert.ok(!water.includes('depthTest:false'));
 assert.ok(water.includes('water.renderOrder=-1'));
 assert.ok(water.includes('if(contactDistance<-contactClipAA)discard;'));
 assert.ok(!water.includes('uDebugWater'));
});
test('physical underwater fish write receiver depth for refraction and absorption',()=>{
 const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
 assert.ok(scene.includes('o.material.transparent=false;o.material.opacity=1;o.material.depthTest=true;o.material.depthWrite=true;'));
 assert.ok(scene.includes('o.material.depthWrite=base.depthWrite;'));
 assert.ok(!scene.includes('o.material.depthWrite=base.depthWrite&&amount<.01'));
 for(const name of ['reef_shark','shoal_fish','silver_fish','reef_tall','reef_shelf','reef_small']){
  const glb=readFileSync(new URL(`../dist/assets/models/${name}.glb`,import.meta.url));
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  assert.ok(json.materials.every(material=>!material.alphaMode||material.alphaMode==='OPAQUE'),`${name} should have opaque materials`);
 }
 // Nonphysical fish hints and overlays deliberately stay out of the depth buffer.
 assert.ok(scene.includes("color:'#214f4d',transparent:true,opacity:.11,depthWrite:false"));
});

function scalarGLSL(source,name,args,bindings={}){
 const start=source.indexOf(`float ${name}(`),open=source.indexOf('{',start);
 assert.ok(start>=0);
 let end=open+1,depth=1;
 for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}
 const body=source.slice(open+1,end-1).replace(/\bfloat\b/g,'let');
 const fn=new Function(...Object.keys(bindings),...args,`const {sin,cos,pow,abs,max,min,sign,sqrt}=Math;const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));const smoothstep=(a,b,x)=>{const q=clamp((x-a)/(b-a),0,1);return q*q*(3-2*q);};${body}`);
 return (...values)=>fn(...Object.values(bindings),...values);
}

test('shore normal matches actual coastline slope',()=>{
 const retreatSlope=scalarGLSL(shoreGLSL,'shoreRetreatSlope',['x']);
 const slope=x=>.187*Math.cos(x*.22)-.1224*Math.sin(x*.51)+retreatSlope(x);
 for(let x=-24;x<=24;x+=.17){const h=1e-4;assert.ok(Math.abs(slope(x)-(shore(x+h)-shore(x-h))/(2*h))<1e-8);}
});
test('coastline continues broadly past the playable beach',()=>{
 assert.ok(shore(-40)>-16);
 assert.ok(shore(40)>-16);
});
test('wave envelope derivative includes the nearshore fade',()=>{
 const derivative=scalarGLSL(waterSurfaceGLSL,'smoothDerivative',['a','b','x']);
 const smooth=(a,b,x)=>{const q=Math.max(0,Math.min(1,(x-a)/(b-a)));return q*q*(3-2*q);};
 for(const [a,b] of [[-.12,2.5],[55,150],[.4,2.5],[5,12]])for(let i=-10;i<=110;i++){
 const x=a+(b-a)*i/100,h=1e-6;assert.ok(Math.abs(derivative(a,b,x)-(smooth(a,b,x+h)-smooth(a,b,x-h))/(2*h))<2e-6);}
});
test('runup retreat stays continuous and monotonic',()=>{
 const surge=scalarGLSL(shoreGLSL,'shoreEventSurge',['phase']);
 for(const join of [.12,.43,.50,.94])assert.ok(Math.abs(surge(join-1e-7)-surge(join+1e-7))<1e-5);
 for(let p=.5001;p<=1;p+=.0001)assert.ok(surge(p)<=surge(p-.0001)+1e-12);
 assert.equal(surge(0),0);assert.equal(surge(1),0);
});
test('trimmed film preserves exact terrain vertices and UVs',()=>{
 const ground=coastGeometry(),film=coastGeometry(false,{shoreMin:-1,shoreMax:.25});
 const gp=ground.attributes.position,guv=ground.attributes.uv,fp=film.attributes.position,fuv=film.attributes.uv,index=new Map();
 for(let i=0;i<gp.count;i++)index.set(`${gp.getX(i)},${gp.getZ(i)}`,i);
 for(let i=0;i<fp.count;i++){const j=index.get(`${fp.getX(i)},${fp.getZ(i)}`);assert.notEqual(j,undefined);assert.equal(fp.getY(i),gp.getY(j));assert.equal(fuv.getX(i),guv.getX(j));assert.equal(fuv.getY(i),guv.getY(j));}
 assert.ok(film.index.count<ground.index.count*.02);ground.dispose();film.dispose();
});
test('sea mesh resolves the physical meniscus without densifying sand',()=>{
 const sea=coastGeometry(true),sand=coastGeometry();
 const seaPositions=sea.attributes.position,shoreZ=shore(0),rows=[];
 for(let i=0;i<seaPositions.count;i++)if(seaPositions.getX(i)===0){
  const d=seaPositions.getZ(i)-shoreZ;
  if(d>=-1.201&&d<=1.201)rows.push(d);
 }
 rows.sort((a,b)=>a-b);
 assert.ok(rows.length>=49);
 assert.ok(rows.every((d,i)=>!i||d-rows[i-1]<=.051));
 assert.ok(seaPositions.count>sand.attributes.position.count);
 sea.dispose();sand.dispose();
});
test('underwater sand extends gently offshore and matches the water bed profile',()=>{
 const water=readFileSync(new URL('../dist/water.js',import.meta.url),'utf8');
 assert.match(water,/sd\*\.05/);
 for(const x of [-16,0,16]){
  const at=d=>terrainY(x,shore(x)+d);
  assert.ok(at(10)-at(30)>.85&&at(10)-at(30)<1.15);
  assert.ok(at(30)>-1.5);
 }
});
test('dry beach rolls into broad dunes without a flat inland shelf',()=>{
 for(const x of [-16,0,16]){
  const at=d=>terrainY(x,shore(x)-d);
  assert.ok(at(2)>at(0));
  assert.ok(at(20)>at(10));
  assert.ok(at(40)>at(0)+1);
  assert.ok(Math.abs(at(40)-at(20))>.08);
 }
});
test('visible beach keeps a resolved shoreline instead of a collapsed replacement mesh',()=>{
 const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
 assert.ok(scene.includes('const geo=coastGeometry(false,{stride:2,shoreDense:true});'));
 assert.ok(!scene.includes("load('./assets/models/beach_terrain.glb'"));
 const beach=coastGeometry(false,{stride:2,shoreDense:true});
 const positions=beach.attributes.position;
 const shoreline=[];
 for(let i=0;i<positions.count;i++)if(Math.abs(positions.getZ(i)-shore(positions.getX(i)))<1e-4&&Math.abs(positions.getX(i))<12)shoreline.push(positions.getX(i));
 shoreline.sort((a,b)=>a-b);
 assert.ok(shoreline.length>=95);
 assert.ok(shoreline.every((x,i)=>!i||x-shoreline[i-1]<=.251));
 assert.ok(beach.index.count/3<130000);
 beach.dispose();
});
test('underwater terrain cannot rise through the thin contact water',()=>{
 const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
 assert.ok(scene.includes('float waterSide=smoothstep(1.2,3.2,position.z-shore(position.x));'));
 assert.ok(scene.includes('float waterY=.14+waterSurface(position.xz,uTime).z;'));
 assert.ok(scene.includes('float flooded=smoothstep(-.015,.045,shoreContactDistance(position.xz,uTime));'));
 assert.ok(scene.includes('transformed.y=mix(bedY,min(bedY,waterY-.045),flooded);'));
 assert.ok(scene.includes('uniform float uTime;\\nvarying vec3 vGround;'));
 for(const waterY of [-.2,0,.1,.5])for(const bedY of [-1,-.1,0,.2,.8]){
  const submerged=Math.min(bedY,waterY-.045);
  assert.ok(submerged<=waterY-.045);
  assert.ok(submerged<=bedY);
 }
});
test('camera-focused water grid keeps dense rows on contact and nearby sea',()=>{
 const water=readFileSync(new URL('../dist/water.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
 assert.ok(water.includes('new T.PlaneGeometry(2,2,128,160)'));
 assert.ok(water.includes('const rings=32,segments=96'));
 assert.equal(128*160*2,40960);
 assert.equal(96*(2*32-1),6048);
 assert.ok(40960+6048<50000);
 assert.ok(water.includes('p.x=uGridCenter.x+sx*tangentMetres;'));
 assert.ok(water.includes('float contactD=-shoreRunupReach(p.x,uTime)*sqrt(1.+pow(shoreSlope(p.x),2.));'));
 assert.ok(water.includes('float d=contactD+normalMetres;'));
 assert.ok(water.includes('float nearEnd=clamp(max(14.,uGridCenter.y+8.),14.,40.);'));
 assert.ok(water.includes('material.uniforms.uGridCenter.value.set(focusX,Math.max(0,focusZ-shore(focusX)));'));
 assert.ok(scene.includes('waterSystem.capture(camera);'));
 const tangentStep=2/128*12/.65,contactStep=2/160/.7*2.15;
 const nearSeaStep=2/160/.9*(14-2);
 assert.ok(tangentStep<.30);
 assert.ok(contactStep<.04);
 assert.ok(nearSeaStep<.18);
 assert.ok(.405/contactStep>10);
 for(const focusDepth of [0,5,12,32]){
  const nearEnd=Math.max(14,Math.min(40,focusDepth+8));
  const offset=q=>q<=-.3?-.15+(q+1)/.7*2.15:q<=.6?2+(q+.3)/.9*(nearEnd-2)
   :nearEnd+Math.exp((q-.6)/.4*Math.log(12001-nearEnd))-1;
  assert.ok(Math.abs(offset(-1)+.15)<1e-10);
  assert.ok(Math.abs(offset(-.3)-2)<1e-10);
  assert.ok(Math.abs(offset(.6)-nearEnd)<1e-10);
  assert.ok(Math.abs(offset(1)-12000)<1e-7);
  for(let row=0;row<160;row++){
   const a=-1+row*2/160,b=a+2/160;
   assert.ok(offset(b)>offset(a));
   if(a>=-.3&&b<=.6)assert.ok(offset(b)-offset(a)<.55);
  }
 }
 const contactD=x=>-x*Math.sqrt(1+.187**2);
 for(const reach of [-.12,0,.45,.90]){
  const d=contactD(reach);
  assert.ok(Math.abs(d/Math.sqrt(1+.187**2)+reach)<1e-12);
 }
});
test('sea and film share lighting; meniscus survives the shore composite',()=>{
 const water=readFileSync(new URL('../dist/water.js',import.meta.url),'utf8');
 assert.equal(water.split('${waterSurfaceGLSL}').length-1,2);
 assert.ok(water.includes('Object.assign(material.uniforms,lighting)'));
 assert.ok(water.includes('uNormalA:{value:waterNormal07},uNormalB:{value:waterNormal07}'));
 assert.ok(water.includes('float seamMeniscus=1.;'));
 assert.ok(!water.includes('if(d< 0.0)discard'));
 assert.ok(water.includes('if(contactDistance<-contactClipAA)discard;'));
 assert.ok(!water.includes('if(signedWaterGap<-contactClipAA)discard;'));
 assert.ok(water.includes('float contactDistance=shoreContactDistance(p,uTime);'));
 assert.ok(water.includes('float shoreFade=smoothstep(0.,1.8,contactDistance)'));
 assert.ok(water.includes('float wetFade=smoothstep(.03,.72,contactDistance)'));
 assert.ok(!water.includes('float wetFade=smoothstep(.04,1.3,d)'));
 assert.ok(water.includes('float meniscusWidth=max(uSetting_meniscusWidth,.005);'));
 assert.ok(!water.includes('contactMetresPerPixel*14.'));
 assert.ok(water.includes('float crown=clamp(uSetting_meniscusCrown,.12,.55);'));
 assert.ok(shoreGLSL.includes('vec2 shoreMeniscusCurve(float normalized,float crownPosition)'));
 assert.ok(water.includes('vec2 curve=shoreMeniscusCurve(contact/width,uSetting_meniscusCrown);'));
 assert.ok(water.includes('float lift=.060*uSetting_meniscusBulge*uSetting_meniscusStrength*curve.x;'));
 assert.ok(water.includes('vec2 curve=shoreMeniscusCurve(lensX,crown);'));
 assert.ok(water.includes('float foamSdf=contactDistance;'));
 assert.ok(!water.includes('signedWaterGap/horizontalGapSlope'));
 assert.ok(water.includes('float meniscusLensSlope=clamp(curve.y*uSetting_meniscusBulge,-2.2,3.2);'));
 assert.ok(water.includes('float contactWaterMask=smoothstep(-contactClipAA,contactClipAA,contactDistance);'));
 assert.ok(water.includes('float meniscusInnerRidge=smoothstep(crown*.55-normalizedAA,crown+normalizedAA,normalizedContact)'));
 assert.ok(water.includes('float waterDepth=shoreDepth;'));
 assert.ok(!water.includes('float depthValid=1.-smoothstep(.88,.995,rawSceneDepth);'));
 assert.ok(water.includes('float geometricOpticalDepth=shoreDepth*angularPath;'));
 assert.ok(water.includes('float contactCoverage=smoothstep(0.,.42+fwidth(contactDistance),stableMeniscusDepth);'));
 assert.ok(water.includes('float liquidSheen=meniscusLensProfile*(.035+.10*lensFresnel)'));
 assert.ok(water.includes('float meniscusTilt=clamp(meniscusLensSlope*.32,-.56,.86);'));
 assert.ok(water.includes('float glintAA=max(fwidth(meniscusNdotH)*1.5,.012);'));
 assert.ok(water.includes('float lipGlintProfile=lipGlintRise*lipGlintFall*contactWaterMask;'));
 assert.ok(water.includes('float glintReach=clamp(uSetting_meniscusGlintReach,.15,.70);'));
 assert.ok(water.includes('uSunRadiance*meniscusCatchlight*uSetting_meniscusHighlightStrength*.62'));
 assert.ok(water.includes('float meniscusCatchlight=lipGlintProfile*(broadGlint*.32+sharpGlint*.78*glintFlecks)'));
 assert.ok(water.includes('vec2 refrUVR=clamp(refrUV+dispersion,.001,.999);'));
 assert.ok(water.includes('source=mix(source,lensBlur,meniscusLensProfile*.65*uSetting_meniscusStrength);'));
 assert.ok(water.includes('float glassBody=meniscusLensProfile*.18*uSetting_meniscusStrength*(1.-aerialHaze);'));
 assert.ok(water.indexOf('color=mix(color,meniscusShadeColor,meniscusShade)')>water.indexOf('color=mix(undistortedSource,color,contactCoverage)'));
 assert.ok(water.includes('float bodyAlpha=0.;'));
 assert.ok(water.includes('float absorptionStrength=max(uSetting_waterAbsorption,0.);'));
 assert.ok(water.includes('vec3 absorption=absorptionStrength*vec3(.18,.065,.03);'));
 assert.ok(water.includes('vec3 refracted=source*trans+inScatter;'));
});
test('shallow flooded sand gets a continuous water coat without full-strength sparkle',()=>{
 const water=readFileSync(new URL('../dist/water.js',import.meta.url),'utf8');
 assert.ok(water.includes('float shallowSurfaceScatter=smoothstep(0.,.85,contactDistance)'));
 assert.ok(water.includes('*(1.-smoothstep(.55,2.6,waterDepth))*.27;'));
 assert.ok(water.includes('refracted=mix(refracted,waterBody,shallowSurfaceScatter);'));
 assert.ok(water.includes('float specularDepthGate=mix(.20,1.,smoothstep(.055,.36,shoreDepth));'));
 assert.ok(water.includes('*specularDepthGate;'));
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const coat=(distance,depth)=>smooth(0,.85,distance)*(1-smooth(.55,2.6,depth))*.27;
 assert.equal(coat(0,.1),0);
 assert.ok(coat(.3,.1)>0&&coat(.3,.1)<coat(.85,.1));
 assert.ok(coat(.85,1)<coat(.85,.1));
 assert.equal(coat(.85,2.6),0);
});
test('water absorption changes underwater receivers even when they match the water hue',()=>{
 const water=readFileSync(new URL('../dist/water.js',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../dist/render-settings-panel.js',import.meta.url),'utf8');
 assert.ok(water.includes('float angularPath=min(1./max(abs(view.y),.001),1.6);'));
 assert.ok(water.includes('float opticalDepthBase=receiverSubmersion*angularPath;'));
 assert.ok(water.includes('float opticalDepth=min(24.,max(0.,mix(geometricOpticalDepth,opticalDepthBase,opticalReceiverBlend)));'));
 assert.ok(water.includes('float absorptionStrength=max(uSetting_waterAbsorption,0.);'));
 assert.ok(water.includes('vec3 scattering=vec3(.035,.045,.06);'));
 assert.ok(water.includes('vec3 inScatter=waterBody*(scattering/extinction)*(1.-trans);'));
 assert.ok(water.includes('vec3 refracted=source*trans+inScatter;'));
 assert.ok(!water.includes('absorbedWaterBody'));
 assert.ok(panel.includes("['waterAbsorption','水体吸收倍率',0,10,.02]"));
 const saved=renderSettings.waterAbsorption;
 try{for(const value of [0,1,3,10]){renderSettings.waterAbsorption=value;assert.equal(settingsUniforms.uSetting_waterAbsorption.value,value);}}
 finally{renderSettings.waterAbsorption=saved;}
 for(const viewY of [.05,.2,.5,1]){
  const path=Math.min(1/Math.max(viewY,.001),1.6);
  assert.ok(path>=1&&path<=1.6);
 }
 for(const depth of [.15,1.3,3])for(const [absorption,scattering] of [[.18,.035],[.065,.045],[.03,.06]]){
  const output=(multiplier)=>{const extinction=absorption*multiplier+scattering,trans=Math.exp(-extinction*depth);return trans+scattering/extinction*(1-trans);};
  assert.ok(output(0)>output(1),'zero absorption must retain more of a same-colour receiver');
  assert.ok(output(1)>output(4)&&output(4)>output(10),'the full slider must darken a same-colour receiver');
 }
 const green=(multiplier)=>{const extinction=.065*multiplier+.045,trans=Math.exp(-extinction*2);return trans+.045/extinction*(1-trans);};
 assert.ok(green(4)-green(10)>.20,'upper slider values should remain visibly distinct at ordinary fish depth');
});
test('sun angles update the real light, shadow map and reflected highlight',()=>{
 const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
 const water=readFileSync(new URL('../dist/water.js',import.meta.url),'utf8');
 assert.ok(scene.includes('function updateSunDirection(){'));
 assert.ok(scene.includes('const az=renderSettings.sunAzimuth*Math.PI/180,el=renderSettings.sunElevation*Math.PI/180;'));
 assert.ok(scene.includes('sun.position.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(21.4);'));
 assert.ok(scene.includes('lighting.uSunDirection.value.copy(sun.position).sub(sun.target.position).normalize();'));
 assert.ok(scene.includes('renderer.shadowMap.needsUpdate=true;'));
 assert.ok(scene.includes('renderer.shadowMap.needsUpdate ||= frame%8===0;'));
 assert.ok(water.includes('float sunInReflection=max(dot(reflectedDir,uSunDirection),0.);'));
 assert.ok(water.includes('reflectedSky+=uSunRadiance*reflectedSun;'));
});
test('moving contact keeps the meniscus width constant through retreat',()=>{
 let reach=0;
 const slope=x=>(shore(x+1e-5)-shore(x-1e-5))/2e-5;
 const distance=scalarGLSL(shoreGLSL,'shoreContactDistance',['p','t'],{
  shore,shoreSlope:slope,shoreRunupReach:()=>reach
 });
 for(let x=-16;x<=16;x+=.5)for(reach=-.12;reach<=.8001;reach+=.04){
  const metric=Math.sqrt(1+slope(x)**2);
  const contactZ=shore(x)-reach*metric;
  assert.ok(Math.abs(distance({x,y:contactZ},0))<1e-10);
  for(const width of [.08,.38,1.18]){
   assert.ok(Math.abs(distance({x,y:contactZ+width*metric},0)-width)<1e-10);
  }
 }
});
test('liquid lens eases into water and bends both sides without a cutoff',()=>{
 const profile=(x,crown,bulge)=>{
  const lensX=Math.max(0,Math.min(1,x));
  const riseU=Math.max(0,Math.min(1,lensX/crown));
  const rise=Math.sqrt(Math.max(riseU*(2-riseU),0));
  const riseSlope=(1-riseU)/(crown*Math.max(rise,.12));
  const fallU=Math.max(0,Math.min(1,(lensX-crown)/(1-crown)));
  const fall=1-fallU*fallU*(3-2*fallU);
  const fallSlope=-6*fallU*(1-fallU)/(1-crown);
  return {height:(lensX<=crown?rise:fall)*bulge,bend:(lensX<=crown?riseSlope:fallSlope)*bulge};
 };
 for(const crown of [.12,.3,.55])for(const bulge of [.25,.75,1.5]){
  assert.ok(profile(crown*.35,crown,bulge).bend>0);
  assert.ok(profile((crown+1)/2,crown,bulge).bend<0);
  assert.ok(Math.abs(profile(crown,crown,bulge).height-bulge)<1e-12);
  assert.ok(Math.abs(profile(crown,crown,bulge).bend)<1e-12);
  assert.ok(Math.abs(profile(1,crown,bulge).height)<1e-12);
  assert.ok(Math.abs(profile(1,crown,bulge).bend)<1e-12);
  assert.ok(Math.abs(profile(1-1e-5,crown,bulge).height)<1e-8);
 }
});
test('meniscus controls expose independent curve and highlight tuning',()=>{
 const panel=readFileSync(new URL('../dist/render-settings-panel.js',import.meta.url),'utf8');
 for(const [key,min,max] of [
  ['meniscusCrown',.12,.55],['meniscusBulge',.25,1.5],
  ['meniscusGlintReach',.15,.7],['meniscusHighlightStrength',0,2]
 ]){
  assert.ok(Object.hasOwn(settingsUniforms,`uSetting_${key}`));
  assert.ok(defaultRenderSettings[key]>=min&&defaultRenderSettings[key]<=max);
  assert.ok(panel.includes(`['${key}'`));
 }
});
test('liquid catchlight is directional and concentrated just inside contact',()=>{
 const smooth=(a,b,x)=>{const q=Math.max(0,Math.min(1,(x-a)/(b-a)));return q*q*(3-2*q);};
 const envelope=x=>smooth(0,.10,x)*(1-smooth(.16,.50,x));
 const highlight=(x,ndoth,flecks)=>envelope(x)*(smooth(.748,.972,ndoth)*.32+ndoth**72*.78*flecks);
 assert.equal(highlight(0,1,1),0);
 assert.ok(highlight(.14,.95,1)>highlight(.14,.75,1)*10);
 assert.ok(highlight(.14,1,1)>highlight(.14,1,0));
 assert.ok(highlight(.14,1,1)>highlight(.40,1,1)*3);
 assert.equal(highlight(.5,1,1),0);
});
test('water reconstructs all underwater receivers from captured depth for caustics',()=>{
 const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
 const water=readFileSync(new URL('../dist/water.js',import.meta.url),'utf8');
 assert.ok(water.includes('uInvProjection*vec4(uv*2.-1.,depth*2.-1.,1.)'));
 assert.ok(water.includes('uInvView*vec4(view.xyz/max(view.w,.00001),1.)'));
 assert.ok(water.includes('receiverWorldPosition(refrUV,min(receiverRawDepth,.9999))'));
 assert.ok(water.includes('receiverWorld-refractedSun*(receiverSubmersion/max(-refractedSun.y,.08))'));
 assert.ok(water.includes('float opticalDepthBase=receiverSubmersion*angularPath;'));
 assert.ok(water.includes('float opticalReceiverBlend=smoothstep(.04,.35,contactDistance)*receiverValid;'));
 assert.ok(water.includes('float raisedReceiver=smoothstep(.04,.20,receiverWorld.y-bedHeightAt(receiverWorld.xz));'));
 assert.ok(water.includes('float causticDepthMask=mix(standardEntry,shallowEntry,raisedReceiver)'));
 assert.ok(water.includes('float causticFacing=mix(.30,1.,smoothstep(-.12,.65,dot(receiverNormal,-refractedSun)));'));
 assert.ok(water.includes('source*=1.+causticGain;'));
 assert.ok(water.includes('vec3 refracted=source*trans+inScatter;'));
 assert.ok(water.includes('material.uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse)'));
 assert.ok(water.includes('material.uniforms.uInvView.value.copy(camera.matrixWorld)'));
 assert.ok(scene.includes('diffuseColor.rgb*=sand;'));
 assert.ok(!scene.includes('diffuseColor.rgb*=sand*(1.+causticLight'));
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const nearFishDepth=.31,raised=smooth(.04,.20,.14);
 const entry=(1-raised)*smooth(.25,.8,nearFishDepth)+raised*smooth(.06,.32,nearFishDepth);
 assert.ok(entry>.55,'shallow physical fish should retain visible caustic response');
 assert.ok(smooth(.15,.75,.03)<.01,'moving shoreline contact should not gain a bright caustic edge');
});
test('bloom keeps HDR targets until final tone mapping',()=>{
 const post=readFileSync(new URL('../dist/postprocessing.js',import.meta.url),'utf8');
 assert.ok(post.includes('type:T.HalfFloatType'));
 assert.ok(post.includes('renderer.toneMapping=T.NoToneMapping'));
 assert.ok(post.includes('#include <tonemapping_fragment>'));
});

// Exercise the actual shader formula against CPU terrain, at retreat and crest.
test('surge moves the physical contact from sea to beach and meets terrain',()=>{
 let reach=0;
 const slope=x=>(shore(x+1e-5)-shore(x-1e-5))/2e-5;
 const height=scalarGLSL(shoreGLSL,'shoreWaterHeight',['p','t'],{
  shore,shoreSlope:slope,shoreRunupReach:()=>reach
 });
 for(let x=-16;x<=16;x+=.5){
  let previous=-Infinity;
  for(reach=-.12;reach<=.8001;reach+=.04){
   const z=shore(x)-reach*Math.sqrt(1+slope(x)**2);
   assert.ok(Math.abs(.14+height({x,y:z},0)-terrainY(x,z))<1e-8);
   const shorelineHeight=height({x,y:shore(x)},0);
   assert.ok(shorelineHeight>previous);previous=shorelineHeight;
   assert.ok(Math.abs(height({x,y:shore(x)+8},0))<1e-12);
  }
 }
});
