// Supplementary controlled duel, not part of either free-seed distribution.
import {build} from 'esbuild';
import {readFileSync,writeFileSync,cpSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const meta=JSON.parse(readFileSync('docs/MARCO2-BENCHMARK.json','utf8'));
const mode='duel-fixture', dir=join(meta.scratch,mode);
cpSync(join(meta.scratch,'after'),dir,{recursive:true});
const file=join(dir,'scenario.ts');
writeFileSync(file,readFileSync(file,'utf8').replace('return s;',`
 s.bodySimulation={fixture:true,care:true,maxExchanges:1,singleDuel:{attacker:s.offender,defender:s.victim,caregiver:s.helper,month:0}};
 const a=s.people.find(p=>p.id===s.offender)!,b=s.people.find(p=>p.id===s.victim)!,h=s.people.find(p=>p.id===s.helper)!;
 a.skill=650;b.skill=550;h.medicalSkill=80;h.canHelp=true;h.traits.compaixao=100;h.values.solidariedade=100;
 for(const q of s.schedules)if([a.id,b.id,h.id].includes(q.id)){q.from=0;q.absentMonths=0;q.period=1;}
 return s;`));
await build({entryPoints:[join(dir,'runner.ts')],outfile:join(dir,'runner.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',keepNames:true});
const row=await new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,['--expose-gc','--max-old-space-size=8192',join(dir,'runner.mjs'),'warm'],{stdio:['ignore','pipe','inherit']});
 let output='';child.stdout.on('data',s=>output+=s);child.on('error',reject);child.on('close',code=>code?reject(Error(`exit ${code}`)):resolve(JSON.parse(output)));
});
if(row.duels<1 || row.wounds<1)throw Error('Active fixture did not exercise injury');
writeFileSync('docs/MARCO2-ACTIVE-BENCHMARK.json',JSON.stringify({scratch:meta.scratch,method:'Supplementary single controlled duel; same 100 founders/100 years/seed, with explicit skill/presence/care overrides. One repetition, not an estimate of mass combat.',rows:[{mode,repetition:1,...row}]},null,2));
console.log(JSON.stringify({coreMs:row.coreMs,bytes:row.jsonBytes,duels:row.duels,wounds:row.wounds,deaths:row.deaths}));
