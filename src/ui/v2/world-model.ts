import { Archive, date, eventLabel } from "./model";
import type { SliceEvent, Work } from "../../engine/v2/types";
import type { Settlement, Dispute } from "../../engine/v2/politics";
import type { Life } from "../../engine/v2/life";
export type MapCategory = "war" | "duel" | "hunger" | "work";
export const categories: Record<MapCategory, string> = {
  war: "Guerra",
  duel: "Duelo",
  hunger: "Fome / escassez",
  work: "Obra",
};
export interface WorldFilter {
  settlement?: string;
  person?: string;
  type?: string;
  category?: MapCategory;
  all?: boolean;
}
export interface LeaderTerm {
  person: string;
  source: string;
  start: number;
  end?: number;
  endSource?: string;
  plannedEnd: number;
  reason: string;
}
export interface CustodyEntry {
  source: string;
  month: number;
  owner: string;
  previous?: string;
  kind: "creation" | "transfer" | "theft" | "estate";
}
const markerType = (e: SliceEvent): MapCategory | undefined =>
  e.type === "war.declared"
    ? "war"
    : e.type === "duel.ended"
      ? "duel"
      : e.type === "scarcity.observed" ||
          (e.type === "hunger.changed" && Number(e.data.after) >= 40)
        ? "hunger"
        : e.type === "work.created"
          ? "work"
          : undefined;
const pack = (m: Map<string, number[]>) =>
  new Map([...m].map(([k, v]) => [k, new Uint32Array(v)]));
