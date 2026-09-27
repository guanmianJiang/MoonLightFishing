import {access,readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const output=fileURLToPath(new URL('../build/',import.meta.url));
const html=await readFile(join(output,'index.html'),'utf8');
const failures=[];
const check=async path=>{try{await access(join(output,path));}catch{failures.push(`缺少 ${path}`);}};

if(!html.includes('<title>等一尾 · 月隐湾</title>'))failures.push('页面入口不正确');
if(!html.includes('bundles/'))failures.push('页面没有引用本次生成的代码');
if(html.includes('app-final.js?v='))failures.push('页面仍在引用开发入口');

for(const path of [
 'assets/Tex_Water_Normal_06.jpg',
 'assets/sky-toon-04.png',
 'assets/models/beach_terrain.glb',
 'assets/models/specimens',
 'assets/audio/source/ocean-wave-01.flac'
])await check(path);

for(const match of html.matchAll(/(?:src|href)="(\.\/bundles\/[^\"]+)"/g))await check(match[1]);
const bundles=await readdir(join(output,'bundles'));
if(!bundles.some(name=>name.endsWith('.js')))failures.push('缺少 JavaScript 构建文件');
if(!bundles.some(name=>name.endsWith('.css')))failures.push('缺少 CSS 构建文件');

if(failures.length){console.error(`构建校验失败：\n${failures.join('\n')}`);process.exitCode=1;}
else console.log('构建校验通过：页面入口、代码、模型、贴图和音频均在 build/ 中。');
