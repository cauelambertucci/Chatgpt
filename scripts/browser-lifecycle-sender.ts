import { SliceSimulation } from './src/engine/v2/engine';
import { memoryScenario } from './scenario';
let sim:SliceSimulation, world:any, coreMs=0;
self.onmessage=(e)=>{
 try {
  let result:any;
  switch(e.data.type){
   case 'setup': { const warm=memoryScenario();warm.months=12;new SliceSimulation(warm).advance();(globalThis as any).gc?.();result={};break; }
   case 'start': {const t=performance.now();sim=new SliceSimulation(memoryScenario());coreMs=performance.now()-t;result={};break;}
   case 'advance': {const t=performance.now();sim.advance(e.data.month);coreMs+=performance.now()-t;result={coreMs,month:e.data.month};break;}
   case 'snapshot': {const t=performance.now();world=sim.runCompact();result={snapshotMs:performance.now()-t,format:world.version,complete:world.complete,nextMonth:world.nextMonth};break;}
   case 'transfer': result={world};break;
   default:throw Error('Unknown sender request');
  }
  self.postMessage({result});
 }catch(error){self.postMessage({error:String(error)});}
};
