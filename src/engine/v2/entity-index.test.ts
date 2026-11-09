import { it, expect } from "vitest";
import {
  enableEntityIndex,
  indexEffects,
  byKind,
  snapshotCopy,
} from "./entity-index";
import { settlementScenario } from "./politics";
import type { SliceWorld, Person, Effect } from "./types";
import { immutable, CompactLog } from "./compact-log";
it("índice mantém ordem de criação e lê a versão atual, inclusive após substituição", () => {
  const people = settlementScenario("index-unit", 12).people;
  const w = {
    entities: Object.fromEntries(people.map((p) => [p.id, p])),
  } as SliceWorld;
  enableEntityIndex(w);
  const first = people[0];
  w.entities[first.id] = { ...first, alive: false };
  expect(byKind(w, "person")[0].alive).toBe(false);
  const added = { ...first, id: "person:new" },
    effect = { op: "create", entity: added } as Effect;
  w.entities[added.id] = added;
  indexEffects(w, [effect]);
  expect(byKind(w, "person").map((p) => p.id)).toEqual([
    ...people.map((p) => p.id),
    "person:new",
  ]);
});
it("cópia preserva JSON e imutabilidade, compartilhando somente subárvore congelada", () => {
  const stable = immutable({ a: [1, 2] }),
    input = { stable, mutable: { b: 3 }, omitted: undefined, none: NaN };
  const copy = immutable(snapshotCopy(input));
  expect(JSON.stringify(copy)).toBe(JSON.stringify(input));
  expect(copy.stable).toBe(stable);
  expect(copy.mutable).not.toBe(input.mutable);
  input.mutable.b = 9;
  expect(copy.mutable.b).toBe(3);
  expect(() => {
    copy.mutable.b = 4;
  }).toThrow();
});
it("metadados em cache preservam conteúdo e não permitem alteração", () => {
  const log = new CompactLog();
  const e: any = {
    id: "event:0",
    seq: 0,
    month: 0,
    ano: 0,
    dia: 0,
    type: "world.created",
    location: "place:void",
    participants: [],
    causes: [],
    effects: [],
    data: { test: { value: 1 } },
  };
  log.append(log.encodeEvent(e, {}));
  const a = log.event(0),
    b = log.event(0);
  expect(a).toBe(b);
  expect(a.data).toBe(b.data);
  expect(() => {
    (a.data.test as any).value = 4;
  }).toThrow();
  expect(log.event(0).data).toEqual(e.data);
});
