import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const seeds=['reservado-2b-006','reservado-2b-011','reservado-2b-028'];
await build({entryPoints:['scripts/marco2d1-case.ts'],outfile:'/tmp/marco2d1-case.mjs',bundle:true,platform:'node',format:'esm'});
for(const seed of seeds)await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--expose-gc','/tmp/marco2d1-case.mjs',seed,'after'],{stdio:'inherit'});p.on('error',reject);p.on('close',(code,signal)=>code===0?resolve():reject(Error(`${code} ${signal}`)));});
const rows=seeds.map(seed=>JSON.parse(readFileSync(`reports/marco2d1/${seed}.after.json`,'utf8')));
writeFileSync('docs/MARCO2D1-EXEMPLOS.json',JSON.stringify({selection:'Três seeds fixas escolhidas pelos acontecimentos já registrados no 2c; sem substituição por resultados 2d-1. Fixtures não entram nesta seleção.',rows},null,2));
console.log('Três exemplos concluídos.');
