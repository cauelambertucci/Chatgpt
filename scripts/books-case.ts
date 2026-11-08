import {validateCompact} from "../src/engine/v2/validate";
import {replayCompact} from "../src/engine/v2/compact-log";
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {SliceSimulation} from '../src/engine/v2/engine';import {livelihoodScenario} from '../src/engine/v2/daily-scenario';import {booksAudit} from './books-audit';
const [seed,mode]=process.argv.slice(2);mkdirSync('reports/books',{recursive:true});
const w=mode==='before'?JSON.parse(readFileSync(`reports/economy-fix/${seed}.after.world.json`,'utf8')):new SliceSimulation(livelihoodScenario(seed,40)).runCompact();
const r=booksAudit(w);if(mode==="after"){r.errors.push(...validateCompact(w));if(JSON.stringify(replayCompact(w))!==JSON.stringify(w.entities))r.errors.push("Replay divergente");}writeFileSync(`reports/books/${seed}.${mode}.json`,JSON.stringify(r,null,2));if(mode==='after')writeFileSync(`reports/books/${seed}.after.world.json`,JSON.stringify(w));console.log({seed,mode,books:r.books,people:r.people,authors:r.authors,errors:r.errors.slice(0,5)});if(r.errors.length)process.exitCode=1;
