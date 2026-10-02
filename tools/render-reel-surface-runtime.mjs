// Offline inspection of actual runtime SVG and controller output; never starts a browser.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {reelSurfaceSample} from '../tests/helpers/reel-surface-runtime-sample.mjs';
const {Resvg}=await import(pathToFileURL(process.argv[2]).href);
const dest=new URL('../docs/validation/fishing-control-v7-runtime-2026-10-01/',import.meta.url);
await mkdir(dest,{recursive:true});
const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const initial=html.match(/<svg class="reel-surface"[\s\S]*?<\/svg>/)[0];
const hook='data:image/svg+xml;base64,'+(await readFile(new URL('../public/assets/ui/fishing-hook.svg',import.meta.url))).toString('base64');
const scene='data:image/jpeg;base64,'+(await readFile(new URL('../docs/design/prototypes/fishing-control-v7/scene.jpg',import.meta.url))).toString('base64');
const states=[['提竿入口',{mode:'strike'}],['收线按压',{mode:'reel',pressed:true}],['左调竿',{mode:'reel',pressed:true,dx:-60}],['上提机会',{mode:'reel',pressed:true,dy:-60,guide:true}],['下压让线',{mode:'reel',pressed:true,dy:60}],['斜向调竿',{mode:'reel',pressed:true,dx:60,dy:-60}],['危险卸力',{mode:'reel',pressed:true,dx:-50,risk:true}],['回摆147ms',{mode:'reel',pressed:true,dx:-60},147],['归位420ms',{mode:'reel',pressed:true,dx:-60},420]];
const captures=[];
for(const [label,input,release] of states){
 const s=reelSurfaceSample();s.view.update(input);if(release!==undefined){s.view.release();s.tick(release);}
 let svg=initial.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
 svg=svg.replace(/<(path|linearGradient|stop)([^>]*data-reel="([\w-]+)"[^>]*)>/g,(all,tag,body,key)=>{
  for(const [attr,value] of Object.entries(s.nodes[key]?.attributes||{})){
   const match=new RegExp(' '+attr+'="[^"]*"');
   body=match.test(body)?body.replace(match,' '+attr+'="'+value+'"'):body.replace(/\/?$/,' '+attr+'="'+value+'"'+(body.endsWith('/')?'/':''));
  }return '<'+tag+body+'>';
 });
 const x=parseFloat(s.styles['--grip-x']),y=parseFloat(s.styles['--grip-y'])+parseFloat(s.styles['--grip-depth']),tilt=parseFloat(s.styles['--grip-tilt']);
 svg=svg.replace('</svg>',`<g transform="translate(${x} ${y})"><image href="${hook}" x="44" y="38" width="60" height="60" transform="rotate(${tilt} 74 68)"/></g></svg>`);
 captures.push({label,svg});
}
const png=svg=>new Resvg(svg,{font:{loadSystemFonts:true}}).render().asPng();
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="576" height="630"><rect width="576" height="630" fill="#d9e7da"/>${captures.map((c,i)=>c.svg.replace('width="176"',`x="${8+i%3*192}" y="${16+Math.floor(i/3)*210}" width="176"`).replaceAll('reel-surface-',`runtime-${i}-`)+`<text x="${96+i%3*192}" y="${194+Math.floor(i/3)*210}" font-family="Microsoft YaHei" font-size="12" fill="#4f6957" text-anchor="middle">${c.label}</text>`).join('')}</svg>`;
await writeFile(new URL('runtime-states.png',dest),png(sheet));
await writeFile(new URL('runtime-left.svg',dest),captures[2].svg);
for(const width of [320,390]){
 const height=Math.round(width*16/9),x=width-168-14,y=height-176-14;
 const portrait=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${scene}" width="${width}" height="${height}"/>${captures[2].svg.replace('width="176"',`x="${x}" y="${y}" width="176"`)}</svg>`;
 await writeFile(new URL('portrait-'+width+'.png',dest),png(portrait));
}
console.log('Rendered runtime SVG/controller states and static portrait compositions offline.');
