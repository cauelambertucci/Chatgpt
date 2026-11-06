import { exportCompactGzip } from "./src/engine/v2/stream-export";
import { SliceSimulation } from "./src/engine/v2/engine";
import { memoryScenario } from "./scenario";
import { output } from "./adapter";
let sim: any,
  world: any,
  received: any,
  json: string | undefined,
  utf8: Uint8Array | undefined;
let coreMs = 0;
export function setup() {
  const warm = memoryScenario();
  warm.months = 12;
  new SliceSimulation(warm).advance();
}
export function start() {
  const t = performance.now();
  sim = new SliceSimulation(memoryScenario());
  coreMs = performance.now() - t;
}
export function advance(month: number) {
  const t = performance.now();
  sim.advance(month);
  coreMs += performance.now() - t;
  return { coreMs, month };
}
export function snapshot() {
  const t = performance.now();
  world = output(sim);
  return {
    snapshotMs: performance.now() - t,
    format: world.version,
    complete: world.complete,
    nextMonth: world.nextMonth,
  };
}
function freeze(v: any): any {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) freeze(x);
  }
  return v;
}
let receiver: Worker;
function receive(command: any) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("Receiver timeout")), 60000);
    receiver.onmessage = (e) => {
      clearTimeout(timeout);
      e.data.error ? reject(Error(e.data.error)) : resolve(e.data);
    };
    receiver.onerror = (e) => {
      clearTimeout(timeout);
      reject(Error(e.message));
    };
    receiver.postMessage(command);
  });
}
export async function transfer() {
  const script = `let world,blob;
 const __name=(value)=>value;
 const exportCompactGzip=${exportCompactGzip.toString()};
 function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
 self.onmessage=async e=>{try{if(e.data.type==='load'){world=freeze(e.data.world);self.postMessage({loaded:true});}
 else {const t=performance.now();const result=await exportCompactGzip(world);blob=result.blob;self.postMessage({exportMs:performance.now()-t,jsonBytes:result.jsonBytes,blobBytes:blob.size,compression:'gzip'});}}
 catch(error){self.postMessage({error:String(error)});}};`;
  const url = URL.createObjectURL(
    new Blob([script], { type: "text/javascript" }),
  );
  receiver = new Worker(url);
  URL.revokeObjectURL(url);
  const t = performance.now();
  await receive({ type: "load", world });
  return { transferAndFreezeMs: performance.now() - t };
}
export async function exportJson() {
  return receive({ type: "export" });
}
export function summary() {
  return {
    entities: world.entities,
    complete: world.complete,
    nextMonth: world.nextMonth,
    format: world.version,
  };
}
