import type {CompactWorld} from '../src/engine/v2/compact-log';
import {CompactLog} from '../src/engine/v2/compact-log';
import type {Person} from '../src/engine/v2/types';
import type {Life} from '../src/engine/v2/life';
export function diagnose(w:CompactWorld){
 const log=CompactLog.from(w.log),people=Object.values(w.entities).filter((e):e is Person=>e.kind==='person');
 const profiles=new Map(people.map(p=>{const l=w.entities[`life:${p.id}`] as Life;return [p.id,{id:p.id,name:p.name,alive:p.alive,birth:l.birthMonth,end:w.nextMonth,rancor:p.traits.rancor,stress:p.psychology?.stress||0,initialRancor:p.traits.rancor,rancorChanges:[] as [number,number][],stressChanges:[] as [number,number][],grief:[] as any[]}]}));
 const grief:any[]=[];const counts:Record<string,number>={};
 for(let i=0;i<log.length;i++){
  const e=log.event(i),d=e.data,id=String(d.owner||e.participants[0]?.id),p=profiles.get(id);counts[e.type]=(counts[e.type]||0)+1;
  if(e.type==='person.died'){const who=profiles.get(String(d.victim));if(who)who.end=e.month;}
  if(p && ['needs.period','emotion.felt','stress.response'].includes(e.type) && typeof d.stressAfter==='number')p.stressChanges.push([e.month,d.stressAfter]);
  if(p && e.type==='person.transformed' && d.facet==='rancor'){
   if(!p.rancorChanges.length)p.initialRancor=Number(d.facetBefore);
   p.rancorChanges.push([e.month,Number(d.facetAfter)]);
  }
  if(p && e.type==='emotion.felt' && d.stimulus==='perda'){
   const source=typeof d.stimulusSource==='string'?log.event(Number(d.stimulusSource.slice(6))):undefined;
   const fact=source?.type==='information.received'?log.event(Number(String(source.data.offense).slice(6))):source;
   const victim=fact?.type==='person.died'?profiles.get(String(fact.data.victim)):undefined;
   const age=victim?Math.floor((fact!.month-victim.birth)/12):undefined;
   const category=fact?.type==='person.died'?(fact.data.natural?(age!==undefined&&age>=68?'morte natural, 68+':'morte natural, <68/desconhecida'):'morte não natural'):fact?.type==='family.loss.perceived'?'perda gestacional':fact?.type==='sequela.perceived'?'sequela':fact?.type==='injury.perceived'?'ferimento':'outra perda';
   const item={id:e.id,person:id,month:e.month,emotion:d.emotion,source:source?.id,fact:fact?.id,category,stressBefore:d.stressBefore,stressAfter:d.stressAfter,appraisal:d.appraisal};grief.push(item);p.grief.push(item);
  }
 }
 const duration=(changes:[number,number][],initial:number,start:number,end:number,threshold:number)=>{
  let at=start,value=initial,total=0,run=0,longest=0;
  for(const [month,next] of [...changes,[end,initial] as [number,number]]){
   const t=Math.max(start,Math.min(end,month)),span=Math.max(0,t-at);
   if(value>=threshold){total+=span;run+=span;longest=Math.max(longest,run);}else run=0;
   at=t;value=next;if(month>=end)break;
  }return {months:total,longest};
 };
 const rows=[...profiles.values()].map(p=>{const start=Math.max(0,p.birth),end=p.end;return {...p,age:Math.floor((end-p.birth)/12),observedMonths:Math.max(0,end-start),rancor90:duration(p.rancorChanges,p.initialRancor,start,end,90),rancor100:duration(p.rancorChanges,p.initialRancor,start,end,100),stress900:duration(p.stressChanges,0,start,end,900),stress1000:duration(p.stressChanges,0,start,end,1000)};});
 return {seed:w.scenario.seed,people:rows,grief,counts,events:log.length};
}
