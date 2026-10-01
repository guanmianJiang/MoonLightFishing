import {access,readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {REAL_AUDIO} from '../src/data/audio-assets.mjs';
import {BAITS,FISH} from '../src/data/catalog.mjs';
import {SKY_TEXTURES} from '../src/sky-settings.mjs';

const output=fileURLToPath(new URL('../build/',import.meta.url));
const html=await readFile(join(output,'index.html'),'utf8');
const failures=[];
const check=async path=>{try{await access(join(output,path));}catch{failures.push(`缺少 ${path}`);}};

if(!html.includes('<title>等一尾 · 月隐湾</title>'))failures.push('页面入口不正确');
if(!html.includes('bundles/'))failures.push('页面没有引用本次生成的代码');
if(html.includes('app-final.js?v='))failures.push('页面仍在引用开发入口');

for(const path of [
 'assets/Tex_Water_Normal_06.jpg',
 'assets/sand-albedo.png',
 'assets/sand-detail-normal.png',
 'assets/models/beach_terrain.glb',
 'assets/models/specimens',
 'assets/audio/source/ocean-wave-01.flac',
 'assets/fonts/noto-sans-sc-ui.woff2',
 'assets/fonts/noto-serif-sc-ui.woff2',
 'assets/journal-fish-watercolor.webp'
])await check(path);
for(const {path} of SKY_TEXTURES){
 await check(path.slice(2));
 try{
  const bytes=await readFile(join(output,path.slice(2)));
  if(bytes.length<33||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==bytes.readUInt32BE(20)*2||bytes.readUInt32BE(16)>2048)failures.push(`天空贴图格式或尺寸不正确 ${path}`);
 }catch{/* Missing assets already reported by check. */}
}

for(const url of Object.values(REAL_AUDIO))await check(url.slice(2));
for(const fish of FISH.filter(item=>!item.object))await check(`assets/models/specimens/${fish.id}.glb`);
for(const bait of BAITS){
 await check(`assets/models/fishing-details/bait_${bait.id}.glb`);
 await check(`assets/models/fishing-details/bait_${bait.id}.png`);
}

for(const match of html.matchAll(/(?:src|href)="(\.\/bundles\/[^\"]+)"/g))await check(match[1]);
const bundles=await readdir(join(output,'bundles'));
if(!bundles.some(name=>name.endsWith('.js')))failures.push('缺少 JavaScript 构建文件');
if(!bundles.some(name=>name.endsWith('.css')))failures.push('缺少 CSS 构建文件');

if(failures.length){console.error(`构建校验失败：\n${failures.join('\n')}`);process.exitCode=1;}
else console.log('构建校验通过：页面入口、代码、模型、贴图和音频均在 build/ 中。');
