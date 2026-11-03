// Identical synthetic oracle and regression tests on the unchanged v3.9.99 release.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {measure,gate} from './replay.mjs';
const base=mkdtempSync(join(tmpdir(),'assistant100-baseline-'));
try{
 const archive=join(base,'baseline.tar');execFileSync('git',['-c','safe.directory='+process.cwd(),'archive','--output',archive,'18e78cda6ecdfea6e149772c380037bbae8c6fba']);
 assert.equal(spawnSync('tar',['-xf',archive,'-C',base]).status,0);
 assert.match(readFileSync(join(base,'js/core.js'),'utf8'),/v3\.9\.99/);
 cpSync('tests/assistant-gold',join(base,'tests/assistant-gold'),{recursive:true});
 cpSync('tests/assistant-confidence100.test.mjs',join(base,'tests/assistant-confidence100.test.mjs'));
 const report=join(base,'measurement.json');const run=spawnSync(process.execPath,['tests/assistant-gold/run.mjs','--report',report],{cwd:base,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const before=JSON.parse(readFileSync(report,'utf8')),after=measure();
 assert.equal(before.messages,63);assert.equal(after.messages,before.messages);assert.equal(before.checkedCorrect,22);assert.ok(gate(before));assert.ok(gate(after));assert.ok(after.checkedCorrect>before.checkedCorrect);
 const regression=spawnSync(process.execPath,['--test-reporter=tap','tests/assistant-confidence100.test.mjs'],{cwd:base,encoding:'utf8'});assert.equal(regression.status,1);assert.match(regression.stdout,/# fail [1-9]/);
 const output=process.argv[2]||'/tmp/solo-confidence100-measurement.json';assert.ok(output.startsWith('/tmp/'));
 writeFileSync(output,JSON.stringify({baseline:'v3.9.99',before,after,baselineRegressions:regression.stdout},null,2)+'\n');
 console.log(JSON.stringify({before:before.checkedCorrectRate,after:after.checkedCorrectRate,safety:[after.silentWrong,after.moneyGuesses,after.mandatoryChecked],report:output}));
}finally{rmSync(base,{recursive:true,force:true});}
