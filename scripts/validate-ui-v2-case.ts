import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SliceSimulation } from "../src/engine/v2/engine";
import { Archive, lightScenario } from "../src/ui/v2/model";
import { auditLifeCompact } from "../src/engine/v2/life-audit";
import { validateCompact } from "../src/engine/v2/validate";
import { replayCompact } from "../src/engine/v2/compact-log";
const seed = process.argv[2],
  index = Number(seed.slice(-3));
const started = performance.now(),
  w = new SliceSimulation(lightScenario(seed)).runCompact(),
  a = new Archive(w);
const hash = (x: unknown) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
const replayEqual = hash(replayCompact(w)) === hash(w.entities);
const errors = [...auditLifeCompact(w), ...validateCompact(w)];
if (!replayEqual) errors.push("Replay mismatch");
const target =
  index === 0
    ? "person:01"
    : a.people.find((p) => (a.generation(p.id) ?? -1) >= (index === 1 ? 1 : 2))
        ?.id || a.people[0].id;
const facts = a
  .biography(target)
  .map((e) => ({
    id: e.id,
    month: e.month,
    type: e.type,
    text: a.narrate(e),
    causes: [...e.causes],
  }));
for (const fact of facts)
  for (const id of fact.causes)
    if (!a.event(id) || a.event(id)!.seq >= Number(fact.id.slice(6)))
      errors.push(`Invalid cause ${id}`);
const result = {
  seed,
  founders: w.scenario.people.length,
  months: w.nextMonth,
  complete: w.complete,
  people: a.people.length,
  alive: a.people.filter((p) => p.alive).length,
  events: w.log.rows.length,
  errors,
  replayEqual,
  diagnosticMs: performance.now() - started,
  entityHash: hash(w.entities),
  person: target,
  name: a.name(target),
  generation: a.generation(target),
  introduction: a.introduction(target),
  facts,
};
writeFileSync(`reports/ui-v2/${seed}.json`, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    seed,
    people: result.people,
    events: result.events,
    errors,
    replayEqual,
    biography: target,
  }),
);
if (errors.length) process.exitCode = 1;
