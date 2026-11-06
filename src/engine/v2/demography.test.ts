import { it, expect } from "vitest";
import { SliceSimulation } from "./engine";
import { demographicScenario } from "./demographic-scenario";
import { openCompact, replayCompact } from "./compact-log";
import { conceptionDiagnostic } from "./demography";
import { validateCompact } from "./validate";
import { auditLife, auditLifeCompact } from "./life-audit";
import type { Life } from "./life";
it("observação de barreiras não altera log, RNG ou estado", () => {
  const s = demographicScenario("diagnostico-imutavel");
  s.months = 120;
  const plain = new SliceSimulation(s).runCompact();
  let calls = 0;
  const observed = new SliceSimulation(s, undefined, {
    observeConception: (o) => {
      calls++;
      o.reasons.push("mutação externa não deve afetar o motor");
    },
  }).runCompact();
  expect(calls).toBeGreaterThan(0);
  expect(observed).toEqual(plain);
});
it("escala cria exatamente os fundadores pedidos com IDs únicos e sem ancestrais", () => {
  for (const n of [12, 40, 100]) {
    const s = demographicScenario("escala", n);
    expect(s.people).toHaveLength(n);
    expect(new Set(s.people.map((p) => p.id)).size).toBe(n);
    expect(s.schedules).toHaveLength(n);
    s.months = 1;
    const w = new SliceSimulation(s).runCompact();
    expect(
      Object.values(w.entities)
        .filter((e) => e.kind === "life")
        .every((l: any) => l.parents.length === 0),
    ).toBe(true);
  }
});
it("política individual permite mais filhos sem quota, preservando gestação, intervalo, replay e checkpoint", () => {
  const s = demographicScenario("fixture-fecundidade", 12, true);
  s.mode = "fixture";
  s.months = 180;
  s.bodySimulation = { care: true };
  s.lifeSimulation = {
    fertilityPolicy: "replacement-2c",
    conceptionOverride: true,
    lossOverride: false,
    roles: {},
  };
  for (const [i, p] of s.people.entries()) {
    p.values.familia = 70;
    p.values.amizade = 100;
    p.values.paz = 100;
    p.born = -18;
    p.hostility = 0;
    p.trainAccess = false;
    s.lifeSimulation.roles![p.id] = i % 2 ? "contributor" : "gestational";
  }
  const old = structuredClone(s);
  delete old.lifeSimulation!.fertilityPolicy;
  const a = new SliceSimulation(old).runCompact(),
    b = new SliceSimulation(s).runCompact();
  const births = (w: any) =>
    Object.values(w.entities).filter(
      (e: any) => e.kind === "pregnancy" && e.status === "born",
    ).length;
  expect(births(b)).toBeGreaterThan(births(a));
  expect(auditLife(openCompact(b))).toEqual([]);
  expect(auditLifeCompact(b)).toEqual(auditLife(openCompact(b)));
  const tampered = structuredClone(b);
  const pregnancy = Object.values(tampered.entities).find(e => e.kind === "pregnancy" && e.status === "born");
  if (!pregnancy || pregnancy.kind !== "pregnancy") throw Error("Missing fixture birth");
  pregnancy.due++;
  expect(auditLifeCompact(tampered)).toEqual(auditLife(openCompact(tampered)));
  expect(auditLifeCompact(tampered).some(e => e.startsWith("gestação inválida"))).toBe(true);

  expect(validateCompact(b)).toEqual([]);
  expect(replayCompact(b)).toEqual(b.entities);
  const partial = new SliceSimulation(s).runCompact(72);
  expect(new SliceSimulation(s, partial).runCompact()).toEqual(b);
  const ev = [...openCompact(b).events].filter(
    (e) => e.type === "pregnancy.conceived",
  );
  expect(
    ev.every((e) => e.data.childCost === 30 && e.data.utilityThreshold === 15),
  ).toBe(true);
  for (const l of Object.values(b.entities).filter(
    (e): e is Life => e.kind === "life",
  )) {
    const months = ev
      .filter((e) => e.participants[0].id === l.owner)
      .map((e) => e.month);
    for (let i = 1; i < months.length; i++)
      expect(months[i] - months[i - 1]).toBeGreaterThanOrEqual(33);
  }
}, 120000);
it("diagnóstico mantém barreiras simultâneas e desejo zero; sem gestante não há concepção elegível", () => {
  const s = demographicScenario("barreiras");
  s.months = 1;
  const w = openCompact(new SliceSimulation(s).runCompact());
  const lives = Object.values(w.entities).filter(
    (e): e is Life => e.kind === "life",
  );
  const mutable = structuredClone({ ...w, events: [] });
  const [a, b] = lives.slice(0, 2).map((l) => mutable.entities[l.id] as Life);
  a.partner = b.owner;
  b.partner = a.owner;
  a.role = "gestational";
  b.role = "contributor";
  a.birthMonth = -30 * 12;
  b.birthMonth = -30 * 12;
  a.lastPregnancyEnd = 0;
  for (const id of [a.owner, b.owner]) {
    const p = mutable.entities[id] as any;
    p.values.familia = 0;
    p.present = false;
  }
  const d = conceptionDiagnostic(mutable, a, 12)!;
  expect(d.reasons).toEqual(
    expect.arrayContaining([
      "ausência",
      "intervalo",
      "desejo zero",
      "utilidade insuficiente",
    ]),
  );
  b.role = "gestational";
  expect(conceptionDiagnostic(mutable, a, 12)!.reasons).toContain(
    "papéis incompatíveis",
  );
});
