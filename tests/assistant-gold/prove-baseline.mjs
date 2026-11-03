// Run exactly the current synthetic cases against unchanged v3.9.98 source.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const base=mkdtempSync(join(tmpdir(),'assistant99-baseline-'));
try{
 const archive=join(base,'baseline.tar');execFileSync('git',['-c','safe.directory='+process.cwd(),'archive','--output',archive,'20612ee8af15ca8823bca705df8acf7c1f56b063']);
 const unpack=spawnSync('tar',['-xf',archive,'-C',base]);assert.equal(unpack.status,0);
 assert.match(readFileSync(join(base,'js/core.js'),'utf8'),/APP_VERSION = "SAHAPRO SOLO v3\.9\.98"/);
 cpSync('tests/assistant-gold',join(base,'tests/assistant-gold'),{recursive:true});
 cpSync('tests/assistant-finance99.test.mjs',join(base,'tests/assistant-finance99.test.mjs'));
 const report=join(base,'baseline.json'),run=spawnSync(process.execPath,['tests/assistant-gold/run.mjs','--report',report],{cwd:base,encoding:'utf8'});
 assert.equal(run.status,1);const m=JSON.parse(readFileSync(report,'utf8'));
 assert.ok(m.silentWrong>0);assert.equal(m.moneyGuesses,0);assert.equal(m.mandatoryChecked,9);
 const safety=spawnSync(process.execPath,['tests/assistant-finance99.test.mjs'],{cwd:base,encoding:'utf8'});
 assert.equal(safety.status,1);assert.match(safety.stdout,/fail 8/);assert.match(safety.stdout,/pass 1/);
 const output=process.argv[2]||'/tmp/assistant99-baseline.json';assert.ok(output.startsWith('/tmp/'));writeFileSync(output,JSON.stringify(m,null,2)+'\n');
 console.log(JSON.stringify({baseline:'v3.9.98',messages:m.messages,silentWrong:m.silentWrong,moneyGuesses:m.moneyGuesses,mandatoryChecked:m.mandatoryChecked,regressions:8,unchangedControl:1,report:output}));
}finally{rmSync(base,{recursive:true,force:true});}
