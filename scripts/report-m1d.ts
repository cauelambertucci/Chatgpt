import { renderM1dReport } from "./render-m1d-report.mjs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { emotionalScenario } from "../src/engine/v2/scenario";
import { simulateSlice, getPerson } from "../src/engine/v2/engine";
import { validateSlice } from "../src/engine/v2/validate";
import {
  personalGoals,
  personalStories,
} from "../src/engine/v2/personal-report";
import {
  lossFixture,
  recurringFixture,
} from "../src/engine/v2/emotional-fixtures";
const dir = "reports/marco1d";
mkdirSync(dir, { recursive: true });
const baseline = JSON.parse(readFileSync("docs/MARCO1D-BASELINE.json", "utf8"));
const frozen = JSON.parse(
  readFileSync("docs/MARCO1D-FROZEN-RULES.json", "utf8"),
);
const engine = readFileSync("src/engine/v2/engine.ts", "utf8");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const frozenChecks = Object.fromEntries(
  Object.entries(frozen).map(([key, value]) => {
    const input =
      key === "socialize"
        ? engine.slice(
            engine.indexOf("  private socialize("),
            engine.indexOf("  private perceiveThreat("),
          )
        : key === "writeWork"
          ? engine.slice(
              engine.indexOf("  private writeWork("),
              engine.indexOf("  private knownAllies("),
            )
          : readFileSync(key, "utf8");
    return [key, hash(input) === value];
  }),
);
if (Object.values(frozenChecks).includes(false))
  throw Error("Approved rules modified: " + JSON.stringify(frozenChecks));
