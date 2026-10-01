// Offline SVG/resource inspection of the actual sample; not a browser or phone screenshot.
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fishingControlSample,fishingFragment} from '../tests/helpers/fishing-control-v7-sample.mjs';
const {Resvg}=await import(pathToFileURL(process.argv[2]).href);
const dest=new URL('../docs/validation/fishing-control-v7-2026-10-01/',import.meta.url);
await mkdir(dest,{recursive:true});
const css=fishingFragment.match(/<style>([\s\S]*?)<\/style>/)[1];
const icon=fishingFragment.match(/class="moon-grip-symbol" src="([^"]+)"/)[1];
const scene=fishingFragment.match(/class="moon-grip-scene" src="([^"]+)"/)[1];
const states=[['静止','steady',0,0,false],['左调竿','steady',-60,0,true],['抬竿','window',0,-60,true],['让线','steady',0,60,true],['斜向调竿','steady',60,-60,true],['受力临界','danger',-50,0,true],['释放 70ms','steady',-60,0,true,70],['回摆 147ms','steady',-60,0,true,147],['归位 420ms','steady',-60,0,true,420]];
const renders=[];
for(const [label,mode,dx,dy,held,releaseTime] of states){
 const s=fishingControlSample();s.choose(mode);if(held){s.down();s.move(dx,dy);}
 if(releaseTime!==undefined){s.up();s.tick(0);s.tick(releaseTime);}
 let svg=fishingFragment.match(/<svg class="moon-grip-surface"([\s\S]*?)<\/svg>/)[0];
 for(const cls of ['face','wall','inner','shadow','edge']){
  const n=s.nodes['.moon-grip-'+cls];
  svg=svg.replace('class="moon-grip-'+cls+'"','class="moon-grip-'+cls+'" d="'+n.attributes.d+'"'+(cls==='edge'?' style="opacity:'+n.styles.opacity+'"':''));
 }
 for(const [k,v] of Object.entries(s.nodes['#moon-surface-face'].attributes))svg=svg.replace(k+'="'+({x1:28,y1:16,x2:118,y2:126}[k])+'"',k+'="'+v+'"');
 const wall=s.nodes['.moon-grip-wall-tone'].attributes['stop-color'];
 svg=svg.replace('offset="1" stop-color="#b28b59"','offset="1" stop-color="'+wall+'"');
 const x=parseFloat(s.control.styles['--grip-x']),y=parseFloat(s.control.styles['--grip-y'])+parseFloat(s.control.styles['--grip-depth']),tilt=parseFloat(s.control.styles['--grip-tilt']);
 svg=svg.replace('<svg class="moon-grip-surface"','<svg xmlns="http://www.w3.org/2000/svg" width="176" height="176"');
 svg=svg.replace(/<defs>/,'<style>'+css+'</style><g id="moon-fishing-control-v7"><g class="moon-grip-control" data-tone="'+s.control.dataset.tone+'"><defs>');
 svg=svg.replace('</svg>',`<g transform="translate(${x} ${y})"><image href="${icon}" x="44" y="38" width="60" height="60" transform="rotate(${tilt} 74 68)"/></g></g></g></svg>`);
 renders.push({label,svg});
}
const render=svg=>new Resvg(svg,{font:{loadSystemFonts:true}}).render().asPng();
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="576" height="630"><rect width="576" height="630" fill="#d9e7da"/>${renders.map((r,i)=>r.svg.replace('width="176"',`x="${8+(i%3)*192}" y="${16+Math.floor(i/3)*210}" width="176"`).replaceAll('moon-surface-',`moon-${i}-surface-`).replaceAll('moon-fishing-control-v7',`moon-fishing-control-v7-${i}`)+`<text x="${96+(i%3)*192}" y="${194+Math.floor(i/3)*210}" text-anchor="middle" font-family="Microsoft YaHei" font-size="12" fill="#4f6957">${r.label}</text>`).join('')}</svg>`;
await writeFile(new URL('surface-states.png',dest),render(sheet));
await writeFile(new URL('surface-left.svg',dest),renders[1].svg);
const portrait=`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="693"><image href="${scene}" width="390" height="693"/>${renders[1].svg.replace('width="176"','x="208" y="503" width="176"')}</svg>`;
await writeFile(new URL('portrait-left.png',dest),render(portrait));
console.log('Wrote offline surface states and static portrait composition (not browser screenshots).');
