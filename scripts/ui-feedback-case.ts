import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { SliceSimulation } from "../src/engine/v2/engine";
import { Archive, lightScenario } from "../src/ui/v2/model";
import { eventLabels } from "../src/ui/v2/labels";
import { auditLifeCompact } from "../src/engine/v2/life-audit";
import { validateCompact } from "../src/engine/v2/validate";
import { replayCompact, type CompactWorld } from "../src/engine/v2/compact-log";
const seed = process.argv[2],
  file = `reports/ui-feedback/${seed}.world.json`;
const reused = existsSync(file),
  w: CompactWorld = reused
    ? JSON.parse(readFileSync(file, "utf8"))
    : new SliceSimulation(lightScenario(seed)).runCompact();
if (!reused) writeFileSync(file, JSON.stringify(w));
const a = new Archive(w),
  hash = (x: unknown) =>
    createHash("sha256").update(JSON.stringify(x)).digest("hex");
const errors = [...auditLifeCompact(w), ...validateCompact(w)];
const replayEqual = hash(replayCompact(w)) === hash(w.entities);
if (!replayEqual) errors.push("Replay mismatch");
const usedTypes = new Set<string>();
for (let i = 0; i < w.log.rows.length; i++) usedTypes.add(a.event(i)!.type);
for (const type of usedTypes)
  if (!eventLabels[type]) errors.push(`Missing Portuguese label: ${type}`);
const ranking = a.people
  .map((p) => {
    const facts = a.biography(p.id),
      ownDeath = a.family.deaths.get(p.id)?.month ?? w.nextMonth;
    const wounds = facts.filter(
      (e) =>
        e.type === "wound.created" &&
        e.participants.some((q) => q.id === p.id && q.role === "victim"),
    ).length;
    const sequelae = facts.filter(
      (e) =>
        e.type === "sequela.confirmed" &&
        e.participants.some((q) => q.id === p.id && q.role === "actor"),
    ).length;
    const widowhood = a.family
      .partners(p.id)
      .filter(
        (q) =>
          q.reason === "morte" &&
          q.end !== undefined &&
          q.people.some(
            (id) => id !== p.id && a.family.deaths.get(id)?.month === q.end,
          ),
      ).length;
    const childLosses = (a.children.get(p.id) || []).filter((id) => {
      const death = a.family.deaths.get(id);
      return death && death.month < ownDeath;
    }).length;
    const score =
      (sequelae ? 40 : 0) +
      (wounds ? 10 : 0) +
      Math.min(widowhood, 3) * 8 +
      Math.min(childLosses, 3) * 15 +
      Math.min(facts.length, 100) / 100;
    return {
      id: p.id,
      name: a.name(p.id),
      wounds,
      sequelae,
      widowhood,
      childLosses,
      score,
    };
  })
  .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
const chosen = ranking[0],
  facts = a.biography(chosen.id).map((e) => ({
    id: e.id,
    type: e.type,
    month: e.month,
    text: a.narrate(e),
    causes: [...e.causes],
  }));
const result = {
  seed,
  reused,
  founders: w.scenario.people.length,
  months: w.nextMonth,
  people: a.people.length,
  events: w.log.rows.length,
  errors,
  replayEqual,
  entityHash: hash(w.entities),
  usedTypes: [...usedTypes].sort(),
  chosen,
  ranking: ranking.slice(0, 5),
  children: (a.children.get(chosen.id) || []).map((id) => ({
    id,
    name: a.name(id),
    lifespan: a.lifeSpan(id),
    birth: a.life(id),
    death: a.family.deaths.get(id)?.month,
  })),
  partnerships: a.family.partners(chosen.id),
  paragraphs: a.paragraphs(chosen.id),
  facts,
};
writeFileSync(
  `reports/ui-feedback/${seed}.summary.json`,
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({ seed, people: result.people, errors, chosen, reused }),
);
if (errors.length) process.exitCode = 1;
