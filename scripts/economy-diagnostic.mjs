import {build} from 'esbuild';import {spawn} from 'node:child_process';
const mode=process.argv[2];if(!['before','after'].includes(mode))throw Error('before ou after');
await build({entryPoints:['scripts/economy-diagnostic-case.ts'],outfile:`/tmp/economy-${mode}.mjs`,bundle:true,platform:'node',format:'esm'});
for(const seed of ['reservado-2b-006','reservado-2b-011','reservado-2b-028'])await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[`/tmp/economy-${mode}.mjs`,seed,mode],{stdio:'inherit'});p.on('error',reject);p.on('close',code=>code===0?resolve():reject(Error(String(code))));});
