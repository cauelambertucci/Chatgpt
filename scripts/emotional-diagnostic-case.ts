import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {SliceSimulation} from '../src/engine/v2/engine';
import {dailyScenario} from '../src/engine/v2/daily-scenario';
import {diagnose} from './emotional-diagnostic';
const seed=process.argv[2];
const w=process.argv[3]?JSON.parse(readFileSync(process.argv[3],'utf8')):new SliceSimulation(dailyScenario(seed,40)).runCompact();
const r=diagnose(w);mkdirSync('reports/emotional-diagnostic',{recursive:true});
writeFileSync(`reports/emotional-diagnostic/${seed}.json`,JSON.stringify(r));
console.log(JSON.stringify({seed,people:r.people.length,grief:r.grief.length,alive:r.people.filter(p=>p.alive).length}));
