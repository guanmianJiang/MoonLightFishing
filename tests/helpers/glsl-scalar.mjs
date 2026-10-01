import assert from 'node:assert/strict';
export function glslScalar(source,name,args,bindings={}){
 const start=source.indexOf(`float ${name}(`),open=source.indexOf('{',start),end=source.indexOf('}',open);
 assert.ok(start>=0&&end>open,`Missing scalar ${name}`);
 const body=source.slice(open+1,end).replace(/\bfloat\b/g,'let');
 return new Function(...Object.keys(bindings),...args,`const {abs,asin,atan,sqrt,max,min,exp,pow,log2,floor}=Math;const clamp=(x,a,b)=>max(a,min(b,x));const mix=(a,b,t)=>a*(1-t)+b*t;${body}`).bind(null,...Object.values(bindings));
}
