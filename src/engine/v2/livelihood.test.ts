import { it, expect } from "vitest";
import { livelihoodScenario, dailyScenario } from "./daily-scenario";
import { SliceSimulation } from "./engine";
import { CompactLog, replayCompact } from "./compact-log";
import { validateCompact } from "./validate";
import { ration, hungerAfter } from "./economy";
import { appraise, knowsExpectedLoss } from "./emotions";
import type { SliceEvent } from "./types";
const fixture = (food = 24, harvest = 24) => {
  const s = livelihoodScenario("2d2-fixture", 12);
  s.mode = "fixture";
  s.months = 12;
  s.bodySimulation!.singleDuel = undefined;
  s.dailyLife!.economy!.initial.food = food;
  s.dailyLife!.economy!.harvest = harvest;
  s.lifeSimulation!.conceptionOverride = false;
  return s;
};
const events = (w: ReturnType<SliceSimulation["runCompact"]>) => [
  ...CompactLog.from(w.log).view(),
];
it("reduz impacto apenas de perda natural de idoso explicitamente conhecida", () => {
  const p = dailyScenario("emo", 12).people[0];
  p.informed = ["event:3"];
  const source = {
    type: "information.received",
    data: { offense: "event:3", knownDeath: { natural: true, ageYears: 80 } },
  } as unknown as SliceEvent;
  expect(knowsExpectedLoss(p, source)).toBe(true);
  const a = appraise(p, "perda"),
    b = appraise(p, "perda", knowsExpectedLoss(p, source));
  expect(b.emotion).toBe(a.emotion);
  expect(b.stressDelta).toBeLessThan(a.stressDelta);
  expect(b.change).toBeLessThan(a.change);
  for (const d of [
    { natural: false, ageYears: 80 },
    { natural: true, ageYears: 30 },
    { natural: true },
  ])
    expect(
      knowsExpectedLoss(p, {
        ...source,
        data: { ...source.data, knownDeath: d },
      }),
    ).toBe(false);
  expect(knowsExpectedLoss({ ...p, informed: [] }, source)).toBe(false);
  expect(knowsExpectedLoss(p, { ...source, type: "person.died" })).toBe(false);
});
it("idoso recebe rotina mensal e recuperação", () => {
  const s = dailyScenario("elder-fixture", 12);
  s.months = 2;
  s.bodySimulation!.singleDuel = undefined;
  const p = s.people[0];
  p.born = -60;
  p.psychology!.stress = 500;
  const out = new SliceSimulation(s).runCompact();
  expect(
    events(out).some(
      (e) =>
        e.type === "needs.period" &&
        e.participants[0].id === p.id &&
        Number(e.data.stressAfter) < Number(e.data.stressBefore),
    ),
  ).toBe(true);
});
it("ração conserva alimento e fome responde à cobertura; fome prolongada mata uma vez, sem kill list", () => {
  expect(ration(5, [4, 4, 2])).toEqual({ consumed: 5, coverage: 0.5 });
  expect(hungerAfter(60, 1)).toBe(35);
  const w = new SliceSimulation(fixture(0, 0)).runCompact(),
    ev = events(w);
  const deaths = ev.filter((e) => e.type === "person.died");
  expect(deaths.length).toBeGreaterThan(0);
  expect(
    deaths.every(
      (e) => e.data.cause === "inanição prolongada" && !e.data.killer,
    ),
  ).toBe(true);
  expect(new Set(deaths.map((e) => e.data.victim)).size).toBe(deaths.length);
  expect(ev.some((e) => e.type === "kill.credited")).toBe(false);
  expect(replayCompact(w)).toEqual(w.entities);
  expect(validateCompact(w)).toEqual([]);
  const fed = new SliceSimulation(fixture(10000, 0)).runCompact();
  expect(events(fed).some((e) => e.type === "hunger.death")).toBe(false);
});
it("produção e consumo conservam estoques; período não é gasto duas vezes; retomada mantém replay", () => {
  const s = fixture(),
    sim = new SliceSimulation(s),
    mid = sim.runCompact(5),
    w = new SliceSimulation(s, mid).runCompact(),
    ev = events(w);
  expect(w).toEqual(new SliceSimulation(s).runCompact());
  expect(replayCompact(w)).toEqual(w.entities);
  expect(validateCompact(w)).toEqual([]);
  const ledger = new Map<string, Record<string, number>>(),
    busy = new Set<string>();
  for (const e of ev) {
    const d = e.data,
      h = String(d.household);
    if (e.type === "household.materials.declared")
      ledger.set(h, {
        ...(d.inventory as Record<string, number>),
        paper: Number(d.paper),
        ink: Number(d.ink),
      });
    if (e.type === "livelihood.period") {
      const k = `${e.month}:${e.participants[0].id}`;
      expect(busy.has(k)).toBe(false);
      busy.add(k);
      const l = ledger.get(h)!;
      if (d.task === "cultivar") {
        l.food += Number(d.environmentalInput);
        l.tools -= Number(d.toolsUsed);
      } else {
        const r = d.recipe as any;
        for (const [k, v] of Object.entries(r.take)) l[k] -= Number(v);
        for (const [k, v] of Object.entries(r.give)) l[k] += Number(v);
        l.paper += r.paper;
        l.ink += r.ink;
      }
    }
    if (e.type === "household.consumption")
      ledger.get(h)!.food -= Number(d.consumed);
    if (e.type === "work.started") {
      ledger.get(h)!.paper -= Number(d.paper);
      ledger.get(h)!.ink -= Number(d.ink);
    }
    if (
      ["work.period", "activity.period", "occupation.care.offered"].includes(
        e.type,
      )
    )
      expect(busy.has(`${e.month}:${e.participants[0].id}`)).toBe(false);
  }
  for (const [id, l] of ledger) {
    const h = w.entities[id];
    if (h.kind !== "household") throw Error();
    expect({ ...h.inventory, ...h.writingStock }).toEqual(l);
    expect(Object.values(l).every((v) => v >= 0)).toBe(true);
  }
  expect(
    ev.some(
      (e) => e.type === "livelihood.period" && e.data.task === "cultivar",
    ),
  ).toBe(true);
  expect(
    ev.some(
      (e) => e.type === "livelihood.period" && e.data.task === "fabricar",
    ),
  ).toBe(true);
});
it("sem matéria-prima não há fabricação; mãos ausentes impedem ofícios manuais", () => {
  const s = fixture(10000, 0);
  Object.assign(s.dailyLife!.economy!.initial, {
    wood: 0,
    fiber: 0,
    pigment: 0,
    tools: 0,
  });
  const w = new SliceSimulation(s).runCompact();
  expect(events(w).some((e) => e.type === "livelihood.period")).toBe(false);
  const t = fixture();
  t.bodySimulation!.missing = Object.fromEntries(
    t.people.map((p) => [p.id, ["hand.left", "hand.right"]]),
  );
  expect(
    events(new SliceSimulation(t).runCompact()).some(
      (e) => e.type === "livelihood.period",
    ),
  ).toBe(false);
});

it("perder uma perna reduz capacidade de cultivo, sem impedir escrita pela mesma razão", () => {
  const s = fixture();
  s.months = 1;
  const id = s.people[0].id;
  const before = events(new SliceSimulation(s).runCompact()).find(
    (e) => e.type === "occupation.changed" && e.participants[0].id === id,
  )!;
  s.bodySimulation!.missing = { [id]: ["leg.left"] };
  const after = events(new SliceSimulation(s).runCompact()).find(
    (e) => e.type === "occupation.changed" && e.participants[0].id === id,
  )!;
  const a = before.data.capacity as any,
    b = after.data.capacity as any;
  expect(b.farm).toBeLessThan(a.farm);
  expect(b.write).toBe(a.write);
});
