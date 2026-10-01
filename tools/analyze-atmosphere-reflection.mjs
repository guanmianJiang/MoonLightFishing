// Offline numeric inspection of the actual scalar GLSL; no browser or saved game.
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {heightAtmosphereGLSL,atmosphereColorLinear} from '../src/height-atmosphere.mjs';
import {waterOpticsGLSL} from '../src/water-optics.mjs';
import {glslScalar} from '../tests/helpers/glsl-scalar.mjs';
import defaults from '../src/render-defaults.js';

const mean=glslScalar(heightAtmosphereGLSL,'heightAtmosphereMean',['startHeight','endHeight','layerHeight']);
const scatter=glslScalar(heightAtmosphereGLSL,'heightAtmosphereScatter',['rayLength','startHeight','endHeight','layerHeight','strength','weatherScale'],{heightAtmosphereMean:mean});
const phaseR=glslScalar(heightAtmosphereGLSL,'heightRayleighPhase',['cosine']);
const phaseM=glslScalar(heightAtmosphereGLSL,'heightMiePhase',['cosine']);
const channel=glslScalar(heightAtmosphereGLSL,'heightAtmosphereChannel',['base','sun','rayleighPhase','miePhase','sunStrength']);
const reflection=glslScalar(waterOpticsGLSL,'waterReflectionWeight',['cosine','base','power','strength']);
const gain=glslScalar(waterOpticsGLSL,'waterReflectionGain',['strength']);
const colour=atmosphereColorLinear(defaults.atmosphereColor),sun=atmosphereColorLinear(defaults.sunColor).map(c=>c*2.65);
const report={kind:'Offline scalar GLSL and texture data; not a GPU render',publishedDefaults:defaults,
 airPaths:[2,80].flatMap(origin=>[.15,1.35].map(strength=>({origin,height:22,strength,scatter:scatter(12000,origin,origin,22,strength,1)}))),
 colourSources:[-1,0,Math.cos(defaults.sunElevation*Math.PI/180),1].map(cosine=>({cosine,linear:colour.map((c,i)=>channel(c,sun[i],phaseR(cosine),phaseM(cosine),defaults.atmosphereSunStrength))})),
 fresnel:[1,.8,.4,.15,.02,0].map(cosine=>({cosine,power5:reflection(cosine,0,5,1),power7_8:reflection(cosine,0,7.8,1),power12:reflection(cosine,0,12,1),oldPower7_8:Math.max(.0204+.9796*(1-cosine)**5,(1-cosine)**7.8),boostedWeight:reflection(cosine,0,5,1.13),boostedGain:gain(1.13)}))};
// Pillow handles the current 16-bit RGBA normal PNG; the sky decoder only accepts 8-bit.
let normalDistribution;
try{normalDistribution=JSON.parse(execFileSync('python',['-c',`import sys,json,math
from PIL import Image
image=Image.open(sys.argv[1]).convert('RGB')
total=0; maximum=0
for rgb in image.getdata():
 x,y,z=[v/255*2-1 for v in rgb];z=max(z,.16);length=math.sqrt(x*x+y*y+z*z)
 slope=math.hypot(x,y)/length/max(z/length,.38)
 total+=slope*slope;maximum=max(maximum,slope)
print(json.dumps(dict(width=image.width,height=image.height,rmsUnscaledSlope=math.sqrt(total/(image.width*image.height)),maxUnscaledSlope=maximum)))`, `public/${defaults.normalTexture.slice(2)}`],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));}
catch{normalDistribution={unverified:'Normal pixel inspection needs Python and Pillow; scalar GLSL results remain available.'};}
report.normalTexture={...normalDistribution,layerA:defaults.normalStrengthA,layerB:defaults.normalStrengthB,reflectionDetailInfluence:defaults.reflectionNormalStrength,note:'Single decoded normal distribution; not combined rotated/scrolled layers or a rendered camera view.'};
const directory='docs/validation/atmosphere-reflection-review-2026-10-01';await mkdir(directory,{recursive:true});await writeFile(`${directory}/numeric-review.json`,JSON.stringify(report,null,2)+'\n');
console.log('已输出离线大气/反射数值复核；未启动浏览器或修改本地存档。');
