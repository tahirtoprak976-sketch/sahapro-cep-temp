import {writeFileSync} from 'node:fs';
import {measure,gate,cases,confidenceCases} from './replay.mjs';
const args=process.argv.slice(2);
if(args.some(x=>!['--report','--confidence'].includes(x)&&!x.endsWith('.json')))throw Error('Kullanım: node tests/assistant-gold/run.mjs [--report /tmp/report.json]');
const result=measure(args.includes('--confidence')?[...cases,...confidenceCases]:cases);
if(args.includes('--report'))writeFileSync(args[args.indexOf('--report')+1],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(!gate(result))process.exitCode=1;
