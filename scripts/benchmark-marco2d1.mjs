import {build} from 'esbuild';
import {cpSync,mkdtempSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir,cpus} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const prior=process.argv.includes('--after-only')?JSON.parse(readFileSync('docs/MARCO2D1-BENCHMARK.json','utf8')):undefined;
const scratch=prior?.scratch || mkdtempSync(join(tmpdir(),'chronicle-m2d1-bench-')),rows=prior?prior.rows.filter(r=>r.mode==='before'):[];
for(const mode of (prior?['after']:['before','after'])){
 const dir=join(scratch,mode);mkdirSync(dir,{recursive:true});cpSync('src',join(dir,'src'),{recursive:true});
 writeFileSync(join(dir,'scenario.ts'),mode==='before'?`import {demographicScenario} from './src/engine/v2/demographic-scenario';export const memoryScenario=()=>demographicScenario('benchmark-pre-m2-100x100-v1',40,true);`:`import {dailyScenario} from './src/engine/v2/daily-scenario';export const memoryScenario=()=>dailyScenario('benchmark-pre-m2-100x100-v1',40);`);
 writeFileSync(join(dir,'adapter.ts'),`import {CompactLog} from './src/engine/v2/compact-log';export const output=(s:any)=>s.runCompact();export const eventStream=(w:any)=>CompactLog.from(w.log).view(true);`);
 writeFileSync(join(dir,'runner.ts'),readFileSync('scripts/benchmark-marco2d1-runner.ts','utf8').replace('Math.max(100,','Math.max(40,'));
 await build({entryPoints:[join(dir,'runner.ts')],outfile:join(dir,'runner.mjs'),bundle:true,platform:'node',format:'esm'});
 for(let repetition=1;repetition<=3;repetition++){
  const result=await new Promise((res,rej)=>{const p=spawn(process.execPath,['--expose-gc',join(dir,'runner.mjs'),'warm'],{stdio:['ignore','pipe','inherit']});let s='';p.stdout.on('data',x=>s+=x);p.on('error',rej);p.on('close',(c,signal)=>{if(c!==0||!s.trim())return rej(Error(`exit=${c} signal=${signal} bytes=${s.length}`));try{res(JSON.parse(s));}catch(e){rej(e);}});});
  rows.push({mode,repetition,...result});
  writeFileSync('docs/MARCO2D1-BENCHMARK.json',JSON.stringify({method:'40 fundadores/100 anos, seed benchmark-pre-m2-100x100-v1. Três processos por versão, aquecimento 12 meses, GC antes do cronômetro; relatório/hash/exportação fora do motor; sem concorrência.',scratch,node:process.version,cpu:cpus()[0]?.model,rows},null,2));
  console.log(JSON.stringify({mode,repetition,coreMs:result.coreMs,events:result.events,jsonBytes:result.jsonBytes,rss:result.corePeakRssKiB}));
 }
}
