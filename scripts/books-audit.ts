import {CompactLog,type CompactWorld} from '../src/engine/v2/compact-log';
import {auditDailyCompact} from '../src/engine/v2/daily-audit';
import type {Work,Person} from '../src/engine/v2/types';
export function booksAudit(w:CompactWorld){
 const log=CompactLog.from(w.log),people=Object.values(w.entities).filter((e):e is Person=>e.kind==='person'),books=Object.values(w.entities).filter((e):e is Work=>e.kind==='work');
 const homes=new Map<string,any>(),spent=new Map<string,{paper:number;ink:number;started:string[]}>();
 for(const e of log.select(new Set(['household.materials.declared','livelihood.period','work.started']))){const d=e.data,h=String(d.household);
  if(e.type==='household.materials.declared')homes.set(h,{rawInitial:d.inventory,initial:{paper:Number(d.paper),ink:Number(d.ink)},produced:{paper:0,ink:0},used:{paper:0,ink:0},recipes:[]});
  if(e.type==='livelihood.period'&&d.task==='fabricar'){const r=d.recipe as any;if(r.paper||r.ink){const home=homes.get(h);home.produced.paper+=r.paper;home.produced.ink+=r.ink;home.recipes.push({event:e.id,actor:e.participants[0].id,month:e.month,recipe:r});}}
  if(e.type==='work.started'){const id=e.participants[0].id;if(!spent.has(id))spent.set(id,{paper:0,ink:0,started:[]});const s=spent.get(id)!;s.paper+=Number(d.paper);s.ink+=Number(d.ink);s.started.push(e.id);homes.get(h).used.paper+=Number(d.paper);homes.get(h).used.ink+=Number(d.ink);}
 }
 const perPerson=people.map(p=>({id:p.id,name:p.name,books:books.filter(b=>b.creator===p.id).length,spent:spent.get(p.id)||{paper:0,ink:0,started:[]}}));
 const living=people.filter(p=>p.alive),childHomes=new Set(living.filter(p=>{const life=w.entities[`life:${p.id}`];return life?.kind==='life'&&w.nextMonth-life.birthMonth<216;}).map(p=>(w.entities[`life:${p.id}`] as any).household));
 const authors=perPerson.filter(p=>p.books>0);
 return {seed:w.scenario.seed,people:people.length,books:books.length,authors:authors.length,booksPerPerson:books.length/people.length,booksPerAuthor:authors.length?books.length/authors.length:0,maxBooks:Math.max(0,...perPerson.map(p=>p.books)),living:living.length,householdsWithChildren:childHomes.size,childrenDefinition:'residentes vivos com menos de 18 anos ao fim de 1200 meses',perPerson,homes:[...homes].map(([id,h])=>({...h,id,final:(w.entities[id] as any).writingStock,rawFinal:(w.entities[id] as any).inventory})),errors:auditDailyCompact(w)};
}
