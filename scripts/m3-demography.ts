import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { SliceSimulation } from "../src/engine/v2/engine";
import { livelihoodScenario } from "../src/engine/v2/daily-scenario";
import { demographicScenario } from "../src/engine/v2/demographic-scenario";
import { CompactLog, type CompactWorld } from "../src/engine/v2/compact-log";
function metrics(w: CompactWorld) {
  const log = CompactLog.from(w.log);
  const es = [
    ...log.select(
      new Set([
        "person.born",
        "partnership.formed",
        "person.died",
        "pregnancy.conceived",
      ]),
    ),
  ];
  const births = es.filter((e) => e.type === "person.born");
  const years = Array(100).fill(0);
  let age = 0;
  for (const e of births) {
    years[Math.floor(e.month / 12)]++;
    const m = w.entities[`life:${(e.data.parents as string[])[0]}`] as any;
    age += (e.month - m.birthMonth) / 12;
  }
  const lives = Object.values(w.entities).filter(
    (e: any) => e.kind === "life",
  ) as any[];
  const live = lives.filter((l) => (w.entities[l.owner] as any).alive);
  return {
    birthsByYear: years,
    births: births.length,
    lastBirth: Math.max(-1, ...births.map((e) => Math.floor(e.month / 12))),
    maternalAge: age / births.length,
    partnerships: es.filter((e) => e.type === "partnership.formed").length,
    living: live.length,
    minorHomes: new Set(
      live.filter((l) => 1200 - l.birthMonth < 216).map((l) => l.household),
    ).size,
    deathsByCause: es
      .filter((e) => e.type === "person.died")
      .reduce(
        (a, e) => {
          const k = String(e.data.cause);
          a[k] = (a[k] || 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
  };
}
mkdirSync("reports/m3", { recursive: true });
const seed = process.argv[2];
const current = JSON.parse(
  readFileSync(`reports/books/${seed}.after.world.json`, "utf8"),
);
const barriers: Record<string, number> = {};
const baseline = new SliceSimulation(
  process.argv[3] === "fixed"
    ? livelihoodScenario(seed, 40)
    : demographicScenario(seed, 40, true),
  undefined,
  {
    observeConception: (d) => {
      if (d.reproductiveWindow)
        for (const r of d.reasons) barriers[r] = (barriers[r] || 0) + 1;
    },
  },
).runCompact();
const r = {
  seed,
  comparison: process.argv[3] === "fixed" ? "recuperacao_corrigida" : "2c",
  baseline: metrics(baseline),
  current: metrics(current),
  baselineBarriers: barriers,
};
writeFileSync(
  `reports/m3/${seed}.${process.argv[3] || "baseline"}.demography.json`,
  JSON.stringify(r, null, 2),
);
console.log(JSON.stringify(r));
