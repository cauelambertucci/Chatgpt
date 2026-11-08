import {readFileSync,writeFileSync} from 'node:fs';
import {Archive} from '../src/ui/v2/model';
const original=JSON.parse(readFileSync('docs/MARCO2D1-HISTORIAS.json','utf8'));
const stories=original.stories.map((story:any)=>{const a=new Archive(JSON.parse(readFileSync(`reports/marco2d1/${story.seed}.after.world.json`,'utf8')));return {seed:story.seed,category:story.category,id:story.person.id,name:a.name(story.person.id),paragraphs:a.paragraphs(story.person.id)};});
writeFileSync('docs/BIOGRAFIAS-2D1-REESCRITAS.json',JSON.stringify({method:'Somente projeção textual dos mesmos três personagens e arquivos imutáveis.',stories},null,2));
let md='# Três biografias reescritas\n\nMesmos personagens, seeds e fatos do 2d-1. Agrupamento por fase/tema e momento; sem nova geração, consumo de RNG ou mudança nas regras. Títulos de obras são rótulos de apresentação derivados do tema; os nomes históricos do log permanecem intactos.\n';
for(const story of stories){md+=`\n## ${story.name} — ${story.seed}\n`;
 for(const p of story.paragraphs){if(p.phase)md+=`\n### ${p.phase}\n`;md+='\n'+p.text+'\n\nFontes: '+p.sources.join(', ')+'.\n';}}
writeFileSync('docs/BIOGRAFIAS-2D1-REESCRITAS.md',md);
console.log(stories.map((s:any)=>({name:s.name,paragraphs:s.paragraphs.length,words:s.paragraphs.reduce((n:number,p:any)=>n+p.text.split(' ').length,0)})));
