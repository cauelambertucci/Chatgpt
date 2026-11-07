/** 2d-1 only. Design assumptions: monthly occupations, no economy or teaching. */
import type { BodySystem } from "./body";
import type { Household, Life } from "./life";
import type { Effect, Person, SliceEvent, SliceWorld, Work } from "./types";
import { sample } from "./rules";
export type Occupation = "criador" | "cuidador" | "sem ofício";
export interface DailyOptions {
  initialPaper: number;
  initialInk: number;
}
export const domainSeed = (seed: string, domain: string) =>
  `${seed}|2d1:${domain}`;
interface Context {
  world: () => SliceWorld;
  month: () => number;
  body: () => BodySystem;
  emit: (
    type: string,
    participants: SliceEvent["participants"],
    causes: string[],
    effects?: Effect[],
    data?: Record<string, unknown>,
  ) => SliceEvent;
}
export class DailySystem {
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
  home(id: string) {
    const l = this.w.entities[`life:${id}`] as Life;
    return this.w.entities[l.household] as Household;
  }
  private patch(p: Person, fields: Partial<Person>): Person {
    return {
      ...p,
      ...fields,
      lastBy: {
        ...p.lastBy,
        ...Object.fromEntries(Object.keys(fields).map((k) => [k, this.next()])),
      },
    };
  }
  initialize() {
    const o = this.w.scenario.dailyLife!;
    for (const h of Object.values(this.w.entities).filter(
      (e): e is Household => e.kind === "household",
    ))
      this.c.emit(
        "household.materials.declared",
        [],
        [h.source],
        [
          {
            op: "replace",
            entity: {
              ...h,
              writingStock: { paper: o.initialPaper, ink: o.initialInk },
              stockSource: this.next(),
            },
          },
        ],
        {
          household: h.id,
          paper: o.initialPaper,
          ink: o.initialInk,
          reason: "Estoque inicial declarado; sem reposição.",
        },
      );
  }
  theme(p: Person): { fact: string; evidence: string } | undefined {
    const home = this.home(p.id);
    if (home.stockSource && p.blockedWritingStock === home.stockSource) return;
    const previous = (p.personalGoals || [])
      .map((id) => this.w.entities[id])
      .filter((e) => e.kind === "personalGoal" && e.type === "criar_obra")
      .map((e) => (e.kind === "personalGoal" ? e.theme : undefined));
    for (const fact of [...p.informed].reverse()) {
      if (previous.includes(fact)) continue;
      const event = this.w.events[Number(fact.slice(6))];
      const evidence = p.knownFactSources?.[fact];
      if (event?.type === "person.died" && evidence) return { fact, evidence };
    }
  }
  ability(id: string) {
    const b = this.c.body(),
      body = b.body(id),
      right = b.grip(id, "right"),
      left = b.grip(id, "left");
    return {
      write: body.conscious ? 0.75 * right + 0.25 * left : 0,
      care: body.conscious ? Math.max(right, left) : 0,
      sources: [
        body.lastEvent,
        ...(
          [
            "hand.left",
            "hand.right",
            "forearm.left",
            "forearm.right",
            "arm.left",
            "arm.right",
          ] as const
        ).map((k) => b.part(id, k).lastEvent),
      ],
    };
  }
  choose(id: string, urgent = false, source?: string) {
    let p = this.person(id);
    if (
      !p.alive ||
      !p.present ||
      !["adult", "elder"].includes(p.lifeStage || "adult")
    )
      return;
    const a = this.ability(id),
      art = p.values.arte || 0,
      solidarity = p.values.solidariedade || 0;
    const scores = {
      criador:
        a.write < 0.5
          ? -10000
          : Math.round(
              art * 3 +
                (p.traits.criatividade || 0) * 2 +
                (p.skills?.escrita || 0) * 2 -
                350 * (1 - a.write),
            ),
      cuidador:
        a.care < 0.5
          ? -10000
          : Math.round(
              solidarity * 2 +
                (p.traits.compaixao || 0) * 2 +
                (p.medicalSkill || 0) * 2 -
                180 * (1 - a.care) +
                (urgent ? 500 : 0),
            ),
      "sem ofício": 90,
    };
    if (
      p.blockedWritingStock === this.home(id).stockSource &&
      p.blockedWritingStock
    )
      scores.criador -= 500;
    const options = (Object.keys(scores) as Occupation[])
      .map((job) => ({
        job,
        score: scores[job] + (p.occupation === job ? 35 : 0),
        noise: sample(
          domainSeed(this.w.scenario.seed, "occupation"),
          `${id}:${this.month}:${job}`,
          0,
          4,
        ),
      }))
      .sort(
        (x, y) =>
          y.score + y.noise - x.score - x.noise || x.job.localeCompare(y.job),
      );
    const chosen = options[0].job;
    if (chosen === p.occupation) return;
    this.c.emit(
      "occupation.changed",
      [{ id, role: "actor" }],
      [
        ...a.sources,
        p.lastBy.traits,
        p.lastBy.values,
        ...(p.lastBy.occupation ? [p.lastBy.occupation] : []),
        ...(source ? [source] : []),
      ],
      [{ op: "replace", entity: this.patch(p, { occupation: chosen }) }],
      {
        previous: p.occupation || null,
        occupation: chosen,
        capacity: a,
        options,
        reason: urgent
          ? "Ferimento presente criou oportunidade de cuidado."
          : "Habilidade, personalidade, valores e capacidade por tarefa; custo de trocar incluído.",
      },
    );
  }
  caregiver(owner: string, fallback: string, source: string): string {
    const candidates = Object.values(this.w.entities).filter(
      (p): p is Person =>
        p.kind === "person" &&
        p.id !== owner &&
        p.alive &&
        p.present &&
        p.canHelp &&
        p.workedMonth !== this.month &&
        ["adult", "elder"].includes(p.lifeStage || "adult"),
    );
    const ranked = candidates
      .map((p) => ({
        p,
        ability: this.ability(p.id).care,
        score:
          (p.medicalSkill || 0) * 2 +
          (p.traits.compaixao || 0) +
          (p.values.solidariedade || 0),
      }))
      .filter((x) => x.ability >= 0.5)
      .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id));
    const chosen = ranked[0];
    if (!chosen) return owner;
    this.choose(chosen.p.id, true, source);
    const p = this.person(chosen.p.id);
    if (p.occupation !== "cuidador") return owner;
    this.c.emit(
      "occupation.care.offered",
      [
        { id: p.id, role: "actor" },
        { id: owner, role: "beneficiary" },
      ],
      [source, p.lastBy.occupation],
      [{ op: "replace", entity: this.patch(p, { workedMonth: this.month }) }],
      {
        patient: owner,
        candidates: ranked.map((x) => ({
          id: x.p.id,
          score: x.score,
          capacity: x.ability,
        })),
        score: chosen.score,
        capacity: chosen.ability,
        reason:
          "Ajuda presencial aceita como atividade deste período; o corpo ainda verifica consentimento e recursos.",
      },
    );
    return p.id;
  }
  transfer(work: Work) {
    const p = this.person(work.creator);
    if (!p.alive || work.owner !== p.id) return;
    const target = Object.values(this.w.entities)
      .filter(
        (q): q is Person =>
          q.kind === "person" &&
          q.id !== p.id &&
          q.alive &&
          q.present &&
          !!(p.bonds?.[q.id] || p.kin.includes(q.id)),
      )
      .sort(
        (a, b) =>
          (p.bonds?.[b.id]?.trust || 0) - (p.bonds?.[a.id]?.trust || 0) ||
          a.id.localeCompare(b.id),
      )[0];
    if (!target || (p.values.amizade || 0) + (p.values.familia || 0) < 60)
      return;
    this.c.emit(
      "work.transferred",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "beneficiary" },
      ],
      [
        work.source,
        ...(p.bonds?.[target.id]
          ? [p.bonds[target.id].source]
          : [p.lastBy.kin]),
        p.lastBy.values,
      ],
      [
        {
          op: "replace",
          entity: { ...work, owner: target.id, ownerSource: this.next() },
        },
      ],
      {
        work: work.id,
        from: p.id,
        to: target.id,
        reason: "Presente por vínculo conhecido e valor de amizade/família.",
      },
    );
  }
}
