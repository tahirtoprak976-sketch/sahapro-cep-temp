import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../..',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'TEST-source-details-')),baseline=join(temp,'baseline');
try{
 mkdirSync(baseline);execFileSync('git',['archive','58971097c0afc8c77a7a1581aff8320096088838','--output='+join(temp,'baseline.tar')],{cwd:root});execFileSync('tar',['-xf',join(temp,'baseline.tar'),'-C',baseline]);
 for(const name of ['tests/assistant-source-details.test.mjs','tests/assistant-gold/real-messages/recorded-live-5897.json'])copyFileSync(join(root,name),join(baseline,name));
 const tests=[
  {args:['tests/assistant-source-details.test.mjs'],message:'source loading recipient must survive model summary'},
  {args:['--input-type=module','-e',`import assert from 'node:assert/strict';import fs from 'node:fs';import {measurePhoneSafety} from './tests/assistant-gold/phone-safety.mjs';const r=JSON.parse(fs.readFileSync('tests/assistant-gold/real-messages/recorded-live-5897.json'));assert.equal(measurePhoneSafety(r.safety).correctCards,12,'model reversed incoming depot receipt');`],message:'model reversed incoming depot receipt'},
 ];
 for(const test of tests){const r=spawnSync(process.execPath,test.args,{cwd:baseline,encoding:'utf8'});assert.notEqual(r.status,0);assert.ok(r.stderr.includes(test.message),r.stderr);assert.ok(r.stderr.includes('AssertionError'),r.stderr);console.log('UNCHANGED v3.11.06 RED:',test.message);}
 const candidate=spawnSync(process.execPath,['tests/assistant-source-details.test.mjs'],{cwd:root,encoding:'utf8'});assert.equal(candidate.status,0,candidate.stdout+candidate.stderr);console.log(candidate.stdout);
}finally{rmSync(temp,{recursive:true,force:true});}
