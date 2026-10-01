import {inflateSync,deflateSync} from 'node:zlib';

// Technical PNG packing and spherical seam/pole conditioning only.
// Cloud artwork is produced with image_gen; no clouds are synthesized here.
export function decodePng(bytes){
 if(bytes.length<33||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Expected PNG');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),channels=bytes[25]===2?3:bytes[25]===6?4:0;
 if(bytes[24]!==8||!channels||bytes[28]!==0||width<2||height<2||width*height>8388608)throw new Error('Unsupported PNG layout');
 const parts=[];
 for(let at=8;at<bytes.length;){
  if(at+12>bytes.length)throw new Error('Truncated PNG');
  const length=bytes.readUInt32BE(at),end=at+12+length;
  if(end>bytes.length)throw new Error('Truncated PNG');
  if(bytes.toString('ascii',at+4,at+8)==='IDAT')parts.push(bytes.subarray(at+8,at+8+length));
  at=end;
 }
 const stride=width*channels,raw=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*height});
 if(raw.length!==(stride+1)*height)throw new Error('Invalid PNG rows');
 const pixels=Buffer.alloc(stride*height);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)];if(filter>4)throw new Error('Invalid PNG filter');
  for(let i=0;i<stride;i++){
   const at=y*stride+i,a=i>=channels?pixels[at-channels]:0,b=y?pixels[at-stride]:0,c=y&&i>=channels?pixels[at-stride-channels]:0;
   const prediction=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);
   pixels[at]=(raw[y*(stride+1)+1+i]+prediction)&255;
  }
 }
 if(channels===3)return {width,height,pixels};
 const rgb=Buffer.alloc(width*height*3);
 for(let p=0;p<width*height;p++){if(pixels[p*4+3]!==255)throw new Error('Sky must be opaque');pixels.copy(rgb,p*3,p*4,p*4+3);}
 return {width,height,pixels:rgb};
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),head=Buffer.alloc(4),crc=Buffer.alloc(4);head.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([head,name,data,crc]);}
export function encodePng({width,height,pixels}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width*height>8388608||pixels.length!==width*height*3)throw new Error('Invalid RGB buffer');
 const stride=width*3,raw=Buffer.alloc((stride+1)*height),header=Buffer.alloc(13);
 for(let y=0;y<height;y++){const row=y*(stride+1);raw[row]=1;for(let i=0;i<stride;i++)raw[row+1+i]=(pixels[y*stride+i]-(i>=3?pixels[y*stride+i-3]:0))&255;}
 header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('sRGB',Buffer.from([0])),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function conditionPanorama({width,height,pixels}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||height<2||width!==height*2||width>2048||pixels.length!==width*height*3)throw new Error('Expected 2:1 mobile sky panorama');
 const result=Buffer.from(pixels),seamWidth=Math.max(4,Math.round(width*.035));
 for(let y=0;y<height;y++){
  const row=y*width*3,mean=[0,0,0],cap=1-smooth(Math.min(y/(height-1),1-y/(height-1))/.12);
  for(let x=0;x<width;x++)for(let c=0;c<3;c++)mean[c]+=pixels[row+x*3+c]/width;
  // At each pole all longitudes converge to one colour, with a smooth fade
  // through the empty cap. Do not vertically tile a spherical texture.
  for(let x=0;x<width;x++)for(let c=0;c<3;c++){const at=row+x*3+c;result[at]=Math.round(pixels[at]*(1-cap)+mean[c]*cap);}
  for(let c=0;c<3;c++){
   const left=result[row+c],right=result[row+(width-1)*3+c],average=(left+right)*.5;
   for(let x=0;x<seamWidth;x++){
    const weight=1-smooth(x/(seamWidth-1));
    const a=row+x*3+c,b=row+(width-1-x)*3+c;
    result[a]=Math.max(0,Math.min(255,Math.round(result[a]+(average-left)*weight)));
    result[b]=Math.max(0,Math.min(255,Math.round(result[b]+(average-right)*weight)));
   }
  }
 }
 return {width,height,pixels:result};
}
export function panoramaMetrics({width,height,pixels}){
 const horizon=[0,0,0];let seamMax=0,seamSlopeMax=0,poleRange=0,horizonStepMax=0;
 const centre=Math.floor(height/2);
 for(let y=0;y<height;y++)for(let c=0;c<3;c++){
  const at=y*width*3+c,last=at+(width-1)*3;
  seamMax=Math.max(seamMax,Math.abs(pixels[at]-pixels[last]));
  seamSlopeMax=Math.max(seamSlopeMax,Math.abs((pixels[at+3]-pixels[at])-(pixels[last]-pixels[last-3])));
 }
 for(const y of [0,height-1])for(let c=0;c<3;c++){let lo=255,hi=0;for(let x=0;x<width;x++){const v=pixels[(y*width+x)*3+c];lo=Math.min(lo,v);hi=Math.max(hi,v);}poleRange=Math.max(poleRange,hi-lo);}
 for(let x=0;x<width;x++)for(let c=0;c<3;c++){
  horizon[c]+=pixels[(centre*width+x)*3+c]/width;
  for(let y=centre-4;y<=centre+4;y++)horizonStepMax=Math.max(horizonStepMax,Math.abs(pixels[(y*width+x)*3+c]-pixels[((y-1)*width+x)*3+c]));
 }
 return {horizonRgb:horizon.map(v=>+v.toFixed(2)),seamMax,seamSlopeMax,poleRange,horizonStepMax};
}

export function validateSkyPanorama(map){
 const {width,height,pixels}=map;
 if(width!==height*2||height<16||width>2048||pixels.length!==width*height*3)throw new Error('Invalid sky dimensions');
 const metrics=panoramaMetrics(map),[r,g,b]=metrics.horizonRgb;
 if(metrics.seamMax!==0||metrics.poleRange!==0||metrics.seamSlopeMax>12)throw new Error('Sky seam or pole discontinuity');
 if(metrics.horizonStepMax>4||!(b>g&&g>r+45&&r<160))throw new Error('Sky horizon must be continuous blue cyan');
 for(let y=Math.floor(height/2);y<height;y++)for(let x=0;x<width;x++){
  const at=(y*width+x)*3;
  if(pixels[at+2]<=pixels[at]+35||pixels[at]>=190)throw new Error('Sky lower hemisphere must be blue atmosphere');
 }
 return metrics;
}
