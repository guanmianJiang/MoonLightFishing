import {writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

// A small, repeatable, seamless albedo bake. No runtime canvas or random uploads.
const width=512,tau=Math.PI*2,raw=Buffer.alloc((width*3+1)*width),heights=new Float32Array(width*width);
let seed=99241;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let y=0;y<width;y++)for(let x=0;x<width;x++){
 const u=x/width*tau,v=y/width*tau;
 const warp=Math.sin(u+Math.sin(v))*.95+Math.sin(u*3+v)*.38;
 const ripple=Math.sin(v*9+warp)*(.45+.25*Math.cos(u-v))
  +Math.sin(v*7-u*2+warp)*.35;
 const broad=Math.sin(u+Math.sin(v))*.018+Math.cos(u*2-v)*.012;
 const grain=(random()-.5)*.034;
 const shade=.94+broad+ripple*.028+grain;
 heights[y*width+x]=ripple*.003+broad*.02+grain*.004;
 const start=y*(width*3+1)+1+x*3;
 for(const [channel,tint] of [246,241,227].entries())raw[start+channel]=Math.min(255,Math.round(tint*shade));
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,bytes){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(Buffer.concat([name,bytes])));return Buffer.concat([length,name,bytes,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(width,4);header[8]=8;header[9]=2;
const encode=pixels=>Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels,{level:9})),chunk('IEND',Buffer.alloc(0))]);
const png=encode(raw);
await writeFile(new URL('../public/assets/sand-albedo.png',import.meta.url),png);
const normals=Buffer.alloc(raw.length),height=(x,y)=>heights[((y+width)%width)*width+(x+width)%width];
for(let y=0;y<width;y++)for(let x=0;x<width;x++){
 const dx=(height(x+1,y)-height(x-1,y))/(8/width),dy=(height(x,y+1)-height(x,y-1))/(8/width),length=Math.hypot(dx,dy,1);
 const start=y*(width*3+1)+1+x*3;
 [-dx/length,-dy/length,1/length].forEach((v,i)=>{normals[start+i]=Math.round((v*.5+.5)*255);});
}
await writeFile(new URL('../public/assets/sand-detail-normal.png',import.meta.url),encode(normals));
console.log(`沙色贴图：${width}×${width}, ${Math.round(png.length/1024)} KiB`);
