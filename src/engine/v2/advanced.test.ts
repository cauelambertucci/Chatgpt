import { it, expect } from "vitest";
import {
  traits,
  values,
  traitActions,
  valueActions,
} from "../../data/v2/personality";
import { advancedScenario } from "./scenario";
import { advancedFixture } from "./advanced-fixtures";
import { SliceSimulation, simulateSlice, getPerson, replay } from "./engine";
import { personalGoals, personalStory } from "./personal-report";
import { validateSlice } from "./validate";
import type { Place } from "./types";
it("catálogos contêm 30 facetas e 20 valores, todos ligados a decisões e com escalas válidas", () => {
  expect(Object.keys(traits)).toHaveLength(30);
  expect(Object.keys(values)).toHaveLength(20);
  expect(Object.values(traitActions).every((a) => a.length)).toBe(true);
  expect(Object.values(valueActions).every((a) => a.length)).toBe(true);
  for (const p of advancedScenario("catalogo").people) {
    expect(Object.keys(p.traits)).toHaveLength(30);
    expect(Object.keys(p.values)).toHaveLength(20);
    expect(Object.values(p.traits).every((n) => n >= 0 && n <= 100)).toBe(true);
    expect(
      Object.values(p.values).every(
        (n) => n !== undefined && n >= -100 && n <= 100,
      ),
    ).toBe(true);
  }
});
it("conquista de poder exige maioria real, apoio público e decisões de outros agentes", () => {
  const s = advancedFixture("governar"),
    w = simulateSlice(s);
  expect(validateSlice(w)).toEqual([]);
  expect(
    personalGoals(w).find((g) => g.owner === s.focal && g.type === "governar")
      ?.status,
  ).toBe("completed");
  const vote = w.events.find((e) => e.type === "leadership.changed")!;
  expect((vote.data.voters as string[]).length).toBeGreaterThanOrEqual(
    Number(vote.data.majority),
  );
  expect((w.entities["place:void"] as Place).leader).toBe(s.focal);
});
it("recusa dos votantes impede poder, sem escolher líder por ambição sozinha", () => {
  const s = advancedFixture("governar");
  for (const p of s.people.slice(1)) {
    p.values.lei = -100;
    p.values.paz = -100;
    p.traits.ambicao = 100;
  }
  const w = simulateSlice(s);
  expect(w.events.some((e) => e.type === "leadership.changed")).toBe(false);
  expect(
    personalGoals(w).find((g) => g.owner === s.focal && g.type === "governar")
      ?.status,
  ).toBe("failed");
  expect(validateSlice(w)).toEqual([]);
});
it("obra tem seis períodos, criador, material consumido e qualidade calculada", () => {
  const s = advancedFixture("criar_obra"),
    w = simulateSlice(s);
  expect(validateSlice(w)).toEqual([]);
  const work = Object.values(w.entities).find((x) => x.kind === "work");
  expect(work?.kind).toBe("work");
  if (work?.kind === "work") {
    expect(work.creator).toBe(s.focal);
    expect(work.quality).toBeGreaterThan(50);
  }
  expect((w.entities["place:void"] as Place).supplies).toEqual({
    paper: 27,
    ink: 58,
  });
  expect(personalGoals(w).find((g) => g.type === "criar_obra")?.status).toBe(
    "completed",
  );
});
it("retirar acesso material impede criação e não produz objeto fictício", () => {
  const s = advancedFixture("criar_obra");
  s.materials = { paper: 0, ink: 0 };
  const w = simulateSlice(s);
  expect(validateSlice(w)).toEqual([]);
  expect(Object.values(w.entities).some((x) => x.kind === "work")).toBe(false);
  expect(w.events.some((e) => e.type === "work.blocked")).toBe(true);
});
it("personalidade e valores alteram escores e elegibilidade com o mesmo RNG", () => {
  const a = advancedFixture("governar"),
    b = structuredClone(a);
  b.people[0].traits.ambicao = 0;
  b.people[0].values.poder = -100;
  const x = simulateSlice(a),
    y = simulateSlice(b);
  expect(personalGoals(x).some((g) => g.type === "governar")).toBe(true);
  expect(personalGoals(y).some((g) => g.type === "governar")).toBe(false);
  const c = advancedFixture("criar_obra"),
    d = structuredClone(c);
  d.people[0].traits.criatividade = 0;
  expect(
    Object.values(simulateSlice(d).entities).some((e) => e.kind === "work"),
  ).toBe(false);
});
it("replay, JSON e retomada reproduzem personalidade, votações e objetos", () => {
  for (const kind of ["governar", "criar_obra"] as const) {
    const s = advancedFixture(kind),
      whole = simulateSlice(s),
      partial = new SliceSimulation(s).run(3),
      resumed = new SliceSimulation(
        s,
        JSON.parse(JSON.stringify(partial)),
      ).run();
    expect(resumed).toEqual(whole);
    expect(replay(whole.events)).toEqual(whole.entities);
  }
});

it("valores negativos de família e solidariedade não forçam compromisso só por parentesco", () => {
  const s = advancedFixture("criar_obra");
  s.people[0].values.familia = -100;
  s.people[0].values.solidariedade = -100;
  s.people[0].kin = [s.victim];
  s.people[1].kin = [s.focal];
  s.people[1].skill = 50;
  s.people[1].traits.cautela = 0;
  s.people[2].skill = 500;
  s.people[2].rival = s.victim;
  s.people[2].hostility = 100;
  s.people[2].values.paz = 0;
  s.people[2].traits.coragem = 100;
  const w = simulateSlice(s);
  expect(
    personalGoals(w).some((g) => g.owner === s.focal && g.type === "proteger"),
  ).toBe(false);
  expect(validateSlice(w)).toEqual([]);
});
it("100 seeds completas mantêm coerência com personalidade maior, cargos e obras", () => {
  for (let i = 0; i < 100; i++) {
    const w = simulateSlice(
      advancedScenario(`pessoal-1c-${String(i).padStart(3, "0")}`),
    );
    expect(validateSlice(w), w.scenario.seed).toEqual([]);
  }
}, 120000);

it("avanço de progresso sem snapshot produz o mesmo log final e estado", () => {
  const s = advancedScenario("pessoal-1c-000"),
    sim = new SliceSimulation(s);
  for (let month = 12; month < 240; month += 12) sim.advance(month);
  expect(sim.run()).toEqual(simulateSlice(s));
});

it("ranking não conta decisão alheia à cadeia do objetivo como progresso intermediário", () => {
  const w = simulateSlice(advancedFixture("criar_obra")),
    g = personalGoals(w).find((g) => g.type === "criar_obra")!,
    before = personalStory(w, g),
    copy = structuredClone(w),
    known = new Set(before.rawEvents),
    end = w.events.find(
      (e) => e.type === "personalGoal.closed" && e.data.goal === g.id,
    )!.seq;
  const unrelated = copy.events.find(
    (e) =>
      e.seq > Number(g.source.split(":")[1]) &&
      e.seq < end &&
      !known.has(e.id) &&
      e.decision,
  )!;
  expect(unrelated).toBeDefined();
  unrelated.decision!.actor = g.owner; // isolated presentation mutation; intentionally not a replay-world
  expect(personalStory(copy, g).intermediateDecisions).toBe(
    before.intermediateDecisions,
  );
  expect(personalStory(copy, g).score).toBe(before.score);
});
