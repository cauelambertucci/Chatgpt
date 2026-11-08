import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { SliceSimulation } from "../src/engine/v2/engine";
import { livelihoodScenario } from "../src/engine/v2/daily-scenario";
import { CompactLog, replayCompact } from "../src/engine/v2/compact-log";
import { validateCompact } from "../src/engine/v2/validate";
const [seed, mode] = process.argv.slice(2),
  dir = "reports/economy-fix";
mkdirSync(dir, { recursive: true });
const cached=mode==='before' && seed==='reservado-2b-006' && existsSync(`reports/marco2d2/${seed}.world.json`);
if (
  mode === "before" &&
  !cached &&
  new SliceSimulation(livelihoodScenario(seed, 40)).runCompact(0).engine !==
    "agents-slice-2d2"
)
  throw Error(
    "Antes exige o motor do commit d282fae. Não rotular o motor corrigido como baseline.",
  );
const start = performance.now();
const w =
  cached
    ? JSON.parse(readFileSync(`reports/marco2d2/${seed}.world.json`, "utf8"))
    : new SliceSimulation(livelihoodScenario(seed, 40)).runCompact();
if(mode==='before' && w.engine!=='agents-slice-2d2')throw Error('Arquivo de baseline incompatível');
const ms = performance.now() - start,
  rss = process.resourceUsage().maxRSS * 1024,
  log = CompactLog.from(w.log),
  homes = new Set<string>(),
  initialHomes = new Set<string>(),
  hungry = new Set<string>(),
  cultivators = new Set<string>(),
  jobs = new Map<string, string>(),
  assigned = new Map<number, Set<string>>();
let firstHunger: number | null = null,
  production = 0,
  workMonths = 0,
  required = 0,
  consumed = 0;
for (let i = 0; i < log.length; i++) {
  const e = log.event(i),
    d = e.data;
  if (e.type === "occupation.changed")
    jobs.set(e.participants[0].id, String(d.occupation));
  if (e.type === "livelihood.period" && d.task === "cultivar") {
    production += Number(d.food);
    workMonths++;
    cultivators.add(e.participants[0].id);
  }
  if (e.type === "household.consumption") {
    homes.add(String(d.household));
    if (e.month === 0) initialHomes.add(String(d.household));
    required += Number(d.required);
    consumed += Number(d.consumed);
    if (!assigned.has(e.month)) assigned.set(e.month, new Set());
    for (const id of d.residents as string[])
      if (jobs.get(id) === "cultivador") assigned.get(e.month)!.add(id);
  }
  if (e.type === "hunger.changed" && Number(d.after) >= 40) {
    firstHunger ??= e.month + 1;
    const c = log.event(Number(e.causes[0].slice(6)));
    hungry.add(String(c.data.household));
  }
}
const living = Object.values(w.entities).filter(
    (p: any) => p.kind === "person" && p.alive,
  ) as any[],
  occupied = new Set(
    living.map((p) => (w.entities[`life:${p.id}`] as any).household),
  );
const result = {
  seed,
  mode,
  firstHungerMonth: firstHunger,
  uniqueCultivators: cultivators.size,
  cultivatorsPerCalendarMonth:
    [...assigned.values()].reduce((n, s) => n + s.size, 0) / 1200,
  productiveCultivatorsPerCalendarMonth: workMonths / 1200,
  foodPerCultivatorWorkMonth: production / workMonths,
  requiredPerCalendarMonth: required / 1200,
  producedPerCalendarMonth: production / 1200,
  consumedPerCalendarMonth: consumed / 1200,
  occupiedInitially: initialHomes.size,
  everOccupied: homes.size,
  hungryHouseholds: hungry.size,
  occupiedAt100: occupied.size,
  initialOccupiedStillAt100: [...initialHomes].filter((h) => occupied.has(h))
    .length,
  living: living.length,
  ms: mode === "before" && seed.endsWith("006") ? null : ms,
  rss,
  jsonBytes: Buffer.byteLength(JSON.stringify(w)),
  errors: validateCompact(w),
  replayEqual: JSON.stringify(replayCompact(w)) === JSON.stringify(w.entities),
};
writeFileSync(`${dir}/${seed}.${mode}.json`, JSON.stringify(result, null, 2));
if (mode === "after")
  writeFileSync(`${dir}/${seed}.after.world.json`, JSON.stringify(w));
console.log(result);
if (result.errors.length || !result.replayEqual) process.exitCode = 1;
