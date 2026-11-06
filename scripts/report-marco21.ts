import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { bodyScenario } from "../src/engine/v2/body-scenario";
import { SliceSimulation } from "../src/engine/v2/engine";
import { openCompact } from "../src/engine/v2/compact-log";
import { validateCompact } from "../src/engine/v2/validate";
import type { Duel, Wound } from "../src/engine/v2/body";
const dir = "reports/marco21";
mkdirSync(dir, { recursive: true });
const batches: any = {},
  examples: any[] = [];
let invalid = 0;
for (const prefix of ["duelo-2a", "reservado-2a", "novo-21"]) {
  const rows: any[] = [],
    outcomes: Record<string, number> = {},
    terminations: Record<string, number> = {};
  for (let i = 0; i < 100; i++) {
    const seed = `${prefix}-${String(i).padStart(3, "0")}`,
      w = new SliceSimulation(bodyScenario(seed)).runCompact(),
      errors = validateCompact(w);
    if (errors.length) {
      invalid++;
      console.error(seed, errors.slice(0, 5));
    }
    const d = Object.values(w.entities).find(
      (e): e is Duel => e.kind === "duel",
    )!;
    const wounds = Object.values(w.entities).filter(
      (e): e is Wound => e.kind === "wound",
    );
    const events = [...openCompact(w).events];
    const choices = events.filter(
      (e) => e.type === "duel.choice" && e.data.stopped,
    );
    const clotted = events
      .filter((e) => e.type === "blood.interval")
      .flatMap((e) => (e.data.clotted || []) as string[]);
    const row = {
      seed,
      outcome: d.outcome,
      termination: d.termination,
      started: d.started,
      wounds: wounds.length,
      aliveWounded: [
        ...new Set(
          wounds
            .filter((wd) => (w.entities[wd.owner] as any).alive)
            .map((wd) => wd.owner),
        ),
      ].length,
      clotted: [...new Set(clotted)].length,
      clottedWithoutCare: [...new Set(clotted)].filter(
        (id) => !wounds.find((wd) => wd.id === id)?.care,
      ).length,
      spontaneousByVessel: Object.fromEntries(
        ["capillary", "vein", "artery"].map((vessel) => [
          vessel,
          [...new Set(clotted)].filter((id) =>
            wounds.some(
              (wd) => wd.id === id && !wd.care && wd.vessel === vessel,
            ),
          ).length,
        ]),
      ),
      stoppingActor: choices[0]?.participants[0].id || null,
      stoppingInjured: choices[0]?.data.injured || false,
      events: w.log.rows.length,
      bytes: Buffer.byteLength(JSON.stringify(w)),
      errors,
    };
    rows.push(row);
    outcomes[d.outcome] = (outcomes[d.outcome] || 0) + 1;
    terminations[d.termination] = (terminations[d.termination] || 0) + 1;
    if (
      choices.length &&
      !examples.some((e) => e.termination === d.termination)
    ) {
      examples.push({ ...row, choice: choices[0], wounds });
      writeFileSync(`${dir}/${seed}.json`, JSON.stringify(w));
    }
  }
  batches[prefix] = {
    outcomes,
    terminations,
    started: rows.filter((r) => r.started).length,
    survivedInjury: rows.filter((r) => r.aliveWounded > 0).length,
    spontaneousClots: rows.reduce((n, r) => n + r.clottedWithoutCare, 0),
    spontaneousByVessel: Object.fromEntries(
      ["capillary", "vein", "artery"].map((vessel) => [
        vessel,
        rows.reduce((n, r) => n + r.spontaneousByVessel[vessel], 0),
      ]),
    ),
    rows,
  };
  console.log(
    prefix,
    JSON.stringify({
      outcomes,
      terminations,
      spontaneousClots: batches[prefix].spontaneousClots,
    }),
  );
}
const previous = JSON.parse(readFileSync("docs/MARCO2-METRICS.json", "utf8"));
const result = {
  engine: "agents-slice-2.1",
  assumption: "suposição de design, não verificado",
  noQuota: true,
  invalid,
  batches,
  examples,
  previous: Object.fromEntries(
    Object.entries(previous.batches).map(([k, v]: any) => [
      k,
      { outcomes: v.counts, terminations: v.terminations },
    ]),
  ),
};
writeFileSync("docs/MARCO21-METRICS.json", JSON.stringify(result, null, 2));
if (invalid) process.exitCode = 1;
