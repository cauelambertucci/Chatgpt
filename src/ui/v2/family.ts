import type { SliceEvent } from "../../engine/v2/types";
export const familyTypes = new Set([
  "family.founder.registered",
  "person.born",
  "person.died",
  "guardianship.decided",
  "partnership.formed",
  "partnership.ended",
]);
export const stringIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === "string"))]
    : [];
export interface Birth {
  id: string;
  month?: number;
  parents: string[];
  founder: boolean;
  source: string;
}
export interface Partnership {
  people: string[];
  start?: number;
  end?: number;
  reason?: string;
  source: string;
  endSource?: string;
}
export interface Custody {
  month: number;
  guardians: string[];
  source: string;
}
/** All relationships and vital dates come from event metadata, not final Life state. */
export class FamilyHistory {
  readonly births = new Map<string, Birth>();
  readonly deaths = new Map<string, SliceEvent>();
  readonly children = new Map<string, string[]>();
  readonly partnerships: Partnership[] = [];
  readonly custody = new Map<string, Custody[]>();
  readonly generations = new Map<string, number | null>();
  constructor(events: Iterable<SliceEvent>) {
    for (const e of events) {
      const d = e.data;
      if (e.type === "family.founder.registered" || e.type === "person.born") {
        const id = e.participants[0]?.id;
        if (!id) continue;
        const founder = e.type === "family.founder.registered";
        this.births.set(id, {
          id,
          month:
            typeof d.birthMonth === "number"
              ? d.birthMonth
              : founder
                ? undefined
                : e.month,
          parents: founder ? [] : stringIds(d.parents),
          founder,
          source: e.id,
        });
        if (Array.isArray(d.guardians))
          this.addCustody(id, e.month, stringIds(d.guardians), e.id);
      }
      if (e.type === "person.died") {
        const id =
          typeof d.victim === "string"
            ? d.victim
            : e.participants.find((p) => p.role === "victim")?.id;
        if (id) this.deaths.set(id, e);
      }
      if (
        e.type === "guardianship.decided" &&
        typeof d.child === "string" &&
        Array.isArray(d.guardians)
      )
        this.addCustody(d.child, e.month, stringIds(d.guardians), e.id);
      if (e.type === "partnership.formed") {
        const people = [...new Set(e.participants.map((p) => p.id))];
        if (people.length === 2)
          this.partnerships.push({ people, start: e.month, source: e.id });
      }
      if (e.type === "partnership.ended") {
        const people = [...new Set(e.participants.map((p) => p.id))];
        if (people.length !== 2) continue;
        let entry = [...this.partnerships]
          .reverse()
          .find(
            (p) =>
              p.end === undefined &&
              people.every((id) => p.people.includes(id)),
          );
        if (!entry) {
          entry = { people, source: e.id };
          this.partnerships.push(entry);
        }
        entry.end = e.month;
        entry.endSource = e.id;
        entry.reason =
          typeof d.cause === "string"
            ? d.cause
            : typeof d.reason === "string"
              ? d.reason
              : undefined;
      }
    }
    for (const b of this.births.values())
      for (const parent of b.parents) {
        let ids = this.children.get(parent);
        if (!ids) {
          ids = [];
          this.children.set(parent, ids);
        }
        if (!ids.includes(b.id)) ids.push(b.id);
      }
    for (const ids of this.children.values())
      ids.sort(
        (a, b) =>
          (this.births.get(a)?.month ?? 0) - (this.births.get(b)?.month ?? 0) ||
          a.localeCompare(b),
      );
  }
  private addCustody(
    id: string,
    month: number,
    guardians: string[],
    source: string,
  ) {
    const rows = this.custody.get(id) || [];
    rows.push({ month, guardians, source });
    this.custody.set(id, rows);
  }
  parents(id: string) {
    return this.births.get(id)?.parents || [];
  }
  partners(id: string) {
    return this.partnerships.filter((p) => p.people.includes(id));
  }
  siblings(id: string) {
    return [
      ...new Set(this.parents(id).flatMap((p) => this.children.get(p) || [])),
    ].filter((p) => p !== id);
  }
  age(id: string, month: number) {
    const birth = this.births.get(id)?.month;
    return birth === undefined || month < birth
      ? undefined
      : Math.floor((month - birth) / 12);
  }
  isAlive(id: string) {
    return this.births.has(id) && !this.deaths.has(id);
  }
  generation(id: string, path = new Set<string>()): number | null {
    if (this.generations.has(id)) return this.generations.get(id)!;
    if (path.has(id)) return null;
    const b = this.births.get(id);
    if (!b) return null;
    if (b.founder) {
      this.generations.set(id, 0);
      return 0;
    }
    if (!b.parents.length) return null;
    const next = new Set(path).add(id),
      gs = b.parents.map((p) => this.generation(p, next));
    const g = gs.some((v) => v === null)
      ? null
      : 1 + Math.max(...(gs as number[]));
    this.generations.set(id, g);
    return g;
  }
}
