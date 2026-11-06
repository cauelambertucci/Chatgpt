import { ageCapacity } from "./life";
/** Suposição de design, não verificado. Fictional contact units and physiology, not DF/medical formulas. */
import { immutable } from "./compact-log";
import { sample } from "./rules";
import type {
  Effect,
  Entity,
  Person,
  Place,
  SliceEvent,
  SliceWorld,
} from "./types";
export type PartKey =
  | "torso"
  | "head"
  | "arm.left"
  | "arm.right"
  | "forearm.left"
  | "forearm.right"
  | "hand.left"
  | "hand.right"
  | "leg.left"
  | "leg.right"
  | "foot.left"
  | "foot.right";
/** Suposição de design, não verificado: independently of pain/nerve function. */
export function vascularRule(
  vessel: "capillary" | "vein" | "artery",
  seed: string,
  key: string,
  minute: number,
) {
  const severity =
    vessel === "capillary"
      ? "light"
      : vessel === "vein"
        ? "moderate"
        : "severe";
  return {
    vessel,
    severity,
    rate: vessel === "capillary" ? 2 : vessel === "vein" ? 6 : 18,
    clotAt:
      vessel === "artery"
        ? null
        : minute +
          sample(
            seed,
            key,
            vessel === "capillary" ? 5 : 40,
            vessel === "capillary" ? 20 : 100,
          ),
  } as const;
}
export interface BodyOptions {
  singleDuel?: {
    attacker: string;
    defender: string;
    caregiver: string;
    month: number;
  };
  care?: boolean;
  blockedInformation?: string[];
  fixture?: boolean;
  maxExchanges?: number;
  missing?: Record<string, PartKey[]>;
  unarmed?: string[];
  armor?: Record<string, "none" | "leather" | "mail">;
  supplies?: { bandages: number; tools: boolean };
  /** Controlled vascular fixture override; never used in free batches. */
  vesselOverride?: Record<string, "capillary" | "vein" | "artery">;
}
export interface Body {
  id: string;
  kind: "body";
  owner: string;
  template: "human-v1";
  blood: number;
  capacity?: number;
  ageCapacity?: number;
  pain: number;
  conscious: boolean;
  minute: number;
  weapon?: {
    id: string;
    template: "blade-v1";
    hand: "left" | "right";
    hands: 1 | 2;
    budget: number;
  };
  armor: "none" | "leather" | "mail";
  lastEvent: string;
}
export interface Part {
  id: string;
  kind: "bodyPart";
  owner: string;
  part: PartKey;
  present: boolean;
  nerve: number;
  bone: number;
  lastEvent: string;
}
export interface Wound {
  id: string;
  kind: "wound";
  owner: string;
  aggressor: string;
  weapon: string;
  part: PartKey;
  source: string;
  lastEvent: string;
  bloodLoss: number;
  duel: string;
  month: number;
  minute: number;
  rate: number;
  clotAt: number | null;
  vessel?: "capillary" | "vein" | "artery";
  severity?: "light" | "moderate" | "severe";
  nerve: boolean;
  fracture: boolean;
  amputation: boolean;
  vital: boolean;
  due: number;
  closed?: number;
  permanent?: boolean;
  care?: string;
  rehabMonths?: number;
}
export interface PhysicalGoal {
  id: string;
  kind: "physicalGoal";
  owner: string;
  source: string;
  lastEvent: string;
  status: "active" | "adapted" | "abandoned";
  requiredHands: 1 | 2;
  minGrip: number;
  practiceMonths?: number;
  description: string;
}
export interface Duel {
  id: string;
  kind: "duel";
  a: string;
  b: string;
  source: string;
  lastEvent: string;
  minuteStart: number;
  started: boolean;
  termination: string;
  outcome: string;
  wounds: string[];
}
export interface Kill {
  id: string;
  kind: "kill";
  recordedAt: string;
  victim: string;
  killer: string | null;
  source: string;
  wound: string;
  weapon: string;
  part: PartKey;
  cause: string;
}
export const anatomy = immutable({
  torso: { parent: null, trajectory: ["skin", "muscle", "rib", "heart"] },
  head: { parent: "torso", trajectory: ["skin", "skull", "brain"] },
  "arm.left": {
    parent: "torso",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "arm.right": {
    parent: "torso",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "forearm.left": {
    parent: "arm.left",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "forearm.right": {
    parent: "arm.right",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "hand.left": {
    parent: "forearm.left",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "hand.right": {
    parent: "forearm.right",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "leg.left": {
    parent: "torso",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "leg.right": {
    parent: "torso",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "foot.left": {
    parent: "leg.left",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
  "foot.right": {
    parent: "leg.right",
    trajectory: ["skin", "muscle", "nerve", "bone"],
  },
} as const);
export const tissues = immutable({
  skin: 8,
  muscle: 30,
  nerve: 12,
  bone: 60,
  rib: 60,
  skull: 80,
  heart: 20,
  brain: 20,
});
export const blade = immutable({
  id: "blade-v1",
  material: "steel",
  massGrams: 1000,
  reachCm: 70,
  contactMm2: 50,
  mode: "cut",
  units: "game-contact-U",
});
const bodyId = (id: string) => `body:${id}`;
const partId = (id: string, key: PartKey) => `part:${id}:${key}`;
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
type Emit = (
  type: string,
  participants: SliceEvent["participants"],
  causes: string[],
  effects?: Effect[],
  data?: Record<string, unknown>,
) => SliceEvent;
export interface BodyContext {
  world: () => SliceWorld;
  month: () => number;
  emit: Emit;
  die: (
    owner: string,
    killer: string | undefined,
    source: string,
    details: Record<string, unknown>,
  ) => void;
  affect: (
    owner: string,
    source: string,
    stimulus: "ameaca" | "perda" | "vitoria",
  ) => void;
}
export class BodySystem {
  constructor(private c: BodyContext) {}
  private get w() {
    return this.c.world();
  }
  private get options() {
    return this.w.scenario.bodySimulation!;
  }
  private person(id: string) {
    return this.w.entities[id] as Person;
  }
  body(id: string) {
    return this.w.entities[bodyId(id)] as Body;
  }
  part(id: string, key: PartKey): Part {
    return (
      (this.w.entities[partId(id, key)] as Part) || {
        id: partId(id, key),
        kind: "bodyPart",
        owner: id,
        part: key,
        present: true,
        nerve: 1,
        bone: 1,
        lastEvent: this.body(id).lastEvent,
      }
    );
  }
  present(id: string, key: PartKey): boolean {
    let next: PartKey | null = key;
    while (next) {
      if (!this.part(id, next).present) return false;
      next = anatomy[next].parent as PartKey | null;
    }
    return true;
  }
  grip(id: string, side: "left" | "right", override?: Part) {
    if (!this.present(id, `hand.${side}`)) return 0;
    return (
      (this.body(id).ageCapacity ?? 1) *
      Math.min(
        ...(
          [`hand.${side}`, `forearm.${side}`, `arm.${side}`] as PartKey[]
        ).map((k) => {
          const p = override?.part === k ? override : this.part(id, k);
          return Math.min(0.4 + 0.6 * p.nerve, p.bone);
        }),
      )
    );
  }
  canStrike(id: string) {
    const b = this.body(id);
    return (
      (!this.person(id).lifeStage ||
        ["adult", "elder"].includes(this.person(id).lifeStage!)) &&
      !!b?.weapon &&
      b.conscious &&
      this.grip(id, b.weapon.hand) >= 0.5 &&
      (b.weapon.hands === 1 ||
        Math.min(this.grip(id, "left"), this.grip(id, "right")) >= 0.8)
    );
  }
  private replace(entity: Entity): Effect {
    return { op: "replace", entity };
  }
  private next() {
    return `event:${this.w.events.length}`;
  }
  grow(id: string, age: number, source: string) {
    const b = this.body(id),
      capacity = Math.round(5000 * ageCapacity(age)),
      p = this.person(id);
    this.c.emit(
      "body.developed",
      [{ id, role: "reference" }],
      [source, b.lastEvent],
      [
        this.replace({
          ...b,
          capacity,
          ageCapacity: ageCapacity(age),
          blood: Math.round((b.blood * capacity) / (b.capacity || 5000)),
          weapon:
            age === 216 && this.present(id, "hand.right") && this.grip(id,"right")>=0.5
              ? b.weapon || {
                  id: `weapon:${id}`,
                  template: "blade-v1",
                  hand: "right",
                  hands: 1,
                  budget: sample(
                    this.w.scenario.seed,
                    `${id}:contact-budget`,
                    65,
                    175,
                  ),
                }
              : age < 216 ? undefined : b.weapon,
          lastEvent: this.next(),
        }),
      ],
      {
        ageMonths: age,
        capacity,
        stage: p.lifeStage,
        preservesBloodFraction: true,
      },
    );
  }
  initialize(personIds?: string[]) {
    const place = this.w.entities["place:void"] as Place;
    const supplies = this.options.supplies || {
      bandages: this.w.scenario.people.length * 2,
      tools: true,
    };
    if (!personIds)
      this.c.emit(
        "medical.stocked",
        [],
        ["event:0"],
        [
          this.replace({
            ...place,
            medical: { ...supplies },
            medicalSource: this.next(),
          }),
        ],
        { supplies },
      );
    for (const p of Object.values(this.w.entities).filter(
      (e): e is Person =>
        e.kind === "person" &&
        (!personIds || personIds.includes(e.id)) &&
        !this.body(e.id),
    )) {
      const source = this.next(),
        b: Body = {
          id: bodyId(p.id),
          kind: "body",
          owner: p.id,
          template: "human-v1",
          blood: this.w.scenario.lifeSimulation
            ? Math.round(
                5000 *
                  ageCapacity(
                    this.c.month() -
                      (this.w.entities[`life:${p.id}`] as any).birthMonth,
                  ),
              )
            : 5000,
          ...(this.w.scenario.lifeSimulation
            ? {
                capacity: Math.round(
                  5000 *
                    ageCapacity(
                      this.c.month() -
                        (this.w.entities[`life:${p.id}`] as any).birthMonth,
                    ),
                ),
                ageCapacity: ageCapacity(
                  this.c.month() -
                    (this.w.entities[`life:${p.id}`] as any).birthMonth,
                ),
              }
            : {}),
          pain: 0,
          conscious: true,
          minute: 0,
          weapon:
            (p.lifeStage && !["adult", "elder"].includes(p.lifeStage)) ||
            this.options.unarmed?.includes(p.id)
              ? undefined
              : {
                  id: `weapon:${p.id}`,
                  template: "blade-v1",
                  hand: "right",
                  hands: 1,
                  budget: this.options.fixture
                    ? 100
                    : sample(
                        this.w.scenario.seed,
                        `${p.id}:contact-budget`,
                        65,
                        175,
                      ),
                },
          armor:
            this.options.armor?.[p.id] ||
            (this.options.fixture
              ? "leather"
              : (["none", "leather", "mail"] as const)[
                  sample(this.w.scenario.seed, `${p.id}:armor`, 0, 2)
                ]),
          lastEvent: source,
        };
      const effects: Effect[] = [{ op: "create", entity: b }];
      for (const key of this.options.missing?.[p.id] || [])
        effects.push({
          op: "create",
          entity: {
            id: partId(p.id, key),
            kind: "bodyPart",
            owner: p.id,
            part: key,
            present: false,
            nerve: 0,
            bone: 0,
            lastEvent: source,
          },
        });
      this.c.emit(
        "body.created",
        [{ id: p.id, role: "actor" }],
        [p.lastBy.alive],
        effects,
        {
          template: "human-v1",
          parts: Object.keys(anatomy),
          sharedCatalog: true,
          assumption: "suposição de design, não verificado",
        },
      );
      this.drop(p.id, source);
    }
  }
  private ensureGoal(p: Person, source: string) {
    const id = `physical:${p.id}`;
    if (this.w.entities[id]) return;
    this.c.emit(
      "physicalGoal.adopted",
      [{ id: p.id, role: "actor" }],
      [source, p.lastBy.traits, p.lastBy.values],
      [
        {
          op: "create",
          entity: {
            id,
            kind: "physicalGoal",
            owner: p.id,
            source: this.next(),
            lastEvent: this.next(),
            status: "active",
            requiredHands: 2,
            minGrip: 0.8,
            description: "Retomar ou manter técnica marcial de duas mãos.",
          },
        },
      ],
      { goal: id },
    );
  }
  reassess(owner: string, source: string) {
    const goal = this.w.entities[`physical:${owner}`] as
      PhysicalGoal | undefined;
    if (!goal || !this.person(owner).alive) return;
    const p = this.person(owner),
      left = this.grip(owner, "left"),
      right = this.grip(owner, "right"),
      viable =
        goal.requiredHands === 2
          ? Math.min(left, right) >= goal.minGrip
          : Math.max(left, right) >= goal.minGrip;
    const utilities = {
      continuar: viable ? 200 : -500,
      adaptar:
        (p.traits.disciplina || 0) +
        (p.traits.esperanca || 0) +
        Math.max(left, right) * 80,
      abandonar: (p.traits.cautela || 0) + (p.psychology?.stress || 0) / 10,
    };
    const chosen = Object.keys(utilities).sort(
      (a, b) =>
        utilities[b as keyof typeof utilities] -
          utilities[a as keyof typeof utilities] || a.localeCompare(b),
    )[0];
    this.c.emit(
      "physicalGoal.reassessed",
      [{ id: owner, role: "actor" }],
      [
        source,
        goal.lastEvent,
        this.body(owner).lastEvent,
        ...(
          [
            "forearm.left",
            "forearm.right",
            "hand.left",
            "hand.right",
          ] as PartKey[]
        ).map((k) => this.part(owner, k).lastEvent),
      ],
      [
        this.replace({
          ...goal,
          status:
            chosen === "abandonar"
              ? "abandoned"
              : chosen === "adaptar"
                ? "adapted"
                : goal.status,
          requiredHands: chosen === "adaptar" ? 1 : goal.requiredHands,
          minGrip: chosen === "adaptar" ? 0.5 : goal.minGrip,
          description:
            chosen === "abandonar"
              ? "Abandonou o objetivo marcial."
              : chosen === "adaptar"
                ? "Aprender técnica compatível com uma mão."
                : goal.description,
          lastEvent: this.next(),
        }),
      ],
      {
        goal: goal.id,
        leftGrip: left,
        rightGrip: right,
        viableBefore: viable,
        utilities,
        chosen,
        knowledgeSource: source,
      },
    );
  }
  private perceive(
    subject: string,
    wound: Wound,
    source: string,
    permanent = false,
    recipient = subject,
    channel = "testemunho",
  ) {
    const p = this.person(recipient);
    if (
      ((this.w.entities[`life:${recipient}`] as any)?.birthMonth !==
        undefined &&
        this.c.month() -
          (this.w.entities[`life:${recipient}`] as any).birthMonth <
          48) ||
      !p?.alive ||
      !p.present ||
      this.options.blockedInformation?.includes(recipient)
    )
      return;
    if (recipient !== subject && !p.kin.includes(subject)) return;
    if (recipient === subject && !this.body(subject).conscious) return;
    const key = `${wound.id}:${permanent ? "permanent" : "acute"}`;
    if (p.knownInjuries?.[key]) return;
    const id = this.next();
    const e = this.c.emit(
      permanent ? "sequela.perceived" : "injury.perceived",
      [
        { id: recipient, role: "actor" },
        { id: subject, role: "reference" },
      ],
      [
        source,
        p.lastBy.present,
        ...(p.lastBy.knownInjuries ? [p.lastBy.knownInjuries] : []),
      ],
      [
        this.replace({
          ...p,
          knownInjuries: { ...p.knownInjuries, [key]: id },
          lastBy: { ...p.lastBy, knownInjuries: id },
        }),
      ],
      { subject, wound: wound.id, permanent, channel },
    );
    this.c.affect(recipient, e.id, permanent ? "perda" : "ameaca");
  }
  private notify(wound: Wound, source: string, permanent = false) {
    for (const p of Object.values(this.w.entities).filter(
      (e): e is Person => e.kind === "person" && e.alive && e.present,
    ))
      this.perceive(wound.owner, wound, source, permanent, p.id);
  }
  private drop(id: string, source: string) {
    const b = this.body(id);
    if (!b.weapon) return;
    const usable =
      this.grip(id, b.weapon.hand) >= 0.5 &&
      (b.weapon.hands === 1 ||
        Math.min(this.grip(id, "left"), this.grip(id, "right")) >= 0.8);
    if (!usable)
      this.c.emit(
        "equipment.dropped",
        [{ id, role: "actor" }],
        [source, b.lastEvent],
        [this.replace({ ...b, weapon: undefined, lastEvent: this.next() })],
        {
          weapon: blade.id,
          reason: "Mão ou conexão sem capacidade necessária.",
        },
      );
  }
  private woundList(owner: string) {
    return Object.values(this.w.entities).filter(
      (e): e is Wound => e.kind === "wound" && e.owner === owner,
    );
  }
  private loseBlood(owner: string, minute: number) {
    const p = this.person(owner),
      b = this.body(owner);
    if (!p.alive || minute <= b.minute) return;
    const active = this.woundList(owner).filter((w) => w.rate > 0);
    if (!active.length) return;
    const losses = active.map((w) => ({
      w,
      loss:
        Math.max(
          0,
          Math.min(minute, w.clotAt ?? minute) - Math.max(b.minute, w.minute),
        ) * w.rate,
    }));
    const loss = Math.round(losses.reduce((s, x) => s + x.loss, 0) * 1e6) / 1e6;
    const blood = Math.max(0, b.blood - loss);
    const source = this.c.emit(
      "blood.interval",
      [{ id: owner, role: "actor" }],
      [b.lastEvent, ...active.map((w) => w.lastEvent)],
      [
        this.replace({
          ...b,
          blood,
          minute,
          conscious: blood > (b.capacity || 5000) * 0.6,
          lastEvent: this.next(),
        }),
        ...losses.map(({ w, loss }) =>
          this.replace({
            ...w,
            bloodLoss: w.bloodLoss + loss,
            rate: w.clotAt !== null && w.clotAt <= minute ? 0 : w.rate,
            lastEvent: this.next(),
          }),
        ),
      ],
      {
        fromMinute: b.minute,
        toMinute: minute,
        loss,
        before: b.blood,
        after: blood,
        clotted: losses
          .filter(({ w }) => w.clotAt !== null && w.clotAt <= minute)
          .map(({ w }) => w.id),
      },
    );
    if (blood <= (b.capacity || 5000) * 0.6) {
      const primary = this.woundList(owner).sort(
        (a, z) => z.bloodLoss - a.bloodLoss || a.id.localeCompare(z.id),
      )[0];
      this.death(primary, source.id, "hemorragia");
    }
  }
  private death(w: Wound, source: string, cause: string) {
    if (!this.person(w.owner).alive) return;
    const e = this.c.emit(
      "body.death",
      [
        { id: w.owner, role: "victim" },
        { id: w.aggressor, role: "reference" },
      ],
      [source, w.source, w.lastEvent],
      [
        this.replace({
          ...this.body(w.owner),
          conscious: false,
          lastEvent: this.next(),
        }),
      ],
      {
        victim: w.owner,
        aggressor: w.aggressor,
        wound: w.id,
        weapon: w.weapon,
        bodyPart: w.part,
        cause,
      },
    );
    this.c.die(w.owner, w.aggressor, e.id, {
      cause,
      weapon: w.weapon,
      bodyPart: w.part,
      wound: w.id,
      abstract: false,
    });
    const physical = this.w.entities[`physical:${w.owner}`];
    if (physical?.kind === "physicalGoal")
      this.c.emit(
        "physicalGoal.closed",
        [{ id: w.owner, role: "reference" }],
        [this.person(w.owner).death!],
        [
          this.replace({
            ...physical,
            status: "abandoned",
            description: "Encerrado pela morte do responsável.",
            lastEvent: this.next(),
          }),
        ],
        { goal: physical.id, reason: "morte" },
      );
    const death = this.person(w.owner).death!;
    const id = `kill:${w.owner}`;
    if (!this.w.entities[id])
      this.c.emit(
        "kill.credited",
        [
          { id: w.aggressor, role: "reference" },
          { id: w.owner, role: "reference" },
        ],
        [death, w.source],
        [
          {
            op: "create",
            entity: {
              id,
              kind: "kill",
              victim: w.owner,
              killer: w.aggressor,
              source: death,
              recordedAt: this.next(),
              wound: w.id,
              weapon: w.weapon,
              part: w.part,
              cause,
            },
          },
        ],
        { victim: w.owner, killer: w.aggressor, primary: true },
      );
  }
  private hit(
    attacker: string,
    defender: string,
    duel: Duel,
    exchange: number,
  ): boolean {
    const a = this.person(attacker),
      d = this.person(defender),
      b = this.body(attacker);
    this.drop(attacker, duel.lastEvent);
    const weapon = this.body(attacker).weapon;
    if (!weapon || !a.alive || !d.alive || !this.body(attacker).conscious)
      return false;
    const minute = duel.minuteStart + exchange;
    const fixture = !!this.options.fixture && exchange === 0;
    const jitterA = fixture
        ? -3
        : sample(
            this.w.scenario.seed,
            `${duel.id}:${exchange}:attack`,
            -12,
            12,
          ),
      jitterD = fixture
        ? 4
        : sample(
            this.w.scenario.seed,
            `${duel.id}:${exchange}:defense`,
            -12,
            12,
          );
    const attack =
      a.skill / 10 +
      20 * this.grip(attacker, weapon.hand) +
      5 +
      jitterA -
      this.body(attacker).pain / 5 -
      exchange * 2;
    const defense =
      d.skill / 10 +
      (this.body(defender).armor === "none" ? 0 : 10) +
      5 +
      jitterD -
      this.body(defender).pain / 6;
    const attempted = this.c.emit(
      "attack.attempted",
      [
        { id: attacker, role: "actor" },
        { id: defender, role: "target" },
      ],
      [
        duel.lastEvent,
        b.lastEvent,
        this.body(defender).lastEvent,
        this.part(attacker, `hand.${weapon.hand}`).lastEvent,
        a.lastBy.skill,
        d.lastBy.skill,
      ],
      [],
      {
        duel: duel.id,
        exchange,
        minute,
        weapon: weapon.id,
        attack,
        defense,
        jitterA,
        jitterD,
        grip: this.grip(attacker, weapon.hand),
        distanceCm: 50,
        reachCm: blade.reachCm,
        material: blade.material,
      },
    );
    if (attack <= defense) {
      this.c.emit(
        "attack.missed",
        [
          { id: attacker, role: "actor" },
          { id: defender, role: "target" },
        ],
        [attempted.id],
        [],
        { duel: duel.id, exchange },
      );
      return true;
    }
    const roll = sample(
      this.w.scenario.seed,
      `${duel.id}:${exchange}:part`,
      0,
      99,
    );
    let key: PartKey = fixture
      ? "forearm.left"
      : roll < 30
        ? "forearm.left"
        : roll < 50
          ? "forearm.right"
          : roll < 70
            ? "leg.left"
            : roll < 90
              ? "torso"
              : "head";
    if (!this.present(defender, key)) key = "torso";
    const armor = this.body(defender).armor,
      coverage = key !== "head";
    const layers: [string, number][] = [
      ...(coverage && armor !== "none"
        ? ([
            ["cloth", 5],
            ["armor", armor === "mail" ? 45 : 15],
          ] as [string, number][])
        : []),
      ...anatomy[key].trajectory.map(
        (t) => [t, tissues[t]] as [string, number],
      ),
    ];
    let remaining = weapon.budget,
      nerve = false,
      fracture = false,
      vital = false;
    const trace = [];
    for (const [layer, resistance] of layers) {
      if (remaining <= 0) break;
      const entering = remaining,
        spent = Math.min(remaining, resistance);
      remaining -= spent;
      trace.push({ layer, resistance, entering, spent, remaining });
      if (layer === "nerve" && spent >= resistance) nerve = true;
      if (["bone", "rib", "skull"].includes(layer) && spent / resistance >= 0.6)
        fracture = true;
      if (["heart", "brain"].includes(layer) && spent >= resistance)
        vital = true;
    }
    const tissueHit = trace.some((t) =>
      [
        "skin",
        "muscle",
        "nerve",
        "bone",
        "rib",
        "skull",
        "heart",
        "brain",
      ].includes(t.layer),
    );
    const contact = this.c.emit(
      "attack.contact",
      [
        { id: attacker, role: "actor" },
        { id: defender, role: "target" },
      ],
      [attempted.id, this.body(defender).lastEvent],
      [],
      {
        duel: duel.id,
        exchange,
        part: key,
        budget: weapon.budget,
        remaining,
        trace,
        assumption: "suposição de design, não verificado",
      },
    );
    if (!tissueHit) return true;
    this.loseBlood(defender, minute);
    if (!this.person(defender).alive) return true;
    const boneCrossed = trace.some(
      (t) => t.layer === "bone" && t.spent >= t.resistance,
    );
    const amputation =
      boneCrossed && nerve && key !== "torso" && key !== "head";
    const part = this.part(defender, key),
      id = `wound:${contact.id}`,
      source = this.next();
    const w: Wound = {
      id,
      kind: "wound",
      owner: defender,
      aggressor: attacker,
      weapon: weapon.id,
      part: key,
      source,
      lastEvent: source,
      bloodLoss: 0,
      duel: duel.id,
      month: this.c.month(),
      minute,
      ...vascularRule(
        this.options.vesselOverride?.[defender] ||
          (amputation ||
          trace.some((t) => ["heart", "brain"].includes(t.layer) && t.spent > 0)
            ? "artery"
            : trace.some((t) => t.layer === "muscle" && t.spent >= t.resistance)
              ? "vein"
              : "capillary"),
        this.w.scenario.seed,
        `${duel.id}:${exchange}:clot`,
        minute,
      ),
      nerve,
      fracture,
      amputation,
      vital,
      due: this.c.month() + (nerve || fracture || amputation ? 6 : 2),
    };
    const partState: Part = {
      ...part,
      present: !amputation,
      nerve: nerve ? 0 : part.nerve,
      bone: fracture ? 0.3 : part.bone,
      lastEvent: source,
    };
    const body = this.body(defender);
    this.c.emit(
      "wound.created",
      [
        { id: defender, role: "victim" },
        { id: attacker, role: "reference" },
      ],
      [contact.id, part.lastEvent],
      [
        { op: "create", entity: w },
        {
          op: this.w.entities[part.id] ? "replace" : "create",
          entity: partState,
        },
        this.replace({
          ...body,
          pain: Math.min(100, body.pain + (nerve ? 35 : fracture ? 30 : 12)),
          conscious: body.conscious && !vital,
          lastEvent: source,
        }),
      ],
      {
        duel: duel.id,
        wound: id,
        part: key,
        nerve,
        fracture,
        amputation,
        vital,
        minute,
        vessel: w.vessel,
        severity: w.severity,
        rate: w.rate,
        clotAt: w.clotAt,
        assumption: "suposição de design, não verificado",
      },
    );
    this.notify(w, source);
    this.drop(defender, source);
    if (vital) this.death(w, source, "estrutura vital destruída");
    return true;
  }
  private stabilize(owner: string, caregiver: string, combatEnd: number) {
    let p = this.person(owner);
    if (!p.alive) return;
    let wounds = this.woundList(owner).filter((w) => w.rate > 0);
    if (!wounds.length) return;
    const first = Math.min(...wounds.map((w) => w.minute)),
      start = Math.max(first + 5, combatEnd, this.body(caregiver)?.minute || 0);
    this.loseBlood(owner, start);
    if (!this.person(owner).alive) return;
    wounds = this.woundList(owner).filter((w) => w.rate > 0);
    if (!wounds.length) return;
    const h = this.person(caregiver),
      medical =
        h?.medicalSkill ??
        sample(this.w.scenario.seed, `${caregiver}:medicine`, 25, 95);
    const willingness = h
      ? (h.traits.compaixao || 0) +
        (h.values.solidariedade || 0) +
        (h.canHelp ? 80 : 0)
      : 0;
    const consent = p.values.paz + p.traits.cautela + this.body(owner).pain;
    const accepted =
      this.options.care !== false &&
      h?.alive &&
      h.present &&
      h.id !== owner &&
      h.canHelp &&
      willingness >= 60 &&
      consent >= 0 &&
      this.body(h.id).conscious &&
      Math.max(this.grip(h.id, "left"), this.grip(h.id, "right")) >= 0.5 &&
      ((this.w.entities["place:void"] as Place).medical?.bandages || 0) >=
        wounds.length;
    const request = this.c.emit(
      "care.requested",
      [
        { id: owner, role: "actor" },
        ...(h ? [{ id: h.id, role: "reference" as const }] : []),
      ],
      [
        this.body(owner).lastEvent,
        ...wounds.map((w) => w.lastEvent),
        ...(h
          ? [
              h.lastBy.traits,
              h.lastBy.values,
              h.lastBy.canHelp,
              h.lastBy.present,
              h.lastBy.medicalSkill || "event:1",
              this.body(h.id).lastEvent,
            ]
          : []),
        (this.w.entities["place:void"] as Place).medicalSource!,
      ],
      [],
      { medical, willingness, consent, accepted, minute: start },
    );
    if (accepted) {
      const source = this.next();
      const stock = this.w.entities["place:void"] as Place;
      this.c.emit(
        "care.compression",
        [
          { id: h.id, role: "actor" },
          { id: owner, role: "beneficiary" },
        ],
        [request.id],
        wounds
          .map((w) => {
            const current = this.w.entities[w.id] as Wound;
            return this.replace({
              ...current,
              rate: Math.round(current.rate * 0.2 * 1e6) / 1e6,
              care: source,
              lastEvent: source,
            });
          })
          .concat([
            this.replace({
              ...this.body(h.id),
              minute: start,
              lastEvent: source,
            }),
            this.replace({
              ...stock,
              medical: {
                ...stock.medical!,
                bandages: stock.medical!.bandages - wounds.length,
              },
              medicalSource: source,
            }),
          ]),
        { minute: start, medical, material: "atadura", reduction: 0.2 },
      );
      const end = start + 10;
      this.loseBlood(owner, end);
      if (
        this.person(owner).alive &&
        medical >= 60 &&
        (this.w.entities["place:void"] as Place).medical?.tools
      ) {
        const stop = this.next();
        this.c.emit(
          "care.controlled",
          [
            { id: h.id, role: "actor" },
            { id: owner, role: "beneficiary" },
          ],
          [source, this.body(owner).lastEvent],
          wounds
            .map((w) =>
              this.replace({
                ...(this.w.entities[w.id] as Wound),
                rate: 0,
                care: stop,
                lastEvent: stop,
              }),
            )
            .concat([
              this.replace({
                ...this.body(h.id),
                minute: end,
                lastEvent: stop,
              }),
            ]),
          { minute: end, medical, material: "atadura e instrumental" },
        );
      }
    }
    if (!this.person(owner).alive) return;
    const active = this.woundList(owner).filter((w) => w.rate > 0);
    if (!active.length) return;
    // Jump only to physical boundaries; no daily or per-minute idle events.
    let time = this.body(owner).minute;
    for (
      let boundary = 0;
      boundary < active.length + 2 && this.person(owner).alive;
      boundary++
    ) {
      const current = this.woundList(owner).filter(
        (w) => w.rate > 0 && (w.clotAt === null || w.clotAt > time),
      );
      if (!current.length) break;
      const rate = current.reduce((s, w) => s + w.rate, 0),
        clot = Math.min(...current.map((w) => w.clotAt ?? Infinity));
      const deathAt =
        time +
        Math.ceil(
          (this.body(owner).blood - (this.body(owner).capacity || 5000) * 0.6) /
            rate /
            5,
        ) *
          5;
      const next = Math.min(clot, deathAt);
      this.loseBlood(owner, next);
      time = next;
      if (!Number.isFinite(next)) throw Error("Invalid physiological deadline");
    }
    if (this.person(owner).alive) {
      const settled = this.next();
      this.c.emit(
        "blood.stabilized",
        [{ id: owner, role: "actor" }],
        [this.body(owner).lastEvent],
        this.woundList(owner)
          .filter((w) => w.rate > 0)
          .map((w) => this.replace({ ...w, rate: 0, lastEvent: settled })),
        { minute: time, reason: "Coagulação em feridas elegíveis." },
      );
    }
  }
  private exitChoice(
    duel: Duel,
    source: string,
    minute: number,
  ): string | undefined {
    const fighters = [duel.a, duel.b].sort(
      (a, b) => this.body(b).pain - this.body(a).pain || (a < b ? -1 : 1),
    );
    const third = Object.values(this.w.entities)
      .filter(
        (e): e is Person =>
          e.kind === "person" &&
          !fighters.includes(e.id) &&
          (!e.lifeStage || ["adult","elder"].includes(e.lifeStage)) &&
          e.alive &&
          e.present &&
          !this.options.blockedInformation?.includes(e.id) &&
          this.body(e.id)?.conscious,
      )
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const id of [...fighters, ...third.map((p) => p.id)]) {
      const p = this.person(id),
        body = this.body(id),
        outsider = !fighters.includes(id);
      const stress = p.psychology?.stress || 0,
        pain = body.pain;
      const visibleWounds = Object.values(this.w.entities).filter(
        (w): w is Wound =>
          w.kind === "wound" &&
          fighters.includes(w.owner) &&
          w.owner !== id &&
          !this.options.blockedInformation?.includes(id) &&
          w.duel === duel.id,
      );
      const visibleDanger = visibleWounds.reduce(
        (n, w) =>
          n +
          (w.severity === "severe" ? 60 : w.severity === "moderate" ? 30 : 10),
        0,
      );
      const observed = this.c.emit(
        "duel.observed",
        [{ id, role: "actor" }],
        [source, p.lastBy.present, ...visibleWounds.map((w) => w.source)],
        [],
        {
          duel: duel.id,
          minute,
          visibleWounds: visibleWounds.map((w) => w.id),
          visibleDanger,
          channel: "testemunho",
        },
      );
      source = observed.id;
      const mobile = ["leg.left", "leg.right", "foot.left", "foot.right"].every(
        (k) =>
          this.present(id, k as PartKey) &&
          this.part(id, k as PartKey).bone >= 0.5 &&
          this.part(id, k as PartKey).nerve >= 0.5,
      );
      const loss = (body.capacity || 5000) - body.blood;
      const utilities: Record<string, number> = outsider
        ? {
            observar:
              100 +
              p.traits.cautela +
              Math.max(...fighters.map((x) => (this.body(x).weapon ? 50 : 0))) -
              p.traits.coragem,
            interromper:
              p.traits.compaixao +
              (p.values.solidariedade || 0) / 2 +
              p.values.paz / 2 +
              visibleDanger +
              stress / 10,
          }
        : {
            continuar:
              p.hostility +
              p.traits.coragem +
              p.traits.orgulho +
              p.traits.agressividade / 2 -
              stress / 5 -
              pain -
              loss / 20,
            render:
              p.traits.cautela +
              stress / 4 +
              pain +
              loss / 15 -
              p.traits.orgulho / 2,
            fugir:
              p.traits.cautela +
              stress / 5 +
              pain +
              20 -
              p.traits.coragem / 2 -
              (p.values.honra || 0) / 3,
            interromper:
              p.traits.compaixao +
              p.values.paz +
              visibleDanger * 1.2 -
              p.hostility / 2 +
              stress / 10,
          };
      const eligible = Object.keys(utilities).filter(
        (k) => k !== "fugir" || mobile,
      );
      const chosen = eligible.sort(
        (a, b) => utilities[b] - utilities[a] || (a < b ? -1 : 1),
      )[0];
      const stopped = !["continuar", "observar"].includes(chosen);
      const role = outsider
        ? "terceiro"
        : id === duel.a
          ? "agressor"
          : "desafiado";
      const reason =
        chosen === "render"
          ? "rendição"
          : chosen === "fugir"
            ? "fuga"
            : `interrupção por ${role}`;
      const e = this.c.emit(
        "duel.choice",
        [
          { id, role: "actor" },
          ...fighters
            .filter((x) => x !== id)
            .map((id) => ({ id, role: "reference" as const })),
        ],
        [
          source,
          body.lastEvent,
          p.lastBy.psychology,
          p.lastBy.traits,
          p.lastBy.values,
          p.lastBy.present,
          ...fighters.map((x) => this.body(x).lastEvent),
        ],
        [],
        {
          duel: duel.id,
          minute,
          role,
          injured: pain > 0,
          stress,
          pain,
          visibleDanger,
          bloodLoss: loss,
          mobile,
          utilities,
          eligible,
          chosen,
          stopped,
          reason: stopped
            ? reason
            : "utilidade de continuar/observar predominou",
          convention:
            "rendição/interrupção encerram o duelo consentido; perseguição fora desta fatia",
        },
      );
      source = e.id;
      if (stopped) return reason;
    }
  }
  duel(
    attacker: string,
    defender: string,
    causes: string[],
    caregiver = this.w.scenario.helper,
  ) {
    const a = this.person(attacker),
      b = this.person(defender);
    if (
      !a.alive ||
      !b.alive ||
      !a.present ||
      !b.present ||
      [a, b].some(
        (p) => p.lifeStage && !["adult", "elder"].includes(p.lifeStage),
      )
    )
      return;
    const ordinal = Object.values(this.w.entities).filter(
      (e) => e.kind === "duel" && e.a === attacker && e.b === defender,
    ).length;
    const id = `duel:${attacker}:${defender}:${this.c.month()}:${ordinal}`,
      source = this.next();
    const initiating =
      a.hostility +
      a.traits.coragem +
      (a.traits.orgulho || 0) -
      a.values.paz / 2 -
      a.traits.cautela / 2;
    const accepting =
      b.traits.coragem +
      (b.traits.orgulho || 0) +
      (b.values.honra || 0) / 2 -
      b.traits.cautela -
      b.values.paz / 4;
    const eligible =
      !!this.body(attacker).weapon &&
      this.grip(attacker, this.body(attacker).weapon!.hand) >= 0.5;
    const started =
      eligible &&
      (this.options.fixture || (initiating >= 75 && accepting >= 30));
    const minuteStart = Math.max(
      this.c.month() * 43200,
      this.body(attacker).minute,
      this.body(defender).minute,
      this.body(caregiver)?.minute || 0,
    );
    const duel: Duel = {
      id,
      kind: "duel",
      a: attacker,
      b: defender,
      source,
      lastEvent: source,
      minuteStart,
      started: !!started,
      termination: started ? "em curso" : eligible ? "recusa" : "inelegível",
      outcome: started ? "em curso" : "sem duelo",
      wounds: [],
    };
    this.c.emit(
      "duel.agreed",
      [
        { id: attacker, role: "actor" },
        { id: defender, role: "target" },
      ],
      [
        ...causes,
        this.body(attacker).lastEvent,
        this.body(defender).lastEvent,
        this.body(caregiver)?.lastEvent || "event:1",
        a.lastBy.traits,
        a.lastBy.values,
        b.lastBy.traits,
        b.lastBy.values,
      ],
      [{ op: "create", entity: duel }],
      {
        duel: id,
        initiating,
        accepting,
        eligible,
        started,
        utilities: {
          iniciar: initiating - 75,
          esperar: 0,
          aceitar: accepting - 30,
          recusar: 0,
        },
        fixture: !!this.options.fixture,
      },
    );
    if (!started) return;
    this.ensureGoal(a, source);
    this.ensureGoal(b, source);
    let reason = "limite de trocas",
      lastMinute = minuteStart;
    const steps: string[] = [];
    for (
      let exchange = 0;
      exchange < (this.options.maxExchanges ?? 6);
      exchange++
    ) {
      const actor = exchange % 2 ? defender : attacker,
        target = exchange % 2 ? attacker : defender;
      lastMinute = minuteStart + exchange;
      if (!this.person(actor).alive || !this.person(target).alive) {
        reason = "morte";
        break;
      }
      if (
        !this.hit(
          actor,
          target,
          { ...duel, lastEvent: steps.at(-1) || source },
          exchange,
        )
      ) {
        reason = "incapacidade ou arma ausente";
        break;
      }
      steps.push(`event:${this.w.events.length - 1}`);
      // The numerical one-contact fixture isolates physiology, not social choices.
      if (
        !this.options.fixture &&
        this.person(attacker).alive &&
        this.person(defender).alive
      ) {
        const stop = this.exitChoice(duel, steps.at(-1)!, lastMinute);
        steps.push(`event:${this.w.events.length - 1}`);
        if (stop) {
          reason = stop;
          break;
        }
      }
    }
    if (!this.person(attacker).alive || !this.person(defender).alive)
      reason = "morte durante o duelo";
    this.stabilize(attacker, caregiver, lastMinute);
    this.stabilize(defender, caregiver, lastMinute);
    const wounds = Object.values(this.w.entities)
      .filter((e): e is Wound => e.kind === "wound" && e.duel === id)
      .map((w) => w.id);
    this.c.emit(
      "duel.ended",
      [
        { id: attacker, role: "reference" },
        { id: defender, role: "reference" },
      ],
      [
        source,
        ...steps,
        this.person(attacker).lastBy.alive,
        this.person(defender).lastBy.alive,
        this.body(attacker).lastEvent,
        this.body(defender).lastEvent,
        ...wounds.map((w) => (this.w.entities[w] as Wound).lastEvent),
      ],
      [
        this.replace({
          ...duel,
          wounds,
          termination: reason,
          lastEvent: this.next(),
        }),
        ...[attacker, defender].map((id) =>
          this.replace({
            ...this.body(id),
            minute: Math.max(
              lastMinute,
              this.body(attacker).minute,
              this.body(defender).minute,
            ),
            lastEvent: this.next(),
          }),
        ),
      ],
      { duel: id, termination: reason, minute: lastMinute },
    );
    this.summary(id);
  }
  private summary(id: string) {
    const d = this.w.entities[id] as Duel,
      a = this.person(d.a),
      b = this.person(d.b);
    const wounds = d.wounds.map((id) => this.w.entities[id] as Wound);
    const credits = [
      this.w.entities[`kill:${d.a}`],
      this.w.entities[`kill:${d.b}`],
    ].filter(
      (e): e is Kill =>
        e?.kind === "kill" && (this.w.entities[e.wound] as Wound).duel === d.id,
    );
    const killedA = credits.some((k) => k.victim === d.a),
      killedB = credits.some((k) => k.victim === d.b);
    const interrupted = wounds.some(
      (w) =>
        !this.person(w.owner).alive &&
        !credits.some((k) => k.victim === w.owner),
    );
    const outcome = !d.started
      ? "sem duelo"
      : killedA && killedB
        ? "morte de ambos"
        : killedA
          ? "morte do desafiante"
          : killedB
            ? "morte do desafiado"
            : interrupted
              ? "evolução interrompida por morte externa"
              : !wounds.length
                ? "sem ferimento"
                : wounds.some((w) => w.permanent)
                  ? "sequela permanente"
                  : wounds.every((w) => w.closed !== undefined)
                    ? "recuperação"
                    : "ferimento em recuperação";
    if (outcome === d.outcome) return;
    this.c.emit(
      "duel.summary",
      [
        { id: d.a, role: "reference" },
        { id: d.b, role: "reference" },
      ],
      [
        d.lastEvent,
        a.lastBy.alive,
        b.lastBy.alive,
        ...credits.map((k) => k.recordedAt),
        ...wounds.map((w) => w.lastEvent),
      ],
      [this.replace({ ...d, outcome, lastEvent: this.next() })],
      { duel: id, outcome },
    );
  }
  monthly() {
    const due = Object.values(this.w.entities).filter(
      (e): e is Wound =>
        e.kind === "wound" &&
        e.closed === undefined &&
        e.due <= this.c.month() &&
        this.person(e.owner).alive,
    );
    for (const wound of due) {
      const part = this.part(wound.owner, wound.part),
        source = this.next();
      const permanent = wound.nerve || wound.amputation || wound.fracture;
      const nextPart = {
        ...part,
        nerve: !part.present
          ? 0
          : wound.nerve
            ? wound.care && (wound.rehabMonths || 0) >= 3
              ? 0.5
              : 0
            : part.nerve,
        bone: !part.present
          ? 0
          : wound.fracture
            ? wound.care
              ? 0.8
              : 0.6
            : part.bone,
        lastEvent: source,
      };
      const w = {
        ...wound,
        permanent,
        closed: this.c.month(),
        lastEvent: source,
      };
      this.c.emit(
        permanent ? "sequela.confirmed" : "wound.healed",
        [{ id: w.owner, role: "actor" }],
        [wound.lastEvent, wound.source, part.lastEvent],
        [
          this.replace(w),
          this.replace(nextPart),
          this.replace({ ...this.body(w.owner), pain: 0, lastEvent: source }),
        ],
        {
          wound: w.id,
          permanent,
          gripLeftBefore: this.grip(w.owner, "left"),
          gripLeftAfter: this.grip(w.owner, "left", nextPart),
          care: wound.care || null,
          rehabMonths: wound.rehabMonths || 0,
        },
      );
      this.notify(w, source, permanent);
      this.summary(w.duel);
    }
    for (const g of Object.values(this.w.entities).filter(
      (e): e is PhysicalGoal =>
        e.kind === "physicalGoal" && e.status === "adapted",
    )) {
      const p = this.person(g.owner);
      if (!p.alive || !p.present) continue;
      const wounds = this.woundList(p.id).filter(
        (w) => w.closed === undefined && !!w.care && (w.nerve || w.fracture),
      );
      if (!wounds.length) continue;
      const practice =
        p.traits.disciplina +
        (p.traits.esperanca || 0) +
        Math.max(this.grip(p.id, "left"), this.grip(p.id, "right")) * 80;
      const rest =
        this.body(p.id).pain +
        p.traits.cautela +
        (p.psychology?.stress || 0) / 10;
      if (practice < rest) continue;
      const id = this.next();
      this.c.emit(
        "rehabilitation.period",
        [{ id: p.id, role: "actor" }],
        [
          g.lastEvent,
          p.lastBy.traits,
          p.lastBy.psychology,
          this.body(p.id).lastEvent,
          ...wounds.map((w) => w.lastEvent),
        ],
        [
          this.replace({
            ...g,
            practiceMonths: (g.practiceMonths || 0) + 1,
            lastEvent: id,
          }),
          ...wounds.map((w) =>
            this.replace({
              ...w,
              rehabMonths: (w.rehabMonths || 0) + 1,
              lastEvent: id,
            }),
          ),
        ],
        {
          goal: g.id,
          owner: p.id,
          action: "reabilitar",
          periodMonths: 1,
          practice,
          rest,
          knowledge: g.source,
        },
      );
    }
    // Public news needs a living co-present witness who already knows this exact fact.
    for (const wound of Object.values(this.w.entities).filter(
      (e): e is Wound => e.kind === "wound",
    ))
      for (const permanent of [false, true]) {
        if (permanent && !wound.permanent) continue;
        const key = `${wound.id}:${permanent ? "permanent" : "acute"}`;
        const family = [
          ...new Set([wound.owner, ...this.person(wound.owner).kin]),
        ].sort();
        const sender = family
          .map((id) => this.person(id))
          .find((p) => p.alive && p.present && !!p.knownInjuries?.[key]);
        if (!sender) continue;
        for (const p of this.person(wound.owner)
          .kin.map((id) => this.person(id))
          .filter(
            (p) =>
              p.alive &&
              p.present &&
              !p.knownInjuries?.[key] &&
              !this.options.blockedInformation?.includes(p.id),
          )) {
          const news = this.c.emit(
            "injury.news",
            [
              { id: sender.id, role: "actor" },
              { id: p.id, role: "beneficiary" },
            ],
            [sender.knownInjuries![key], wound.lastEvent],
            [],
            { wound: wound.id, recipient: p.id, sender: sender.id, permanent },
          );
          this.perceive(wound.owner, wound, news.id, permanent, p.id, "relato");
        }
      }
  }
}
