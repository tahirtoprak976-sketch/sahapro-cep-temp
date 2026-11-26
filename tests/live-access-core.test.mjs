import {test} from 'node:test';import assert from 'node:assert/strict';
import {sealLive,openLive,catalogPage,catalogSpec,readLiveCode} from '../js/live-access-core.js';
const channel='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002';
const authority=async()=>({channel,key:await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])});
test('encrypted request roundtrip; channel, request identity, direction, expiry and ciphertext authenticated',async()=>{
 const a=await authority(),now=Date.now(),value={type:'catalog',store:'sites'},box=await sealLive(value,a,id,'request',{now});
 assert.deepEqual(await openLive(box,a,id,'request',{now}),value);
 for(const changed of [{...box,direction:'response'},{...box,id:channel},{...box,expires_at:new Date(now+7200000).toISOString()},{...box,ciphertext:box.ciphertext.slice(0,-2)+'AA'}])await assert.rejects(()=>openLive(changed,a,id,'request',{now}));
 await assert.rejects(()=>openLive(box,a,id,'request',{now:now+3600001}));
 await assert.rejects(()=>openLive(box,awaitAuthorityPlaceholder,id,'request'));
});
const awaitAuthorityPlaceholder={channel,key:null};
test('catalog only whitelisted stores and fields; contracts preserved, credentials and payroll excluded',()=>{
 const r=catalogPage({type:'catalog',store:'sites',limit:1},[{id:'b',deal:{basis:'Sefer',price:25},api_key:'SECRET'},{id:'a',deal:{basis:'m³',price:20},driver_secret:'SECRET'}]);
 assert.deepEqual(r.rows,[{id:'a',deal:{basis:'m³',price:20}}]);assert.equal(r.next,'a');assert.ok(!JSON.stringify(r).includes('SECRET'));
 for(const store of ['meta','attachments','cash_records','audit_log','__proto__'])assert.throws(()=>catalogSpec({type:'catalog',store}));
 assert.throws(()=>catalogSpec({type:'catalog',store:'sites',limit:1000}));assert.throws(()=>catalogSpec({type:'catalog',store:'sites',sql:'select 1'}));
});
test('pairing code must match current authority',()=>{assert.equal(readLiveCode('SPAL1.'+channel+'.'+'A'.repeat(43),channel).channel,channel);assert.throws(()=>readLiveCode('SPAL1.'+id+'.'+'A'.repeat(43),channel));});
