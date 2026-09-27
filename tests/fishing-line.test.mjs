import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/three.module.js';
import {FishingLine} from '../src/fishing-motion.js';

test('paid-out line sags while a loaded taut line follows its endpoints',()=>{
 const a=new T.Vector3(0,2,0),b=new T.Vector3(6,.06,0),line=new FishingLine();
 const direct=a.distanceTo(b);
 for(let i=0;i<90;i++)line.update(a,b,1/60,{length:direct+.6,load:0});
 const midpoint=Math.floor(line.nodes.length/2),straight=a.y+(b.y-a.y)*midpoint/(line.nodes.length-1);
 assert.ok(line.nodes[midpoint].y<straight-.2);
 assert.equal(line.tension,0);
 line.update(a,b,1/60,{length:direct-.05,load:.8});
 assert.ok(Math.abs(line.nodes[midpoint].y-straight)<.001);
 assert.equal(line.tension,.8);
 assert.ok(line.nodes[0].distanceTo(a)<1e-9);
 assert.ok(line.nodes.at(-1).distanceTo(b)<1e-9);
});
