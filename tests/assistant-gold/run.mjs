import {writeFileSync} from 'node:fs';
import {measure,gate} from './replay.mjs';
const args=process.argv.slice(2);
if(args.some(x=>!['--report'].includes(x)&&!x.endsWith('.json')))throw Error('Kullanım: node tests/assistant-gold/run.mjs [--report /tmp/report.json]');
const result=measure();
if(args.includes('--report'))writeFileSync(args[args.indexOf('--report')+1],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(!gate(result))process.exitCode=1;
