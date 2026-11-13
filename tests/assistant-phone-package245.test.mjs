import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'sahapro-phone-package-'));
try{
 const outputs=['one.zip','two.zip'].map(name=>join(dir,name));for(const output of outputs)execFileSync('python3',['tools/preview/build_phone.py','--output',output]);assert.deepEqual(readFileSync(outputs[0]),readFileSync(outputs[1]),'source-pinned packages are reproducible');
 const inspect=JSON.parse(execFileSync('python3',['-c',`import hashlib,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1])as z:
 names=z.namelist();cfg=json.loads(z.read('tests/assistant-gold/phone-source.json'));assert all(not n.startswith('/')and'..'not in n.split('/')for n in names);assert all(hashlib.sha256(z.read(n)).hexdigest()==h for n,h in cfg['files'].items());print(json.dumps({'names':names,'sha':cfg['sourceSha']}))`,outputs[0]],{encoding:'utf8'}));
 assert.equal(inspect.sha,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());assert.ok(inspect.names.includes('tests/assistant-gold/phone.html'));assert.ok(inspect.names.includes('tests/assistant-gold/real-messages/source.json'));
 assert.ok(!inspect.names.some(n=>n.includes('.git')||n.endsWith('.sahapro')||n==='sw.js'||n==='manifest.webmanifest'||n.startsWith('docs/')),'no repository metadata, backups, application SW or unrelated documents');
 console.log('phone-package245 PASS: committed source only, deterministic archive, exact file hashes, no SW/backup/private workspace files');
}finally{rmSync(dir,{recursive:true,force:true});}
