import { themeProof, writingSaturation } from "./writing";
/** Monthly occupations and minimal household economy; fictional design assumptions. */
import {
  foodNeed,
  reserveMonths,
  cultivationNeed,
  cultivationYield,
  toolLifetime,
  ration,
  hungerAfter,
  recipe,
  type EconomyOptions,
} from "./economy";
import type { BodySystem } from "./body";
import type { Household, Life } from "./life";
import type { Effect, Person, SliceEvent, SliceWorld, Work } from "./types";
import { sample } from "./rules";
export type Occupation =
  "criador" | "cuidador" | "cultivador" | "artesão" | "sem ofício";
export interface DailyOptions {
  economy?: EconomyOptions;
  initialPaper: number;
  initialInk: number;
}
export const domainSeed = (seed: string, domain: string) =>
  `${seed}|2d1:${domain}`;
interface Context {
  die: (id: string, source: string) => void;
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
              ...(o.economy
                ? {
                    inventory: { ...o.economy.initial },
                    inventorySource: this.next(),
                  }
                : {}),
            },
          },
        ],
        {
          household: h.id,
          inventory: o.economy?.initial,
          paper: o.initialPaper,
          ink: o.initialInk,
          reason: o.economy
            ? "Estoque inicial declarado; receitas e colheitas mensais explícitas."
            : "Estoque inicial declarado; sem reposição.",
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
    const works = (p.works || [])
      .map((id) => this.w.entities[id])
      .filter((e): e is Work => e?.kind === "work");
    const candidates = [
      ...p.informed.map((fact) => ({
        fact,
        evidence: p.knownFactSources?.[fact],
      })),
      ...Object.values(p.livedFacts || {}).map((fact) => ({
        fact,
        evidence: fact,
      })),
    ].filter(
      (x): x is { fact: string; evidence: string } =>
        !!x.evidence &&
        !previous.includes(x.fact) &&
        this.knows(p, x.fact, x.evidence),
    );
    const counts = new Map<string, number>();
    for (const w of works) {
      const t = w.theme ? this.eventType(w.theme) : "unknown";
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    candidates.sort(
      (a, b) =>
        (counts.get(this.eventType(a.fact)) || 0) -
          (counts.get(this.eventType(b.fact)) || 0) ||
        Number(b.fact.slice(6)) - Number(a.fact.slice(6)),
    );
    return candidates[0];
  }
  private eventType(id: string) {
    return this.w.events[Number(id.slice(6))]?.type || "unknown";
  }
  knows(p: Person, fact: string, evidence: string) {
    const e = this.w.events[Number(evidence.slice(6))];
    if (!e || !themeProof(p.id, fact, e)) return false;
    if (e.type === "information.received") return p.informed.includes(fact);
    const life = this.w.entities[`life:${p.id}`] as Life | undefined;
    return !life || e.month - life.birthMonth >= 48;
  }
  saturation(p: Person, theme?: string) {
    return writingSaturation(
      (p.works || [])
        .map((id) => this.w.entities[id])
        .filter((e): e is Work => e?.kind === "work"),
      (id) => this.eventType(id),
      theme ? this.eventType(theme) : "unknown",
    );
  }

  ability(id: string) {
    const b = this.c.body(),
      body = b.body(id),
      right = b.grip(id, "right"),
      left = b.grip(id, "left");
    return {
      farm: body.conscious
        ? Math.max(right, left) *
          ((["left", "right"] as const).reduce(
            (sum, side) =>
              sum +
              (b.present(id, `leg.${side}`)
                ? Math.min(
                    b.part(id, `leg.${side}`).bone,
                    b.part(id, `leg.${side}`).nerve,
                  )
                : 0),
            0,
          ) /
            2) *
          Math.max(0.4, 1 - (this.person(id).hunger || 0) / 125)
        : 0,
      craft: body.conscious
        ? Math.min(right, left) *
          Math.max(0.4, 1 - (this.person(id).hunger || 0) / 125)
        : 0,
      write: body.conscious
        ? (0.75 * right + 0.25 * left) *
          Math.max(0.4, 1 - (this.person(id).hunger || 0) / 125)
        : 0,
      care: body.conscious
        ? Math.max(right, left) *
          Math.max(0.4, 1 - (this.person(id).hunger || 0) / 125)
        : 0,
      sources: [
        body.lastEvent,
        ...(this.person(id).lastBy.hunger
          ? [this.person(id).lastBy.hunger]
          : []),
        ...(
          [
            "hand.left",
            "hand.right",
            "forearm.left",
            "forearm.right",
            "arm.left",
            "arm.right",
            "leg.left",
            "leg.right",
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
    const h = this.home(id),
      economy = this.w.scenario.dailyLife?.economy;
    const residents = Object.values(this.w.entities).filter(
      (q): q is Person =>
        q.kind === "person" && q.alive && this.home(q.id).id === h.id,
    );
    const demand = residents.reduce((n, q) => n + foodNeed(q.lifeStage), 0);
    const craft =
      h.inventory &&
      recipe(h.inventory, h.writingStock?.paper || 0, h.writingStock?.ink || 0);
    const scores: Record<Occupation, number> = {
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
      cultivador:
        !economy || !h.inventory || a.farm < 0.1 || economy.harvest <= 0
          ? -10000
          : Math.round(
              cultivationNeed(h.inventory.food, demand) +
                (p.traits.disciplina || 0) +
                this.aptitude(id, "cultivo") -
                200 * (1 - a.farm),
            ),
      artesão:
        !economy || !craft || a.craft < 0.5
          ? -10000
          : Math.round(
              (h.inventory!.tools < 2 ? 800 : 250) +
                (p.traits.criatividade || 0) +
                this.aptitude(id, "artesanato") -
                200 * (1 - a.craft),
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
        ...(h.inventorySource ? [h.inventorySource] : []),
        ...residents.map(
          (q) => (this.w.entities[`life:${q.id}`] as Life).lastEvent,
        ),
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
        foodReserveMonths: h.inventory
          ? reserveMonths(h.inventory.food, demand)
          : undefined,
        foodDemand: demand,
        aptitude: {
          cultivo: this.aptitude(id, "cultivo"),
          artesanato: this.aptitude(id, "artesanato"),
        },
        options,
        reason: urgent
          ? "Ferimento presente criou oportunidade de cuidado."
          : "Habilidade, personalidade, valores e capacidade por tarefa; custo de trocar incluído.",
      },
    );
  }
  aptitude(id: string, task: string) {
    return sample(
      domainSeed(this.w.scenario.seed, "livelihood"),
      `${id}:${task}`,
      20,
      80,
    );
  }
  urgentFood(id:string){
    const h=this.home(id),p=this.person(id);
    const demand=Object.values(this.w.entities).filter((q):q is Person=>q.kind==='person'&&q.alive&&this.home(q.id).id===h.id).reduce((n,q)=>n+foodNeed(q.lifeStage),0);
    return p.occupation==='cultivador' && !!h.inventory && reserveMonths(h.inventory.food,demand)<2;
  }
  work(id: string): boolean {
    const p = this.person(id),
      o = this.w.scenario.dailyLife?.economy;
    if (!o || !p.alive || !p.present || p.workedMonth === this.month)
      return false;
    const h = this.home(id),
      stock = h.inventory;
    if (!stock) return false;
    const a = this.ability(id),
      next = { ...stock },
      writing = { ...h.writingStock! };
    let data: Record<string, unknown>,
      toolWear = h.toolWear || 0;
    if (p.occupation === "cultivador" && a.farm >= 0.1 && o.harvest > 0) {
      const amount = cultivationYield(
        o.harvest,
        a.farm,
        p.psychology?.stress || 0,
        stock.tools >= 1,
      );
      if (!amount) return false;
      next.food += amount;
      const hasTool = stock.tools >= 1;
      const wearAfter = toolWear + (hasTool ? 1 : 0),
        used = wearAfter >= toolLifetime ? 1 : 0;
      toolWear = used ? 0 : wearAfter;
      next.tools -= used;
      data = {
        task: "cultivar",
        food: amount,
        toolsUsed: used,
        toolWear,
        manual: !hasTool,
        capacity: a.farm,
        stress: p.psychology?.stress || 0,
        environmentalInput: amount,
        reason:
          "Colheita renovável declarada; ferramenta dura 12 períodos; trabalho manual rende 60%; estresse reduz rendimento, sem proibição absoluta.",
      };
    } else if (p.occupation === "artesão" && a.craft >= 0.5) {
      const r = recipe(stock, writing.paper, writing.ink);
      if (!r) return false;
      for (const [k, v] of Object.entries(r.take))
        next[k as keyof typeof next] -= v;
      for (const [k, v] of Object.entries(r.give))
        next[k as keyof typeof next] += v;
      writing.paper += r.paper;
      writing.ink += r.ink;
      data = {
        task: "fabricar",
        recipe: r,
        reason:
          "Conversão explícita de material inicial; sem reposição de matéria-prima.",
      };
    } else return false;
    this.c.emit(
      "livelihood.period",
      [{ id, role: "actor" }],
      [
        p.lastBy.occupation,
        p.lastBy.psychology,
        h.inventorySource!,
        h.stockSource!,
        ...a.sources,
      ],
      [
        {
          op: "replace",
          entity: {
            ...h,
            inventory: next,
            toolWear,
            inventorySource: this.next(),
            writingStock: writing,
            stockSource:
              writing.paper !== h.writingStock!.paper ||
              writing.ink !== h.writingStock!.ink
                ? this.next()
                : h.stockSource,
          },
        },
        { op: "replace", entity: this.patch(p, { workedMonth: this.month }) },
      ],
      { household: h.id, periodMonths: 1, ...data },
    );
    return true;
  }
  consume() {
    if (!this.w.scenario.dailyLife?.economy) return;
    const homes = new Map<string, Person[]>();
    for (const p of Object.values(this.w.entities))
      if (p.kind === "person" && p.alive) {
        const h = this.home(p.id);
        if (!homes.has(h.id)) homes.set(h.id, []);
        homes.get(h.id)!.push(p);
      }
    for (const [hid, residents] of homes) {
      const h = this.w.entities[hid] as Household;
      if (!h.inventory) continue;
      const needs = residents.map((p) => foodNeed(p.lifeStage)),
        r = ration(h.inventory.food, needs);
      const starving: string[] = [],
        effects: Effect[] = [
          {
            op: "replace",
            entity: {
              ...h,
              inventory: {
                ...h.inventory,
                food: h.inventory.food - r.consumed,
              },
              inventorySource: this.next(),
            },
          },
        ];
      const transitions: { id: string; before: number; after: number }[] = [];
      for (const p of residents) {
        const before = p.hunger || 0,
          after = hungerAfter(before, r.coverage);
        if (after >= 100) starving.push(p.id);
        if (before >= 40 !== after >= 40)
          transitions.push({ id: p.id, before, after });
        const fields: Partial<Person> = { hunger: after };
        if (after > 0 && p.psychology)
          fields.psychology = {
            ...p.psychology,
            stress: Math.min(1000, p.psychology.stress + Math.ceil(after / 5)),
          };
        if (after !== before || fields.psychology)
          effects.push({ op: "replace", entity: this.patch(p, fields) });
      }
      const e = this.c.emit(
        "household.consumption",
        [],
        [
          h.inventorySource!,
          ...residents.map(
            (p) => (this.w.entities[`life:${p.id}`] as Life).lastEvent,
          ),
        ],
        effects,
        {
          household: hid,
          periodMonths: 1,
          required: needs.reduce((a, b) => a + b, 0),
          consumed: r.consumed,
          coverage: r.coverage,
          residents: residents.map((p) => p.id),
        },
      );
      for (const t of transitions)
        this.c.emit(
          "hunger.changed",
          [{ id: t.id, role: "reference" }],
          [e.id],
          [],
          t,
        );
      for (const id of starving) this.c.die(id, e.id);
    }
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
