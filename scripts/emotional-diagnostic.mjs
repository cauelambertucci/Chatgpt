import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
const seeds=Array.from({length:10},(_,i)=>`saturacao-2d1-${String(i).padStart(3,'0')}`);
await build({entryPoints:['scripts/emotional-diagnostic-case.ts'],outfile:'/tmp/emotional-diagnostic-case.mjs',bundle:true,platform:'node',format:'esm'});
for(const seed of seeds){
 if(process.argv.includes('--resume')&&existsSync(`reports/emotional-diagnostic/${seed}.json`))continue;
 await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['/tmp/emotional-diagnostic-case.mjs',seed],{stdio:'inherit'});p.on('error',reject);p.on('close',(code,signal)=>code===0?resolve():reject(Error(`${code} ${signal}`)));});
}
await new Promise((resolve,reject)=>{const p=spawn('python3',['scripts/summarize-emotional-diagnostic.py'],{stdio:'inherit'});p.on('error',reject);p.on('close',code=>code===0?resolve():reject(Error(String(code))));});
