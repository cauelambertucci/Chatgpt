import { describe, it, expect } from "vitest";
import {
  SliceSimulation,
  simulateSlice,
  replay,
  getPerson,
  goals,
  effectiveMemory,
} from "./engine";
import { fixtureScenario, freeScenario } from "./scenario";
import { validateSlice } from "./validate";
import { story, distribution, selectStories } from "./report";
import type { Scenario, SliceWorld } from "./types";
const run = (edit?: (s: Scenario) => void) => {
  const s = fixtureScenario();
  edit?.(s);
  return simulateSlice(s);
};
const actionTrace = (w: SliceWorld, id = w.scenario.focal) =>
  w.events
    .filter((e) => e.decision?.actor === id)
    .map((e) => ({
      month: e.month,
      action: e.decision!.chosen,
      target: e.decision!.target,
      scores: e.decision!.candidates.map((c) => ({
        action: c.action,
        score: c.score,
        factors: c.factors,
      })),
    }));
const firstRevenge = (w: SliceWorld) =>
  w.events.find(
    (e) =>
      e.type === "confrontation.resolved" &&
      e.decision?.actor === w.scenario.focal,
  );
describe("Marco 1 mínimo — fixture ponta a ponta", () => {
  it("ofensa não injetada, informação, espera, treino e vingança anos depois", () => {
    const w = run(),
      s = story(w);
    expect(validateSlice(w)).toEqual([]);
    expect(s.outcome).toBe("vingança cumprida");
    expect(s.closedMonth! - s.offenseMonth!).toBeGreaterThanOrEqual(24);
    expect(s.trainingPeriods).toBeGreaterThan(12);
    const death = w.events.find((e) => e.type === "person.died")!;
    expect(
      w.events.some(
        (e) =>
          death.causes.includes(e.id) &&
          e.type === "confrontation.resolved" &&
          e.decision?.chosen === "confrontar",
      ),
    ).toBe(true);
    expect(w.events.some((e) => e.type === "information.shared")).toBe(true);
    expect(w.events.some((e) => e.type === "external.incident")).toBe(false);
  });
  it("repete seed, faz replay e retoma em fronteira mensal sem mudar o log", () => {
    const s = fixtureScenario(),
      whole = simulateSlice(s),
      sim = new SliceSimulation(s),
      partial = sim.run(37);
    const restored = new SliceSimulation(
      s,
      JSON.parse(JSON.stringify(partial)),
    ).run();
    expect(restored).toEqual(whole);
    expect(simulateSlice(s)).toEqual(whole);
    expect(replay(whole.events)).toEqual(whole.entities);
  });
  it("eventos são profundamente imutáveis e snapshots externos não alteram o motor", () => {
    const s = fixtureScenario(),
      sim = new SliceSimulation(s);
    sim.run(2);
    const event = sim.world.events[0];
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.effects[0].entity)).toBe(true);
    expect(() => {
      (event.causes as string[]).push("event:999");
    }).toThrow();
    const snapshot = sim.run(3);
    getPerson(snapshot, s.focal).skill = 99999;
    expect(getPerson(sim.world, s.focal).skill).not.toBe(99999);
  });
  it("rotina e treino têm no máximo um registro por agente/mês", () => {
    const w = run();
    const keys = w.events
      .filter((e) => e.type === "activity.period")
      .map((e) => `${e.month}:${e.decision?.actor}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      w.events
        .filter((e) => e.type === "activity.period")
        .every((e) => e.data.periodMonths === 1),
    ).toBe(true);
    expect(w.events.every((e) => e.dia % 30 === 0)).toBe(true);
  });
});
describe("metamórficos — uma intervenção de cada vez", () => {
  it("sem percepção nem canais de notícia, não há vingança por conhecimento global", () => {
    const w = run((s) => {
      s.blockedInformation = [s.focal];
    });
    expect(
      w.events.some(
        (e) => e.type === "person.died" && e.data.victim === w.scenario.victim,
      ),
    ).toBe(true);
    expect(getPerson(w, w.scenario.focal).memory).toBeUndefined();
    expect(goals(w).some((g) => g.owner === w.scenario.focal)).toBe(false);
    expect(firstRevenge(w)).toBeUndefined();
    expect(validateSlice(w)).toEqual([]);
  });
  it("menos rancor acelera esquecimento e altera a persistência quando o reencontro é tardio", () => {
    const base = fixtureScenario();
    base.schedules[2].period = 132;
    base.schedules[2].absentMonths = 129;
    const low = structuredClone(base);
    low.people[0].traits.rancor = 5;
    const a = new SliceSimulation(base).run(110),
      b = new SliceSimulation(low).run(110);
    expect(effectiveMemory(b, getPerson(b, base.focal), 100)).toBeLessThan(
      effectiveMemory(a, getPerson(a, base.focal), 100),
    );
    expect(story(simulateSlice(low)).outcome).toBe("desistência");
    expect(story(simulateSlice(base)).outcome).toBe("vingança cumprida");
  });
  it("paz maior e vingança menor impedem o confronto, sem apagar a notícia", () => {
    const w = run((s) => {
      s.people[0].values = { familia: 95, vinganca: 0, paz: 100 };
    });
    expect(getPerson(w, w.scenario.focal).informed.length).toBeGreaterThan(0);
    expect(story(w).outcome).toBe("desistência");
    expect(firstRevenge(w)).toBeUndefined();
  });
  it("maior capacidade antecipa o confronto sob a mesma agenda", () => {
    const a = run(),
      b = run((s) => {
        s.people[0].skill = 700;
      });
    expect(firstRevenge(b)!.month).toBeLessThan(firstRevenge(a)!.month);
    expect(story(a).trainingPeriods).toBeGreaterThan(story(b).trainingPeriods);
  });
  it("sem treino não cresce habilidade nem se produz vitória compensatória", () => {
    const w = run((s) => {
      s.people[0].trainAccess = false;
    });
    expect(getPerson(w, w.scenario.focal).skill).toBe(70);
    expect(
      w.events.some(
        (e) =>
          e.decision?.actor === w.scenario.focal &&
          e.decision.chosen === "treinar",
      ),
    ).toBe(false);
    expect(story(w).outcome).not.toBe("vingança cumprida");
  });
  it("sem apoio de mentor o treino não ganha o bônus de ajuda", () => {
    const base = fixtureScenario();
    base.people[0].traits.coragem = 20;
    base.people[0].traits.cautela = 95;
    const low = structuredClone(base);
    low.people.forEach((p) => (p.canHelp = false));
    const a = simulateSlice(base),
      b = simulateSlice(low);
    expect(getPerson(a, base.focal).helpedBy).toBeDefined();
    expect(getPerson(b, base.focal).helpedBy).toBeUndefined();
    const gains = (w: SliceWorld) =>
      w.events
        .filter(
          (e) =>
            e.type === "activity.period" &&
            e.decision?.actor === base.focal &&
            e.data.action === "treinar",
        )
        .map((e) => Number(e.data.gain));
    expect(Math.max(...gains(a))).toBeGreaterThan(Math.max(...gains(b)));
  });
  it("retirar o reencontro impede confronto mesmo mantendo objetivo e preparo", () => {
    const w = run((s) => {
      s.noReencounter = true;
    });
    expect(getPerson(w, w.scenario.focal).goal).toBeDefined();
    expect(story(w).trainingPeriods).toBeGreaterThan(0);
    expect(firstRevenge(w)).toBeUndefined();
    expect(story(w).outcome).toBe("objetivo frustrado");
  });
  it("outra causa mata o alvo e não credita a morte ao vingador", () => {
    const w = run((s) => {
      s.externalDeathMonth = 12;
    });
    expect(story(w).outcome).toBe("alvo morto por outra causa");
    expect(getPerson(w, w.scenario.offender).killer).toBeUndefined();
    expect(
      w.events.some(
        (e) => e.type === "person.died" && e.data.killer === w.scenario.focal,
      ),
    ).toBe(false);
    expect(validateSlice(w)).toEqual([]);
  });
  it("habilidade oculta do alvo ausente não altera a utilidade de preparo", () => {
    const scenario = fixtureScenario(),
      base = new SliceSimulation(scenario).run(10),
      altered = structuredClone(base);
    // Isolated selector intervention, not an exported/replay-valid world.
    getPerson(altered, scenario.offender).skill = 999;
    const a = new SliceSimulation(scenario, base),
      b = new SliceSimulation(scenario, altered);
    expect(a.candidates(scenario.focal)).toEqual(b.candidates(scenario.focal));
  });
  it("trocar nomes não altera utilidades ou decisões", () => {
    const a = run(),
      b = run((s) =>
        s.people.forEach((p, i) => {
          p.name = `Pessoa ${i}`;
        }),
      );
    expect(actionTrace(b)).toEqual(actionTrace(a));
    expect(story(b).outcome).toBe(story(a).outcome);
  });
  it("inserir agente desconectado não altera decisões ou RNG dos existentes", () => {
    const a = run(),
      b = run((s) => {
        const p = structuredClone(s.people[19]);
        p.id = "person:99";
        p.name = "Isolado";
        p.kin = [];
        p.rival = undefined;
        p.canHelp = false;
        p.present = false;
        s.people.push(p);
        s.schedules.push({
          id: p.id,
          from: 240,
          until: 240,
          period: 1,
          absentMonths: 0,
        });
      });
    for (const p of a.scenario.people)
      expect(actionTrace(b, p.id)).toEqual(actionTrace(a, p.id));
  });
});
describe("comunicação, reconciliação e coerência", () => {
  it("relatório mantém todos os ramos causais, inclusive morte independente do alvo", () => {
    const w = simulateSlice(freeScenario("livre-098")),
      s = story(w);
    const target = getPerson(w, w.scenario.offender);
    expect(s.causalEvents).toContain(target.death);
    expect(s.causalEvents).toContain(
      goals(w).find((g) => g.owner === w.scenario.focal)!.offense,
    );
    expect(s.causalEvents[0]).toBe("event:0");
    expect(
      s.narrative.some((text) =>
        text.includes("Corin morreu em confronto com Thorin"),
      ),
    ).toBe(true);
  });
  it("relatório avisa concentração já no limiar de 70%", () => {
    const s = story(run());
    const values = Array.from({ length: 100 }, (_, i) => ({
      ...s,
      outcome: i < 70 ? ("desistência" as const) : ("fuga" as const),
    }));
    expect(distribution(values).warning).toContain("70%");
    expect(distribution(values).counts["desistência"]).toBe(70);
  });

  it("pedir ajuda libera treino assistido somente após resposta positiva", () => {
    const w = run((s) => {
      s.people[0].traits.coragem = 20;
      s.people[0].traits.cautela = 95;
    });
    const request = w.events.find(
      (e) =>
        e.type === "help.requested" && e.decision?.actor === w.scenario.focal,
    );
    expect(request).toBeDefined();
    expect(
      w.events.some((e) => e.type === "help.responded" && e.data.accepted),
    ).toBe(true);
    expect(getPerson(w, w.scenario.focal).helpedBy).toBeDefined();
    expect(validateSlice(w)).toEqual([]);
  });
  it("perdão só vira reconciliação com alvo presente e aceitação calculada", () => {
    const s = fixtureScenario();
    s.people[0].values = { familia: 90, vinganca: 55, paz: 65 };
    s.people[0].traits.rancor = 45;
    s.people[2].values = { familia: 100, vinganca: 0, paz: 100 };
    s.people[2].traits.rancor = 5;
    s.people[2].traits.cautela = 30;
    s.people[2].hostility = 100;
    s.schedules[2].period = 1;
    s.schedules[2].absentMonths = 0;
    const w = simulateSlice(s);
    expect(story(w).outcome).toBe("reconciliação");
    const e = w.events.find((e) => e.type === "reconciliation.agreed");
    expect(e?.data.accepted).toBe(true);
    expect(validateSlice(w)).toEqual([]);
  });
  it("validador detecta causa futura, morto agindo e projeção adulterada", () => {
    const w = run();
    const copy = structuredClone(w);
    (copy.events[2].causes as string[]).push("event:999999");
    expect(validateSlice(copy).some((e) => e.includes("causa futura"))).toBe(
      true,
    );
    const after = structuredClone(w);
    const dead = Object.values(after.entities).find(
      (e) => e.kind === "person" && !e.alive,
    )!;
    const event = after.events.at(-1)!;
    (event.participants as { id: string; role: "actor" }[]).push({
      id: dead.id,
      role: "actor",
    });
    expect(validateSlice(after).some((e) => e.includes("morto agiu"))).toBe(
      true,
    );
    getPerson(w, w.scenario.focal).skill = 9999;
    expect(validateSlice(w)).toContain("Replay diverge do estado");
  });
  it("100 seeds livres: invariantes, seis categorias e histórias extraídas sem roteirizar resultados", () => {
    const stories = [];
    for (let i = 0; i < 100; i++) {
      const w = simulateSlice(
        freeScenario(`livre-${String(i).padStart(3, "0")}`),
      );
      expect(validateSlice(w), w.scenario.seed).toEqual([]);
      stories.push(story(w));
    }
    const d = distribution(stories);
    expect(Object.values(d.counts).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.keys(d.counts)).toHaveLength(6);
    expect(selectStories(stories)).toHaveLength(3);
  }, 60000);
});
