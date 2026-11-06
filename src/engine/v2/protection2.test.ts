import { it, expect } from "vitest";
import { protectionFixture } from "./personal-fixtures";
import { simulateSlice, getPerson } from "./engine";
import {
  personalGoals,
  personalStory,
  personalStories,
} from "./personal-report";
import { validateSlice } from "./validate";
import { collapsedCausality } from "./causal";
import { fixtureScenario } from "./scenario";
const weak = () => {
  const s = protectionFixture();
  s.people[3].skill = 0;
  s.people[3].traits.coragem = 0;
  return s;
};
it("estimativa anterior à adoção inclui planos, fontes e habilidade, sem conhecer vontades privadas", () => {
  const w = simulateSlice(weak());
  for (const g of personalGoals(w).filter((g) => g.type === "proteger")) {
    expect(g.estimate).toBeDefined();
    const adoption = w.events[Number(g.source.split(":")[1])];
    const initial = (
      adoption.effects.find((e) => e.entity.id === g.id)!.entity as typeof g
    ).estimate!;
    expect(Number(initial.assessedAt.split(":")[1])).toBeLessThan(
      Number(g.source.split(":")[1]),
    );
    expect(g.estimate!.best).toBeGreaterThanOrEqual(40);
    expect(g.estimate!.ownSkill).toBeLessThanOrEqual(1000);
  }
  expect(validateSlice(w)).toEqual([]);
});
it("sem plano viável registra estimativa e recusa adoção", () => {
  const s = weak();
  s.people[1].skill = 550;
  s.people[2].values.paz = 0;
  s.people[2].traits.coragem = 100;
  const w = simulateSlice(s);
  expect(
    w.events.some(
      (e) =>
        e.type === "protection.declined" &&
        e.participants.some((p) => p.id === s.people[3].id),
    ),
  ).toBe(true);
  expect(
    personalGoals(w).some(
      (g) => g.type === "proteger" && g.owner === s.people[3].id,
    ),
  ).toBe(false);
});
it("aviso comunica ameaça e o alvo decide sair; abrigo não é permanente", () => {
  const s = weak(),
    w = simulateSlice(s);
  expect(w.events.some((e) => e.type === "protection.warning")).toBe(true);
  expect(
    w.events.some(
      (e) => e.type === "protection.target.responded" && e.data.accepted,
    ),
  ).toBe(true);
  expect(getPerson(w, s.victim).knownThreats).toBeDefined();
  expect(
    w.events.some(
      (e) => e.type === "presence.changed" && e.data.present && e.month >= 3,
    ),
  ).toBe(true);
  expect(getPerson(w, s.victim).alive).toBe(true);
  expect(validateSlice(w)).toEqual([]);
});
it("afastamento depende de consentimento do alvo e vínculo conhecido", () => {
  const s = weak(),
    p = s.people[3],
    t = s.people[1];
  p.skill = 1000;
  p.traits.cautela = 100;
  p.kin = [t.id];
  t.kin = [p.id];
  t.skill = 400;
  t.traits.coragem = 0;
  const w = simulateSlice(s);
  expect(w.events.some((e) => e.type === "protection.escort.offered")).toBe(
    true,
  );
  expect(
    w.events.some(
      (e) =>
        e.type === "protection.target.responded" &&
        e.data.action === "afastar_alvo" &&
        e.data.accepted,
    ),
  ).toBe(true);
  expect(validateSlice(w)).toEqual([]);
});
it("pedir ajuda exige aliado conhecido, aceitação e capacidade conjunta", () => {
  const s = weak(),
    p = s.people[3],
    ally = s.people[5];
  s.people[1].skill = 400;
  p.skill = 50;
  p.kin = [ally.id];
  ally.kin = [p.id];
  ally.skill = 1000;
  ally.values.solidariedade = 100;
  ally.values.familia = 100;
  ally.traits.cautela = 0;
  const w = simulateSlice(s);
  expect(
    w.events.some(
      (e) =>
        e.type === "protection.support.requested" && e.decision?.actor === p.id,
    ),
  ).toBe(true);
  expect(
    w.events.some(
      (e) => e.type === "protection.support.responded" && e.data.accepted,
    ),
  ).toBe(true);
  expect(
    personalGoals(w).find((g) => g.owner === ally.id && g.type === "proteger")
      ?.interventions,
  ).toBeGreaterThan(0);
  expect(validateSlice(w)).toEqual([]);
});
it("o alvo pode recusar aviso e isso não é contabilizado como resgate", () => {
  const s = weak();
  s.people[1].skill = 400;
  s.people[1].traits.coragem = 100;
  s.people[1].traits.cautela = 0;
  const w = simulateSlice(s);
  expect(
    w.events.some(
      (e) => e.type === "protection.target.responded" && !e.data.accepted,
    ),
  ).toBe(true);
  expect(getPerson(w, s.victim).alive).toBe(false);
  expect(validateSlice(w)).toEqual([]);
});
it("monitoramento e rotina alternada formam um único elo antes da profundidade", () => {
  const base = simulateSlice(fixtureScenario()),
    raw = base.events.find((e) => e.type === "activity.period")!;
  const make = (count: number) => {
    const w = structuredClone(base);
    w.events = [w.events[0]];
    for (let i = 1; i <= count; i++)
      w.events.push({
        ...raw,
        id: `event:${i}`,
        seq: i,
        month: i,
        type: "protection.monitored",
        decision: undefined,
        data: { owner: base.scenario.focal, goal: "goal:test" },
        causes: [`event:${i - 1}`],
      });
    w.events.push({
      ...raw,
      id: `event:${count + 1}`,
      seq: count + 1,
      type: "personalGoal.closed",
      month: count + 1,
      causes: [`event:${count}`],
    });
    return collapsedCausality(w, `event:${count + 1}`);
  };
  expect(make(1).depth).toBe(3);
  expect(make(24).depth).toBe(3);
  expect(make(24).episodes.some((e) => e.monitoringPeriods === 24)).toBe(true);
});
it("ranking penaliza falha instantânea sem decisão e não preenche dez vagas", () => {
  const s = weak();
  s.people[1].skill = 400;
  s.people[1].traits.coragem = 100;
  const p = s.people[0];
  p.values.amizade = 100;
  p.values.solidariedade = 100;
  p.values.familia = 100;
  p.traits.rancor = 0;
  const w = simulateSlice(s),
    g = personalGoals(w).find(
      (g) => g.owner === p.id && g.type === "proteger",
    )!;
  const story = personalStory(w, g);
  expect(story.sameMonthNoDecision).toBe(true);
  expect(story.score).toBeLessThan(0);
  expect(personalStories(w).some((s) => s.goal === g.id)).toBe(false);
  expect(personalStories(w).length).toBeLessThan(10);
});

it("ranking reconhece respostas consentidas como decisões intermediárias", () => {
  const s = protectionFixture();
  s.people[0].values.amizade = 100;
  s.people[1].values.amizade = 100;
  s.people[0].values.paz = 100;
  s.people[1].values.paz = 100;
  s.people[0].traits.rancor = 0;
  s.people[1].traits.rancor = 0;
  s.people[2].rival = undefined;
  s.people[2].hostility = 0;
  s.friendTargets = {
    [s.people[0].id]: s.people[1].id,
    [s.people[1].id]: s.people[0].id,
  };
  const w = simulateSlice(s),
    g = personalGoals(w).find(
      (g) => g.type === "amizade" && g.owner === s.focal,
    )!;
  const result = personalStory(w, g),
    end = w.events.find(
      (e) => e.type === "personalGoal.closed" && e.data.goal === g.id,
    )!,
    start = Number(g.source.split(":")[1]);
  const scheduled = w.events.filter(
    (e) => e.seq > start && e.seq < end.seq && e.decision?.actor === g.owner,
  ).length;
  expect(result.intermediateDecisions).toBeGreaterThan(scheduled);
});
