import { it, expect, vi } from "vitest";
import * as random from "./rules";
import { SliceSimulation, applyEvent } from "./engine";
import {
  settlementScenario,
  PoliticsSystem,
  warUtilities,
  politicalGate,
  type Settlement,
} from "./politics";
import { CompactLog, replayCompact } from "./compact-log";
import { validateCompact } from "./validate";
import type { SliceEvent, SliceWorld, Person } from "./types";
function harness() {
  const s = settlementScenario("politics-fixture", 12);
  s.mode = "fixture";
  s.politics!.count = 2;
  s.months = 24;
  s.bodySimulation!.singleDuel = undefined;
  s.lifeSimulation!.conceptionOverride = false;
  for (const p of s.people) {
    p.born = -25;
    p.skill = 0;
    p.traits.agressividade = 100;
    p.traits.coragem = 100;
    p.traits.rancor = 100;
    p.traits.cautela = 0;
    p.traits.compaixao = 0;
    p.traits.autocontrole = 0;
    p.values.paz = 0;
    p.values.poder = 100;
    p.values.vinganca = 100;
  }
  const w = structuredClone(new SliceSimulation(s).run(0));
  let month = 0;
  const emit = (
    type: string,
    participants: SliceEvent["participants"],
    causes: string[],
    effects: any[] = [],
    data: any = {},
  ) => {
    const e: SliceEvent = {
      id: `event:${w.events.length}`,
      seq: w.events.length,
      month,
      ano: Math.floor(month / 12),
      dia: (month % 12) * 30,
      type,
      participants,
      causes,
      effects,
      data,
      location: "place:void",
    };
    applyEvent(w.entities, e);
    w.events.push(e);
    return e;
  };
  const system = new PoliticsSystem({
    world: () => w,
    month: () => month,
    emit,
    die: (id, source, conflict) => {
      const p = w.entities[id] as Person;
      emit(
        "person.died",
        [{ id, role: "reference" }],
        [source],
        [
          {
            op: "replace",
            entity: { ...p, alive: false, death: `event:${w.events.length}` },
          },
        ],
        { victim: id, conflict },
      );
    },
  });
  const incident = () =>
    emit(
      "attack.attempted",
      [
        { id: "person:00", role: "actor" },
        { id: "person:01", role: "target" },
      ],
      ["event:1"],
      [],
      { duel: "fixture-duel" },
    );
  return {
    s,
    w,
    system,
    incident,
    tick: (n: number) => {
      month = n;
      system.monthly();
    },
  };
}
it("trocar líder muda decisão; remover incidente, notícia ou autoridade impede declaração", () => {
  const h = harness();
  const s = h.w.entities["settlement:1"] as Settlement;
  const leader = h.w.entities[s.leader!] as Person;
  const incident = h.incident();
  const notice = {
    id: "notice",
    type: "political.notice.received",
    participants: [{ id: leader.id, role: "actor" }],
    data: { incident: incident.id },
  } as unknown as SliceEvent;
  expect(politicalGate(h.w, s, leader.id, incident, notice, 0)).toBeUndefined();
  expect(warUtilities(leader).guerra).toBeGreaterThan(
    warUtilities(leader).acordo,
  );
  const peaceful = {
    ...leader,
    traits: {
      ...leader.traits,
      agressividade: 0,
      rancor: 0,
      coragem: 0,
      cautela: 100,
      compaixao: 100,
      autocontrole: 100,
    },
    values: { ...leader.values, paz: 100, poder: 0, vinganca: 0 },
  };
  expect(warUtilities(peaceful).guerra).toBeLessThan(
    warUtilities(peaceful).acordo,
  );
  expect(politicalGate(h.w, s, leader.id, undefined, notice, 0)).toMatch(
    "incidente",
  );
  expect(politicalGate(h.w, s, leader.id, incident, undefined, 0)).toMatch(
    "conhecido",
  );
  expect(
    politicalGate(
      h.w,
      { ...s, mandate: undefined },
      leader.id,
      incident,
      notice,
      0,
    ),
  ).toMatch("autoridade");
  expect(politicalGate(h.w, s, leader.id, incident, notice, 60)).toMatch(
    "autoridade",
  );
});
it("integra relato, viagem, guerra e mortalidade sem repetição do incidente", () => {
  const h = harness();
  h.incident();
  h.tick(0);
  expect(h.w.events.some((e) => e.type === "war.declared")).toBe(false);
  h.tick(1);
  expect(h.w.events.filter((e) => e.type === "war.declared")).toHaveLength(1);
  const original = random.sample;
  const mock = vi
    .spyOn(random, "sample")
    .mockImplementation((seed, key, min, max) =>
      seed.endsWith("|politics:casualties") ? 0 : original(seed, key, min, max),
    );
  h.tick(3);
  mock.mockRestore();
  const result = h.w.events.find((e) => e.type === "campaign.resolved")!;
  expect(result).toBeTruthy();
  expect(
    (result.data.casualties as string[]).length,
    JSON.stringify(result.data),
  ).toBeGreaterThan(0);
  h.tick(4);
  expect(h.w.events.filter((e) => e.type === "campaign.resolved")).toHaveLength(
    1,
  );
  const deaths = h.w.events.filter((e) => e.type === "person.died");
  expect(new Set(deaths.map((e) => e.data.victim)).size).toBe(deaths.length);
});
it("notícia bloqueada e incidente removido impedem guerra no loop", () => {
  const a = harness();
  a.tick(0);
  a.tick(1);
  expect(a.w.events.some((e) => e.type === "war.declared")).toBe(false);
  const b = harness();
  b.w.scenario.blockedInformation.push("person:01");
  b.incident();
  b.tick(0);
  b.tick(1);
  expect(b.w.events.some((e) => e.type === "war.declared")).toBe(false);
});
it("sucessão durante a viagem cancela campanha; mandato não se transfere", () => {
  const h = harness();
  h.incident();
  h.tick(0);
  h.tick(1);
  const s = h.w.entities["settlement:1"] as Settlement;
  s.termEnd = 2;
  h.tick(2);
  h.tick(3);
  expect(h.w.events.some((e) => e.type === "campaign.resolved")).toBe(false);
  expect(
    h.w.events.some(
      (e) =>
        e.type === "campaign.ended" &&
        String(e.data.reason).includes("cancelada"),
    ),
  ).toBe(true);
});
it("replay, retomada e causas permanecem íntegros no motor integrado", () => {
  const s = settlementScenario("politics-resume", 12);
  s.months = 36;
  const sim = new SliceSimulation(s);
  const checkpoint = sim.runCompact(15);
  const resumed = new SliceSimulation(s, checkpoint).runCompact();
  const full = new SliceSimulation(s).runCompact();
  expect(resumed).toEqual(full);
  expect(replayCompact(full)).toEqual(full.entities);
  expect(validateCompact(full)).toEqual([]);
  expect(
    [...CompactLog.from(full.log).select(new Set(["office.appointed"]))].length,
  ).toBeGreaterThan(0);
});
it("trabalho com reserva não impede recuperação; urgência alimentar continua produtiva", () => {
  const s = settlementScenario("work-rest", 12);
  s.months = 2;
  s.politics = undefined;
  s.personalObjectives = false;
  s.advancedObjectives = false;
  s.bodySimulation!.singleDuel = undefined;
  for (const p of s.people) {
    p.psychology = {
      stress: 600,
      needs: { descanso: 100, vinculo: 0, seguranca: 0, expressao: 0 },
    };
    p.values.arte = -100;
    p.values.solidariedade = -100;
    p.traits.criatividade = 0;
    p.medicalSkill = 0;
  }
  s.dailyLife!.economy!.initial.food = 80;
  const rested = [
    ...CompactLog.from(new SliceSimulation(s).runCompact().log).select(
      new Set(["stress.response"]),
    ),
  ];
  expect(rested.some((e) => e.data.action === "recuperar")).toBe(true);
  s.dailyLife!.economy!.initial.food = 0;
  const urgent = [
    ...CompactLog.from(new SliceSimulation(s).runCompact().log).select(
      new Set(["livelihood.period"]),
    ),
  ];
  expect(urgent.some((e) => e.data.task === "cultivar")).toBe(true);
});
it("metamórfico no loop: mesmo incidente, líder conciliador rejeita; sem mandato também", () => {
  const peace = harness();
  const s = peace.w.entities["settlement:1"] as Settlement;
  const p = peace.w.entities[s.leader!] as Person;
  Object.assign(p.traits, {
    agressividade: 0,
    rancor: 0,
    coragem: 0,
    cautela: 100,
    compaixao: 100,
    autocontrole: 100,
  });
  Object.assign(p.values, { paz: 100, poder: 0, vinganca: 0 });
  peace.incident();
  peace.tick(0);
  peace.tick(1);
  expect(peace.w.events.some((e) => e.type === "war.declared")).toBe(false);
  expect(
    peace.w.events.some(
      (e) =>
        e.type === "dispute.proposed",
    ),
  ).toBe(true);
  const noAuthority = harness();
  (noAuthority.w.entities["settlement:1"] as Settlement).mandate = undefined;
  noAuthority.incident();
  noAuthority.tick(0);
  noAuthority.tick(1);
  expect(noAuthority.w.events.some((e) => e.type === "war.declared")).toBe(
    false,
  );
  expect(
    noAuthority.w.events.some(
      (e) =>
        e.type === "war.rejected" &&
        String(e.data.reason).includes("autoridade"),
    ),
  ).toBe(true);
});
it("mortes do conflito acionam viuvez, guarda e emoção no motor completo", async () => {
  const { politicalWarFixture } = await import("./politics-fixture");
  const s = politicalWarFixture();
  s.months = 125;
  const w = new SliceSimulation(s).runCompact();
  const events = [
    ...CompactLog.from(w.log).select(
      new Set([
        "person.died",
        "partnership.ended",
        "guardianship.decided",
        "emotion.felt",
      ]),
    ),
  ];
  const deaths = events.filter(
    (e) => e.type === "person.died" && e.data.conflict,
  );
  const ids = new Set(deaths.map((e) => e.id));
  expect(deaths.length).toBeGreaterThan(0);
  expect(new Set(deaths.map((e) => e.data.victim)).size).toBe(deaths.length);
  expect(
    events.some(
      (e) => e.type === "partnership.ended" && ids.has(String(e.data.death)),
    ),
  ).toBe(true);
  expect(
    events.some(
      (e) =>
        e.type === "guardianship.decided" &&
        e.data.orphan &&
        e.causes.some((c) => ids.has(c)),
    ),
  ).toBe(true);
  expect(
    events.some(
      (e) => e.type === "emotion.felt" && e.data.stimulus === "perda",
    ),
  ).toBe(true);
  expect(validateCompact(w)).toEqual([]);
}, 30000);
