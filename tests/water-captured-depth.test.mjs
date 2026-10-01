import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PerspectiveCamera,Vector3,Vector4} from 'three';
import {waterCapturedDepthGLSL} from '../src/water-captured-depth.mjs';
import {waterOpticsGLSL} from '../src/water-optics.mjs';
import {glslScalar} from './helpers/glsl-scalar.mjs';

const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const linear=glslScalar(waterCapturedDepthGLSL,'waterLinearEyeDepth',['raw','nearPlane','farPlane']);
const validKernel=glslScalar(waterCapturedDepthGLSL,'waterCapturedReceiverValid',['raw','receiverEye','surfaceEye','verticalGap','nearPlane','farPlane']);
const valid=(raw,receiverEye,surfaceEye,verticalGap)=>validKernel(raw,receiverEye,surfaceEye,verticalGap,.1,16000);
const column=glslScalar(waterCapturedDepthGLSL,'waterCapturedColumn',['surfaceY','receiverY','valid']);
const gate=glslScalar(waterCapturedDepthGLSL,'waterDepthRefractionGate',['depth'],{smoothstep});
const path=glslScalar(waterOpticsGLSL,'waterOpticalPath',['depth','airCosine']);
const radiance=glslScalar(waterOpticsGLSL,'waterChannelRadiance',['source','body','absorption','scattering','viewPath','sunPath']);
const water=readFileSync(new URL('../src/water.js',import.meta.url),'utf8');
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);

function captured(cameraPosition,depth,shift=0,quantized=false){
 const surface=new Vector3(0,.14+shift,0);
 const camera=new PerspectiveCamera(36,9/16,.1,16000);
 camera.position.copy(cameraPosition).add(new Vector3(0,shift,0));
 camera.lookAt(surface);camera.updateMatrixWorld(true);
 const direction=surface.clone().sub(camera.position).normalize();
 const receiver=surface.clone().addScaledVector(direction,depth/-direction.y);
 const ndc=receiver.clone().project(camera);
 let raw=(ndc.z+1)/2;if(quantized)raw=Math.round(raw*(2**24-1))/(2**24-1);
 const reconstructed=new Vector4(ndc.x,ndc.y,raw*2-1,1).applyMatrix4(camera.projectionMatrixInverse);
 reconstructed.divideScalar(reconstructed.w).applyMatrix4(camera.matrixWorld);
 const surfaceEye=-surface.clone().applyMatrix4(camera.matrixWorldInverse).z;
 const receiverEye=-receiver.clone().applyMatrix4(camera.matrixWorldInverse).z;
 const accepted=valid(raw,linear(raw,camera.near,camera.far),surfaceEye,surface.y-reconstructed.y);
 return {raw,surface,receiver,reconstructed,surfaceEye,receiverEye,accepted,
  measured:column(surface.y,reconstructed.y,accepted),camera};
}

for(const [name,position] of [
 ['倾斜',new Vector3(4,8,12)],['俯瞰',new Vector3(0,25,.01)],['掠射',new Vector3(0,.28,12)]
])test(`${name}相机：实际投影深度重建零厚度到深水，不依赖海床公式`,()=>{
 for(const depth of [0,.001,.01,.3,1,8,24]){
  const hit=captured(position,depth);
  close(linear(hit.raw,hit.camera.near,hit.camera.far),hit.receiverEye,1e-4);
  assert.equal(hit.accepted,1);
  close(hit.reconstructed.y,hit.receiver.y,1e-6);
  close(hit.measured,depth,1e-6);
 }
});

test('远裁面前的实际接收体可用，清屏深度 1 不冒充海床',()=>{
 const hit=captured(new Vector3(0,.28,12),24);
 assert.ok(hit.raw>.9999&&hit.raw<1);
 assert.equal(hit.accepted,1);
 assert.equal(valid(1,16000,hit.surfaceEye,24),0);
 assert.equal(column(.14,-100,0),24);
});

test('折射采到水面前景或水面以上的物体时拒绝该接收体',()=>{
 assert.equal(valid(.7,4,5,1),0);
 assert.equal(valid(.7,6,5,-.02),0);
 assert.equal(valid(.7,6,5,.02),1);
 for(const raw of [-.1,1,2,NaN,Infinity])assert.equal(valid(raw,6,5,1),0);
 assert.equal(valid(.7,6,-1,1),0);
 assert.equal(valid(.7,NaN,5,1),0);
 assert.equal(valid(.7,6,5,NaN),0);
});

