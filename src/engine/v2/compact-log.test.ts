import { it, expect } from "vitest";
import { SliceSimulation } from "./engine";
import { emotionalScenario, fixtureScenario } from "./scenario";
import {
  replayCompact,
  expandCompact,
  CompactLog,
  openCompact,
} from "./compact-log";
import { validateSlice, validateCompact } from "./validate";
import { personalStories } from "./personal-report";
import type { Entity } from "./types";
it("compacto preserva cada evento, decisão, mês, causalidade e projeção do formato anterior", () => {
  for (const seed of ["pessoal-1c-000", "reservado-1d-096", "memoria-002"]) {
    const s = emotionalScenario(seed);
    s.months = 36;
    const expected = new SliceSimulation(s, undefined, {
      storage: "legacy",
    }).run();
    const packed = new SliceSimulation(s).runCompact();
    expect(expandCompact(packed)).toEqual(expected);
    expect(replayCompact(packed)).toEqual(expected.entities);
    expect(validateCompact(packed)).toEqual([]);
    expect(personalStories(openCompact(packed))).toEqual(
      personalStories(expected),
    );
    expect(validateSlice(expandCompact(packed))).toEqual([]);
    expect(personalStories(expandCompact(packed))).toEqual(
      personalStories(expected),
    );
    expect(JSON.stringify(packed).length).toBeLessThan(
      JSON.stringify(expected).length * 0.5,
    );
  }
}, 30000);
it("retomada compacta e importação de checkpoint antigo conservam o resultado", () => {
  const s = emotionalScenario("retomada-compacta");
  s.months = 36;
  const full = new SliceSimulation(s).runCompact();
  const partial = new SliceSimulation(s).runCompact(12);
  expect(
    new SliceSimulation(s, JSON.parse(JSON.stringify(partial))).runCompact(),
  ).toEqual(full);
  const old = new SliceSimulation(s, undefined, { storage: "legacy" }).run(12);
  expect(new SliceSimulation(s, old).runCompact()).toEqual(full);
});
it("snapshots e linhas são imutáveis, e continuar o motor não altera snapshot anterior", () => {
  const s = emotionalScenario("imutavel-compacto");
  s.months = 24;
  const sim = new SliceSimulation(s);
  const part = sim.runCompact(12),
    json = JSON.stringify(part);
  expect(Object.isFrozen(part.log.rows[0])).toBe(true);
  expect(typeof part.log.rows[0]).toBe("string");
  expect(() => {
    part.log.rows[0] = "mutated";
  }).toThrow();
  sim.advance();
  expect(JSON.stringify(part)).toBe(json);
  expect(JSON.stringify(sim.runCompact())).not.toBe(json);
});
it("deltas preservam remoções e campos inalterados; rejeitam causas futuras", () => {
  const s = fixtureScenario(),
    w = new SliceSimulation(s).runCompact();
  expect(replayCompact(w)).toEqual(expandCompact(w).entities);
  const broken = JSON.parse(JSON.stringify(w));
  const row = JSON.parse(broken.log.rows[1]);
  row[3] = [99999];
  broken.log.rows[1] = JSON.stringify(row);
  expect(() => replayCompact(broken)).toThrow("Invalid compact");
});
it("patches aninhados não alteram versões anteriores nem duplicam identidades", () => {
  const log = new CompactLog(),
    state: Record<string, Entity> = {};
  const p = emotionalScenario("patch").people[0];
  const event = (seq: number, entity: Entity, op: "create" | "replace") =>
    ({
      id: `event:${seq}`,
      seq,
      month: seq,
      ano: 0,
      dia: seq * 30,
      type: seq ? "test.changed" : "world.created",
      participants: [],
      location: "place:void",
      causes: seq ? ["event:0"] : [],
      effects: [{ op, entity }],
      data: {},
    }) as any;
  log.append(log.encodeEvent(event(0, p, "create"), state));
  state[p.id] = p;
  const next = { ...p, traits: { ...p.traits, rancor: 17 }, rival: undefined };
  log.append(log.encodeEvent(event(1, next, "replace"), state));
  const expanded = log.materialize();
  expect(expanded[0].effects[0].entity).toEqual(p);
  expect(log.replay()[p.id]).toEqual(JSON.parse(JSON.stringify(next)));
});

it("receber JSON e abrir o log protege a projeção e preserva acesso a eventos", () => {
  const s = emotionalScenario("recepcao");
  s.months = 2;
  const payload = JSON.parse(
    JSON.stringify(new SliceSimulation(s).runCompact()),
  );
  const logical = openCompact(payload);
  expect(Object.isFrozen(logical.entities)).toBe(true);
  expect(() => {
    payload.log.rows[0] = "alterado";
  }).toThrow();
  expect(logical.events[0].type).toBe("world.created");
  expect(logical.events[0].effects[0].op).toBe("create");
});
