import assert from 'node:assert/strict';
import {reviewTotals,groupedDraftQuestions} from '../js/assistant-review-core.js';
import {assistantPageHTML,conversationHTML} from '../js/assistant-page-ui.js';
const rows=[{kind:'work',label:'İş',index:0,missing:['customer','date'],selected:true,issues:false},{kind:'work',label:'İş',index:1,missing:['customer'],selected:false,issues:true,duplicate:true},{kind:'collection',label:'Tahsilat',index:0,missing:['amount'],selected:true,disabled:true},{kind:'work',label:'İş',index:2,missing:[],selected:true,saved:true}];
assert.deepEqual(reviewTotals(rows),{total:3,selected:1,review:3,duplicates:1});
const qs=groupedDraftQuestions(rows);assert.equal(qs.length,3);assert.deepEqual(qs[0].rows,[1,2]);assert.equal(qs[2].kind,'collection');assert.deepEqual(reviewTotals([]),{total:0,selected:0,review:0,duplicates:0});
const html=assistantPageHTML({ready:false},{wa:'<img src=x onerror=alert(1)>'},'');assert.equal((html.match(/data-msg/g)||[]).length,1);assert.equal((html.match(/data-ask /g)||[]).length,1);assert.ok(html.includes('data-stop-reading'));assert.ok(html.includes('data-chat-context checked'));assert.ok(!html.includes('<img src=x'));
const history=conversationHTML({turns:Array.from({length:5},(_,i)=>({id:'t'+i,user:'<script>TEST</script>',reply:'TEST yanıt',status:i===4?'draft':'answer'}))});assert.equal((history.match(/data-chat-turn=/g)||[]).length,5);assert.ok(history.includes('Önceki 3 mesajı göster'));assert.ok(!history.includes('<script>'));assert.ok(history.includes('Onay bekliyor'));assert.equal(conversationHTML({turns:[]}), '');
console.log('PASS selected/disabled/saved review counts; grouped missing fields never imply bulk changes; unique composer; escaped conversation and read-only history');