test('接触处容许投影舍入，厚度仍夹在零到饱和预算内',()=>{
 assert.equal(valid(.5,10-.00001,10,-.00001),1);
 assert.equal(column(.14,.14001,1),0);
 assert.equal(column(.14,-100,1),24);
 close(column(.14,.139,1),.001);
});

test('24位深度量化在俯瞰/远近镜头不把接触点误判为水上物体',()=>{
 for(const height of [12,16,20,25,30,40,50]){
  for(const depth of [0,.001,.3,8]){
   const hit=captured(new Vector3(0,height,.01),depth,0,true);
   assert.equal(hit.accepted,1,`height ${height}, depth ${depth}`);
   close(hit.measured,depth,.002);
  }
 }
 // At 30 m a 24-bit sample puts the contact just above the surface;
 // 0.1 mm fixed tolerance used to reject this legitimate receiver.
 const rounded=captured(new Vector3(0,30,.01),0,0,true);
 assert.ok(rounded.reconstructed.y-rounded.surface.y>.0001);
 assert.equal(validKernel(.7,9.999,10,-.001,.1,16000),0);
});

test('深海床上方的浅水鱼使用鱼的深度，世界高度平移不改变水层',()=>{
 for(const depth of [.01,.3,8]){
  const a=captured(new Vector3(4,8,12),depth);
  const b=captured(new Vector3(4,8,12),depth,1000);
  close(a.measured,b.measured);
  close(a.measured,depth);
 }
 const fish=captured(new Vector3(4,8,12),.3);
 const bed=captured(new Vector3(4,8,12),8);
 assert.ok(path(fish.measured,.8)<path(bed.measured,.8));
 assert.ok(radiance(1,.5,.28,.035,path(fish.measured,.8),path(fish.measured,.9))>
  radiance(1,.5,.28,.035,path(bed.measured,.8),path(bed.measured,.9)));
});

test('极浅水连续进入光学传输，零厚度保留输入色；无接收体不会透出天空',()=>{
 let previous=1;
 for(const depth of [0,.00001,.001,.01,.1]){
  const result=radiance(1,.5,.28,.035,path(depth,.8),path(depth,.9));
  assert.ok(Number.isFinite(result)&&result<=previous);previous=result;
  if(depth===0)close(result,1);
 }
 for(const [absorption,scattering] of [[0,.035],[.28,.035],[.065,.085],[.025,.10]]){
  const result=radiance(0,.5,absorption,scattering,path(column(.14,0,0),.8),path(24,.9));
  assert.ok(Number.isFinite(result)&&result>=0&&result<=.5);
 }
});

test('折射偏移以实际水层渐入并衰减，接触处无偏移',()=>{
 assert.equal(gate(-1),0);assert.equal(gate(0),0);assert.equal(gate(.005),0);
 assert.ok(gate(.01)>0&&gate(.01)<gate(.1));
 assert.ok(gate(1)>gate(24));
 for(let depth=0;depth<=24;depth+=.01)assert.ok(gate(depth)>=0&&gate(depth)<=1);
 close(gate(.3-1e-7),gate(.3+1e-7),1e-6);
});

test('颜色与深度一起回退，吸收、焦散和渐变共用获准接收体',()=>{
 assert.match(water,/if\(!refrInside\|\|receiverValid<\.5\|\|originalValid<\.5\)/);
 assert.match(water,/refrUV=uv;receiverRawDepth=rawSceneDepth;receiverWorld=originalReceiver;receiverValid=originalValid;/);
 assert.ok(water.indexOf('if(!refrInside')<water.indexOf('vec3 source=texture2D(uScene,refrUV).rgb;'));
 assert.match(water,/source\*=receiverValid;/);
 assert.match(water,/waterCapturedColumn\(vWorld\.y,receiverWorld\.y,receiverValid\)/);
 assert.match(water,/float waterDepth=receiverSubmersion;/);
 assert.match(water,/waterOpticalPath\(waterDepth,view\.y\)/);
 assert.match(water,/waterOpticalPath\(waterDepth,uSunDirection\.y\)/);
 for(const legacy of ['geometricOpticalDepth','opticalReceiverBlend','bedHeightAt','raisedReceiver','glassBody','liquidSheen'])
  assert.ok(!water.includes(legacy),legacy);
 assert.equal((water.match(/color=mix\(color,reflectedSky,reflectionWeight\)/g)||[]).length,1);
 assert.match(water,/fragmentShader:material\.fragmentShader/);
});
