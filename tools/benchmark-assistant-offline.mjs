// Synthetic/pseudonym fixture only; no phone database, API, Save or learned examples.
import {createHash} from 'node:crypto';
import {offlinePlan} from '../js/offline-whatsapp.js';
import {fixture,source,message,fixtureSettings} from '../tests/assistant-gold/real-messages/fixture.mjs';
const text=message(source.cases.find(c=>c.id==='r00_tumu')),d=fixture(),rules=fixtureSettings().assistant_rules,times=[],hashes=[];let cards;
for(let i=0;i<6;i++){const start=performance.now(),v=offlinePlan(text,{d,today:source.today_for_test,rules});times.push(Math.round((performance.now()-start)*10)/10);hashes.push(createHash('sha256').update(JSON.stringify(v)).digest('hex'));cards=v.works.length+v.fuel.length;}
console.log(JSON.stringify({scope:'Node parsing only; not DOM, physical phone or Gemini',messages:20,cards,coldMs:times[0],warmMs:times.slice(1),outputHashes:hashes,stableOutput:new Set(hashes).size===1},null,2));
