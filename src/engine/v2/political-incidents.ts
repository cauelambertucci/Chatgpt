import { byKind } from "./entity-index";
/** Fictional annual visits: knowledge requires arrival; weights are design assumptions. */
import type { Effect, Person, SliceEvent, SliceWorld, Work } from "./types";
import type { Life, Household } from "./life";
import type { Settlement } from "./politics";
import { sample } from "./rules";
import { foodNeed } from "./economy";
export interface PoliticalVisit {
  id: string;
  kind: "politicalVisit";
  actor: string;
  from: string;
  to: string;
  due: number;
  status: "travelling" | "finished";
  source: string;
  lastEvent: string;
}
export function theftUtility(p: Person, book: boolean) {
  return {
    take:
      (p.traits.ambicao || 0) +
      (p.traits.agressividade || 0) +
      (p.values.poder || 0) +
      (book ? Math.max(0, p.values.arte || 0) : p.hunger || 0) -
      (p.values.lei || 0) -
      (p.traits.autocontrole || 0),
    leave: 100 + p.traits.cautela,
  };
}
export function shortage(food: number, demand: number, hunger: number) {
  return demand > 0 && (food / demand < 2 || hunger >= 40);
}
interface Context {
  world: () => SliceWorld;
  month: () => number;
  emit: (
    type: string,
    participants: SliceEvent["participants"],
    causes: string[],
    effects?: Effect[],
    data?: Record<string, unknown>,
  ) => SliceEvent;
  settlements: () => Settlement[];
  home: (id: string) => Settlement | undefined;
  petition: (
    e: SliceEvent,
    witness: string,
    from: Settlement,
    to: Settlement,
  ) => void;
}
export class PoliticalIncidents {
  constructor(private c: Context) {}
  private get w() {
    return this.c.world();
  }
  private get month() {
    return this.c.month();
  }
  private next() {
    return `event:${this.w.events.length}`;
  }
  private person(id: string) {
    return this.w.entities[id] as Person;
  }
  private resident(s: Settlement) {
    return byKind(this.w, "person").filter(
      (p): p is Person =>
        p.kind === "person" && p.alive && this.c.home(p.id)?.id === s.id,
    );
  }
  private usable(p: Person) {
    return (
      p.present &&
      p.alive &&
      ["adult", "elder"].includes(p.lifeStage || "") &&
      !this.w.scenario.blockedInformation.includes(p.id)
    );
  }
  private busy(p: Person): Effect {
    return {
      op: "replace",
      entity: {
        ...p,
        workedMonth: this.month,
        lastBy: { ...p.lastBy, workedMonth: this.next() },
      },
    };
  }
  occupied(id: string) {
    return byKind(this.w, "politicalVisit").some(
      (e) =>
        e.kind === "politicalVisit" &&
        e.actor === id &&
        e.status === "travelling",
    );
  }
  monthly() {
    // One annual public visit per inhabited settlement, not a quota of thefts or disputes.
    if (this.month % 12 === 0)
      for (const from of this.c.settlements()) {
        const candidates = this.resident(from)
          .filter((p) => this.usable(p) && !this.occupied(p.id))
          .map((p) => ({
            id: p.id,
            utility:
              (p.traits.curiosidade || 0) +
              (p.traits.sociabilidade || 0) +
              (p.traits.ambicao || 0) -
              (p.psychology?.stress || 0) / 10,
          }))
          .sort((a, b) => b.utility - a.utility || a.id.localeCompare(b.id));
        if (!candidates.length || candidates[0].utility <= 80) continue;
        const neighbors = this.c
          .settlements()
          .filter((s) => s.id !== from.id && this.resident(s).length);
        if (!neighbors.length) continue;
        const to =
            neighbors[
              sample(
                `${this.w.scenario.seed}|politics:visits`,
                `${from.id}:${this.month}`,
                0,
                neighbors.length - 1,
              )
            ],
          p = this.person(candidates[0].id),
          id = `visit:${from.id}:${this.month}`,
          source = this.next();
        const distance =
          30 +
          30 *
            Math.abs(
              Number(from.id.split(":")[1]) - Number(to.id.split(":")[1]),
            );
        this.c.emit(
          "political.visit.started",
          [{ id: p.id, role: "actor" }],
          [from.source, to.source, p.lastBy.traits, p.lastBy.psychology],
          [
            {
              op: "create",
              entity: {
                id,
                kind: "politicalVisit",
                actor: p.id,
                from: from.id,
                to: to.id,
                due: this.month + Math.ceil(distance / 60),
                status: "travelling",
                source,
                lastEvent: source,
              },
            },
            this.busy(p),
          ],
          {
            visit: id,
            from: from.id,
            to: to.id,
            name: to.name,
            distanceKm: distance,
            reason: "utilidade de visitar supera permanecer",
            candidates,
            stay: 80,
          },
        );
      }
    for (const v of byKind(this.w, "politicalVisit").filter(
      (e): e is PoliticalVisit =>
        e.kind === "politicalVisit" &&
        e.status === "travelling" &&
        e.due <= this.month,
    ))
      this.arrive(v);
  }
  private arrive(v: PoliticalVisit) {
    let p = this.person(v.actor);
    const from = this.w.entities[v.from] as Settlement,
      to = this.w.entities[v.to] as Settlement;
    if (!this.usable(p) || this.c.home(p.id)?.id !== from.id) {
      this.c.emit(
        "political.visit.ended",
        [{ id: p.id, role: "reference" }],
        [v.source, p.lastBy.alive, p.lastBy.present],
        [
          {
            op: "replace",
            entity: { ...v, status: "finished", lastEvent: this.next() },
          },
        ],
        {
          visit: v.id,
          reason: "viajante morreu, ficou indisponível ou mudou de residência",
        },
      );
      return;
    }
    const residents = this.resident(to),
      homes = [
        ...new Set(
          residents.map(
            (q) => (this.w.entities[`life:${q.id}`] as Life).household,
          ),
        ),
      ].map((id) => this.w.entities[id] as Household);
    const food = homes.reduce((n, h) => n + (h.inventory?.food || 0), 0),
      demand = residents.reduce((n, q) => n + foodNeed(q.lifeStage), 0),
      hunger = Math.max(0, ...residents.map((q) => q.hunger || 0));
    const arrived = this.c.emit(
      "political.visit.arrived",
      [{ id: p.id, role: "actor" }],
      [v.source, ...homes.map((h) => h.inventorySource || h.source)],
      [
        {
          op: "replace",
          entity: { ...v, status: "finished", lastEvent: this.next() },
        },
        this.busy(p),
      ],
      {
        visit: v.id,
        from: from.id,
        to: to.id,
        name: to.name,
        food,
        demand,
        hunger,
        households: homes.map((h) => h.id),
        assumption:
          "Visita pública com observação de reservas e moradores; consumo de viagem contabilizado no domicílio de origem.",
      },
    );
    if (shortage(food, demand, hunger)) {
      const e = this.c.emit(
        "scarcity.observed",
        [{ id: p.id, role: "actor" }],
        [arrived.id, ...residents.map((q) => q.lastBy.hunger).filter(Boolean)],
        [],
        {
          settlement: to.id,
          name: to.name,
          food,
          demand,
          hunger,
          criticalMonths: 2,
          observer: p.id,
          reason:
            hunger >= 40 ? "fome observada" : "reserva inferior a dois meses",
        },
      );
      this.c.petition(e, p.id, from, to);
    }
    p = this.person(p.id);
    const victims = residents.filter(
      (q) =>
        q.alive && q.present && ["adult", "elder"].includes(q.lifeStage || ""),
    );
    if (!victims.length) return;
    const works = byKind(this.w, "work").filter(
      (e): e is Work =>
        e.kind === "work" &&
        !e.ownerEstate &&
        victims.some((q) => q.id === e.owner),
    );
    const book = works[0];
    const victim = book
      ? this.person(book.owner!)
      : victims.find((q) => {
          const h = this.w.entities[
            (this.w.entities[`life:${q.id}`] as Life).household
          ] as Household;
          return (h.writingStock?.paper || 0) > 0;
        });
    if (!victim) return;
    const scores = theftUtility(p, !!book);
    if (scores.take <= scores.leave) return;
    const donor = this.w.entities[
        (this.w.entities[`life:${victim.id}`] as Life).household
      ] as Household,
      receiver = this.w.entities[
        (this.w.entities[`life:${p.id}`] as Life).household
      ] as Household;
    if (donor.id === receiver.id) return;
    const amount = book ? 0 : Math.min(3, donor.writingStock!.paper),
      source = this.next();
    const effects: Effect[] = book
      ? [
          {
            op: "replace",
            entity: { ...book, owner: p.id, ownerSource: source },
          },
        ]
      : [
          {
            op: "replace",
            entity: {
              ...donor,
              writingStock: {
                ...donor.writingStock!,
                paper: donor.writingStock!.paper - amount,
              },
              stockSource: source,
            },
          },
          {
            op: "replace",
            entity: {
              ...receiver,
              writingStock: {
                ...receiver.writingStock!,
                paper: receiver.writingStock!.paper + amount,
              },
              stockSource: source,
            },
          },
        ];
    const stolen = this.c.emit(
      "property.stolen",
      [
        { id: p.id, role: "actor" },
        { id: victim.id, role: "victim" },
      ],
      [
        arrived.id,
        p.lastBy.traits,
        p.lastBy.values,
        book?.ownerSource || donor.stockSource!,
        receiver.stockSource!,
      ],
      effects,
      {
        work: book?.id || null,
        material: book ? null : "papel",
        amount,
        from: victim.id,
        to: p.id,
        fromHousehold: donor.id,
        toHousehold: receiver.id,
        utilities: scores,
        visit: v.id,
        reason:
          "apropriação escolhida após observar o bem; transferência conservativa",
      },
    );
    const draw = sample(
        `${this.w.scenario.seed}|politics:detection`,
        v.id,
        0,
        99,
      ),
      threshold = Math.max(15, 80 - Math.floor(p.traits.cautela / 2));
    if (
      draw < threshold &&
      !this.w.scenario.blockedInformation.includes(victim.id)
    ) {
      const perceived = this.c.emit(
        "theft.perceived",
        [
          { id: victim.id, role: "actor" },
          { id: p.id, role: "reference" },
        ],
        [stolen.id],
        [],
        {
          incident: stolen.id,
          offender: p.id,
          work: book?.id || null,
          material: book ? null : "papel",
          amount,
          draw,
          threshold,
        },
      );
      this.c.petition(perceived, victim.id, to, from);
    }
  }
}
