import { it, expect } from "vitest";
import { SliceSimulation, simulateSlice, getPerson, replay } from "./engine";
import { advancedFixture } from "./advanced-fixtures";
import {
  emotionalize,
  lossFixture,
  recurringFixture,
} from "./emotional-fixtures";
import { emotionalScenario } from "./scenario";
import { validateSlice } from "./validate";
import { personalGoals, personalStories } from "./personal-report";
import type { Place } from "./types";
it("mesma perda real: personalidades diferentes produzem transformações diferentes, após receber notícia", () => {
  const a = simulateSlice(lossFixture("irado")),
    b = simulateSlice(lossFixture("solidario"));
  for (const w of [a, b]) {
    expect(validateSlice(w)).toEqual([]);
    const loss = w.events.find(
      (e) =>
        e.type === "emotion.felt" &&
        e.participants[0].id === w.scenario.focal &&
        e.data.stimulus === "perda",
    )!;
    expect(loss).toBeDefined();
    expect(loss.month).toBeGreaterThan(0);
    expect(
      w.events[Number(String(loss.data.stimulusSource).split(":")[1])].type,
    ).toBe("information.received");
    const transformed = w.events.find(
      (e) => e.type === "person.transformed" && e.causes.includes(loss.id),
    )!;
    expect(transformed).toBeDefined();
    expect(transformed.data.facetAfter).not.toBe(transformed.data.facetBefore);
    expect(transformed.data.valueAfter).not.toBe(transformed.data.valueBefore);
  }
  const responses = [a, b].map(
    (w) =>
      w.events.find(
        (e) =>
          e.type === "emotion.felt" &&
          e.participants[0].id === w.scenario.focal &&
          e.data.stimulus === "perda",
      )!.data.emotion,
  );
  expect(responses).toEqual(["luto irado", "luto solidario"]);
  expect(a.events.find((e) => e.type === "person.died")?.data).toEqual(
    b.events.find((e) => e.type === "person.died")?.data,
  );
});
it("bloquear a informação impede luto e transformação por perda desconhecida", () => {
  const s = lossFixture("irado");
  s.blockedInformation = [s.focal];
  const w = simulateSlice(s);
  expect(
    w.events.filter(
      (e) =>
        e.type === "emotion.felt" &&
        e.participants[0].id === s.focal &&
        e.data.stimulus === "perda",
    ),
  ).toHaveLength(0);
  expect(validateSlice(w)).toEqual([]);
});
it("estresse alto altera escolhas: isolamento, agressividade verbal e abandono do posto dependem do contexto", () => {
  for (const action of ["isolar", "hostilizar", "abandonar_posto"] as const) {
    const s = emotionalize(advancedFixture("governar"));
    s.months = 1;
    const p = s.people[0];
    p.values.poder = 0;
    p.traits.ambicao = 0;
    p.psychology!.stress = 950;
    p.traits.cautela = action === "isolar" ? 100 : 0;
    p.traits.sociabilidade = 0;
    p.traits.agressividade = action === "hostilizar" ? 100 : 0;
    p.traits.autocontrole = 0;
    p.traits.disciplina = 0;
    if (action === "hostilizar") p.rival = s.people[1].id;
    if (action === "abandonar_posto") {
      s.fixtureLeader = p.id;
      p.psychology!.needs.descanso = 100;
    }
    const sim = new SliceSimulation(s);
    const w = sim.run();
    expect(
      w.events.find(
        (e) => e.type === "stress.response" && e.participants[0].id === p.id,
      )?.data.action,
    ).toBe(action);
    expect(validateSlice(w)).toEqual([]);
    if (action === "abandonar_posto")
      expect((w.entities["place:void"] as Place).leader).toBeUndefined();
    const low = structuredClone(s);
    low.people[0].psychology!.stress = 0;
    expect(
      simulateSlice(low).events.find(
        (e) => e.type === "stress.response" && e.participants[0].id === p.id,
      )?.data.action,
    ).not.toBe(action);
  }
});
it("ameaças reincidentes têm consequência causal e não repetem indefinidamente", () => {
  const w = simulateSlice(recurringFixture());
  expect(validateSlice(w)).toEqual([]);
  const sanctions = w.events.filter((e) => e.type === "aggressor.consequence");
  expect(sanctions.length).toBeGreaterThan(0);
  for (const e of sanctions)
    expect(Number(e.data.count)).toBeGreaterThanOrEqual(3);
  const place = w.entities["place:void"] as Place;
  for (const ledger of Object.values(place.incidents || {}))
    expect(ledger.threats.length).toBeLessThanOrEqual(4);
});
it("testemunha sem contribuição encerra resolvido por outro; não é falha ou intervenção creditada", () => {
  const w = simulateSlice(recurringFixture(true));
  const resolved = personalGoals(w).filter(
    (g) => g.status === "resolved_by_other",
  );
  expect(resolved.length).toBeGreaterThan(0);
  for (const g of resolved) {
    expect(g.interventions).toBe(0);
    expect(g.perception).toBeDefined();
  }
  expect(validateSlice(w)).toEqual([]);
});
it("replay, retomada JSON e ranking funcionam com necessidades e transformações", () => {
  const s = emotionalScenario("metamorfico-1d");
  s.months = 36;
  const full = simulateSlice(s),
    partial = new SliceSimulation(s).run(12);
  const resumed = new SliceSimulation(
    s,
    JSON.parse(JSON.stringify(partial)),
  ).run();
  expect(resumed).toEqual(full);
  expect(replay(full.events)).toEqual(full.entities);
  expect(validateSlice(full)).toEqual([]);
  expect(() => personalStories(full)).not.toThrow();
});
it("emoções não apagam pessoas nem ultrapassam escalas; necessidades são mensais", () => {
  const w = simulateSlice(emotionalScenario("necessidades-1d"));
  expect(validateSlice(w)).toEqual([]);
  const keys = new Set<string>();
  for (const e of w.events.filter((e) => e.type === "needs.period")) {
    const key = `${e.data.owner}:${e.month}`;
    expect(keys.has(key)).toBe(false);
    keys.add(key);
    expect(e.data.periodMonths).toBe(1);
  }
  expect(w.events.some((e) => e.type === "person.transformed")).toBe(true);
  for (const p of Object.values(w.entities).filter(
    (e) => e.kind === "person",
  )) {
    expect(p.psychology!.stress).toBeGreaterThanOrEqual(0);
    expect(p.psychology!.stress).toBeLessThanOrEqual(1000);
    expect(p.psychology!.needs.descanso).toBeLessThanOrEqual(100);
  }
});
it("quatro respostas ao reincidente são selecionadas por valores; reincidir depois da advertência leva à expulsão", () => {
  for (const response of ["confronto", "expulsao", "perdao", "acordo"]) {
    const s = recurringFixture();
    const a = s.people[0];
    a.traits.coragem = 0;
    a.traits.cautela = 0;
    a.traits.tolerancia = 0;
    a.traits.confianca = 0;
    a.values.justica = 0;
    a.values.lei = 0;
    a.values.paz = 0;
    a.values.cooperacao = 0;
    if (response === "confronto") a.traits.coragem = 100;
    if (response === "expulsao") a.traits.cautela = 100;
    if (response === "perdao") a.traits.tolerancia = 100;
    if (response === "acordo") a.traits.confianca = 100;
    const w = simulateSlice(s),
      sanctions = w.events.filter((e) => e.type === "aggressor.consequence");
    expect(sanctions[0]?.data.response).toBe(response);
    if (response !== "expulsao")
      expect(sanctions[1]?.data.response).toBe("expulsao");
    expect(validateSlice(w)).toEqual([]);
    const expelled = Object.values(w.entities).find(
      (p) => p.kind === "person" && p.expelled,
    );
    expect(expelled?.kind === "person" && expelled.present).toBe(false);
  }
});
it("quebrar promessa explícita de apoio gera traição percebida, emoção e transformação; trocar apoio sem promessa não", () => {
  const s = emotionalize(advancedFixture("governar"));
  s.months = 3;
  const [old, candidate, voter] = s.people;
  old.values.poder = 0;
  old.traits.ambicao = 0;
  old.skills!.lideranca = 20;
  candidate.values.poder = 100;
  candidate.traits.ambicao = 100;
  candidate.skills!.lideranca = 100;
  voter.supportFor = old.id;
  voter.pledge = { to: old.id, source: "event:1", until: 12 };
  const w = simulateSlice(s);
  expect(
    w.events.some(
      (e) => e.type === "betrayal.perceived" && e.data.beneficiary === old.id,
    ),
  ).toBe(true);
  expect(
    w.events.some(
      (e) =>
        e.type === "emotion.felt" &&
        e.data.stimulus === "traicao" &&
        e.participants[0].id === old.id,
    ),
  ).toBe(true);
  expect(validateSlice(w)).toEqual([]);
  delete voter.pledge;
  const unpromised = simulateSlice(s);
  expect(unpromised.events.some((e) => e.type === "betrayal.perceived")).toBe(
    false,
  );
});
it("bloquear percepção não concede fechamento ou crédito por resgate remoto", () => {
  const s = recurringFixture(true),
    observer = s.people[4];
  s.blockedThreatPerception = [observer.id];
  const w = simulateSlice(s);
  expect(
    personalGoals(w).filter(
      (g) => g.type === "proteger" && g.owner === observer.id,
    ),
  ).toHaveLength(0);
  expect(validateSlice(w)).toEqual([]);
});
it("vencer alivia estresse sem fabricar mudança quando ambos os atributos já estão saturados", () => {
  const s = lossFixture("irado");
  const winner = s.people[2];
  winner.psychology!.stress = 400;
  winner.traits.esperanca = 100;
  winner.values.honra = 100;
  const w = simulateSlice(s);
  const victory = w.events.find(
    (e) =>
      e.type === "emotion.felt" &&
      e.participants[0].id === winner.id &&
      e.data.stimulus === "vitoria",
  )!;
  expect(victory).toBeDefined();
  expect(Number(victory.data.stressAfter)).toBeLessThan(
    Number(victory.data.stressBefore),
  );
  expect(
    w.events.some(
      (e) => e.type === "person.transformed" && e.causes.includes(victory.id),
    ),
  ).toBe(false);
  expect(validateSlice(w)).toEqual([]);
});
it("validador rejeita emoção sem notícia e crédito de resgate sem resolução", () => {
  const loss = simulateSlice(lossFixture("solidario"));
  const emotion = loss.events.find(
    (e) => e.type === "emotion.felt" && e.data.stimulus === "perda",
  )!;
  (emotion.data as Record<string, unknown>).stimulusSource = "event:1";
  expect(validateSlice(loss).some((e) => e.includes("luto sem notícia"))).toBe(
    true,
  );
  const rescue = simulateSlice(recurringFixture(true));
  const resolved = personalGoals(rescue).find(
    (g) => g.status === "resolved_by_other",
  )!;
  const closure = rescue.events.find(
    (e) => e.type === "personalGoal.closed" && e.data.goal === resolved.id,
  )!;
  const effect = closure.effects.find((e) => e.entity.id === resolved.id)!;
  if (effect.entity.kind === "personalGoal") effect.entity.interventions = 2;
  expect(
    validateSlice(rescue).some((e) =>
      e.includes("resolvido por outro sem testemunho"),
    ),
  ).toBe(true);
});
it("autodefesa letal do alvo resolve a proteção da testemunha sem creditar intervenção", () => {
  const s = recurringFixture();
  s.months = 1;
  const [, target, attacker, guardian] = s.people;
  attacker.skill = 500;
  target.skill = 600;
  target.traits.cautela = 0;
  guardian.skill = 800;
  guardian.psychology!.stress = 950;
  guardian.traits.cautela = 100;
  guardian.traits.sociabilidade = 0;
  const w = simulateSlice(s);
  expect(getPerson(w, attacker.id).alive).toBe(false);
  expect(getPerson(w, target.id).alive).toBe(true);
  const g = personalGoals(w).find(
    (g) => g.owner === guardian.id && g.type === "proteger",
  )!;
  expect(g).toBeDefined();
  expect(g.interventions).toBe(0);
  expect(g.status).toBe("resolved_by_other");
  expect(validateSlice(w)).toEqual([]);
});
it("seed reservada 096 preserva DAG mesmo com realimentação entre rotinas e outros agentes", () => {
  const w = simulateSlice(emotionalScenario("reservado-1d-096"));
  expect(validateSlice(w)).toEqual([]);
  expect(() => personalStories(w)).not.toThrow();
});
it("fracasso de proteção remoto só gera emoção quando o guardião recebe a notícia", () => {
  const s = recurringFixture();
  s.months = 10;
  const guardian = s.people[3];
  const schedule = s.schedules.find((x) => x.id === guardian.id)!;
  schedule.period = 6;
  schedule.absentMonths = 5;
  const w = simulateSlice(s);
  const g = personalGoals(w).find(
    (g) => g.owner === guardian.id && g.type === "proteger",
  )!;
  expect(g.status).toBe("failed");
  const closure = w.events.find(
    (e) => e.type === "personalGoal.closed" && e.data.goal === g.id,
  )!;
  expect(closure.month).toBe(3);
  const reactions = w.events.filter(
    (e) =>
      e.type === "emotion.felt" &&
      e.participants[0].id === guardian.id &&
      e.data.stimulus === "fracasso",
  );
  expect(reactions).toHaveLength(1);
  const emotion = reactions[0],
    source =
      w.events[Number(String(emotion.data.stimulusSource).split(":")[1])];
  expect(source.type).toBe("information.received");
  expect(emotion.month).toBeGreaterThan(closure.month);
  expect(emotion.causes).toContain(closure.id);
  expect(validateSlice(w)).toEqual([]);
});
