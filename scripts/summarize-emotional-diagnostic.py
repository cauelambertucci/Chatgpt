import json,statistics,hashlib
from pathlib import Path
seeds=[f'saturacao-2d1-{i:03d}' for i in range(10)]
raw=[json.loads(Path(f'reports/emotional-diagnostic/{s}.json').read_text()) for s in seeds]
people=[p for r in raw for p in r['people']]; grief=[g for r in raw for g in r['grief']]
def hist(xs,bounds):
 return {f'{a}–{b}':sum(a<=v<=b for v in xs) for a,b in bounds}
def describe(ps):
 r=[p['rancor'] for p in ps];s=[p['stress'] for p in ps]
 return {'n':len(ps),'rancor':hist(r,[(0,24),(25,49),(50,74),(75,89),(90,99),(100,100)]),'stress':hist(s,[(0,249),(250,499),(500,749),(750,899),(900,999),(1000,1000)]),'meanRancor':statistics.mean(r) if r else None,'medianRancor':statistics.median(r) if r else None,'meanStress':statistics.mean(s) if s else None,'medianStress':statistics.median(s) if s else None}
def counter(items,key):
 out={}
 for x in items:out[str(x[key])]=out.get(str(x[key]),0)+1
 return out
byCategory={c:counter([g for g in grief if g['category']==c],'emotion') for c in sorted({g['category'] for g in grief})}
summary={'method':'10 seeds fixas consecutivas, 40 fundadores/100 anos; população final viva separada do último estado dos mortos; duração conta somente tempo vivo. Cap=100/1000, faixa alta=90+/900+. Não confundir frequência por evento com proporção por pessoa.','seeds':seeds,'groups':{label:describe(ps) for label,ps in [('vivos',[p for p in people if p['alive']]),('vivos 18–59',[p for p in people if p['alive'] and 18<=p['age']<60]),('vivos 60+',[p for p in people if p['alive'] and p['age']>=60]),('vivos <18',[p for p in people if p['alive'] and p['age']<18]),('mortos, estado na morte',[p for p in people if not p['alive']])]},'grief':counter(grief,'emotion'),'griefByCause':byCategory,'duration':{},'perSeed':[]}
for key in ['rancor90','rancor100','stress900','stress1000']:
 summary['duration'][key]={'ever':sum(p[key]['months']>0 for p in people),'continuous10Years':sum(p[key]['longest']>=120 for p in people),'maxContinuousYears':max(p[key]['longest'] for p in people)/12,'personMonths':sum(p[key]['months'] for p in people),'allObservedPersonMonths':sum(p['observedMonths'] for p in people)}
for row in raw:
 summary['perSeed'].append({'seed':row['seed'],'people':len(row['people']),'alive':describe([p for p in row['people'] if p['alive']]),'grief':counter(row['grief'],'emotion')})
# Full time series remain in local reproducible report files; publish compact per-person data.
compact=[]
for row in raw:
 ps=[]
 for p in row['people']:
  q={k:v for k,v in p.items() if k not in ['stressChanges','rancorChanges','grief']};q['griefCounts']=counter(p['grief'],'emotion');ps.append(q)
 compact.append({'seed':row['seed'],'people':ps,'counts':row['counts']})
Path('docs/SATURACAO-2D1-DADOS.json').write_text(json.dumps({'method':summary['method'],'rows':compact},ensure_ascii=False,indent=2)+'\n')
if Path('reports/emotional-diagnostic/reservado-2b-006.json').exists():
 alda=json.loads(Path('reports/emotional-diagnostic/reservado-2b-006.json').read_text());p=next(p for p in alda['people'] if p['id']=='person:17')
 summary['Alda']={k:v for k,v in p.items() if k!='stressChanges'}
 summary['Alda']['stressTransitions']=[x for i,x in enumerate(p['stressChanges']) if not i or x[1]!=p['stressChanges'][i-1][1]]
Path('docs/SATURACAO-2D1-RESUMO.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print('Resumo: 10 seeds,', len(people), 'pessoas,', len(grief), 'eventos de luto')
