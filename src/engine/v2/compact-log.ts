import type { Effect, Entity, Scenario, SliceEvent, SliceWorld } from "./types";
export function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) immutable(item);
  }
  return value;
}
type Value = null | boolean | number | Value[];
type Delta = [number, Value];
type StoredEffect = [0, Value] | [1, Value, Delta[]];
type Row = [number, number, Value, number[], StoredEffect[], Value, Value?];
export interface PackedLog {
  format: "delta-routine-v1";
  strings: string[];
  shapes: number[][];
  rows: string[];
}
export interface CompactWorld {
  version: 3;
  engine: SliceWorld["engine"];
  scenario: Scenario;
  entities: Record<string, Entity>;
  log: PackedLog;
  nextMonth: number;
  complete: boolean;
}
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const plain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
/** Append-only representation dictionaries; they do not cache or bypass decisions. */
export class CompactLog {
  private strings: string[] = [];
  private shapes: number[][] = [];
  private rows: string[] = [];
  private stringIds = new Map<string, number>();
  private shapeIds = new Map<string, number>();
  private intern(text: string) {
    let id = this.stringIds.get(text);
    if (id === undefined) {
      id = this.strings.length;
      this.strings.push(text);
      this.stringIds.set(text, id);
    }
    return id;
  }
  private shape(keys: string[]) {
    const ids = keys.map((k) => this.intern(k)),
      key = ids.join(",");
    let id = this.shapeIds.get(key);
    if (id === undefined) {
      id = this.shapes.length;
      this.shapes.push(immutable(ids));
      this.shapeIds.set(key, id);
    }
    return id;
  }
  private encode(value: any): Value {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number"
    )
      return value;
    if (typeof value === "string") {
      if (/^event:\d+$/.test(value)) return [-4, Number(value.slice(6))];
      return [-1, this.intern(value)];
    }
    if (Array.isArray(value)) return [-2, ...value.map((v) => this.encode(v))];
    const keys = Object.keys(value).filter((k) => value[k] !== undefined);
    return [-3, this.shape(keys), ...keys.map((k) => this.encode(value[k]))];
  }
  private decode(value: Value): any {
    if (!Array.isArray(value)) return value;
    if (value[0] === -1) return this.strings[value[1] as number];
    if (value[0] === -4) return `event:${value[1]}`;
    if (value[0] === -2) return value.slice(1).map((v) => this.decode(v));
    if (value[0] === -3) {
      const keys = this.shapes[value[1] as number];
      if (!keys) throw Error("Unknown compact shape");
      return Object.fromEntries(
        keys.map((key, i) => [this.strings[key], this.decode(value[i + 2])]),
      );
    }
    throw Error("Unknown compact value");
  }
  private delta(
    before: any,
    after: any,
    path: string[] = [],
    result: Delta[] = [],
  ): Delta[] {
    if (before === after) return result;
    if (plain(before) && plain(after)) {
      for (const key of new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ]))
        this.delta(before[key], after[key], [...path, key], result);
    } else if (after === undefined) result.push([this.shape(path), [-5]]);
    else if (
      !Array.isArray(before) ||
      !Array.isArray(after) ||
      JSON.stringify(before) !== JSON.stringify(after)
    )
      result.push([this.shape(path), this.encode(after)]);
    return result;
  }
  encodeEvent(e: SliceEvent, before: Record<string, Entity>): string {
    const effects: StoredEffect[] = e.effects.map((f) =>
      f.op === "create"
        ? [0, this.encode(f.entity)]
        : [
            1,
            this.encode(f.entity.id),
            this.delta(before[f.entity.id], f.entity),
          ],
    );
    // Monthly schema derives calendar/id/location and period=1, retaining every month's payload and decision.
    const routine = e.type === "needs.period" || e.type === "activity.period";
    const data = routine
      ? Object.fromEntries(
          Object.entries(e.data).filter(([key]) => key !== "periodMonths"),
        )
      : e.data;
    if (e.location !== "place:void")
      throw Error("Compact v1 only supports the current abstract location");
    return JSON.stringify([
      e.month,
      e.type === "needs.period"
        ? -1
        : e.type === "activity.period"
          ? -2
          : this.intern(e.type),
      this.encode(e.participants),
      e.causes.map((id) => Number(id.slice(6))),
      effects,
      this.encode(data),
      ...(e.decision ? [this.encode(e.decision)] : []),
    ] as Row);
  }
  append(row: string) {
    this.rows.push(row);
  }
  private row(index: number): Row {
    const encoded = this.rows[index];
    if (encoded === undefined) throw Error("Unknown compact event");
    return JSON.parse(encoded);
  }
  get length() {
    return this.rows.length;
  }
  private effects(index: number, state: Record<string, Entity>): Effect[] {
    const row = this.row(index);
    if (!row) throw Error("Unknown compact event");
    const result: Effect[] = [];
    for (const f of row[4]) {
      if (f[0] === 0) {
        const entity = immutable(this.decode(f[1]) as Entity);
        if (state[entity.id]) throw Error("Duplicate compact entity");
        result.push({ op: "create", entity });
      } else {
        const id = this.decode(f[1]) as string;
        let entity = state[id];
        if (!entity) throw Error("Missing compact patch target");
        for (const [pathId, encoded] of f[2]) {
          const path = this.shapes[pathId]?.map((k) => this.strings[k]);
          if (
            !path?.length ||
            path.some((k) =>
              ["__proto__", "constructor", "prototype"].includes(k),
            )
          )
            throw Error("Invalid compact patch path");
          const root: any = { ...entity };
          let node = root,
            previous: any = entity;
          for (const key of path.slice(0, -1)) {
            if (!plain(previous?.[key]))
              throw Error("Invalid compact patch parent");
            node[key] = { ...previous[key] };
            node = node[key];
            previous = previous[key];
          }
          const key = path[path.length - 1];
          if (Array.isArray(encoded) && encoded[0] === -5) delete node[key];
          else node[key] = this.decode(encoded);
          entity = immutable(root);
        }
        if (entity.id !== id) throw Error("Patch cannot change identity");
        result.push({ op: "replace", entity });
      }
    }
    for (const f of result) state[f.entity.id] = f.entity;
    return result;
  }
  private lazy(value: Value): any {
    if (Array.isArray(value) && value[0] === -3) {
      const keys = this.shapes[value[1] as number];
      if (!keys) throw Error("Unknown compact shape");
      const object: Record<string, unknown> = {};
      keys.forEach((key, i) =>
        Object.defineProperty(object, this.strings[key], {
          enumerable: true,
          get: () => immutable(this.lazy(value[i + 2])),
        }),
      );
      return Object.freeze(object);
    }
    return immutable(this.decode(value));
  }
  private metadata(index: number): Omit<SliceEvent, "effects"> {
    const raw = this.rows[index];
    if (raw === undefined) throw Error("Unknown compact event");
    const header = /^\[(\d+),(-?\d+),/.exec(raw);
    if (!header) throw Error("Invalid compact header");
    const month = Number(header[1]),
      typeId = Number(header[2]);
    let parsed: Row | undefined;
    const row = () => (parsed ||= JSON.parse(raw) as Row);
    const e: any = {
      id: `event:${index}`,
      seq: index,
      month,
      ano: Math.floor(month / 12),
      dia: (month % 12) * 30,
      type:
        typeId === -1
          ? "needs.period"
          : typeId === -2
            ? "activity.period"
            : this.strings[typeId],
      location: "place:void",
    };
    Object.defineProperties(e, {
      participants: {
        enumerable: true,
        get: () => immutable(this.decode(row()[2])),
      },
      causes: {
        enumerable: true,
        get: () => immutable(row()[3].map((i) => `event:${i}`)),
      },
      data: {
        enumerable: true,
        get: () => {
          const data = this.lazy(row()[5]);
          return typeId < 0
            ? Object.freeze({ ...data, periodMonths: 1 })
            : data;
        },
      },
      decision: {
        enumerable: true,
        get: () => (row().length > 6 ? this.lazy(row()[6]!) : undefined),
      },
    });
    return e;
  }
  event(index: number): SliceEvent {
    const e = this.metadata(index);
    // Internal history reads use metadata. Explicit legacy effect lookup is intentionally lazy, never retained.
    Object.defineProperty(e, "effects", {
      enumerable: true,
      get: () => {
        const state: Record<string, Entity> = {};
        for (let i = 0; i < index; i++) this.effects(i, state);
        return immutable(this.effects(index, state));
      },
    });
    return Object.freeze(e) as SliceEvent;
  }
  view(sequentialEffects = false): SliceEvent[] {
    let cursor = -1;
    const state: Record<string, Entity> = {};
    let current: SliceEvent | undefined;
    return new Proxy([] as SliceEvent[], {
      get: (_target, key) => {
        if (key === "length") return this.length;
        if (typeof key === "string" && /^\d+$/.test(key)) {
          const i = Number(key);
          if (i >= this.length) return undefined;
          if (sequentialEffects && i === cursor + 1) {
            current = { ...this.metadata(i), effects: this.effects(i, state) };
            cursor = i;
            return current;
          }
          if (sequentialEffects && i === cursor) return current;
          return this.event(i);
        }
        if (key === Symbol.iterator)
          return function* (this: CompactLog) {
            const state: Record<string, Entity> = {};
            for (let i = 0; i < this.length; i++)
              yield sequentialEffects
                ? { ...this.metadata(i), effects: this.effects(i, state) }
                : this.event(i);
          }.bind(this);
        return Reflect.get(Array.prototype, key);
      },
      has: (_target, key) =>
        typeof key === "string" && /^\d+$/.test(key)
          ? Number(key) < this.length
          : Reflect.has(Array.prototype, key),
      set: () => {
        throw Error("Compact event history is append-only");
      },
    });
  }
  /** Sequential metadata selection; no retained index and no effect materialization. */
  *select(types: ReadonlySet<string>): IterableIterator<SliceEvent> {
    for (let i = 0; i < this.rows.length; i++) {
      const header = /^\[(\d+),(-?\d+),/.exec(this.rows[i]);
      if (!header) throw Error("Invalid compact header");
      const id = Number(header[2]);
      const type = id === -1 ? "needs.period" : id === -2 ? "activity.period" : this.strings[id];
      if (types.has(type)) yield this.event(i);
    }
  }
  materialize(): SliceEvent[] {
    const state: Record<string, Entity> = {};
    return this.rows.map((_, i) => ({
      ...this.metadata(i),
      effects: this.effects(i, state),
    }));
  }
  replay(): Record<string, Entity> {
    const state: Record<string, Entity> = {};
    for (let i = 0; i < this.length; i++) {
      const row = this.row(i);
      if (
        !Number.isInteger(row[0]) ||
        row[0] < 0 ||
        (i && row[0] < this.row(i - 1)[0]) ||
        row[3].some((c) => !Number.isInteger(c) || c < 0 || c >= i)
      )
        throw Error("Invalid compact calendar or cause");
      this.effects(i, state);
    }
    return immutable(state);
  }
  snapshot(): PackedLog {
    return immutable({
      format: "delta-routine-v1",
      strings: [...this.strings],
      shapes: [...this.shapes],
      rows: [...this.rows],
    });
  }
  static from(log: PackedLog): CompactLog {
    if (log.format !== "delta-routine-v1")
      throw Error("Unknown compact format");
    const result = new CompactLog(),
      data = {
        strings: [...log.strings],
        shapes: log.shapes.map((s) => [...s]),
        rows: [...log.rows],
      };
    result.strings = data.strings;
    result.shapes = data.shapes.map((shape) => immutable(shape));
    result.rows = immutable(data.rows).slice();
    result.stringIds = new Map(result.strings.map((s, i) => [s, i]));
    result.shapeIds = new Map(result.shapes.map((s, i) => [s.join(","), i]));
    return result;
  }
}
export function replayCompact(world: CompactWorld) {
  return CompactLog.from(world.log).replay();
}
export function expandCompact(world: CompactWorld): SliceWorld {
  return copy({
    version: 2,
    engine: world.engine,
    scenario: world.scenario,
    entities: world.entities,
    events: CompactLog.from(world.log).materialize(),
    nextMonth: world.nextMonth,
    complete: world.complete,
  });
}

/** Read-only logical view. For effects over the whole log use validateCompact/replayCompact, not random prefix expansion. */
export function openCompact(world: CompactWorld): SliceWorld {
  immutable(world);
  return {
    version: 2,
    engine: world.engine,
    scenario: world.scenario,
    entities: world.entities,
    nextMonth: world.nextMonth,
    complete: world.complete,
    events: CompactLog.from(world.log).view(),
  };
}
