import { it, expect } from "vitest";
import { lifeScenario } from "./life-scenario";
import { SliceSimulation } from "./engine";
import { openCompact, replayCompact } from "./compact-log";
import { validateCompact } from "./validate";
import { lineageDepth, auditLife } from "./life-audit";
import type { Life, Pregnancy } from "./life";
import type { Body } from "./body";
function fixture() {
  const s = lifeScenario("fixture-linhagem", 8);
  s.mode = "fixture";
  s.months = 720;
  s.bodySimulation = { care: true, maxExchanges: 1 };
  s.lifeSimulation = {
    conceptionOverride: true,
    lossOverride: false,
    roles: {},
  };
  for (const [i, p] of s.people.entries()) {
    p.born = -20;
    p.values.familia = 100;
    p.values.paz = 100;
    p.values.amizade = 80;
    p.traits.compaixao = 100;
    p.traits.confianca = 100;
    p.traits.cautela = 10;
    p.hostility = 0;
    p.trainAccess = false;
    p.canHelp = true;
    p.medicalSkill = 80;
    s.lifeSimulation.roles![p.id] = i % 2 ? "contributor" : "gestational";
  }
  return s;
}
it("gestação cria criança com corpo infantil, sem memórias nem arma; balanço e replay fecham", () => {
  const s = fixture(),
    w = new SliceSimulation(s).runCompact(10),
    events = [...openCompact(w).events];
  const born = events.find((e) => e.type === "person.born")!;
  expect(born).toBeDefined();
  const p = w.entities[born.participants[0].id] as any,
    b = w.entities[`body:${p.id}`] as Body;
  expect(p.born).toBe(0);
  expect(p.skill).toBe(0);
  expect(p.informed).toEqual([]);
  expect(p.goal).toBeUndefined();
  expect(b.weapon).toBeUndefined();
  expect(b.blood).toBe(600);
  expect(born.data.gestationMonths).toBe(9);
  expect(validateCompact(w)).toEqual([]);
  expect(replayCompact(w)).toEqual(w.entities);
});
it("pais biológicos e responsáveis são separados; órfão exige decisão explícita", () => {
  const s = fixture();
  s.lifeSimulation!.deathMonths = {
    [s.people[0].id]: 20,
    [s.people[1].id]: 21,
  };
  const w = new SliceSimulation(s).runCompact(22),
    events = [...openCompact(w).events];
  const orphan = events.find(
    (e) => e.type === "guardianship.decided" && e.data.orphan && e.data.chosen,
  )!;
  expect(orphan).toBeDefined();
  const l = w.entities[`life:${orphan.data.child}`] as Life;
  expect(l.parents).toEqual([s.people[0].id, s.people[1].id]);
  expect(l.guardians).toEqual([orphan.data.chosen]);
  for (const id of l.parents) {
    expect((w.entities[id] as any).alive).toBe(false);
    expect(w.entities[`kill:${id}`]).toBeUndefined();
  }
  expect(validateCompact(w)).toEqual([]);
});
it("perda gestacional não conta como pessoa morta; concepção bloqueada impede essa descendência", () => {
  const s = fixture();
  s.lifeSimulation!.lossOverride = true;
  const w = new SliceSimulation(s).runCompact(10);
  expect(
    Object.values(w.entities).some(
      (e) => e.kind === "pregnancy" && e.status === "lost",
    ),
  ).toBe(true);
  expect(
    Object.values(w.entities).filter((e) => e.kind === "person"),
  ).toHaveLength(8);
  expect(validateCompact(w)).toEqual([]);
  const t = fixture();
  t.lifeSimulation!.blockedConceptions = [t.people[0].id];
  const blocked = new SliceSimulation(t).runCompact(10);
  expect(
    Object.values(blocked.entities)
      .filter((e): e is Pregnancy => e.kind === "pregnancy")
      .every((g) => g.parents[0] !== t.people[0].id),
  ).toBe(true);
});
it("genealogia simulada chega a três gerações, sem pais dos fundadores nem cópia integral dos traços", () => {
  const s = fixture(),
    w = new SliceSimulation(s).runCompact();
  expect(Math.max(...lineageDepth(w.entities).values())).toBeGreaterThanOrEqual(
    3,
  );
  for (const p of s.people)
    expect((w.entities[`life:${p.id}`] as Life).parents).toEqual([]);
  const events = [...openCompact(w).events];
  const births = events.filter((e) => e.type === "person.born");
  for (const e of births) {
    const h = e.data.inheritance as Record<string, any>;
    expect(Object.values(h).some((x) => x.genetic !== x.maternal)).toBe(true);
    expect(Object.values(h).every((x) => x.experience === 0)).toBe(true);
  }
  expect(validateCompact(w)).toEqual([]);
}, 120000);
it("mesma sequela informa parceiro e filhos apenas após percepção; notícia bloqueada impede luto", () => {
  const s = fixture();
  s.months = 140;
  s.bodySimulation = {
    fixture: true,
    care: true,
    maxExchanges: 1,
    singleDuel: {
      attacker: s.people[2].id,
      defender: s.people[1].id,
      caregiver: s.people[3].id,
      month: 120,
    },
  };
  s.people[2].skill = 650;
  s.people[1].skill = 550;
  const w = new SliceSimulation(s).runCompact(),
    events = [...openCompact(w).events];
  expect(
    events.some(
      (e) =>
        e.type === "sequela.perceived" &&
        e.participants[0].id === s.people[0].id,
    ),
  ).toBe(true);
  const children = Object.values(w.entities).filter(
    (e): e is Life => e.kind === "life" && e.parents.includes(s.people[1].id),
  );
  expect(
    events.some(
      (e) =>
        e.type === "sequela.perceived" &&
        children.some((l) => l.owner === e.participants[0].id),
    ),
  ).toBe(true);
  const blocked = fixture();
  blocked.months = 24;
  blocked.lifeSimulation!.deathMonths = { [blocked.people[1].id]: 20 };
  blocked.blockedInformation = [blocked.people[0].id];
  const b = new SliceSimulation(blocked).runCompact(),
    ev = [...openCompact(b).events];
  expect(
    ev.some(
      (e) =>
        e.type === "information.received" &&
        e.participants[0].id === blocked.people[0].id,
    ),
  ).toBe(false);
  expect(validateCompact(w)).toEqual([]);
  expect(validateCompact(b)).toEqual([]);
}, 120000);
it("retomada conserva agendas, herança e ledger; auditoria rejeita ciclo de ascendência", () => {
  const s = fixture();
  s.months = 36;
  const full = new SliceSimulation(s).runCompact(),
    partial = new SliceSimulation(s).runCompact(5),
    resumed = new SliceSimulation(
      s,
      JSON.parse(JSON.stringify(partial)),
    ).runCompact();
  expect(resumed).toEqual(full);
  const changed = JSON.parse(JSON.stringify(full));
  const l = changed.entities[`life:${s.people[0].id}`];
  l.parents = [l.owner];
  expect(
    auditLife({ ...openCompact(changed), entities: changed.entities }).some(
      (e) => e.includes("cíclica"),
    ),
  ).toBe(true);
});
it("guarda encerra na maioridade; morte da gestante encerra a gestação no mesmo mês", () => {
  const s = fixture();
  s.months = 226;
  const w = new SliceSimulation(s).runCompact();
  for (const l of Object.values(w.entities).filter(
    (e): e is Life => e.kind === "life",
  ))
    if (w.nextMonth - 1 - l.birthMonth >= 216) expect(l.guardians).toEqual([]);
  const t = fixture();
  t.months = 5;
  t.lifeSimulation!.deathMonths = { [t.people[0].id]: 4 };
  const stopped = new SliceSimulation(t).runCompact();
  const pregnancies = Object.values(stopped.entities).filter(
    (e): e is Pregnancy =>
      e.kind === "pregnancy" && e.parents[0] === t.people[0].id,
  );
  expect(pregnancies.length).toBeGreaterThan(0);
  expect(pregnancies.every((g) => g.status === "lost")).toBe(true);
  expect(validateCompact(stopped)).toEqual([]);
});
