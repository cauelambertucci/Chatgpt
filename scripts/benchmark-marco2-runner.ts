import { SliceSimulation } from "./src/engine/v2/engine";
import { memoryScenario } from "./scenario";
import { output, eventStream } from "./adapter";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
const s = memoryScenario();
const base = structuredClone(s);
delete base.bodySimulation;
const baseScenarioHash = createHash("sha256")
  .update(JSON.stringify(base))
  .digest("hex");
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(s))
  .digest("hex");
if (process.argv.includes("warm")) {
  const w = structuredClone(s);
  w.months = 12;
  new SliceSimulation(w).advance();
}
(globalThis as any).gc?.();
const start = performance.now();
const sim = new SliceSimulation(s);
sim.advance();
const coreMs = performance.now() - start;
const coreMemory = process.memoryUsage(),
  corePeakRssKiB = process.resourceUsage().maxRSS;
const copyStart = performance.now();
const world = output(sim);
const snapshotMs = performance.now() - copyStart;
const snapshotMemory = process.memoryUsage(),
  snapshotPeakRssKiB = process.resourceUsage().maxRSS;
const jsonStart = performance.now();
const json = JSON.stringify(world);
const jsonEncodeMs = performance.now() - jsonStart;
const jsonBytes = Buffer.byteLength(json),
  exportMemory = process.memoryUsage(),
  exportPeakRssKiB = process.resourceUsage().maxRSS;
// Equivalence digest and replay are deliberately outside every timed/memory phase.
const canonical = (_key: string, v: any) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(
        Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      )
    : v;
const hash = createHash("sha256");
let events = 0,
  decisions = 0;
const types: Record<string, number> = {};
for (const e of eventStream(world)) {
  hash.update(JSON.stringify(e, canonical));
  hash.update("\n");
  events++;
  if (e.decision) decisions++;
  types[e.type] = (types[e.type] || 0) + 1;
}
const entitiesHash = createHash("sha256")
  .update(JSON.stringify(world.entities, canonical))
  .digest("hex");
console.log(
  JSON.stringify({
    scenarioHash,
    baseScenarioHash,
    bodies: Object.values(world.entities).filter((e: any) => e.kind === "body")
      .length,
    wounds: Object.values(world.entities).filter((e: any) => e.kind === "wound")
      .length,
    duels: Object.values(world.entities).filter((e: any) => e.kind === "duel")
      .length,
    deaths: Object.values(world.entities).filter(
      (e: any) => e.kind === "person" && !e.alive,
    ).length,
    coreMs,
    snapshotMs,
    apiTotalMs: coreMs + snapshotMs,
    jsonEncodeMs,
    jsonBytes,
    coreMemory,
    snapshotMemory,
    exportMemory,
    corePeakRssKiB,
    snapshotPeakRssKiB,
    exportPeakRssKiB,
    events,
    decisions,
    types,
    eventHash: hash.digest("hex"),
    entitiesHash,
    completed: world.complete,
    nextMonth: world.nextMonth,
    format: world.version,
  }),
);
