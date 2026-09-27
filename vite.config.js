import {writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import solid from 'vite-plugin-solid';
import {defaultRenderSettings} from './src/render-settings.js';

function validDefaults(value,template=defaultRenderSettings){
 if(typeof template==='number')return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=10000;
 if(typeof template==='boolean')return typeof value==='boolean';
 if(typeof template==='string')return typeof value==='string'&&value.length<200&&(template.startsWith('#')?/^#[0-9a-f]{6}$/i.test(value):template.startsWith('./assets/')?/^\.\/assets\/[\w.-]+$/.test(value):template==='shaded'?['shaded','wireframe','shaded-wireframe'].includes(value):['aces','neutral','agx','reinhard','linear','none'].includes(value));
 if(Array.isArray(template))return Array.isArray(value)&&value.length>=2&&value.length<=8&&value.every((v,i)=>validDefaults(v,template[0])&&v.depth>=0&&v.depth<=50&&(!i||v.depth-value[i-1].depth>=.01));
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(template).length&&Object.keys(template).every(k=>Object.hasOwn(value,k)&&validDefaults(value[k],template[k]));
}
export default {
 root:'src',base:'./',publicDir:fileURLToPath(new URL('./public/',import.meta.url)),
 build:{outDir:'../build',emptyOutDir:true,assetsDir:'bundles',rollupOptions:{output:{manualChunks(id){
  if(id.includes('/src/three.core.js'))return 'three-core';
  if(id.includes('/src/three.module.js')||id.includes('/src/vendor/'))return 'three-addons';
  if(id.includes('/node_modules/solid-js/'))return 'solid';
 }}}},
 server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
 plugins:[solid(),{
  name:'save-render-defaults',
  configureServer(server){
   server.middlewares.use('/__render-defaults',async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const reply=(code,body)=>{res.statusCode=code;res.end(JSON.stringify(body));};
    // Only the local editor can write project files. Never exposed in static builds.
    const address=req.socket.remoteAddress;
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)){reply(403,{error:'Local editor only'});return;}
    if(req.method==='GET'){reply(200,{writable:true});return;}
    if(req.method!=='POST'){reply(405,{error:'Method not allowed'});return;}
    if(req.headers.origin!==`http://${req.headers.host}`||!req.headers['content-type']?.startsWith('application/json')){reply(403,{error:'Same-origin JSON required'});return;}
    try{
     let body='';for await(const chunk of req){body+=chunk;if(body.length>32768){reply(413,{error:'Too large'});return;}}
     const values=JSON.parse(body);
     if(!validDefaults(values)){reply(400,{error:'Invalid settings'});return;}
     const target=fileURLToPath(new URL('./src/render-defaults.js',import.meta.url));
     const temporary=target+'.tmp';
     // The editor already has these values; avoid a reload while it is being used.
     server.watcher.unwatch([target,temporary]);
     await writeFile(temporary,'// 发布默认画面参数，由画面设置面板生成。\nexport default '+JSON.stringify(values,null,2)+';\n','utf8');
     await rename(temporary,target);
     const modules=server.moduleGraph.getModulesByFile(target.replaceAll('\\','/'));
     if(modules)for(const module of modules)server.moduleGraph.invalidateModule(module);
     reply(200,{saved:true});
    }catch{reply(500,{error:'Unable to save defaults'});}
   });
  }
 }]
};
