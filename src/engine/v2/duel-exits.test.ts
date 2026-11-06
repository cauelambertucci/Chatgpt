import { it, expect } from "vitest";
import { SliceSimulation } from "./engine";
import { bodyFixture, bodyScenario } from "./body-scenario";
import { openCompact, replayCompact } from "./compact-log";
import { validateCompact } from "./validate";
import type { Body, Part, Wound } from "./body";
it("capilares e veias estancam sem cuidado; coagulação não cura nervo nem elimina dor", () => {
  for (const vessel of ["capillary", "vein"] as const) {
    const s = bodyFixture();
    s.bodySimulation!.care = false;
    s.bodySimulation!.vesselOverride = { [s.victim]: vessel };
    const w = new SliceSimulation(s).runCompact(1),
      body = w.entities[`body:${s.victim}`] as Body,
      part = w.entities[`part:${s.victim}:forearm.left`] as Part;
    const wound = Object.values(w.entities).find(
      (e): e is Wound => e.kind === "wound",
    )!;
    expect(wound.rate).toBe(0);
    expect(wound.care).toBeUndefined();
    expect(wound.clotAt).not.toBeNull();
    expect(body.blood).toBeGreaterThan(3000);
    expect(body.pain).toBeGreaterThan(0);
    expect(part.nerve).toBe(0);
    expect(
      [...openCompact(w).events].some(
        (e) =>
          e.type === "blood.interval" &&
          (e.data.clotted as string[]).includes(wound.id),
      ),
    ).toBe(true);
    expect(replayCompact(w)).toEqual(w.entities);
    expect(validateCompact(w)).toEqual([]);
  }
});
it("mesmo golpe com mais estresse muda continuação para rendição, sem golpes posteriores", () => {
  const a = bodyScenario("duelo-2a-004"),
    b = structuredClone(a);
  for (const p of b.people.slice(0, 2)) p.psychology!.stress = 800;
  const events = [a, b].map((s) => [
    ...openCompact(new SliceSimulation(s).runCompact()).events,
  ]);
  const choices = events.map((es) => es.find((e) => e.type === "duel.choice")!);
  expect(choices[0].data.chosen).toBe("continuar");
  expect(choices[1].data.chosen).toBe("render");
  expect(
    events[0].find((e) => e.type === "attack.contact")!.data.trace,
  ).toEqual(events[1].find((e) => e.type === "attack.contact")!.data.trace);
  expect(
    events[1].filter(
      (e) => e.seq > choices[1].seq && e.type === "attack.attempted",
    ),
  ).toHaveLength(0);
});
it("terceiro ausente ou com informação bloqueada não decide interrupção", () => {
  const s = bodyScenario("duelo-2a-008"),
    base = new SliceSimulation(s).runCompact();
  expect(
    [...openCompact(base).events].some(
      (e) =>
        e.type === "duel.choice" &&
        e.data.stopped &&
        e.data.role === "terceiro",
    ),
  ).toBe(true);
  for (const block of [false, true]) {
    const other = structuredClone(s);
    const outsiders = other.people.slice(2).map((p) => p.id);
    if (block) other.bodySimulation!.blockedInformation = outsiders;
    else
      for (const q of other.schedules) if (outsiders.includes(q.id)) q.from = 7;
    const w = new SliceSimulation(other).runCompact();
    expect(
      [...openCompact(w).events].filter(
        (e) =>
          ["duel.choice", "duel.observed"].includes(e.type) &&
          outsiders.includes(e.participants[0].id),
      ),
    ).toHaveLength(0);
    expect(validateCompact(w)).toEqual([]);
  }
});
it("perna ausente impede fuga, mas não impede rendição nem decisão de parar", () => {
  const s = bodyScenario("duelo-2a-010");
  s.bodySimulation!.missing = { [s.victim]: ["leg.left"] };
  const w = new SliceSimulation(s).runCompact();
  const choices = [...openCompact(w).events].filter(
    (e) => e.type === "duel.choice" && e.participants[0].id === s.victim,
  );
  expect(choices.length).toBeGreaterThan(0);
  for (const e of choices) {
    expect(e.data.mobile).toBe(false);
    expect(e.data.eligible).not.toContain("fugir");
    expect(e.data.eligible).toContain("render");
  }
  expect(validateCompact(w)).toEqual([]);
});
it("lote novo preserva replay e causas sem quotas de desfecho", () => {
  for (let i = 0; i < 100; i++) {
    const w = new SliceSimulation(
      bodyScenario(`novo-21-${String(i).padStart(3, "0")}`),
    ).runCompact();
    expect(validateCompact(w), w.scenario.seed).toEqual([]);
    expect(replayCompact(w)).toEqual(w.entities);
  }
}, 120000);
