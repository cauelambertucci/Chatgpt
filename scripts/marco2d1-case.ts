import {writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {gzipSync} from 'node:zlib';
import {SliceSimulation} from '../src/engine/v2/engine';
import {dailyScenario} from '../src/engine/v2/daily-scenario';
import {demographicScenario} from '../src/engine/v2/demographic-scenario';
import {CompactLog,replayCompact} from '../src/engine/v2/compact-log';
import {validateCompact} from '../src/engine/v2/validate';
import {auditLifeCompact} from '../src/engine/v2/life-audit';
import {auditDailyCompact} from '../src/engine/v2/daily-audit';
import {Archive} from '../src/ui/v2/model';
const seed=process.argv[2],mode=process.argv[3]||'after',bench=process.argv.includes('--bench');
const s=mode==='before'?demographicScenario(seed,40,true):dailyScenario(seed,40);
const warm=structuredClone(s);warm.months=12;new SliceSimulation(warm).advance();
(globalThis as any).gc?.();
const start=performance.now(),sim=new SliceSimulation(s);sim.advance();
const coreMs=performance.now()-start,coreRSS=process.resourceUsage().maxRSS*1024,coreHeap=process.memoryUsage().heapUsed;
const w=sim.runCompact(),snapshotRSS=process.resourceUsage().maxRSS*1024;
const json=JSON.stringify(w),jsonBytes=Buffer.byteLength(json),gzipBytes=gzipSync(json).length;
const exportRSS=process.resourceUsage().maxRSS*1024;
const log=CompactLog.from(w.log);const counts:Record<string,number>={};
for(let i=0;i<w.log.rows.length;i++){const e=log.event(i);counts[e.type]=(counts[e.type]||0)+1;}
const result:any={seed,mode,founders:40,years:100,coreMs,coreRSS,coreHeap,snapshotRSS,exportRSS,jsonBytes,gzipBytes,events:w.log.rows.length,counts};
mkdirSync('reports/marco2d1',{recursive:true});
if(!bench){
 result.errors=[...validateCompact(w),...auditLifeCompact(w),...auditDailyCompact(w)];
 result.replayEqual=JSON.stringify(replayCompact(w))===JSON.stringify(w.entities);
 writeFileSync(`reports/marco2d1/${seed}.${mode}.world.json`,json);
 const a=new Archive(w);
 result.people=a.people.map(p=>{const facts=a.biography(p.id);const own=facts.filter(e=>e.participants.some(q=>q.id===p.id&&q.role==='actor'));return {id:p.id,name:a.name(p.id),lossBooks:Object.values(w.entities).filter(e=>e.kind==='work'&&e.creator===p.id&&e.theme&&a.relation(p.id,String(a.event(e.theme)?.data.victim),e.created)).length,works:own.filter(e=>e.type==='work.created').length,care:own.filter(e=>e.type==='care.compression').length,failures:own.filter(e=>e.type==='work.blocked').length,sequela:own.filter(e=>e.type==='sequela.confirmed').length,changes:own.filter(e=>e.type==='occupation.changed'&&e.data.previous).length,paragraphs:a.paragraphs(p.id),facts:own.filter(e=>['occupation.changed','work.started','work.created','work.blocked','care.compression','sequela.confirmed','work.transferred'].includes(e.type)).map(e=>({id:e.id,month:e.month,type:e.type,text:a.narrate(e),causes:e.causes,data:e.data}))};});
}
writeFileSync(`reports/marco2d1/${seed}.${mode}${bench?'.bench':''}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,people:undefined,counts,errors:result.errors?.slice(0,10)}));

if(result.errors?.length || result.replayEqual===false)process.exitCode=1;
