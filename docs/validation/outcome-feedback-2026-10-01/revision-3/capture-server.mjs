// Local verification helper; accepts only generated test recordings.
import http from 'node:http';
import {writeFile} from 'node:fs/promises';
const names=new Set(['first','line-break','escaped','whoosh','muted']);
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:53989');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.end();return}
 const kind=req.url.slice(1);if(req.method!=='POST'||!names.has(kind)){res.writeHead(404);res.end();return}
 try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2000000)throw Error('too large');chunks.push(chunk)}await writeFile(new URL(kind+'.webm',import.meta.url),Buffer.concat(chunks));res.end('saved')}catch{res.writeHead(400);res.end('failed')}
}).listen(53991,'127.0.0.1',()=>console.log('Local audio capture ready'));
