import { byKind } from "./entity-index";
import { PoliticalIncidents } from "./political-incidents";
/** Marco 3 mínimo. All weights, travel and casualty rules are unverified design assumptions. */
import type { Effect, Person, SliceEvent, SliceWorld } from "./types";
import type { Life } from "./life";
import { sample } from "./rules";
import { livelihoodScenario } from "./daily-scenario";
export interface Settlement {
  id: string;
  kind: "settlement";
  name: string;
  homes: string[];
  office: string;
  leader?: string;
  termEnd: number;
  mandate?: string;
  source: string;
  lastEvent: string;
  previous?: string;
}
export interface Dispute {
  id: string;
  kind: "dispute";
  from: string;
  to: string;
  incident: string;
  witness: string;
  sent: string;
  due: number;
  status: "travelling" | "declared" | "negotiating" | "closed";
  outcome?: string;
  leader?: string;
  mandate?: string;
  notice?: string;
  declaration?: string;
  lastEvent: string;
}
export interface PoliticsOptions {
  count: 2 | 3;
  termMonths: number;
}
export const politicalTypes = [
  "settlement.founded",
  "office.appointed",
  "office.vacated",
  "political.notice.sent",
  "political.notice.received",
  "war.rejected",
  "war.declared",
  "campaign.resolved",
  "campaign.ended",
  "scarcity.observed",
  "property.stolen",
  "theft.perceived",
  "dispute.proposed",
  "dispute.agreed",
  "dispute.unresolved",
] as const;
export function settlementScenario(seed: string, count = 40) {
  const s = livelihoodScenario(seed, count);
  s.politics = { count: 3, termMonths: 60 };
  return s;
}
export function warUtilities(p: Person) {
  return {
    guerra:
      (p.traits.agressividade || 0) * 2 +
      p.traits.rancor +
      (p.values.poder || 0) +
      Math.max(0, p.values.vinganca) +
      p.traits.coragem -
      (p.psychology?.stress || 0) / 10,
    acordo:
      100 +
      Math.max(0, p.values.paz) * 2 +
      (p.traits.compaixao || 0) +
      p.traits.cautela +
      (p.traits.autocontrole || 0),
  };
}
export function politicalGate(
  w: SliceWorld,
  s: Settlement,
  actor: string,
  incident: SliceEvent | undefined,
  notice: SliceEvent | undefined,
  month: number,
) {
  const p = w.entities[actor];
  if (
    !s.mandate ||
    s.leader !== actor ||
    month >= s.termEnd ||
    p?.kind !== "person" ||
    !p.alive ||
    !p.present
  )
    return "sem autoridade vigente";
  if (
    !incident ||
    ![
      "attack.attempted",
      "person.died",
      "scarcity.observed",
      "theft.perceived",
    ].includes(incident.type) ||
    (incident.type === "person.died" && !incident.data.killer) ||
    incident.data.conflict
  )
    return "sem incidente pessoal válido";
  if (
    !notice ||
    notice.type !== "political.notice.received" ||
    notice.data.incident !== incident.id ||
    !notice.participants.some((x) => x.id === actor && x.role === "actor")
  )
    return "incidente não conhecido pelo líder";
  return undefined;
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
  die: (id: string, cause: string, conflict: string) => void;
}
export class PoliticsSystem {
  private additions: PoliticalIncidents;
  constructor(private c: Context) {
    this.additions = new PoliticalIncidents({
      ...c,
      settlements: () => this.settlements(),
      home: (id) => this.home(id),
      petition: (e, witness, from, to) => this.petition(e, witness, from, to),
    });
  }
  beforeActions() {
    this.additions.monthly();
  }
  occupied(id: string) {
    return this.additions.occupied(id);
  }
  petition(e: SliceEvent, witness: string, from: Settlement, to: Settlement) {
    const p = this.person(witness);
    if (
      !p.alive ||
      !p.present ||
      this.w.scenario.blockedInformation.includes(witness) ||
      from.id === to.id
    )
      return;
    const id = `dispute:${e.id}`,
      distance = this.distance(from, to),
      due = this.month + Math.ceil(distance / 60),
      source = this.next();
    this.c.emit(
      "political.notice.sent",
      [{ id: witness, role: "actor" }],
      [e.id, from.source, to.source],
      [
        {
          op: "create",
          entity: {
            id,
            kind: "dispute",
            from: from.id,
            to: to.id,
            incident: e.id,
            witness,
            sent: source,
            due,
            status: "travelling",
            lastEvent: source,
          },
        },
      ],
      {
        incident: e.id,
        from: from.id,
        to: to.id,
        source: witness,
        distanceKm: distance,
        travelMonths: due - this.month,
      },
    );
  }
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
  private event(id: string) {
    return this.w.events[Number(id.slice(6))];
  }
  private settlements() {
    return Array.from(
      { length: this.w.scenario.politics!.count },
      (_, i) => this.w.entities[`settlement:${i}`],
    ).filter((e): e is Settlement => e?.kind === "settlement");
  }
  home(id: string) {
    const l = this.w.entities[`life:${id}`] as Life | undefined;
    return this.settlements().find((s) => s.homes.includes(l?.household || ""));
  }
  private adults(s: Settlement) {
    return byKind(this.w, "person").filter(
      (p): p is Person =>
        p.kind === "person" &&
        p.alive &&
        p.present &&
        ["adult", "elder"].includes(p.lifeStage || "") &&
        this.home(p.id)?.id === s.id,
    );
  }
  distance(a: Settlement, b: Settlement) {
    return (
      30 +
      30 *
        Math.abs(
          this.settlements().findIndex((s) => s.id === a.id) -
            this.settlements().findIndex((s) => s.id === b.id),
        )
    );
  }
  initialize() {
    const names = ["Vale do Cedro", "Porto das Pedras", "Colina da Fonte"];
    for (let i = 0; i < this.w.scenario.politics!.count; i++) {
      const id = `settlement:${i}`,
        source = this.next();
      this.c.emit(
        "settlement.founded",
        [],
        ["event:0"],
        [
          {
            op: "create",
            entity: {
              id,
              kind: "settlement",
              name: names[i],
              homes: this.w.scenario.people
                .filter((_, n) => n % this.w.scenario.politics!.count === i)
                .map((p) => `home:${p.id}`),
              office: "coordenador",
              termEnd: 0,
              source,
              lastEvent: source,
            },
          },
        ],
        {
          name: names[i],
          settlement: id,
          assumption:
            "Residência declarada dos fundadores; sem mapa ou história anterior.",
        },
      );
    }
    this.elections();
  }
  private elections() {
    for (const original of this.settlements()) {
      let s = original;
      const old = s.leader ? this.person(s.leader) : undefined;
      if (old?.alive && this.month < s.termEnd) continue;
      if (s.leader) {
        const cause = old?.death || s.mandate!;
        const e = this.c.emit(
          "office.vacated",
          [{ id: s.leader, role: "reference" }],
          [cause, s.lastEvent],
          [
            {
              op: "replace",
              entity: {
                ...s,
                previous: s.leader,
                leader: undefined,
                mandate: undefined,
                lastEvent: this.next(),
              },
            },
          ],
          {
            settlement: s.id,
            name: s.name,
            reason: old?.alive ? "fim do mandato" : "morte",
            office: s.office,
          },
        );
        s = this.w.entities[s.id] as Settlement;
      }
      const adults = this.adults(s);
      if (!adults.length) continue;
      const scores = adults
        .map((p) => {
          const supports = adults
            .filter(
              (v) =>
                (p.values.poder || 0) +
                  (p.skills?.lideranca || 0) +
                  (p.traits.confianca || 0) -
                  Math.abs((v.values.lei || 0) - (p.values.lei || 0)) / 2 +
                  (v.kin.includes(p.id) ? 30 : 0) >=
                50,
            )
            .map((v) => v.id);
          const kin = !!s.previous && p.kin.includes(s.previous);
          return {
            id: p.id,
            supports,
            kin,
            score:
              supports.length * 30 +
              (p.skills?.lideranca || 0) +
              (p.traits.ambicao || 0) +
              (kin ? 30 : 0) -
              (p.psychology?.stress || 0) / 20,
          };
        })
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      const chosen = scores[0],
        p = this.person(chosen.id),
        source = this.next();
      this.c.emit(
        "office.appointed",
        [{ id: p.id, role: "actor" }],
        [s.lastEvent, ...adults.map((p) => p.lastBy.values), p.lastBy.traits],
        [
          {
            op: "replace",
            entity: {
              ...s,
              leader: p.id,
              mandate: source,
              termEnd: this.month + this.w.scenario.politics!.termMonths,
              lastEvent: source,
            },
          },
        ],
        {
          settlement: s.id,
          name: s.name,
          office: s.office,
          leader: p.id,
          termEnd: this.month + this.w.scenario.politics!.termMonths,
          reason: chosen.kin
            ? "parentesco e apoio dos residentes"
            : "apoio dos residentes",
          candidates: scores,
          previous: s.previous || null,
        },
      );
    }
  }
  private incidents() {
    const recent: SliceEvent[] = [];
    for (let i = this.w.events.length - 1; i >= 0; i--) {
      const e = this.w.events[i];
      if (e.month < this.month) break;
      if (e.type === "attack.attempted" || e.type === "information.received")
        recent.push(e);
    }
    for (const received of recent.reverse()) {
      const e =
        received.type === "information.received"
          ? this.event(String(received.data.offense))
          : received;
      if (
        !e ||
        (e.type === "person.died" && (!e.data.killer || e.data.conflict))
      )
        continue;
      const attacker = String(
          e.data.killer ||
            e.participants.find((p) => p.role === "actor")?.id ||
            "",
        ),
        victim = String(
          e.data.victim ||
            e.participants.find((p) => p.role === "target")?.id ||
            "",
        );
      const witnessId =
        received.type === "information.received"
          ? received.participants.find((p) => p.role === "actor")?.id
          : victim;
      if (!witnessId) continue;
      const witness = this.person(witnessId);
      if (e.type === "person.died" && !witness.kin.includes(victim)) continue;
      const from = this.home(witnessId),
        to = this.home(attacker);
      if (!from || !to || from.id === to.id) continue;
      const key = String(e.data.duel || e.id + ":" + from.id),
        id = `dispute:${key}`;
      if (this.w.entities[id]) continue;
      // A surviving direct participant reports; an unobserved death cannot bootstrap knowledge.
      if (
        !witness?.alive ||
        !witness.present ||
        this.w.scenario.blockedInformation.includes(witness.id)
      )
        continue;
      const distance = this.distance(from, to),
        due = this.month + Math.max(1, Math.ceil(distance / 60)),
        source = this.next();
      this.c.emit(
        "political.notice.sent",
        [{ id: witness.id, role: "actor" }],
        [e.id, received.id, from.source, to.source],
        [
          {
            op: "create",
            entity: {
              id,
              kind: "dispute",
              from: from.id,
              to: to.id,
              incident: e.id,
              witness: witness.id,
              sent: source,
              due,
              status: "travelling",
              lastEvent: source,
            },
          },
        ],
        {
          incident: e.id,
          from: from.id,
          to: to.id,
          distanceKm: distance,
          travelMonths: due - this.month,
          source: witness.id,
        },
      );
    }
  }
  private decide(d: Dispute) {
    const s = this.w.entities[d.from] as Settlement;
    const p = s.leader ? this.person(s.leader) : undefined;
    let notice: SliceEvent | undefined;
    if (
      p?.alive &&
      p.present &&
      !this.w.scenario.blockedInformation.includes(p.id)
    )
      notice = this.c.emit(
        "political.notice.received",
        [
          { id: p.id, role: "actor" },
          { id: d.witness, role: "reference" },
        ],
        [d.sent, d.incident, s.mandate || s.source],
        [],
        {
          incident: d.incident,
          source: d.sent,
          witness: d.witness,
          settlement: s.id,
        },
      );
    const denied = politicalGate(
      this.w,
      s,
      p?.id || "",
      this.event(d.incident),
      notice,
      this.month,
    );
    const scores = p ? warUtilities(p) : undefined;
    if (!denied && scores && scores.guerra <= scores.acordo) {
      const target = this.w.entities[d.to] as Settlement;
      this.c.emit(
        "dispute.proposed",
        [{ id: p!.id, role: "actor" }],
        [
          notice!.id,
          d.incident,
          s.mandate!,
          p!.lastBy.traits,
          p!.lastBy.values,
        ],
        [
          {
            op: "replace",
            entity: {
              ...d,
              status: "negotiating",
              leader: p!.id,
              mandate: s.mandate,
              notice: notice!.id,
              due: this.month + Math.ceil(this.distance(s, target) / 60),
              lastEvent: this.next(),
            },
          },
        ],
        {
          from: s.id,
          to: target.id,
          name: s.name,
          targetName: target.name,
          incident: d.incident,
          utilities: scores,
          reason:
            "preferência por acordo de não agressão; sem transferência presumida de bens",
        },
      );
      return;
    }
    if (denied || !scores) {
      this.c.emit(
        "war.rejected",
        p ? [{ id: p.id, role: "reference" }] : [],
        [d.sent, ...(notice ? [notice.id] : []), s.lastEvent],
        [
          {
            op: "replace",
            entity: { ...d, status: "closed", lastEvent: this.next() },
          },
        ],
        {
          from: d.from,
          to: d.to,
          name: s.name,
          reason: denied || "utilidade de acordo supera a guerra",
          utilities: scores || null,
          incident: d.incident,
        },
      );
      return;
    }
    const target = this.w.entities[d.to] as Settlement;
    const due = this.month + Math.ceil(this.distance(s, target) / 30);
    const id = this.next();
    this.c.emit(
      "war.declared",
      [{ id: p!.id, role: "actor" }],
      [
        notice!.id,
        d.incident,
        s.mandate!,
        p!.lastBy.traits,
        p!.lastBy.values,
        p!.lastBy.psychology,
      ],
      [
        {
          op: "replace",
          entity: {
            ...d,
            status: "declared",
            leader: p!.id,
            mandate: s.mandate,
            notice: notice!.id,
            declaration: id,
            due,
            lastEvent: id,
          },
        },
      ],
      {
        from: s.id,
        to: target.id,
        name: s.name,
        targetName: target.name,
        incident: d.incident,
        mandate: s.mandate,
        utilities: scores,
        reason: "utilidade de confronto supera a de acordo",
        arrival: due,
        distanceKm: this.distance(s, target),
      },
    );
  }
  private negotiate(d: Dispute) {
    const a = this.w.entities[d.from] as Settlement,
      b = this.w.entities[d.to] as Settlement,
      p = b.leader ? this.person(b.leader) : undefined;
    const notice =
      p?.alive &&
      p.present &&
      !this.w.scenario.blockedInformation.includes(p.id)
        ? this.c.emit(
            "political.notice.received",
            [{ id: p.id, role: "actor" }],
            [d.lastEvent, d.incident, b.mandate || b.source],
            [],
            {
              incident: d.incident,
              source: d.lastEvent,
              witness: d.witness,
              settlement: b.id,
            },
          )
        : undefined;
    const deniedA = politicalGate(
        this.w,
        a,
        d.leader!,
        this.event(d.incident),
        this.event(d.notice!),
        this.month,
      ),
      deniedB = politicalGate(
        this.w,
        b,
        p?.id || "",
        this.event(d.incident),
        notice,
        this.month,
      );
    const scores = p ? warUtilities(p) : undefined;
    const accepted =
      !deniedA &&
      !deniedB &&
      a.mandate === d.mandate &&
      !!scores &&
      scores.acordo >= scores.guerra;
    this.c.emit(
      accepted ? "dispute.agreed" : "dispute.unresolved",
      p ? [{ id: p.id, role: "reference" }] : [],
      [d.lastEvent, ...(notice ? [notice.id] : []), a.lastEvent, b.lastEvent],
      [
        {
          op: "replace",
          entity: {
            ...d,
            status: "closed",
            outcome: accepted ? "agreement" : "unresolved",
            lastEvent: this.next(),
          },
        },
      ],
      {
        from: a.id,
        to: b.id,
        name: a.name,
        targetName: b.name,
        incident: d.incident,
        accepted,
        utilities: scores || null,
        reason: accepted
          ? "ambos os líderes vigentes aceitam não agressão; bens não transferidos"
          : deniedA ||
            deniedB ||
            (a.mandate !== d.mandate
              ? "mandato mudou durante a negociação"
              : "outro líder recusou o acordo"),
      },
    );
  }
  private resolve(d: Dispute) {
    const s = this.w.entities[d.from] as Settlement,
      t = this.w.entities[d.to] as Settlement;
    const gate = politicalGate(
      this.w,
      s,
      d.leader!,
      this.event(d.incident),
      this.event(d.notice!),
      this.month,
    );
    if (gate || s.mandate !== d.mandate) {
      this.c.emit(
        "campaign.ended",
        [],
        [d.declaration!, s.lastEvent],
        [
          {
            op: "replace",
            entity: { ...d, status: "closed", lastEvent: this.next() },
          },
        ],
        {
          conflict: d.id,
          reason: "autoridade mudou durante a viagem; campanha cancelada",
        },
      );
      return;
    }
    const attackers = this.adults(s),
      defenders = this.adults(t);
    if (!attackers.length || !defenders.length) {
      this.c.emit(
        "campaign.ended",
        [],
        [d.declaration!, s.lastEvent, t.lastEvent],
        [
          {
            op: "replace",
            entity: { ...d, status: "closed", lastEvent: this.next() },
          },
        ],
        {
          conflict: d.id,
          reason:
            "sem adultos presentes em ambos os lados; não houve confronto",
        },
      );
      return;
    }
    const roster = [...attackers, ...defenders];
    const rolls = roster.map((p) => ({
      id: p.id,
      draw: sample(
        `${this.w.scenario.seed}|politics:casualties`,
        `${d.id}:${p.id}`,
        0,
        99,
      ),
      threshold: Math.max(5, Math.min(45, 30 - Math.floor(p.skill / 40))),
    }));
    const dead = rolls.filter((r) => r.draw < r.threshold).map((r) => r.id);
    const e = this.c.emit(
      "campaign.resolved",
      roster.map((p) => ({ id: p.id, role: "reference" })),
      [d.declaration!, s.mandate!, ...roster.map((p) => p.lastBy.alive)],
      [
        {
          op: "replace",
          entity: { ...d, status: "closed", lastEvent: this.next() },
        },
      ],
      {
        conflict: d.id,
        from: s.id,
        to: t.id,
        name: s.name,
        targetName: t.name,
        casualties: dead,
        rolls,
        reason: "encontro armado após viagem; exposição dos adultos presentes",
        assumption:
          "Conflito abstrato: sem executor individual presumido; crianças não combatem.",
      },
    );
    for (const id of dead) this.c.die(id, e.id, d.id);
    this.c.emit(
      "campaign.ended",
      [],
      [e.id, ...dead.map((id) => this.person(id).death!)],
      [],
      {
        conflict: d.id,
        reason: "encontro encerrado; sem guerra automática recorrente",
        deaths: dead.length,
      },
    );
  }
  monthly() {
    this.elections();
    this.incidents();
    for (const d of byKind(this.w, "dispute").filter(
      (e): e is Dispute =>
        e.kind === "dispute" && e.status !== "closed" && e.due <= this.month,
    )) {
      if (d.status === "travelling") this.decide(d);
      else if (d.status === "negotiating") this.negotiate(d);
      else this.resolve(d);
    }
    this.elections();
  }
}
