import { Session } from "node:inspector";
import { performance } from "node:perf_hooks";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { SliceSimulation } from "../src/engine/v2/engine";
import { settlementScenario } from "../src/engine/v2/politics";
const tag = process.argv[2] || "before";
const seed = process.argv[3] || "reservado-2b-006";
mkdirSync("reports/m3-review", { recursive: true });
const scenario = settlementScenario(seed, 40);
const warm = structuredClone(scenario);
warm.months = 12;
new SliceSimulation(warm).advance();
(globalThis as any).gc?.();
const session = new Session();
const post = (method: string) =>
  new Promise<any>((resolve, reject) =>
    session.post(method as any, (e, r) => (e ? reject(e) : resolve(r))),
  );
const profile = process.argv.includes("--profile");
if (profile) {
  session.connect();
  await post("Profiler.enable");
  await post("Profiler.start");
}
const t = performance.now();
const sim = new SliceSimulation(scenario);
sim.advance();
const ms = performance.now() - t;
const memory = {
  rssPeak: process.resourceUsage().maxRSS * 1024,
  ...process.memoryUsage(),
};
if (profile) {
  const r = await post("Profiler.stop");
  writeFileSync(
    `reports/m3-review/${tag}.cpuprofile`,
    JSON.stringify(r.profile),
  );
  session.disconnect();
}
const w = sim.runCompact();
const json = JSON.stringify(w);
const hash = createHash("sha256").update(json).digest("hex");
writeFileSync(
  `reports/m3-review/${tag}.bench.json`,
  JSON.stringify(
    {
      seed,
      ms,
      memory,
      hash,
      events: w.log.rows.length,
      jsonBytes: Buffer.byteLength(json),
      profile,
    },
    null,
    2,
  ),
);
console.log({ tag, seed, ms, hash, memory, events: w.log.rows.length });
