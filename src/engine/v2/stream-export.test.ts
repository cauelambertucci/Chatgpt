import {it,expect} from 'vitest';
import {exportCompactGzip} from './stream-export';
import {SliceSimulation} from './engine';
import {demographicScenario} from './demographic-scenario';
import {replayCompact} from './compact-log';
it('gzip em fluxo preserva cada byte do JSON, Unicode, replay e imutabilidade',async()=>{
 const s=demographicScenario('exportação-🌍',12,true);s.months=36;s.people[0].name='á🌍'.repeat(25000);
 const w=new SliceSimulation(s).runCompact(),before=JSON.stringify(w);
 const {blob,jsonBytes}=await exportCompactGzip(w);
 const json=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
 expect(json===before).toBe(true);expect(jsonBytes).toBe(new TextEncoder().encode(before).byteLength);expect(blob.size).toBeLessThan(jsonBytes);expect(Object.isFrozen(w)).toBe(true);expect(JSON.stringify(w)).toBe(before);
 expect(replayCompact(JSON.parse(json))).toEqual(w.entities);
},30000);
