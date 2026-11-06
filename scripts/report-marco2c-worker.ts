import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { SliceSimulation } from "../src/engine/v2/engine";
import { demographicScenario } from "../src/engine/v2/demographic-scenario";
import { openCompact, CompactLog } from "../src/engine/v2/compact-log";
import { auditLifeCompact } from "../src/engine/v2/life-audit";
import type { Life, Pregnancy } from "../src/engine/v2/life";
import type { Person } from "../src/engine/v2/types";
import { rules } from "../src/engine/v2/rules";
// Harness ceiling only; aborts are retained as errors, never dropped/replaced seeds.
(rules as any).maxEvents = 1000000;
const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const worker = Number(process.argv[3]),
  workers = Number(process.argv[4]);
for (let i = worker; i < jobs.length; i += workers) {
  const job = jobs[i],
    { seed, count, adjusted } = job;
  const file = `reports/marco2c/${job.id}.json`;
  if (process.argv.includes("--resume") && existsSync(file)) continue;
  const pairObs = new Map<
    string,
    {
      all: Record<string, number>;
      window: Record<string, number>;
      opportunities: number;
    }
  >();
  const shadowSingleBarrier: Record<string, number> = {};
  let shadowEligible = 0,
    shadowMultiple = 0;
  const start = performance.now();
  try {
    const s = demographicScenario(seed, count, adjusted);
    const sim = new SliceSimulation(s, undefined, {
      observeConception: (o) => {
        let r = pairObs.get(o.pair);
        if (!r) {
          r = { all: {}, window: {}, opportunities: 0 };
          pairObs.set(o.pair, r);
        }
        for (const reason of o.reasons.length ? o.reasons : ["elegível"]) {
          r.all[reason] = (r.all[reason] || 0) + 1;
          if (o.reproductiveWindow)
            r.window[reason] = (r.window[reason] || 0) + 1;
        }
        if (o.reproductiveWindow) {
          r.opportunities++;
          const gates = o.reasons.filter((x) => x !== "sorteio anual");
          if (!gates.length) shadowEligible++;
          else if (gates.length === 1)
            shadowSingleBarrier[gates[0]] =
              (shadowSingleBarrier[gates[0]] || 0) + 1;
          else shadowMultiple++;
        }
      },
    });
    sim.advance();
    const diagnosticCoreMs = performance.now() - start;
    const w = sim.runCompact(),
      events = CompactLog.from(w.log).select(new Set(["person.died", "person.born", "partnership.formed", "guardianship.decided"]));
    const lives = Object.values(w.entities).filter(
      (e): e is Life => e.kind === "life",
    );
    const pregnancies = Object.values(w.entities).filter(
      (e): e is Pregnancy => e.kind === "pregnancy",
    );
    const persons = Object.values(w.entities).filter(
      (e): e is Person => e.kind === "person",
    );
    const deathMonth = new Map<string, number>(),
      partnered = new Set<string>(),
      pairs = new Map<string, number>();
    const orphans = new Set<string>();
    let guardianshipDecisions = 0,
      orphanDecisions = 0,
      accepted = 0,
      pending = 0,
      natural = 0;
    let peak = count,
      live = count;
    for (const e of events) {
      if (e.type === "person.died") {
        deathMonth.set(String(e.data.victim), e.month);
        live--;
        if (e.data.natural) natural++;
      }
      if (e.type === "person.born") {
        live++;
        peak = Math.max(peak, live);
      }
      if (e.type === "partnership.formed") {
        const ids = e.participants.map((p) => p.id);
        ids.forEach((id) => partnered.add(id));
        pairs.set(ids.sort().join("|"), e.month);
      }
      if (e.type === "guardianship.decided") {
        guardianshipDecisions++;
        if (e.data.orphan) {
          orphans.add(String(e.data.child));
          orphanDecisions++;
          if (e.data.chosen) accepted++;
          else pending++;
        }
      }
    }
    const conceived = new Set(
      pregnancies.map((g) => [...g.parents].sort().join("|")),
    );
    const never = [...pairs].filter(([k]) => !conceived.has(k));
    const allBarriers: Record<string, number> = {};
    let noReproductiveWindow = 0;
    const barriers: Record<string, number> = {},
      dominant: Record<string, number> = {},
      barrierYears: Record<string, number> = {};
    for (const [key] of never) {
      const obs = pairObs.get(key);
      for(const reason of Object.keys(obs?.all || {})) allBarriers[reason]=(allBarriers[reason]||0)+1;
      if(!obs?.opportunities) noReproductiveWindow++;
      const entries = Object.entries(obs?.window || {});
      for (const [reason, n] of entries) {
        barriers[reason] = (barriers[reason] || 0) + 1;
        barrierYears[reason] = (barrierYears[reason] || 0) + n;
      }
      const reason =
        entries.sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0]?.[0] || "sem janela reprodutiva observada";
      dominant[reason] = (dominant[reason] || 0) + 1;
    }
    const exposureMonths = Array(28).fill(0),
      birthsByAge = Array(28).fill(0);
    const gestators = lives.filter((l) => l.role === "gestational");
    const adult = (l: Life) =>
      (deathMonth.get(l.owner) ?? 1199) - l.birthMonth >= 216;
    const first = new Map<string, number>();
    let births = 0;
    for (const g of pregnancies.filter((g) => g.status === "born")) {
      births++;
      const mother = w.entities[`life:${g.parents[0]}`] as Life;
      const child = w.entities[`life:${g.child}`] as Life;
      const age = child.birthMonth - mother.birthMonth;
      const bin = Math.floor(age / 12) - 18;
      if (bin >= 0 && bin < 28) birthsByAge[bin]++;
      first.set(
        mother.owner,
        Math.min(first.get(mother.owner) ?? Infinity, age / 12),
      );
    }
    for (const l of gestators) {
      const end = Math.min(1200, (deathMonth.get(l.owner) ?? 1199) + 1);
      for (let a = 18; a <= 45; a++)
        exposureMonths[a - 18] += Math.max(
          0,
          Math.min(end, l.birthMonth + (a + 1) * 12) -
            Math.max(0, l.birthMonth + a * 12),
        );
    }
    const complete = gestators.filter(
      (l) => l.birthMonth + 216 >= 0 && l.birthMonth + 552 <= 1200 && adult(l),
    );
    const completeBirths = complete.reduce((n, l) => n + l.children, 0);
    const errors = auditLifeCompact(w);
    if (count + births - deathMonth.size !== live)
      errors.push("Population balance mismatch");
    const row = {
      ...job,
      shadowSingleBarrier,
      shadowEligible,
      shadowMultiple,
      diagnosticCoreMs,
      initial: count,
      births,
      deaths: deathMonth.size,
      naturalDeaths: natural,
      living: live,
      peakPopulation: peak,
      adultCount: lives.filter(adult).length,
      partneredAdults: partnered.size,
      gestators: gestators.length,
      adultGestators: gestators.filter(adult).length,
      partneredGestators: gestators.filter((l) => partnered.has(l.owner))
        .length,
      partnerships: pairs.size,
      neverConceived: never.length,
      neverConceivedBarriers: barriers,
      neverConceivedAllBarriers: allBarriers,
      neverConceivedNoWindow: noReproductiveWindow,
      neverConceivedDominant: dominant,
      neverConceivedBarrierYears: barrierYears,
      exposureMonths,
      birthsByAge,
      completedGestators: complete.length,
      completedBirths: completeBirths,
      firstBirthCount: first.size,
      firstBirthAgeSum: [...first.values()].reduce((a, b) => a + b, 0),
      losses: pregnancies.filter((g) => g.status === "lost").length,
      orphans: orphans.size,
      guardianshipDecisions,
      orphanDecisions,
      accepted,
      pending,
      events: w.log.rows.length,
      bytes: Buffer.byteLength(JSON.stringify(w)),
      errors,
    };
    writeFileSync(file, JSON.stringify(row));
    console.log(job.id, Math.round(diagnosticCoreMs), live, errors.length);
  } catch (e) {
    writeFileSync(file, JSON.stringify({ ...job, error: String(e) }));
    console.log(job.id, String(e));
  }
}
