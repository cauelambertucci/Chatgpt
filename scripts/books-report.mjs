import {build} from 'esbuild';import {spawn} from 'node:child_process';
const mode=process.argv[2];if(!['before','after'].includes(mode))throw Error('before/after');
await build({entryPoints:['scripts/books-case.ts'],outfile:'/tmp/books-case.mjs',bundle:true,platform:'node',format:'esm'});
for(const seed of ['reservado-2b-006','reservado-2b-011','reservado-2b-028'])await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['/tmp/books-case.mjs',seed,mode],{stdio:'inherit'});p.on('error',reject);p.on('close',code=>code===0?resolve():reject(Error(String(code))));});
