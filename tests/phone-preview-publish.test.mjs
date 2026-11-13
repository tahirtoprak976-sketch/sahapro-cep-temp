import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {join} from 'node:path';
const base='c1a3c1668b1c4870fd5b5d5b020a3a2fdf3d8dfe',canonical='e0f0605318f8e3bbabbdba29242f0bb0e7276db6',qa='qa-v311-phone';
const bytes=(ref,path)=>execFileSync('git',['show',ref+':'+path],{maxBuffer:16*1024*1024});
const oldFiles=execFileSync('git',['ls-tree','-r','--name-only',base],{encoding:'utf8'}).trim().split('\n');
for(const path of oldFiles.filter(p=>p.startsWith('js/')||p.startsWith('icons/')||['sw.js','index.html','styles.css','manifest.webmanifest'].includes(p)))assert.deepEqual(readFileSync(path),bytes(base,path),'live application file changed: '+path);
const manifest=JSON.parse(readFileSync(qa+'/QA-MANIFEST.json','utf8'));assert.equal(manifest.canonicalSourceSha,canonical);
for(const[path,want]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(readFileSync(join(qa,path))).digest('hex'),want,path);
const phone=JSON.parse(readFileSync(qa+'/tests/assistant-gold/phone-source.json','utf8'));assert.equal(phone.sourceSha,canonical);for(const[path,want]of Object.entries(phone.files)){const value=readFileSync(join(qa,path));assert.equal(createHash('sha256').update(value).digest('hex'),want);assert.deepEqual(value,bytes(canonical,path),'phone source must be the accepted canonical bytes: '+path);}
const restore=text=>text.replaceAll('sahapro_onizleme_v31105_db','sahapro_cep_db').replaceAll('sahapro-onizleme-v31105-share','sahapro-share').replaceAll('sahapro-onizleme-v31105-wa','sahapro-wa').replaceAll('sahapro-onizleme-v31105-driver','sahapro-driver').replaceAll('sahapro-onizleme-v31105-','sahapro-solo-').replaceAll('spx_v31105_','sp_').replaceAll('solox_v31105_','solo_');
for(const name of readdirSync(qa+'/app/js').filter(n=>n.endsWith('.js')))assert.equal(restore(readFileSync(qa+'/app/js/'+name,'utf8')),bytes(canonical,'js/'+name).toString(),'preview business logic differs beyond storage names: '+name);
assert.equal(restore(readFileSync(qa+'/app/sw.js','utf8')).replace('  "./preview-start.mjs",\n',''),bytes(canonical,'sw.js').toString());
const appManifest=JSON.parse(readFileSync(qa+'/app/manifest.webmanifest','utf8'));assert.equal(appManifest.id,'sahapro-onizleme-v31105');assert.equal(appManifest.share_target,undefined);
assert.ok(Object.keys(manifest.files).every(p=>!p.includes('/data/transfers/')&&!p.includes('/.git/')));
assert.match(readFileSync(qa+'/app/preview-start.mjs','utf8'),/TEST_/);assert.ok(!readFileSync(qa+'/app/preview-start.mjs','utf8').includes('gemini_key'));
console.log('phone preview publish PASS: live bytes unchanged, canonical phone hashes, only storage namespaces differ in app logic, isolated manifest and no driver payloads');
