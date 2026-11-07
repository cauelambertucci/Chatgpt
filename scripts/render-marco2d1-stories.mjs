import {readFileSync,writeFileSync} from 'node:fs';
const r=JSON.parse(readFileSync('docs/MARCO2D1-EXEMPLOS.json','utf8'));
const pool=r.rows.flatMap(row=>row.people.map(person=>({seed:row.seed,person}))),used=new Set(),stories=[];
for(const [category,title,score] of [
 ['obra','Livro sobre uma morte conhecida, com tentativa frustrada',p=>p.works>0&&p.failures>0?p.lossBooks*10+p.works:0],
 ['cuidado','Cuidador que tratou uma ferida',p=>p.care*10],
 ['sequela','Limitação manual e mudança de ofício',p=>p.sequela&&p.facts.some(e=>e.type==='occupation.changed'&&e.data.previous==='criador'&&e.data.occupation!=='criador'&&e.data.capacity.write<0.5)?10:0]
]){
 const candidates=pool.filter(x=>!used.has(x.seed+':'+x.person.id)&&score(x.person)>0).sort((a,b)=>score(b.person)-score(a.person)||b.person.facts.length-a.person.facts.length||a.seed.localeCompare(b.seed)||a.person.id.localeCompare(b.person.id));
 if(!candidates.length)throw Error(`Sem história real para ${category}; não fabricar nem substituir seeds.`);
 const chosen=candidates[0];used.add(chosen.seed+':'+chosen.person.id);stories.push({category,title,...chosen});
}
writeFileSync('docs/MARCO2D1-HISTORIAS.json',JSON.stringify({selection:r.selection,stories},null,2));
let md='# Marco 2d-1 — três biografias reais\n\nTrês seeds previamente fixadas; escolha de pessoas após a geração, por fatos auditados. Não são fixtures nem estimativa de frequências. As obras encontradas retratam mortes reais conhecidas na comunidade; não se afirma perda familiar do autor. Cada fonte é um ID do arquivo compacto da respectiva seed.\n';
for(const x of stories){md+=`\n## ${x.person.name} — ${x.title}\n\nSeed: \`${x.seed}\` · pessoa: \`${x.person.id}\`.\n\n`;for(const p of x.person.paragraphs)md+=p.text+'\n\nFontes: '+p.sources.join(', ')+'.\n\n';}
md+='A mudança por dano manual pode ocorrer no mês da lesão, antes da confirmação posterior da sequela. O texto conserva essa ordem, sem atribuir retroativamente a decisão ao evento de confirmação.\n';
writeFileSync('docs/MARCO2D1-BIOGRAFIAS.md',md);
console.log(JSON.stringify(stories.map(x=>({category:x.category,seed:x.seed,id:x.person.id,name:x.person.name,works:x.person.works,lossBooks:x.person.lossBooks,failures:x.person.failures,care:x.person.care,sequela:x.person.sequela}))));
