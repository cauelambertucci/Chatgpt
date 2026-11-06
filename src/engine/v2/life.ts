/** Suposição de design, não verificado. Monthly calendar, coarse human life stages. */
import { conceptionDiagnostic, type ConceptionDiagnostic } from "./demography";
import type { Person, Entity, Effect, SliceEvent, SliceWorld } from "./types";
import { initialPsychology, bounded } from "./emotions";
import { sample, names } from "./rules";
export type Stage = "child" | "youth" | "adult" | "elder";
export interface LifeOptions {
  fertilityPolicy?: "replacement-2c";
  blockedConceptions?: string[];
  roles?: Record<string, "gestational" | "contributor">;
  conceptionOverride?: boolean;
  lossOverride?: boolean;
  deathMonths?: Record<string, number>;
}
export interface Life {
  id: string;
  kind: "life";
  owner: string;
  birthMonth: number;
  stage: Stage;
  parents: string[];
  guardians: string[];
  partner?: string;
  household: string;
  role: "gestational" | "contributor";
  genes: Record<string, number>;
  naturalDeathAt: number;
  declineSource?: string;
  children: number;
  lastPregnancyEnd?: number;
  pregnancy?: string;
  source: string;
  lastEvent: string;
}
export interface Household {
  id: string;
  kind: "household";
  source: string;
}
export interface Pregnancy {
  id: string;
  kind: "pregnancy";
  parents: [string, string];
  conceived: number;
  due: number;
  status: "gestating" | "born" | "lost";
  lossRisk: number;
  draw: number;
  child?: string;
  source: string;
  lastEvent: string;
}
interface Context {
  observeConception?: (observation: ConceptionDiagnostic) => void;
  world: () => SliceWorld;
  month: () => number;
  emit: (
    type: string,
    participants: SliceEvent["participants"],
    causes: string[],
    effects?: Effect[],
    data?: Record<string, unknown>,
  ) => SliceEvent;
  body: (id: string) => void;
  grow: (id: string, age: number, source: string) => void;
  die: (id: string, source: string, details: Record<string, unknown>) => void;
  affect: (id: string, source: string) => void;
}
export const stageAt = (age: number): Stage =>
  age < 144 ? "child" : age < 216 ? "youth" : age < 720 ? "adult" : "elder";
export const ageCapacity = (age: number) =>
  age < 216
    ? Math.max(0.12, age / 216)
    : Math.max(0.5, 1 - Math.max(0, age - 720) / 1200);
