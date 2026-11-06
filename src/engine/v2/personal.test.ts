import {
  protectionFixture as protection,
  friendshipFixture as friendship,
} from "./personal-fixtures";
import { describe, it, expect } from "vitest";
import { personalScenario } from "./scenario";
import { simulateSlice, SliceSimulation, getPerson, replay } from "./engine";
import type { Scenario, PersonalGoal } from "./types";
import { validateSlice } from "./validate";
const personal = (w: ReturnType<typeof simulateSlice>) =>
  Object.values(w.entities).filter(
    (x): x is PersonalGoal => x.kind === "personalGoal",
  );
describe("Marco 1b — proteger alguém", () => {
  it("ameaça percebida gera objetivo, intervenção altera o ataque e alvo sobrevive ao horizonte", () => {
    const s = protection(),
      w = simulateSlice(s);
    expect(validateSlice(w)).toEqual([]);
    const g = personal(w).find(
      (g) => g.owner === s.people[3].id && g.type === "proteger",
    )!;
    expect(g.status).toBe("completed");
    expect(g.interventions).toBeGreaterThan(0);
    expect(getPerson(w, s.victim).alive).toBe(true);
    expect(w.events.some((e) => e.type === "confrontation.prevented")).toBe(
      true,
    );
  });
  it("sem testemunhar ameaça, não adota objetivo nem intervém por onisciência", () => {
    const s = protection();
    s.blockedThreatPerception = [s.people[3].id];
    const w = simulateSlice(s);
    expect(
      personal(w).some(
        (g) => g.owner === s.people[3].id && g.type === "proteger",
      ),
    ).toBe(false);
    expect(
      w.events.some(
        (e) =>
          e.decision?.actor === s.people[3].id &&
          ["proteger", "avisar_alvo", "pedir_aliados", "afastar_alvo"].includes(
            e.decision.chosen,
          ),
      ),
    ).toBe(false);
    expect(validateSlice(w)).toEqual([]);
  });
  it("retirar capacidade impede intervenção direta mas permite outros planos", () => {
    const s = protection();
    s.people[3].skill = 10;
    const w = simulateSlice(s);
    expect(
      w.events.some(
        (e) =>
          e.type === "protection.intervened" &&
          e.decision?.actor === s.people[3].id,
      ),
    ).toBe(false);
    expect(
      w.events.some(
        (e) =>
          e.decision?.actor === s.people[3].id &&
          ["avisar_alvo", "pedir_aliados", "afastar_alvo"].includes(
            e.decision.chosen,
          ),
      ),
    ).toBe(true);
    expect(validateSlice(w)).toEqual([]);
  });
  it("sem ameaça não fabrica objetivo de proteção", () => {
    const s = protection();
    s.people[2].rival = undefined;
    s.people[2].hostility = 0;
    const w = simulateSlice(s);
    expect(personal(w).filter((g) => g.type === "proteger")).toHaveLength(0);
  });
});
describe("Marco 1b — conquistar amizade", () => {
  it("encontro, convites aceitos e confiança bilateral precedem amizade real", () => {
    const s = friendship(),
      w = simulateSlice(s);
    expect(validateSlice(w)).toEqual([]);
    const g = personal(w).find(
      (g) => g.owner === s.focal && g.type === "amizade",
    )!;
    expect(g.status).toBe("completed");
    expect(
      getPerson(w, s.focal).bonds?.[g.target]?.trust,
    ).toBeGreaterThanOrEqual(60);
    expect(
      w.events.filter(
        (e) =>
          e.type === "social.responded" &&
          e.data.accepted &&
          e.data.goal === g.id,
      ).length,
    ).toBeGreaterThanOrEqual(3);
  });
  it("recusa do outro impede amizade e encerra insistência após três convites", () => {
    const s = friendship();
    s.people[1].values = {
      familia: 0,
      vinganca: 0,
      paz: 0,
      amizade: 0,
      solidariedade: 0,
    };
    s.people[1].traits.rancor = 100;
    s.people[1].traits.cautela = 100;
    const w = simulateSlice(s);
    const g = personal(w).find(
      (g) => g.owner === s.focal && g.type === "amizade",
    )!;
    expect(g.status).toBe("abandoned");
    expect(g.rejections).toBe(3);
    expect(getPerson(w, s.focal).bonds?.[g.target]).toBeUndefined();
    expect(validateSlice(w)).toEqual([]);
  });
  it("retirar encontro impede objetivo dirigido a pessoa desconhecida", () => {
    const s = friendship();
    s.schedules[1].from = 12;
    const w = simulateSlice(s);
    expect(
      personal(w).some((g) => g.owner === s.focal && g.target === s.victim),
    ).toBe(false);
  });
  it("replay, retomada e determinismo incluem os novos objetivos", () => {
    const s = friendship(),
      w = simulateSlice(s),
      partial = new SliceSimulation(s).run(5),
      restored = new SliceSimulation(s, partial).run();
    expect(restored).toEqual(w);
    expect(replay(w.events)).toEqual(w.entities);
    expect(simulateSlice(s)).toEqual(w);
  });
  it("trocar nomes não altera metas nem resultados", () => {
    const a = friendship(),
      b = structuredClone(a);
    b.people.forEach((p, i) => (p.name = `Outra pessoa ${i}`));
    expect(personal(simulateSlice(a))).toEqual(personal(simulateSlice(b)));
  });
});

it("100 seeds pessoais preservam referências, conhecimento e eventos no replay", () => {
  for (let i = 0; i < 100; i++) {
    const w = simulateSlice(
      personalScenario(`pessoal-1b-${String(i).padStart(3, "0")}`),
    );
    expect(validateSlice(w), w.scenario.seed).toEqual([]);
  }
}, 90000);
it("amizade construída muda quem assume proteção; retirar o vínculo muda o desfecho", () => {
  const s = friendship();
  s.people[0].kin = [];
  s.people[1].kin = [];
  s.people[0].skill = 800;
  s.people[0].traits.coragem = 95;
  s.people[1].skill = 50;
  s.people[1].traits.cautela = 0;
  s.people[2].skill = 500;
  s.people[2].rival = s.people[1].id;
  s.people[2].hostility = 100;
  s.schedules[2].from = 4;
  s.schedules[2].period = 1;
  s.schedules[2].absentMonths = 0;
  s.friendTargets![s.people[1].id] = s.people[4].id; // no reciprocal planned contact: person 4 is absent during this fixture
  const a = simulateSlice(s),
    without = structuredClone(s);
  without.people[0].values.amizade = 0;
  const b = simulateSlice(without);
  const goal = personal(a).find(
    (g) => g.owner === s.focal && g.type === "proteger",
  )!;
  expect(goal.status).toBe("completed");
  expect(getPerson(a, s.victim).alive).toBe(true);
  expect(getPerson(b, s.victim).alive).toBe(false);
  const adoption = a.events[Number(goal.source.split(":")[1])];
  expect(
    adoption.causes.some(
      (id) =>
        a.events[Number(id.split(":")[1])].type === "relationship.strengthened",
    ),
  ).toBe(true);
  expect(validateSlice(a)).toEqual([]);
  expect(validateSlice(b)).toEqual([]);
});