const countGoals = (gs: any[]) => {
  const counts: Record<string, Record<string, number>> = {};
  for (const g of gs) {
    counts[g.type] ||= {};
    counts[g.type][g.status] = (counts[g.type][g.status] || 0) + 1;
  }
  return counts;
};
const batches: Record<string, unknown> = {};
const examples: any[] = [];
let invalid = 0;
const started = performance.now();
for (const prefix of ["pessoal-1c", "reservado-1d"]) {
  const rows: any[] = [];
  const emotions: Record<string, number> = {},
    responses: Record<string, number> = {},
    sanctions: Record<string, number> = {};
  let maxThreats = 0,
    maxMs = 0,
    totalEvents = 0,
    transformations = 0,
    highStress = 0,
    emptyRanks = 0;
  for (let i = 0; i < 100; i++) {
    const seed = `${prefix}-${String(i).padStart(3, "0")}`,
      start = performance.now(),
      w = simulateSlice(emotionalScenario(seed));
    const errors = validateSlice(w);
    if (errors.length) {
      invalid++;
      console.error(seed, errors.slice(0, 5));
    }
    const gs = personalGoals(w);
    const ranked = personalStories(w);
    if (!ranked.length) emptyRanks++;
    for (const e of w.events) {
      if (e.type === "emotion.felt") {
        const k = String(e.data.stimulus);
        emotions[k] = (emotions[k] || 0) + 1;
      }
      if (e.type === "person.transformed") transformations++;
      if (e.type === "stress.response") {
        const k = String(e.data.action);
        responses[k] = (responses[k] || 0) + 1;
      }
      if (e.type === "aggressor.consequence") {
        const k = String(e.data.response);
        sanctions[k] = (sanctions[k] || 0) + 1;
      }
      if (e.type === "needs.period" && Number(e.data.stressAfter) >= 650)
        highStress++;
    }
    const localMax = Math.max(
      0,
      ...Object.values((w.entities["place:void"] as any).incidents || {}).map(
        (x: any) => x.threats.length,
      ),
    );
    maxThreats = Math.max(maxThreats, localMax);
    if (localMax > 4) throw Error(`${seed}: recidivism unbounded`);
    // First independently generated examples, by distinct phenomena; no desired outcome quota in generation.
    for (const [category, predicate] of [
      ["transformacao", (e: any) => e.type === "person.transformed"],
      ["consequencia", (e: any) => e.type === "aggressor.consequence"],
      [
        "resolvido_por_outro",
        (e: any) =>
          e.type === "personalGoal.closed" &&
          e.data.status === "resolved_by_other",
      ],
    ] as const)
      if (!examples.some((x) => x.category === category)) {
        const event = w.events.find(predicate);
        if (event) {
          const ancestors = new Set<string>();
          const pending = [event.id];
          while (pending.length) {
            const id = pending.pop()!;
            if (ancestors.has(id)) continue;
            ancestors.add(id);
            pending.push(...w.events[Number(id.split(":")[1])].causes);
          }
          examples.push({
            category,
            seed,
            event: event.id,
            participants: event.participants.map((p) => ({
              name: getPerson(w, p.id).name,
              role: p.role,
            })),
            data: event.data,
            chain: w.events
              .filter(
                (e) =>
                  ancestors.has(e.id) &&
                  [
                    "threat.announced",
                    "information.received",
                    "emotion.felt",
                    "person.transformed",
                    "aggressor.consequence",
                    "personalGoal.closed",
                    "confrontation.prevented",
                  ].includes(e.type),
              )
              .map((e) => ({
                id: e.id,
                month: e.month,
                type: e.type,
                data: e.data,
              })),
            ranked: ranked.slice(0, 1),
          });
          writeFileSync(`${dir}/${seed}.json`, JSON.stringify(w));
        }
      }
    totalEvents += w.events.length;
    maxMs = Math.max(maxMs, performance.now() - start);
    rows.push({
      seed,
      goals: gs.map((g) => ({
        type: g.type,
        status: g.status,
        reason: g.reason,
      })),
      deaths: w.events.filter((e) => e.type === "person.died").length,
      threats: w.events.filter((e) => e.type === "threat.announced").length,
      events: w.events.length,
      ranked: ranked.length,
      errors,
    });
    if (i % 20 === 19) console.log(`${prefix}: ${i + 1}/100`);
  }
  const old = baseline.batches[prefix];
  batches[prefix] = {
    before: {
      counts: countGoals(old.flatMap((x: any) => x.goals)),
      deaths: old.reduce((s: number, x: any) => s + x.deaths, 0),
      threats: old.reduce((s: number, x: any) => s + x.threats, 0),
    },
    after: {
      counts: countGoals(rows.flatMap((x) => x.goals)),
      deaths: rows.reduce((s, x) => s + x.deaths, 0),
      threats: rows.reduce((s, x) => s + x.threats, 0),
      emotions,
      responses,
      sanctions,
      transformations,
      highStressPersonMonths: highStress,
      maxThreatsPerAggressor: maxThreats,
      totalEvents,
      maxMs: Math.round(maxMs),
      emptyRanks,
    },
    rows,
  };
}
const fixtures = [
  lossFixture("irado"),
  lossFixture("solidario"),
  recurringFixture(true),
].map((s, index) => {
  const w = simulateSlice(s),
    errors = validateSlice(w);
  if (errors.length) invalid++;
  writeFileSync(`${dir}/fixture-${index}.json`, JSON.stringify(w));
  return {
    seed: s.seed,
    errors,
    emotions: w.events
      .filter(
        (e) => e.type === "emotion.felt" && e.participants[0].id === s.focal,
      )
      .map((e) => e.data),
    consequences: w.events
      .filter((e) => e.type === "aggressor.consequence")
      .map((e) => e.data),
    counts: countGoals(personalGoals(w)),
  };
});
const result = {
  engine: "agents-slice-1d",
  noQuota: true,
  invalid,
  frozenChecks,
  elapsedMs: Math.round(performance.now() - started),
  batches,
  examples,
  fixtures,
};
writeFileSync(`${dir}/results.json`, JSON.stringify(result, null, 2));
writeFileSync(
  "docs/MARCO1D-METRICS.json",
  JSON.stringify(
    {
      ...result,
      batches: Object.fromEntries(
        Object.entries(batches).map(([k, v]: any) => [
          k,
          { ...v, rows: undefined },
        ]),
      ),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ invalid, frozenChecks, elapsedMs: result.elapsedMs }),
);
renderM1dReport(result);
if (invalid) process.exitCode = 1;