export class LifeSystem {
  constructor(private c: Context) {}
  private get w() {
    return this.c.world();
  }
  private get month() {
    return this.c.month();
  }
  private person(id: string) {
    return this.w.entities[id] as Person;
  }
  private all() {
    return Object.values(this.w.entities).filter(
      (e): e is Life => e.kind === "life",
    );
  }
  get(id: string) {
    return this.w.entities[`life:${id}`] as Life | undefined;
  }
  private next() {
    return `event:${this.w.events.length}`;
  }
  private replace(entity: Entity): Effect {
    return { op: "replace", entity };
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
  private naturalDeadline(id: string, birth: number) {
    return (
      this.w.scenario.lifeSimulation?.deathMonths?.[id] ??
      birth +
        sample(this.w.scenario.seed, `${id}:lifespan:years`, 68, 92) * 12 +
        sample(this.w.scenario.seed, `${id}:lifespan:month`, 0, 11)
    );
  }
  initialize() {
    for (const p of this.w.scenario.people) {
      const current = this.person(p.id),
        birth = p.born * 12,
        id = this.next(),
        home = `home:${p.id}`;
      const l: Life = {
        id: `life:${p.id}`,
        kind: "life",
        owner: p.id,
        birthMonth: birth,
        stage: stageAt(-birth),
        parents: [],
        guardians: [],
        household: home,
        role:
          this.w.scenario.lifeSimulation?.roles?.[p.id] ||
          (sample(this.w.scenario.seed, `${p.id}:reproductive-role`, 0, 1)
            ? "gestational"
            : "contributor"),
        genes: Object.fromEntries(
          Object.keys(p.traits).map((k) => [
            k,
            sample(this.w.scenario.seed, `${p.id}:founder-gene:${k}`, 15, 85),
          ]),
        ),
        naturalDeathAt: this.naturalDeadline(p.id, birth),
        children: 0,
        source: id,
        lastEvent: id,
      };
      this.c.emit(
        "family.founder.registered",
        [{ id: p.id, role: "reference" }],
        [current.lastBy.alive],
        [
          { op: "create", entity: { id: home, kind: "household", source: id } },
          { op: "create", entity: l },
          this.replace(
            this.patch(current, { kin: [...current.kin], lifeStage: l.stage }),
          ),
        ],
        {
          founder: true,
          parentsUnknown: true,
          prehistory: "não simulada; sem memórias fabricadas",
          heredity: "parâmetros fundadores independentes do fenótipo observado",
          birthMonth: birth,
          naturalDeathAt: l.naturalDeathAt,
        },
      );
    }
  }
  private ancestors(id: string, seen = new Set<string>()) {
    if (seen.has(id)) return seen;
    seen.add(id);
    for (const p of this.get(id)?.parents || []) this.ancestors(p, seen);
    return seen;
  }
  private related(a: string, b: string) {
    const x = this.ancestors(a),
      y = this.ancestors(b);
    return [...x].some((id) => y.has(id));
  }
  private link(a: string, b: string) {
    const p = this.person(a);
    return this.replace(this.patch(p, { kin: [...new Set([...p.kin, b])] }));
  }
  private partner(l: Life) {
    const p = this.person(l.owner);
    if (!p.alive || !p.present || l.partner || this.month - l.birthMonth < 216)
      return;
    const candidates = this.all().filter(
      (x) =>
        x.owner !== l.owner &&
        !p.kin.includes(x.owner) &&
        !x.partner &&
        this.person(x.owner).alive &&
        this.person(x.owner).present &&
        this.month - x.birthMonth >= 216 &&
        !this.related(l.owner, x.owner),
    );
    const desire = (a: Person, b: Person) =>
      (a.values.familia > 40 &&
      b.values.familia > 40 &&
      this.get(a.id)!.role !== this.get(b.id)!.role
        ? 30
        : 0) +
      a.values.familia +
      (a.values.amizade || 0) / 2 +
      (a.traits.confianca || 0) / 2 -
      (a.psychology?.stress || 0) / 20 -
      Math.abs(this.get(a.id)!.birthMonth - this.get(b.id)!.birthMonth) / 24;
    const scored = candidates
      .map((x) => ({
        id: x.owner,
        a: desire(p, this.person(x.owner)),
        b: desire(this.person(x.owner), p),
      }))
      .filter((x) => x.a >= 45 && x.b >= 45)
      .sort((a, b) => b.a + b.b - (a.a + a.b) || (a.id < b.id ? -1 : 1));
    if (!scored.length) return;
    const chosen = scored[0],
      q = this.get(chosen.id)!,
      e = this.next();
    this.c.emit(
      "partnership.formed",
      [
        { id: l.owner, role: "actor" },
        { id: q.owner, role: "actor" },
      ],
      [
        l.lastEvent,
        q.lastEvent,
        p.lastBy.values,
        this.person(q.owner).lastBy.values,
      ],
      [
        this.replace({ ...l, partner: q.owner, lastEvent: e }),
        this.replace({
          ...q,
          partner: l.owner,
          household: l.household,
          lastEvent: e,
        }),
        this.link(l.owner, q.owner),
        this.link(q.owner, l.owner),
      ],
      {
        candidates: scored,
        chosen: q.owner,
        threshold: 45,
        consent: "utilidades de ambos acima de permanecer só",
        household: l.household,
      },
    );
  }
  private conceive(l: Life) {
    if (
      l.role !== "gestational" ||
      !l.partner ||
      l.pregnancy ||
      this.w.scenario.lifeSimulation?.blockedConceptions?.includes(l.owner)
    )
      return;
    const q = this.get(l.partner),
      p = this.person(l.owner),
      father = this.person(l.partner);
    if (
      !q ||
      q.role !== "contributor" ||
      !p.alive ||
      !father.alive ||
      !p.present ||
      !father.present
    )
      return;
    const age = this.month - l.birthMonth,
      otherAge = this.month - q.birthMonth;
    if (
      age < 216 ||
      age > 540 ||
      otherAge < 216 ||
      otherAge > 780 ||
      this.related(l.owner, q.owner) ||
      (l.lastPregnancyEnd !== undefined && this.month - l.lastPregnancyEnd < 24)
    )
      return;
    const adjusted =
      this.w.scenario.lifeSimulation?.fertilityPolicy === "replacement-2c";
    const childCost = adjusted ? 30 : 60;
    const desired = Math.max(
      0,
      Math.min(
        adjusted ? 5 : 3,
        Math.round((p.values.familia + father.values.familia) / childCost),
      ),
    );
    const utility =
      p.values.familia +
      father.values.familia -
      l.children * childCost -
      (p.psychology?.stress || 0) / 10 -
      (father.psychology?.stress || 0) / 10;
    if (l.children >= desired || utility < (adjusted ? 15 : 30)) return;
    const key = `${l.owner}:${Math.floor(this.month / 12)}`,
      draw = sample(this.w.scenario.seed, `${key}:conception`, 0, 99);
    if (!(this.w.scenario.lifeSimulation?.conceptionOverride ?? draw < 40))
      return;
    const id = `pregnancy:${key}`,
      source = this.next(),
      risk = 8 + Math.max(0, Math.floor(age / 12) - 35),
      lossDraw = sample(this.w.scenario.seed, `${id}:loss`, 0, 99);
    const g: Pregnancy = {
      id,
      kind: "pregnancy",
      parents: [l.owner, q.owner],
      conceived: this.month,
      due: this.month + 9,
      status: "gestating",
      lossRisk: risk,
      draw: lossDraw,
      source,
      lastEvent: source,
    };
    this.c.emit(
      "pregnancy.conceived",
      [
        { id: l.owner, role: "actor" },
        { id: q.owner, role: "actor" },
      ],
      [l.lastEvent, q.lastEvent, p.lastBy.values, father.lastBy.values],
      [
        { op: "create", entity: g },
        this.replace({ ...l, pregnancy: id, lastEvent: source }),
      ],
      {
        pregnancy: id,
        ...(adjusted
          ? {
              fertilityPolicy: "replacement-2c",
              childCost,
              utilityThreshold: 15,
              preferenceCeiling: 5,
            }
          : {}),
        utility,
        desired,
        draw,
        threshold: 40,
        gestationMonths: 9,
        lossRisk: risk,
        lossDraw,
        assumption: "suposição de design, não verificado",
      },
    );
  }
  private resolve(g: Pregnancy) {
    const mother = this.person(g.parents[0]),
      l = this.get(mother.id)!;
    const lost =
        !mother.alive ||
        (this.w.scenario.lifeSimulation?.lossOverride ?? g.draw < g.lossRisk),
      source = this.next();
    if (lost) {
      const e = this.c.emit(
        "pregnancy.lost",
        g.parents.map((id) => ({ id, role: "reference" })),
        [g.source, ...(!mother.alive && mother.death ? [mother.death] : [])],
        [
          this.replace({ ...g, status: "lost", lastEvent: source }),
          this.replace({
            ...l,
            pregnancy: undefined,
            lastPregnancyEnd: this.month,
            lastEvent: source,
          }),
        ],
        {
          pregnancy: g.id,
          cause: !mother.alive
            ? "morte da gestante"
            : "complicação gestacional agendada",
          countsAsPopulationDeath: false,
        },
      );
      for (const id of g.parents)
        if (
          this.person(id).alive &&
          this.person(id).present &&
          !this.w.scenario.blockedInformation.includes(id)
        ) {
          const notice = this.c.emit(
            "family.loss.perceived",
            [{ id, role: "actor" }],
            [e.id],
            [],
            { pregnancy: g.id, source: e.id },
          );
          this.c.affect(id, notice.id);
        }
      return;
    }
    const fatherLife = this.get(g.parents[1])!,
      father = this.person(g.parents[1]),
      childId = `person:birth:${g.id.slice(10)}`;
    const inheritance: Record<string, unknown> = {},
      genes: Record<string, number> = {},
      traits: Record<string, number> = {};
    for (const k of Object.keys(l.genes)) {
      const maternal = l.genes[k],
        paternal = fatherLife.genes[k],
        segregation = sample(
          this.w.scenario.seed,
          `${childId}:segregation:${k}`,
          -10,
          10,
        ),
        developmentRng = sample(
          this.w.scenario.seed,
          `${childId}:development:${k}`,
          -8,
          8,
        );
      genes[k] = bounded((maternal + paternal) / 2 + segregation);
      traits[k] = bounded(genes[k] + developmentRng);
      inheritance[k] = {
        maternal,
        paternal,
        segregation,
        genetic: genes[k],
        developmentRng,
        experience: 0,
        phenotype: traits[k],
      };
    }
    const guardians = g.parents.filter((id) => this.person(id).alive);
    const child: Person = {
      id: childId,
      kind: "person",
      name: `${names[sample(this.w.scenario.seed, `${childId}:name`, 0, names.length - 1)]} ${Math.floor(this.month / 12)}`,
      born: Math.floor(this.month / 12),
      lifeStage: "child",
      alive: true,
      traits: traits as Person["traits"],
      values: Object.fromEntries(
        Object.keys(mother.values).map((k) => [k, k === "familia" ? 30 : 0]),
      ) as Person["values"],
      skill: 0,
      skills: { lideranca: 0, escrita: 0 },
      medicalSkill: 0,
      psychology: initialPsychology(),
      kin: [...g.parents],
      hostility: 0,
      trainAccess: false,
      canHelp: false,
      present: true,
      escaped: false,
      remorse: 0,
      informed: [],
      lastBy: {},
    };
    child.lastBy = Object.fromEntries(
      Object.keys(child).map((k) => [k, source]),
    );
    const life: Life = {
      id: `life:${childId}`,
      kind: "life",
      owner: childId,
      birthMonth: this.month,
      stage: "child",
      parents: [...g.parents],
      guardians,
      household: l.household,
      role: sample(this.w.scenario.seed, `${childId}:reproductive-role`, 0, 1)
        ? "gestational"
        : "contributor",
      genes,
      naturalDeathAt: this.naturalDeadline(childId, this.month),
      children: 0,
      source,
      lastEvent: source,
    };
    const effects: Effect[] = [
      { op: "create", entity: child },
      { op: "create", entity: life },
      this.replace({ ...g, status: "born", child: childId, lastEvent: source }),
      this.replace({
        ...l,
        children: l.children + 1,
        lastPregnancyEnd: this.month,
        pregnancy: undefined,
        lastEvent: source,
      }),
      this.replace({
        ...fatherLife,
        children: fatherLife.children + 1,
        lastEvent: source,
      }),
      this.link(mother.id, childId),
      this.link(father.id, childId),
    ];
    this.c.emit(
      "person.born",
      [
        { id: childId, role: "reference" },
        ...g.parents.map((id) => ({ id, role: "reference" as const })),
      ],
      [g.source, l.lastEvent, fatherLife.lastEvent],
      effects,
      {
        pregnancy: g.id,
        parents: g.parents,
        guardians,
        birthMonth: this.month,
        inheritance,
        memoriesCreated: 0,
        gestationMonths: this.month - g.conceived,
      },
    );
    this.c.body(childId);
    // Siblings are factual direct links; no invented ancestors or past experiences.
    for (const sib of this.all().filter(
      (x) =>
        x.owner !== childId && x.parents.some((id) => g.parents.includes(id)),
    ))
      this.c.emit(
        "family.siblings.registered",
        [
          { id: childId, role: "reference" },
          { id: sib.owner, role: "reference" },
        ],
        [source, sib.source],
        [this.link(childId, sib.owner), this.link(sib.owner, childId)],
        { sharedParents: g.parents.filter((id) => sib.parents.includes(id)) },
      );
  }
  onDeath(id: string, source: string) {
    const l = this.get(id);
    if (!l) return;
    if (l.partner) {
      const q = this.get(l.partner)!;
      this.c.emit(
        "partnership.ended",
        [
          { id, role: "reference" },
          { id: q.owner, role: "reference" },
        ],
        [source, l.lastEvent, q.lastEvent],
        [
          this.replace({ ...l, partner: undefined, lastEvent: this.next() }),
          this.replace({ ...q, partner: undefined, lastEvent: this.next() }),
        ],
        { cause: "morte", death: source },
      );
    }
    for (const child of this.all().filter(
      (x) =>
        x.guardians.includes(id) &&
        this.person(x.owner).alive &&
        this.month - x.birthMonth < 216,
    ))
      this.custody(child, source);
    const current = this.get(id)!;
    if (current.pregnancy) {
      const pregnancy = this.w.entities[current.pregnancy] as Pregnancy;
      if (pregnancy.status === "gestating") this.resolve(pregnancy);
    }
    this.c.emit(
      "life.ended",
      [{ id, role: "reference" }],
      [source, this.get(id)!.lastEvent],
      [
        this.replace({
          ...this.get(id)!,
          guardians: [],
          lastEvent: this.next(),
        }),
      ],
      { death: source },
    );
  }
  private custody(l: Life, cause: string) {
    const survivors = l.guardians.filter((id) => this.person(id).alive);
    let chosen: string | undefined = survivors[0];
    const candidates = this.all()
      .filter(
        (x) =>
          this.person(x.owner).alive &&
          this.person(x.owner).present &&
          !this.w.scenario.blockedInformation.includes(x.owner) &&
          this.month - x.birthMonth >= 216 &&
          x.owner !== l.owner,
      )
      .map((x) => {
        const p = this.person(x.owner);
        return {
          id: x.owner,
          utility:
            p.values.familia +
            p.traits.compaixao +
            (this.person(l.owner).kin.includes(x.owner) ? 40 : 0) -
            x.children * 20 -
            (p.psychology?.stress || 0) / 20 -
            40,
        };
      })
      .sort((a, b) => b.utility - a.utility || (a.id < b.id ? -1 : 1));
    if (!chosen) chosen = candidates.find((x) => x.utility >= 0)?.id;
    const guardians = survivors.length ? survivors : chosen ? [chosen] : [],
      source = this.next();
    const effects: Effect[] = [
      this.replace({
        ...l,
        guardians,
        household: chosen ? this.get(chosen)!.household : l.household,
        lastEvent: source,
      }),
    ];
    if (chosen && !this.person(l.owner).kin.includes(chosen)) {
      effects.push(this.link(l.owner, chosen), this.link(chosen, l.owner));
    }
    this.c.emit(
      "guardianship.decided",
      [
        { id: l.owner, role: "beneficiary" },
        ...(chosen
          ? [
              {
                id: chosen,
                role: this.w.scenario.blockedInformation.includes(chosen)
                  ? ("reference" as const)
                  : ("actor" as const),
              },
            ]
          : []),
      ],
      [
        cause,
        l.lastEvent,
        ...candidates.map((x) => this.person(x.id).lastBy.values),
      ],
      effects,
      {
        child: l.owner,
        candidates,
        chosen: chosen || null,
        guardians,
        reason: survivors.length
          ? "responsável sobrevivente mantém guarda"
          : chosen
            ? "adulto presente aceita guarda por utilidade"
            : "nenhum adulto elegível aceita; guarda pendente",
        orphan: survivors.length === 0,
      },
    );
  }
  private grow(l: Life) {
    const p = this.person(l.owner),
      age = this.month - l.birthMonth,
      stage = stageAt(age),
      source = this.next();
    const fields: Partial<Person> = { lifeStage: stage };
    const effects: Effect[] = [
      this.replace({
        ...l,
        stage,
        guardians: age >= 216 ? [] : l.guardians,
        lastEvent: source,
      }),
    ];
    if (stage === "adult" && l.stage !== "adult") {
      fields.trainAccess = true;
      fields.canHelp = true;
    }
    if (age < 216) {
      const carers = l.guardians
        .map((id) => this.person(id))
        .filter((p) => p.alive && p.present);
      const observed = carers.length
        ? Math.round(
            carers.reduce((n, p) => n + p.traits.compaixao, 0) / carers.length,
          )
        : 0;
      fields.traits = {
        ...p.traits,
        confianca: bounded(
          (p.traits.confianca || 0) + (carers.length ? 1 : -2),
        ),
      };
      fields.values = {
        ...p.values,
        familia: Math.max(
          -100,
          Math.min(100, p.values.familia + (carers.length ? 1 : -2)),
        ),
      };
      fields.skill = Math.min(
        150,
        p.skill + (age >= 72 && carers.length ? 5 : 0),
      );
      this.c.emit(
        "development.period",
        [{ id: p.id, role: "reference" }],
        [l.lastEvent, ...carers.map((p) => p.lastBy.traits)],
        [this.replace(this.patch(p, fields)), ...effects],
        {
          ageMonths: age,
          periodMonths: 12,
          caregivers: carers.map((p) => p.id),
          observedCompassion: observed,
          experience: { facet: "confianca", delta: carers.length ? 1 : -2 },
          genotypeUnchanged: true,
        },
      );
    } else
      this.c.emit(
        "life.aged",
        [{ id: p.id, role: "reference" }],
        [l.lastEvent],
        [this.replace(this.patch(p, fields)), ...effects],
        { ageMonths: age, stage, periodMonths: 12 },
      );
    this.c.grow(p.id, age, source);
  }
  monthly() {
    for (const entry of this.all()) {
      const l = this.get(entry.owner)!;
      const p = this.person(l.owner);
      if (!p.alive) continue;
      if (
        !l.declineSource &&
        this.month >= Math.min(l.birthMonth + 720, l.naturalDeathAt - 12)
      ) {
        const id = this.next();
        this.c.emit(
          "mortality.condition",
          [{ id: p.id, role: "reference" }],
          [l.lastEvent],
          [this.replace({ ...l, declineSource: id, lastEvent: id })],
          {
            cause: "declínio fisiológico por envelhecimento",
            due: l.naturalDeathAt,
            assumption: "suposição de design, não verificado",
          },
        );
      }
      const current = this.get(p.id)!;
      if (this.month >= current.naturalDeathAt) {
        this.c.die(p.id, current.declineSource || current.lastEvent, {
          cause: "morte natural: declínio fisiológico",
          natural: true,
          weapon: null,
          bodyPart: null,
        });
        continue;
      }
      if (this.month > 0 && (this.month - l.birthMonth) % 12 === 0)
        this.grow(this.get(p.id)!);
    }
    for (const g of Object.values(this.w.entities).filter(
      (e): e is Pregnancy => e.kind === "pregnancy" && e.status === "gestating",
    ))
      if (g.due <= this.month || !this.person(g.parents[0]).alive)
        this.resolve(g);
    if (this.month % 12 === 0) {
      for (const l of this.all()) this.partner(this.get(l.owner)!);
      for (const l of this.all()) {
        const current = this.get(l.owner)!;
        if (this.c.observeConception) {
          const observation = conceptionDiagnostic(this.w, current, this.month);
          if (observation) this.c.observeConception(observation);
        }
      }
      for (const l of this.all()) this.conceive(this.get(l.owner)!);
      for (const l of this.all().filter(
        (x) =>
          this.person(x.owner).alive &&
          this.month - x.birthMonth < 216 &&
          !x.guardians.some((id) => this.person(id).alive),
      ))
        this.custody(l, l.lastEvent);
      this.balance();
    }
  }
  balance() {
    const persons = Object.values(this.w.entities).filter(
      (e): e is Person => e.kind === "person",
    );
    const births = persons.length - this.w.scenario.people.length,
      deaths = persons.filter((p) => !p.alive).length;
    this.c.emit(
      "population.balance",
      [],
      persons.map((p) => p.lastBy.alive),
      [],
      {
        initial: this.w.scenario.people.length,
        births,
        deaths,
        living: persons.length - deaths,
        month: this.month,
      },
    );
  }
}
