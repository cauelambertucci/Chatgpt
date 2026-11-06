import { mkdirSync, writeFileSync } from "node:fs";
import { bodyScenario, bodyFixture } from "../src/engine/v2/body-scenario";
import { SliceSimulation } from "../src/engine/v2/engine";
import { validateCompact } from "../src/engine/v2/validate";
import { openCompact, replayCompact } from "../src/engine/v2/compact-log";
import { collapsedCausality } from "../src/engine/v2/causal";
import type { Duel, Wound, Kill } from "../src/engine/v2/body";
const out = "reports/marco2";
mkdirSync(out, { recursive: true });
const batches: any = {},
  stories: any[] = [];
let invalid = 0;
for (const prefix of ["duelo-2a", "reservado-2a"]) {
  const counts: Record<string, number> = {},
    terminations: Record<string, number> = {},
    rows = [];
  for (let i = 0; i < 100; i++) {
    const seed = `${prefix}-${String(i).padStart(3, "0")}`,
      world = new SliceSimulation(bodyScenario(seed)).runCompact(),
      errors = validateCompact(world),
      view = openCompact(world);
    if (errors.length) {
      invalid++;
      console.error(seed, errors.slice(0, 4));
    }
    const duel = Object.values(world.entities).find(
      (e): e is Duel => e.kind === "duel",
    )!;
    counts[duel.outcome] = (counts[duel.outcome] || 0) + 1;
    terminations[duel.termination] = (terminations[duel.termination] || 0) + 1;
    const wounds = Object.values(world.entities).filter(
      (e): e is Wound => e.kind === "wound",
    );
    const kills = Object.values(world.entities).filter(
      (e): e is Kill => e.kind === "kill",
    );
    const row = {
      seed,
      outcome: duel.outcome,
      termination: duel.termination,
      wounds: wounds.length,
      kills: kills.length,
      events: world.log.rows.length,
      bytes: Buffer.byteLength(JSON.stringify(world)),
      errors,
    };
    rows.push(row);
    // Examples are selected after generation. No seed is rejected or regenerated for an outcome.
    const category =
      duel.outcome === "sequela permanente"
        ? "sequela"
        : duel.outcome === "recuperação"
          ? "recuperação"
          : duel.outcome.includes("morte")
            ? "morte"
            : undefined;
    if (
      prefix === "duelo-2a" &&
      stories.length < 3 &&
      category &&
      !stories.some((s) => s.category === category) &&
      duel.started &&
      wounds.length
    ) {
      const end = duel.lastEvent,
        graph = collapsedCausality(view, end),
        events = [...view.events];
      const physicalPerceptions = new Set(
        events
          .filter((e) =>
            ["injury.perceived", "sequela.perceived"].includes(e.type),
          )
          .map((e) => e.id),
      );
      const physicalEmotions = new Set(
        events
          .filter(
            (e) =>
              e.type === "emotion.felt" &&
              physicalPerceptions.has(String(e.data.stimulusSource)),
          )
          .map((e) => e.id),
      );
      const relevant = events.filter(
        (e) =>
          [
            "duel.agreed",
            "attack.contact",
            "wound.created",
            "care.requested",
            "care.controlled",
            "body.death",
            "person.died",
            "kill.credited",
            "sequela.confirmed",
            "wound.healed",
            "injury.perceived",
            "sequela.perceived",
            "emotion.felt",
            "person.transformed",
            "physicalGoal.reassessed",
          ].includes(e.type) &&
          (!["emotion.felt", "person.transformed"].includes(e.type) ||
            physicalEmotions.has(e.id) ||
            physicalEmotions.has(String(e.data.emotion))),
      );
      stories.push({
        ...row,
        category,
        a: (world.entities[duel.a] as any).name,
        b: (world.entities[duel.b] as any).name,
        depth: graph.depth,
        chain: graph.chain,
        events: relevant.map((e) => ({
          id: e.id,
          month: e.month,
          type: e.type,
          participants: e.participants,
          data: e.data,
        })),
        wounds,
        kills,
      });
      writeFileSync(`${out}/${seed}.json`, JSON.stringify(world));
    }
  }
  batches[prefix] = { counts, terminations, rows };
  console.log(prefix, counts);
}
const fixtures = [];
for (const care of [true, false]) {
  const s = bodyFixture();
  s.bodySimulation!.care = care;
  const w = new SliceSimulation(s).runCompact(),
    errors = validateCompact(w);
  if (errors.length) invalid++;
  writeFileSync(
    `${out}/fixture-${care ? "care" : "no-care"}.json`,
    JSON.stringify(w),
  );
  fixtures.push({
    care,
    errors,
    events: [...openCompact(w).events]
      .filter((e) =>
        [
          "attack.contact",
          "blood.interval",
          "sequela.confirmed",
          "person.died",
          "kill.credited",
        ].includes(e.type),
      )
      .map((e) => ({ id: e.id, type: e.type, data: e.data })),
  });
}
const result = {
  engine: "agents-slice-2a",
  assumption: "suposição de design, não verificado",
  invalid,
  noQuota: true,
  batches,
  stories,
  fixtures,
};
writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
writeFileSync(
  "docs/MARCO2-METRICS.json",
  JSON.stringify(
    {
      ...result,
      batches: Object.fromEntries(
        Object.entries(batches).map(([k, v]: any) => [
          k,
          { counts: v.counts, terminations: v.terminations },
        ]),
      ),
    },
    null,
    2,
  ),
);
console.log("invalid", invalid);
if (invalid) process.exitCode = 1;