/** Read-only projections. Historical residence comes from recorded family transitions. */
export class WorldArchive {
  readonly settlements: Settlement[];
  readonly works: Work[];
  readonly terms = new Map<string, LeaderTerm[]>();
  readonly custody = new Map<string, CustodyEntry[]>();
  readonly byType: Map<string, Uint32Array>;
  readonly byPerson: Map<string, Uint32Array>;
  readonly bySettlement: Map<string, Uint32Array>;
  readonly markers: {
    seq: number;
    category: MapCategory;
    settlements: string[];
  }[] = [];
  private homeSettlement = new Map<string, string>();
  private residence = new Map<string, { seq: number; home: string }[]>();
  private highlights: Set<number>;
  constructor(readonly archive: Archive) {
    const w = archive.world;
    this.settlements = Object.values(w.entities)
      .filter((e): e is Settlement => e.kind === "settlement")
      .sort((a, b) => a.id.localeCompare(b.id));
    this.works = Object.values(w.entities)
      .filter((e): e is Work => e.kind === "work")
      .sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
    for (const s of this.settlements)
      for (const h of s.homes) this.homeSettlement.set(h, s.id);
    const types = new Map<string, number[]>(),
      persons = new Map<string, number[]>(),
      places = new Map<string, number[]>();
    const add = (m: Map<string, number[]>, key: string, seq: number) => {
      const list = m.get(key) || [];
      list.push(seq);
      m.set(key, list);
    };
    const move = (id: string, home: string | undefined, seq: number) => {
      if (!home) return;
      const history = this.residence.get(id) || [];
      if (history.at(-1)?.home !== home) {
        history.push({ seq, home });
        this.residence.set(id, history);
      }
    };
    const current = (id: string) => this.residence.get(id)?.at(-1)?.home;
    this.highlights = new Set(archive.highlights);
    for (let i = 0; i < w.log.rows.length; i++) {
      const e = archive.event(i)!,
        d = e.data;
      const before = this.associations(e);
      if (e.type === "family.founder.registered")
        move(e.participants[0]?.id, `home:${e.participants[0]?.id}`, i);
      if (e.type === "partnership.formed" && typeof d.household === "string")
        for (const p of e.participants) move(p.id, d.household, i);
      if (e.type === "person.born")
        move(e.participants[0]?.id, current((d.parents as string[])[0]), i);
      if (
        e.type === "guardianship.decided" &&
        typeof d.child === "string" &&
        typeof d.chosen === "string"
      )
        move(d.child, current(d.chosen), i);
      add(types, e.type, i);
      for (const id of new Set(e.participants.map((p) => p.id)))
        if (w.entities[id]?.kind === "person") add(persons, id, i);
      const involved = [...new Set([...before, ...this.associations(e)])];
      for (const id of involved) add(places, id, i);
      const category = markerType(e);
      if (category)
        this.markers.push({ seq: i, category, settlements: involved });
      if (e.type === "office.appointed") {
        const id = String(d.settlement),
          list = this.terms.get(id) || [];
        list.push({
          person: String(d.leader),
          source: e.id,
          start: e.month,
          plannedEnd: Number(d.termEnd),
          reason: String(d.reason),
        });
        this.terms.set(id, list);
      }
      if (e.type === "office.vacated") {
        const list = this.terms.get(String(d.settlement));
        const term = list?.at(-1);
        if (term && term.end === undefined) {
          term.end = e.month;
          term.endSource = e.id;
        }
      }
      const work = typeof d.work === "string" ? d.work : undefined;
      if (work) {
        const list = this.custody.get(work) || [];
        let entry: CustodyEntry | undefined;
        if (e.type === "work.created")
          entry = {
            source: e.id,
            month: e.month,
            owner: e.participants.find((p) => p.role === "actor")!.id,
            kind: "creation",
          };
        if (e.type === "work.transferred" || e.type === "property.stolen")
          entry = {
            source: e.id,
            month: e.month,
            owner: String(d.to),
            previous: String(d.from),
            kind: e.type === "property.stolen" ? "theft" : "transfer",
          };
        if (e.type === "work.estate.recorded")
          entry = {
            source: e.id,
            month: e.month,
            owner: String(d.owner),
            kind: "estate",
          };
        if (entry) {
          list.push(entry);
          this.custody.set(work, list);
        }
      }
    }
    this.byType = pack(types);
    this.byPerson = pack(persons);
    this.bySettlement = pack(places);
  }
  residenceAt(person: string, seq: number) {
    const history = this.residence.get(person) || [];
    let low = 0,
      high = history.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (history[mid].seq <= seq) low = mid + 1;
      else high = mid;
    }
    return low ? history[low - 1].home : undefined;
  }
  associations(e: SliceEvent) {
    const ids = new Set<string>();
    for (const key of ["settlement", "from", "to"]) {
      const id = e.data[key];
      if (typeof id === "string" && this.settlements.some((s) => s.id === id))
        ids.add(id);
    }
    for (const key of ["household", "fromHousehold", "toHousehold"]) {
      const h = e.data[key];
      if (typeof h === "string" && this.homeSettlement.has(h))
        ids.add(this.homeSettlement.get(h)!);
    }
    for (const p of e.participants) {
      const h = this.residenceAt(p.id, e.seq);
      if (h && this.homeSettlement.has(h)) ids.add(this.homeSettlement.get(h)!);
    }
    return [...ids];
  }
  filter(f: WorldFilter) {
    const lists: Uint32Array[] = [];
    for (const [id, map] of [
      [f.type, this.byType],
      [f.person, this.byPerson],
      [f.settlement, this.bySettlement],
    ] as const)
      if (id) lists.push(map.get(id) || new Uint32Array());
    if (f.category)
      lists.push(
        new Uint32Array(
          this.markers
            .filter((m) => m.category === f.category)
            .map((m) => m.seq),
        ),
      );
    lists.sort((a, b) => a.length - b.length);
    const allowed = lists.slice(1).map((a) => new Set(a));
    const base =
      lists[0] ||
      (!f.all && !f.type
        ? this.archive.highlights
        : Array.from(
            { length: this.archive.world.log.rows.length },
            (_, i) => i,
          ));
    return Array.from(base).filter(
      (i) =>
        (f.all || !!f.type || this.highlights.has(i) || !!f.category) &&
        allowed.every((s) => s.has(i)),
    );
  }
  population(id: string) {
    return this.archive.people.filter(
      (p) =>
        this.archive.isAlive(p.id) &&
        this.homeSettlement.get(
          (this.archive.world.entities[`life:${p.id}`] as Life | undefined)
            ?.household || "",
        ) === id,
    );
  }
  currentLeader(s: Settlement) {
    const p = s.leader ? this.archive.world.entities[s.leader] : undefined;
    return p?.kind === "person" &&
      p.alive &&
      !!s.mandate &&
      s.termEnd > Math.max(0, this.archive.world.nextMonth - 1)
      ? p
      : undefined;
  }
  relations() {
    const result: {
      from: Settlement;
      to: Settlement;
      state: "paz" | "disputa" | "guerra" | "acordo";
      reason: string;
      source?: string;
      disputes: number;
    }[] = [];
    for (let i = 0; i < this.settlements.length; i++)
      for (let j = i + 1; j < this.settlements.length; j++) {
        const from = this.settlements[i],
          to = this.settlements[j];
        const ds = Object.values(this.archive.world.entities)
          .filter(
            (e): e is Dispute =>
              e.kind === "dispute" &&
              [e.from, e.to].includes(from.id) &&
              [e.from, e.to].includes(to.id),
          )
          .sort(
            (a, b) =>
              Number(b.lastEvent.slice(6)) - Number(a.lastEvent.slice(6)),
          );
        const active =
            ds.find((d) => d.status === "declared") ||
            ds.find((d) => d.status !== "closed"),
          last = active || ds[0];
        const lastEvent = last ? this.archive.event(last.lastEvent) : undefined;
        const state =
          active?.status === "declared"
            ? "guerra"
            : active
              ? "disputa"
              : last?.outcome === "agreement" ||
                  lastEvent?.type === "dispute.agreed"
                ? "acordo"
                : "paz";
        result.push({
          from,
          to,
          state,
          reason: active
            ? "processo ativo no último mês registrado"
            : lastEvent
              ? String(lastEvent.data.reason || eventLabel(lastEvent))
              : "nenhuma disputa registrada",
          source: last?.lastEvent,
          disputes: ds.length,
        });
      }
    return result;
  }
  routes() {
    return this.settlements.flatMap((from, i) =>
      this.settlements.slice(i + 1).map((to, j) => {
        const km = 30 + 30 * (j + 1);
        return {
          from,
          to,
          km,
          noticeMonths: Math.ceil(km / 60),
          campaignMonths: Math.ceil(km / 30),
        };
      }),
    );
  }
  workTheme(w: Work) {
    const e = w.theme ? this.archive.event(w.theme) : undefined;
    return e
      ? this.archive.factDescription(e, w.creator)
      : "Tema não registrado";
  }
}
export const markdownText = (s: unknown) =>
  String(s ?? "").replace(/[\\`*_{}\[\]()#+!|<>]/g, "\\$&");
function sources(a: Archive, ids: readonly string[]) {
  return ids
    .map((id) => {
      const e = a.event(id);
      return e ? `${id} — ${markdownText(eventLabel(e))}` : id;
    })
    .join("; ");
}
export function* worldMarkdown(v: WorldArchive): Generator<string> {
  const a = v.archive,
    w = a.world;
  yield `# Crônica do mundo\n\nSeed: ${markdownText(w.scenario.seed)}. Horizonte: ${Math.floor(w.nextMonth / 12)} anos.\n\nMundo inteiro: acontecimentos em destaque de todas as pessoas e assentamentos; rotina mensal omitida. IDs preservam referências causais do arquivo.\n\n## Assentamentos\n\n`;
  for (const s of v.settlements)
    yield `- **${markdownText(s.name)}**: ${v.population(s.id).length} pessoas vivas; liderança: ${markdownText(v.currentLeader(s) ? a.name(s.leader) : "cargo vago")}.\n`;
  yield "\n## Cronologia\n";
  let year = -1;
  for (const i of a.highlights) {
    const e = a.event(i)!;
    if (e.ano !== year) {
      year = e.ano;
      yield `\n### Ano ${year}\n\n`;
    }
    yield `- ${markdownText(a.narrate(e))} [${e.id}]\n  Causas: ${sources(a, e.causes) || "origem registrada do mundo"}.\n`;
  }
  yield "\n## Obras\n\n";
  for (const work of v.works) {
    yield `### ${markdownText(a.workTitle(work.id))}\n\nCriador: ${markdownText(a.name(work.creator))}. Tema: ${markdownText(v.workTheme(work))}. Qualidade: ${work.quality}/100.\n\n`;
    for (const c of v.custody.get(work.id) || [])
      yield `- ${date(c.month)}: ${c.kind === "theft" ? "roubo" : c.kind === "estate" ? "espólio" : c.kind === "creation" ? "criação" : "transferência"} — ${markdownText(a.name(c.owner))} [${c.source}].\n`;
  }
}
export function* personMarkdown(a: Archive, id: string): Generator<string> {
  yield `# Crônica de ${markdownText(a.name(id))}\n\nSeed: ${markdownText(a.world.scenario.seed)}. Pessoa: ${markdownText(id)}.\n\n`;
  for (const p of a.paragraphs(id))
    yield `${p.phase ? `## ${markdownText(p.phase)}\n\n` : ""}${markdownText(p.text)}\n\nFontes: ${sources(a, p.sources)}.\n\n`;
}
