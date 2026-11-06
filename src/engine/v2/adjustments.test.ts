import { it, expect } from "vitest";
import { fixtureScenario } from "./scenario";
import { SliceSimulation, simulateSlice, getPerson, goals } from "./engine";
import { story } from "./report";
import { validateSlice } from "./validate";
import { collapsedCausality } from "./causal";
const peaceful = () => {
  const s = fixtureScenario();
  s.people[0].values = { familia: 100, vinganca: 0, paz: 100 };
  s.people[0].traits.rancor = 0;
  s.people[0].trainAccess = false;
  s.people[2].values = { familia: 100, vinganca: 0, paz: 100 };
  s.people[2].traits.rancor = 0;
  s.people[2].traits.cautela = 10;
  return s;
};
it("buscar acordo espera reencontro, sem declarar recusa ou reconciliação à distância", () => {
  const s = peaceful();
  s.schedules[2].period = 12;
  s.schedules[2].absentMonths = 11;
  s.schedules[0].from = 1;
  const partial = new SliceSimulation(s).run(6);
  expect(goals(partial)[0].accordIntent).toBeDefined();
  expect(goals(partial)[0].closed).toBeUndefined();
  expect(partial.events.some((e) => e.type === "agreement.responded")).toBe(
    false,
  );
  const w = simulateSlice(s);
  expect(story(w).outcome).toBe("reconciliação");
  expect(w.events.find((e) => e.type === "agreement.responded")!.month).toBe(
    12,
  );
  expect(validateSlice(w)).toEqual([]);
});
it("perdão unilateral não depende da resposta ou das crenças do outro", () => {
  const s = peaceful();
  const sim = new SliceSimulation(s),
    partial = sim.run(2),
    g = goals(partial)[0];
  expect(g).toBeDefined();
  const copy = structuredClone(partial);
  const goal = copy.entities[g.id] as typeof g;
  goal.accordIntent = goal.source;
  goal.accordRejected = goal.source; // isolated decision fixture, not a replay-valid world
  const a = new SliceSimulation(s, copy);
  const c = a.candidates(s.focal);
  expect(c.some((x) => x.action === "buscar_acordo")).toBe(false);
  expect(c.some((x) => x.action === "perdoar")).toBe(true);
  const b = structuredClone(copy);
  getPerson(b, s.offender).values.paz = 0;
  expect(
    new SliceSimulation(s, b)
      .candidates(s.focal)
      .find((x) => x.action === "perdoar")!.score,
  ).toBe(c.find((x) => x.action === "perdoar")!.score);
});
it("profundidade usa um episódio de treino por bloco, sem perder períodos ou modificar fatos", () => {
  const w = simulateSlice(fixtureScenario()),
    before = JSON.stringify(w),
    s = story(w);
  expect(s.chain.length).toBeLessThan(s.rawDepth);
  expect(s.episodes.some((e) => (e.actionCounts?.treinar || 0) > 12)).toBe(
    true,
  );
  const counts = s.episodes
    .filter((e) => e.actor === w.scenario.focal)
    .reduce((n, e) => n + (e.actionCounts?.treinar || 0), 0);
  expect(counts).toBe(s.trainingPeriods);
  expect(JSON.stringify(w)).toBe(before);
  expect(collapsedCausality(w, s.chain.at(-1)!).depth).toBe(s.chain.length);
});
it("perdão unilateral encerra a vingança mesmo com interlocutor disposto a acordo", () => {
  const s = peaceful();
  s.people[0].values = { familia: -100, vinganca: -50, paz: 20 };
  s.people[0].traits.cautela = 0;
  s.schedules[2].period = 1;
  s.schedules[2].absentMonths = 0;
  const w = simulateSlice(s);
  expect(story(w).outcome).toBe("desistência");
  expect(
    w.events.some((e) => e.type === "forgiveness.chosen" && e.data.unilateral),
  ).toBe(true);
  expect(w.events.some((e) => e.type === "reconciliation.agreed")).toBe(false);
  expect(validateSlice(w)).toEqual([]);
});
it("adicionar 24 períodos idênticos não infla profundidade do episódio", () => {
  const base = simulateSlice(fixtureScenario()),
    period = base.events.find(
      (e) => e.type === "activity.period" && e.data.action === "treinar",
    )!;
  const make = (n: number) => {
    const w = structuredClone(base);
    w.events = [{ ...w.events[0], id: "event:0", seq: 0, causes: [] }];
    for (let i = 1; i <= n; i++)
      w.events.push({
        ...period,
        id: `event:${i}`,
        seq: i,
        month: i,
        ano: Math.floor(i / 12),
        dia: (i % 12) * 30,
        causes: [`event:${i - 1}`],
      });
    w.events.push({
      ...base.events.at(-1)!,
      id: `event:${n + 1}`,
      seq: n + 1,
      month: n + 1,
      causes: [`event:${n}`],
      type: "goal.closed",
    });
    return collapsedCausality(w, `event:${n + 1}`);
  };
  expect(make(1).depth).toBe(3);
  expect(make(24).depth).toBe(3);
  expect(
    make(24).episodes.find((e) => e.type === "activity.period")?.periods,
  ).toBe(24);
});

it("checkpoint de regras antigas não continua silenciosamente com a versão nova", () => {
  const s = fixtureScenario(),
    w = new SliceSimulation(s).run(2);
  w.engine = "revenge-slice-1";
  expect(() => new SliceSimulation(s, w).run()).toThrow("Versão incompatível");
});
