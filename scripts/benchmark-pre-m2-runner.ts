import { SliceSimulation } from "./src/engine/v2/engine";
import { emotionalScenario } from "./src/engine/v2/scenario";
import { rules } from "./src/engine/v2/rules";
import type { Scenario } from "./src/engine/v2/types";
import { performance } from "node:perf_hooks";
import { Session } from "node:inspector";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const seed = "benchmark-pre-m2-100x100-v1";
const s = emotionalScenario(seed);
s.months = 1200;
s.people = [];
s.schedules = [];
s.materials = { paper: 150, ink: 300 };
for (let cohort = 0; cohort < 5; cohort++) {
  const part = emotionalScenario(`${seed}:cohort:${cohort}`);
  const ids = Object.fromEntries(
    part.people.map((p, i) => [
      p.id,
      `person:${String(cohort * 20 + i).padStart(3, "0")}`,
    ]),
  );
  s.people.push(
    ...part.people.map((p) => ({
      ...p,
      id: ids[p.id],
      name: `${p.name} ${cohort + 1}`,
      kin: p.kin.map((id) => ids[id]),
      ...(p.rival ? { rival: ids[p.rival] } : {}),
    })),
  );
  s.schedules.push(
    ...part.schedules.map((schedule) => ({
      ...schedule,
      id: ids[schedule.id],
      until: 1199,
    })),
  );
  if (cohort === 0) {
    s.focal = ids[part.focal];
    s.victim = ids[part.victim];
    s.offender = ids[part.offender];
    s.helper = ids[part.helper];
  }
}
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(s))
  .digest("hex");
if (process.argv.includes("native")) {
  let error = "";
  try {
    new SliceSimulation(s);
  } catch (e) {
    error = String(e);
  }
  console.log(
    JSON.stringify({
      nativeAccepted: !error,
      error,
      maxEvents: rules.maxEvents,
      requestedMonths: s.months,
      agents: s.people.length,
      scenarioHash,
    }),
  );
  process.exit(0);
}
const warm = process.argv.includes("warm");
if (warm) {
  const warmup = structuredClone(s);
  warmup.months = 12;
  new SliceSimulation(warmup).advance();
}
(globalThis as any).gc?.();
const before = process.memoryUsage();
const usageBefore = process.cpuUsage();
let inspector: Session | undefined;
const post = (method: string, params = {}) =>
  new Promise<any>((res, rej) =>
    inspector!.post(method as any, params, (e, r) => (e ? rej(e) : res(r))),
  );
if (process.argv.includes("profile")) {
  inspector = new Session();
  inspector.connect();
  await post("Profiler.enable");
  await post("Profiler.setSamplingInterval", { interval: 1000 });
  await post("Profiler.start");
}
const t0 = performance.now();
const sim = new SliceSimulation(s);
const t1 = performance.now();
sim.advance();
const t2 = performance.now();
const coreMemory = process.memoryUsage(),
  coreUsage = process.cpuUsage(usageBefore),
  corePeakKiB = process.resourceUsage().maxRSS;
if (inspector) {
  const { profile } = await post("Profiler.stop");
  writeFileSync(
    process.argv[process.argv.indexOf("profile") + 1],
    JSON.stringify(profile),
  );
  inspector.disconnect();
}
const t3 = performance.now();
const world = sim.run(); // Complete already: this measures the existing API's final JSON clone, without freezing an extra world getter.
const t4 = performance.now();
const snapshotMemory = process.memoryUsage(),
  snapshotPeakKiB = process.resourceUsage().maxRSS;
const t5 = performance.now();
const json = JSON.stringify(world);
const t6 = performance.now();
const bytes = Buffer.byteLength(json);
const types: Record<string, number> = {};
for (const e of world.events) types[e.type] = (types[e.type] || 0) + 1;
const persons = Object.values(world.entities).filter(
  (e) => e.kind === "person",
);
const decisions = world.events.filter((e) => e.decision).length;
console.log(
  JSON.stringify({
    seed,
    scenarioHash,
    agents: s.people.length,
    months: s.months,
    completed: world.complete,
    nextMonth: world.nextMonth,
    warmupMonths: warm ? 12 : 0,
    profiled: !!inspector,
    constructorMs: t1 - t0,
    advanceMs: t2 - t1,
    coreMs: t2 - t0,
    snapshotMs: t4 - t3,
    apiTotalMs: t2 - t0 + (t4 - t3),
    jsonEncodeMs: t6 - t5,
    jsonBytes: bytes,
    cpuUserMs: coreUsage.user / 1000,
    cpuSystemMs: coreUsage.system / 1000,
    corePeakRssKiB: corePeakKiB,
    snapshotPeakRssKiB: snapshotPeakKiB,
    before,
    coreMemory,
    snapshotMemory,
    events: world.events.length,
    eventsPerYear: world.events.length / 100,
    decisions,
    alive: persons.filter((p) => p.alive).length,
    present: persons.filter((p) => p.present).length,
    eventTypes: types,
  }),
);
