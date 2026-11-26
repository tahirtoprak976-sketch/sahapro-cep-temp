import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../infrastructure/solo-access/handler.mjs';
const channel='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002',token='A'.repeat(43);
const req=(body={channel,action:'poll'},options={})=>new Request('https://example.invalid/access',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://tahirtoprak976-sketch.github.io',...options.headers},body:JSON.stringify(body),...options});
test('unauthenticated, wrong origin, extra fields and unrestricted actions never reach database',async()=>{
 let calls=0;const h=makeHandler({rpc:async()=>{calls++;return {ok:true,value:{messages:[]}};}});
 assert.equal((await h(req({}, {headers:{}}))).status,401);
 assert.equal((await h(req({channel,action:'poll'},{headers:{Origin:'https://evil.invalid',Authorization:'Bearer '+token}}))).status,403);
 assert.equal((await h(req({channel,action:'sql',query:'select 1'}))).status,400);
 assert.equal((await h(req({channel,action:'poll',sql:'select 1'}))).status,400);
 assert.equal((await h(req({channel,action:'respond',id,response:[]}))).status,400);
 assert.equal(calls,0);
});
test('valid device token is hashed, no token/keys in reply; database authorization failures are sanitized',async()=>{
 let args;const h=makeHandler({rpc:async a=>{args=a;return {ok:true,value:{messages:[]}};}});
 const r=await h(req());assert.equal(r.status,200);assert.match(args.p_token_hash,/^[0-9a-f]{64}$/);assert.ok(!JSON.stringify(args).includes(token));assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),'https://tahirtoprak976-sketch.github.io');
 assert.equal((await makeHandler({rpc:async()=>({ok:false,code:'28000',message:'private details'})})(req())).status,401);
 const bad=await makeHandler({rpc:async()=>({ok:false,message:'private details'})})(req());assert.ok(!(await bad.text()).includes('private details'));
});
test('streamed size limits and method handling precede database calls',async()=>{
 let calls=0;const h=makeHandler({rpc:async()=>{calls++;}});
 assert.equal((await h(req({channel,action:'respond',id,response:{data:'x'.repeat(1100000)}}))).status,413);
 assert.equal((await h(new Request('https://example.invalid',{method:'GET'}))).status,405);
 assert.equal(calls,0);
});
