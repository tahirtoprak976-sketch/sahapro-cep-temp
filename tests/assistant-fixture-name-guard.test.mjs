import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {source,records} from './assistant-gold/real-messages/fixture.mjs';
import {foldTr} from '../js/parser.js';
const names=new Set(records.pseudonyms_extra);
for(const person of source.fixture.personnel)for(const name of person.name.split('=')){
 names.add(name.trim());for(const token of name.trim().split(/\s+/))if(!['abi','bey','operator','tirci'].includes(foldTr(token)))names.add(token);
}
for(const group of ['customers','quarries','dump_sites'])for(const row of source.fixture[group]){
 names.add(row.name);for(const alias of row.aliases||[])names.add(alias);
 for(const site of row.sites||[]){names.add(site.name);for(const alias of site.aliases||[])names.add(alias);}
}
for(const site of records.sites){names.add(site.name);for(const alias of site.aliases||[])names.add(alias);}
for(const row of records.personnel_aliases){names.add(row.name);for(const alias of row.aliases)names.add(alias);}
for(const vehicle of source.fixture.vehicles)if(vehicle.plate)names.add(vehicle.plate);
// Equipment types, units and generic words (e.g. own-yard terminology) are not identities.
// All personal/customer/site/place aliases and the pseudonym plate remain mandatory.
const norm=s=>foldTr(s).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const compact=s=>norm(s).replace(/ /g,'');
const files=readdirSync(new URL('../js/',import.meta.url),{recursive:true}).filter(p=>p.endsWith('.js'));
const leaks=[];
for(const file of files){const text=readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),n=norm(text.replace(/\\s[+*?]?/g,' '));
 for(const name of names){const needle=norm(name);if(needle.length<3)continue;
  const escaped=needle.split(' ').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join(' ?');
  const found=new RegExp('(?<![\\p{L}\\p{N}])'+escaped+'(?![\\p{L}\\p{N}])','u').test(n);
  if(found)leaks.push({file,name});
 }
}
assert.deepEqual(leaks,[],'Exam identities belong only in test/data records, never production JavaScript');
console.log(`fixture-name guard: ${names.size} identities across ${files.length} JavaScript files PASS`);
