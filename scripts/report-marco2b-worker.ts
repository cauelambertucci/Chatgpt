import { writeFileSync, mkdirSync } from "node:fs";
import { lifeScenario } from "../src/engine/v2/life-scenario";
import { SliceSimulation } from "../src/engine/v2/engine";
import { validateCompact } from "../src/engine/v2/validate";
import { openCompact } from "../src/engine/v2/compact-log";
import { lineageDepth } from "../src/engine/v2/life-audit";
import type { Life, Pregnancy } from "../src/engine/v2/life";
import type { Wound } from "../src/engine/v2/body";
const start = Number(process.argv[2]),
  end = Number(process.argv[3]),
  rows: any[] = [],
  stories: any[] = [];
mkdirSync("reports/marco2b", { recursive: true });
for (let i = start; i < end; i++) {
  const prefix = i < 100 ? "linhagem-2b" : "reservado-2b",
    seed = `${prefix}-${String(i % 100).padStart(3, "0")}`,
    w = new SliceSimulation(lifeScenario(seed)).runCompact(),
    errors = validateCompact(w),
    events = [...openCompact(w).events],
    depth = lineageDepth(w.entities),
    persons = Object.values(w.entities).filter(
      (e: any) => e.kind === "person",
    ) as any[];
  const lives = Object.values(w.entities).filter(
      (e): e is Life => e.kind === "life",
    ),
    preg = Object.values(w.entities).filter(
      (e): e is Pregnancy => e.kind === "pregnancy",
    ),
    wounds = Object.values(w.entities).filter(
      (e): e is Wound => e.kind === "wound" && !!e.permanent,
    );
  const ancestor = (a: string, b: string): boolean =>
    a === b ||
    (w.entities[`life:${b}`] as Life).parents.some((p) => ancestor(a, p));
  const maxGeneration = Math.max(...depth.values()),
    descendant = lives.find(
      (l) =>
        (depth.get(l.owner) || 0) >= 3 &&
        wounds.some((wd) => ancestor(wd.owner, l.owner)),
    );
  const deaths = events.filter((e) => e.type === "person.died"),
    births = events.filter((e) => e.type === "person.born");
  const row = {
    seed,
    initial: w.scenario.people.length,
    births: births.length,
    deaths: deaths.length,
    naturalDeaths: deaths.filter((e) => e.data.natural).length,
    living: persons.filter((p) => p.alive).length,
    pregnancies: preg.length,
    losses: preg.filter((g) => g.status === "lost").length,
    pending: preg.filter((g) => g.status === "gestating").length,
    maxGeneration,
    peakPopulation: Math.max(
      ...events
        .filter((e) => e.type === "population.balance")
        .map((e) => Number(e.data.living)),
    ),
    orphanDecisions: events.filter(
      (e) => e.type === "guardianship.decided" && e.data.orphan,
    ).length,
    unassigned: events.filter(
      (e) =>
        e.type === "guardianship.decided" && e.data.orphan && !e.data.chosen,
    ).length,
    duelSequelaLineage: !!descendant,
    events: w.log.rows.length,
    bytes: Buffer.byteLength(JSON.stringify(w)),
    errors,
  };
  rows.push(row);
  if (
    maxGeneration >= 3 &&
    (stories.filter((s) => !s.duelSequelaLineage).length < 2 ||
      (descendant && !stories.some((s) => s.duelSequelaLineage)))
  ) {
    const child =
      descendant?.owner ||
      lives.find((l) => depth.get(l.owner) === maxGeneration)!.owner;
    const family = new Set<string>();
    const collect = (id: string) => {
      if (family.has(id)) return;
      family.add(id);
      for (const p of (w.entities[`life:${id}`] as Life).parents) collect(p);
    };
    collect(child);
    const selected = events.filter(
      (e) =>
        [
          "person.born",
          "person.died",
          "pregnancy.lost",
          "guardianship.decided",
          "sequela.confirmed",
          "sequela.perceived",
          "emotion.felt",
          "person.transformed",
          "development.period",
        ].includes(e.type) && e.participants.some((p) => family.has(p.id)),
    );
    const story = JSON.parse(
      JSON.stringify({
        ...row,
        descendant: child,
        genealogy: lives
          .filter((l) => family.has(l.owner))
          .map((l) => ({
            id: l.owner,
            name: (w.entities[l.owner] as any).name,
            parents: l.parents,
            birthMonth: l.birthMonth,
            generation: depth.get(l.owner),
            death: (w.entities[l.owner] as any).death || null,
          })),
        timeline: selected.map((e) => ({
          id: e.id,
          month: e.month,
          type: e.type,
          participants: e.participants,
          causes: e.causes,
          data: e.data,
        })),
        sequela: wounds.filter((wd) => family.has(wd.owner)),
      }),
    );
    stories.push(story);
    writeFileSync(`reports/marco2b/${seed}.json`, JSON.stringify(w));
  }
  if (errors.length) console.error(seed, errors.slice(0, 3));
  if ((i - start + 1) % 10 === 0)
    console.log(`${start}-${end}: ${i - start + 1} seeds`);
}
writeFileSync(
  `reports/marco2b/part-${start}.json`,
  JSON.stringify({ rows, stories }),
);
