/** ID-only index. Reads always resolve the latest immutable entity; no cached decisions. */
import type { Entity, Effect, SliceWorld } from "./types";
const indexes = new WeakMap<
  Record<string, Entity>,
  Map<Entity["kind"], string[]>
>();
export function enableEntityIndex(w: SliceWorld) {
  const map = new Map<Entity["kind"], string[]>();
  for (const e of Object.values(w.entities)) {
    const ids = map.get(e.kind) || [];
    ids.push(e.id);
    map.set(e.kind, ids);
  }
  indexes.set(w.entities, map);
}
export function indexEffects(w: SliceWorld, effects: readonly Effect[]) {
  const map = indexes.get(w.entities);
  if (!map) return;
  for (const f of effects)
    if (f.op === "create") {
      const ids = map.get(f.entity.kind) || [];
      ids.push(f.entity.id);
      map.set(f.entity.kind, ids);
    }
}
export function byKind<K extends Entity["kind"]>(
  w: SliceWorld,
  kind: K,
): Extract<Entity, { kind: K }>[] {
  const map = indexes.get(w.entities);
  return (
    map
      ? (map.get(kind) || []).map((id) => w.entities[id])
      : Object.values(w.entities).filter((e) => e.kind === kind)
  ) as Extract<Entity, { kind: K }>[];
}
/** JSON-equivalent copy for simulation records, sharing only already frozen subtrees. */
export function snapshotCopy<T>(v: T): T {
  if (v === null || typeof v !== "object")
    return (
      typeof v === "number" && !Number.isFinite(v)
        ? null
        : typeof v === "number" && Object.is(v, -0)
          ? 0
          : v
    ) as T;
  if (Object.isFrozen(v)) return v;
  if (Array.isArray(v))
    return v.map((x) => (x === undefined ? null : snapshotCopy(x))) as T;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v))
    if (x !== undefined) out[k] = snapshotCopy(x);
  return out as T;
}
