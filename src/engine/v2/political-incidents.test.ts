import { it, expect } from "vitest";
import { settlementScenario, politicalGate, type Settlement } from "./politics";
import { shortage, theftUtility } from "./political-incidents";
import { SliceSimulation } from "./engine";
import { CompactLog, replayCompact } from "./compact-log";
import { validateCompact } from "./validate";
import { auditDailyCompact } from "./daily-audit";
function fixture() {
  const s = settlementScenario("incidents-fixture", 12);
  s.mode = "fixture";
  s.months = 8;
  s.bodySimulation!.singleDuel = undefined;
  s.lifeSimulation!.conceptionOverride = false;
  for (const p of s.people) {
    p.born = -25;
    p.values.familia = -100;
    p.values.poder = 100;
    p.values.lei = -100;
    Object.assign(p.traits, {
      ambicao: 100,
      agressividade: 100,
      curiosidade: 100,
      sociabilidade: 100,
      autocontrole: 0,
      cautela: 0,
    });
  }
  return s;
}
it("limiar de escassez usa reserva e fome reais, sem inventar crise", () => {
  expect(shortage(8, 8, 0)).toBe(true);
  expect(shortage(100, 8, 40)).toBe(true);
  expect(shortage(100, 8, 0)).toBe(false);
  expect(shortage(0, 0, 0)).toBe(false);
});
it("roubo transfere materiais sem criar estoque e segue cadeia de conhecimento", () => {
  const w = new SliceSimulation(fixture()).runCompact(),
    es = [
      ...CompactLog.from(w.log).select(
        new Set([
          "property.stolen",
          "theft.perceived",
          "political.notice.sent",
        ]),
      ),
    ];
  expect(es.some((e) => e.type === "property.stolen")).toBe(true);
  for (const e of es.filter((e) => e.type === "theft.perceived"))
    expect(
      es.some((x) => x.id === e.data.incident && x.type === "property.stolen"),
    ).toBe(true);
  expect(auditDailyCompact(w)).toEqual([]);
  expect(validateCompact(w)).toEqual([]);
  expect(replayCompact(w)).toEqual(w.entities);
});
it("sem bem disponível não há roubo; sem notícia o líder não recebe conhecimento", () => {
  const s = fixture();
  s.dailyLife!.initialPaper = 0;
  s.dailyLife!.initialInk = 0;
  s.dailyLife!.economy!.initial.fiber = 0;
  const w = new SliceSimulation(s).runCompact();
  expect([
    ...CompactLog.from(w.log).select(new Set(["property.stolen"])),
  ]).toHaveLength(0);
  const t = fixture();
  t.blockedInformation = t.people.map((p) => p.id);
  const blocked = new SliceSimulation(t).runCompact();
  expect([
    ...CompactLog.from(blocked.log).select(
      new Set(["political.notice.received"]),
    ),
  ]).toHaveLength(0);
});
it("escassez observada pode gerar petição; estoque suficiente remove o motivo", () => {
  const s = fixture();
  s.dailyLife!.economy!.initial.food = 0;
  s.dailyLife!.economy!.harvest = 0;
  s.months = 3;
  const w = new SliceSimulation(s).runCompact();
  const es = [
    ...CompactLog.from(w.log).select(
      new Set(["scarcity.observed", "political.notice.sent"]),
    ),
  ];
  expect(es.some((e) => e.type === "scarcity.observed")).toBe(true);
  expect(
    es.some(
      (e) =>
        e.type === "political.notice.sent" &&
        es.some(
          (x) => x.id === e.data.incident && x.type === "scarcity.observed",
        ),
    ),
  ).toBe(true);
  const enough = fixture();
  enough.months = 3;
  enough.dailyLife!.economy!.initial.food = 1000;
  const full = new SliceSimulation(enough).runCompact();
  expect([
    ...CompactLog.from(full.log).select(new Set(["scarcity.observed"])),
  ]).toHaveLength(0);
});
it("honestidade legal e autocontrole mudam escolha de apropriação", () => {
  const p = fixture().people[0];
  expect(theftUtility(p, false).take).toBeGreaterThan(
    theftUtility(p, false).leave,
  );
  p.values.lei = 100;
  p.traits.autocontrole = 100;
  p.traits.ambicao = 0;
  p.traits.agressividade = 0;
  expect(theftUtility(p, false).take).toBeLessThan(
    theftUtility(p, false).leave,
  );
});
it("bloquear a vítima não impede o roubo material, mas impede seu relato", () => {
  const s = fixture();
  s.months = 3;
  const normal = new SliceSimulation(s).runCompact();
  const original = [
    ...CompactLog.from(normal.log).select(new Set(["property.stolen"])),
  ][0];
  expect(original).toBeTruthy();
  const victim = String(original.data.from),
    thief = String(original.data.to);
  const blocked = fixture();
  blocked.months = 3;
  blocked.blockedInformation = [victim];
  const w = new SliceSimulation(blocked).runCompact();
  const events = [
    ...CompactLog.from(w.log).select(
      new Set(["property.stolen", "theft.perceived", "political.notice.sent"]),
    ),
  ];
  expect(
    events.some(
      (e) =>
        e.type === "property.stolen" &&
        e.data.from === victim &&
        e.data.to === thief,
    ),
  ).toBe(true);
  expect(
    events.some(
      (e) => e.type === "theft.perceived" && e.participants[0]?.id === victim,
    ),
  ).toBe(false);
  expect(auditDailyCompact(w)).toEqual([]);
});
