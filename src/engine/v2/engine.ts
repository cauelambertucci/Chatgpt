import {experienceParticipants} from "./writing";
import { DailySystem, domainSeed } from "./daily";
import { firstUnknownRecipient } from "./information";
import type { ConceptionDiagnostic } from "./demography";
import { LifeSystem } from "./life";
import { BodySystem } from "./body";
import { CompactLog, type CompactWorld } from "./compact-log";
import {
  appraise,
  knowsExpectedLoss,
  bounded,
  initialPsychology,
  type Stimulus,
} from "./emotions";
import { personalityFactors } from "../../data/v2/personality";
import { estimateProtection, type ProtectionAction } from "./protection";
import type {
  Action,
  Candidate,
  Decision,
  Effect,
  Entity,
  Goal,
  Memory,
  Person,
  Reaction,
  Scenario,
  SliceEvent,
  SliceWorld,
  Outcome,
  PersonalGoal,
  Place,
  Work,
} from "./types";
import { memoryWeight, noise, rules, sample } from "./rules";
import { presentAt } from "./scenario";
// All persisted state is canonical JSON: no undefined properties or negative zero.
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
function freeze<T>(x: T): T {
  if (x && typeof x === "object" && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const child of Object.values(x)) freeze(child);
  }
  return x;
}
export function applyEvent(entities: Record<string, Entity>, e: SliceEvent) {
  for (const effect of e.effects) {
    const id = effect.entity.id;
    if (effect.op === "create" && entities[id])
      throw Error(`Duplicate entity ${id}`);
    if (effect.op === "replace" && !entities[id])
      throw Error(`Unknown entity ${id}`);
    entities[id] = clone(effect.entity);
  }
}
export function replay(events: readonly SliceEvent[]): Record<string, Entity> {
  const entities: Record<string, Entity> = {};
  for (const e of events) applyEvent(entities, e);
  return entities;
}
export const people = (w: SliceWorld) =>
  Object.values(w.entities)
    .filter((e): e is Person => e.kind === "person")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
export const goals = (w: SliceWorld) =>
  Object.values(w.entities).filter((e): e is Goal => e.kind === "goal");
export const getPerson = (w: SliceWorld, id: string) => {
  const p = w.entities[id];
  if (!p || p.kind !== "person") throw Error(`Not a person: ${id}`);
  return p;
};
export const getGoal = (w: SliceWorld, p: Person) =>
  p.goal ? (w.entities[p.goal] as Goal) : undefined;
export function effectiveMemory(w: SliceWorld, p: Person, month: number) {
  const m = p.memory ? (w.entities[p.memory] as Memory) : undefined;
  return m ? memoryWeight(m.weight, m.rancor, month - m.at) : 0;
}
function changed(p: Person, patch: Partial<Person>, id: string): Person {
  return {
    ...p,
    ...patch,
    lastBy: {
      ...p.lastBy,
      ...Object.fromEntries(Object.keys(patch).map((k) => [k, id])),
    },
  };
}
const gReason = (g: PersonalGoal, id: string) =>
  g.owner === id ? "O responsável morreu." : "A pessoa-alvo morreu.";
export class SliceSimulation {
  private state: SliceWorld;
  private log?: CompactLog;
  private anatomy?: BodySystem;
  private life?: LifeSystem;
  private daily?: DailySystem;
  private attachDaily(initialize=false){
    if(!this.state.scenario.dailyLife)return;
    this.daily=new DailySystem({die:(id,source)=>{const body=this.anatomy!.body(id);const e=this.emit("hunger.death",[{id,role:"reference"}],[source,body.lastEvent],[{op:"replace",entity:{...body,conscious:false,weapon:undefined,lastEvent:this.nextId()}}],{cause:"inanição prolongada"});this.die(getPerson(this.state,id),undefined,e.id,{cause:"inanição prolongada",natural:false});},world:()=>this.state,month:()=>this.month,body:()=>this.anatomy!,emit:(...args)=>this.emit(...args)});
    if(initialize)this.daily.initialize();
  }
  private observeConception?: (observation: ConceptionDiagnostic) => void;
  private attachLife(initialize = false) {
    if (!this.state.scenario.lifeSimulation) return;
    this.life = new LifeSystem({
      observeConception: this.observeConception,
      world: () => this.state,
      month: () => this.month,
      emit: (...args) => this.emit(...args),
      body: (id) => this.anatomy!.initialize([id]),
      grow: (id, age, source) => this.anatomy!.grow(id, age, source),
      affect: (id, source) =>
        this.feel(
          getPerson(this.state, id),
          this.state.events[Number(source.slice(6))],
          "perda",
        ),
      die: (id, source, details) => {
        const body = this.anatomy!.body(id);
        const e = this.emit(
          "natural.death",
          [{ id, role: "reference" }],
          [source, body.lastEvent],
          [
            {
              op: "replace",
              entity: {
                ...body,
                conscious: false,
                weapon: undefined,
                lastEvent: this.nextId(),
              },
            },
          ],
          details,
        );
        this.die(getPerson(this.state, id), undefined, e.id, details);
        this.drain();
      },
    });
    if (initialize) this.life.initialize();
  }
  private attachBody(initialize = false) {
    if (!this.state.scenario.bodySimulation) return;
    this.anatomy = new BodySystem({
      caregiver: (owner,fallback,source)=>this.daily?.caregiver(owner,fallback,source) ?? fallback,
      world: () => this.state,
      month: () => this.month,
      emit: (...args) => this.emit(...args),
      die: (owner, killer, source, details) => {
        this.die(getPerson(this.state, owner), killer, source, details);
        this.drain();
      },
      affect: (recipient, source, stimulus) => {
        const p = getPerson(this.state, recipient);
        if (p.alive)
          this.feel(p, this.state.events[Number(source.slice(6))], stimulus);
      },
    });
    if (initialize) this.anatomy.initialize();
  }
  private legacySnapshot(): SliceWorld {
    return clone({
      ...this.state,
      events: this.log ? this.log.materialize() : this.state.events,
    });
  }
  runCompact(untilMonth = this.state.scenario.months): CompactWorld {
    this.advance(untilMonth);
    if (!this.log) throw Error("Compact output requires compact storage");
    return freeze({
      version: 3,
      engine: this.state.engine,
      scenario: clone(this.state.scenario),
      entities: clone(this.state.entities),
      log: this.log.snapshot(),
      nextMonth: this.state.nextMonth,
      complete: this.state.complete,
    });
  }
  get world(): SliceWorld {
    return freeze(this.legacySnapshot());
  }
  private month = 0;
  private queue: Reaction[] = [];
  private delivered = new Set<string>();
  private reactedThisMonth = new Set<string>();
  constructor(
    scenario: Scenario,
    restored?: SliceWorld | CompactWorld,
    options: {
      storage?: "compact" | "legacy";
      observeConception?: (observation: ConceptionDiagnostic) => void;
    } = {},
  ) {
    this.observeConception = options.observeConception;
    if (restored) {
      const expected = restored.scenario.dailyLife ? (restored.scenario.dailyLife.economy ? "agents-slice-2d2-writing2" : "agents-slice-2d1-writing2") : restored.scenario.lifeSimulation
        ? restored.scenario.lifeSimulation.fertilityPolicy
          ? "agents-slice-2c"
          : "agents-slice-2b"
        : restored.scenario.bodySimulation
          ? "agents-slice-2.1"
          : restored.scenario.emotionalDynamics
            ? "agents-slice-1d"
            : restored.scenario.advancedObjectives
              ? "agents-slice-1c"
              : restored.scenario.personalObjectives
                ? "agents-slice-protection2"
                : "agents-slice-1a";
      if (!restored.complete && restored.engine !== expected)
        throw Error(
          "Versão incompatível para continuar; histórico anterior disponível somente para leitura.",
        );
      if (restored.version === 3) {
        this.state = {
          version: 2,
          engine: restored.engine,
          scenario: clone(restored.scenario),
          entities: clone(restored.entities),
          events: [],
          nextMonth: restored.nextMonth,
          complete: restored.complete,
        };
        this.log = CompactLog.from(restored.log);
        this.state.events = this.log.view();
      } else {
        this.state = clone(restored);
        if (options.storage !== "legacy") {
          this.log = new CompactLog();
          const prior: Record<string, Entity> = {};
          for (const e of this.state.events) {
            this.log.append(this.log.encodeEvent(e, prior));
            applyEvent(prior, e);
          }
          this.state.events = this.log.view();
        } else this.state.events = this.state.events.map(freeze);
      }
      this.month = this.state.nextMonth;
      this.attachBody();
      this.attachLife();
      this.attachDaily();
      return;
    }
    if (
      scenario.months < 1 ||
      scenario.months > (scenario.lifeSimulation ? 1200 : 240)
    )
      throw Error("Horizon must be 1–240 months");
    this.state = {
      version: 2,
      engine: scenario.dailyLife ? (scenario.dailyLife.economy ? "agents-slice-2d2-writing2" : "agents-slice-2d1-writing2") : scenario.lifeSimulation
        ? scenario.lifeSimulation.fertilityPolicy
          ? "agents-slice-2c"
          : "agents-slice-2b"
        : scenario.bodySimulation
          ? "agents-slice-2.1"
          : scenario.emotionalDynamics
            ? "agents-slice-1d"
            : scenario.advancedObjectives
              ? "agents-slice-1c"
              : scenario.personalObjectives
                ? "agents-slice-protection2"
                : "agents-slice-1a",
      scenario: clone(scenario),
      events: [],
      entities: {},
      nextMonth: 0,
      complete: false,
    };
    if (options.storage !== "legacy") {
      this.log = new CompactLog();
      this.state.events = this.log.view();
    }
    this.emit(
      "world.created",
      [],
      [],
      [
        {
          op: "create",
          entity: {
            id: "place:void",
            kind: "place",
            name: "O lugar sem mapa",
            ...(scenario.advancedObjectives
              ? {
                  supplies: scenario.materials || { paper: 30, ink: 60 },
                  suppliesSource: "event:0",
                }
              : {}),
          },
        },
      ],
      {
        seed: scenario.seed,
        mode: scenario.mode,
        calendar: "360 days, monthly periods",
        schema: 2,
      },
    );
    // Bootstrap related people atomically: no forward kin/rival references.
    const initial = [...scenario.people]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((input) => {
        const p = clone(input);
        if (scenario.emotionalDynamics) p.psychology ||= initialPsychology();
        p.present = presentAt(scenario, p.id, 0);
        p.lastBy = Object.fromEntries(
          Object.keys(p).map((k) => [k, this.nextId()]),
        );
        return p;
      });
    this.emit(
      "people.created",
      initial.map((p) => ({ id: p.id, role: "reference" })),
      ["event:0"],
      initial.map((entity) => ({ op: "create", entity })),
      {
        origin: "configured adults",
        description: "Parentesco e rivalidades iniciais criados atomicamente.",
      },
    );
    if (scenario.fixtureLeader) {
      if (scenario.mode !== "fixture")
        throw Error("fixtureLeader is test-only");
      const leader = getPerson(this.state, scenario.fixtureLeader);
      const place = this.state.entities["place:void"] as Place;
      this.emit(
        "fixture.post.assigned",
        [{ id: leader.id, role: "actor" }],
        ["event:1"],
        [
          {
            op: "replace",
            entity: {
              ...place,
              leader: leader.id,
              leaderSource: this.nextId(),
            },
          },
        ],
        {
          fixture: true,
          reason:
            "Cargo inicial declarado pela fixture; não representa eleição gerada.",
        },
      );
    }
    this.attachLife(true);
    this.attachBody(true);
    this.attachDaily(true);
  }

  private feel(person: Person, source: SliceEvent, stimulus: Stimulus) {
    let p = getPerson(this.state, person.id);
    const psy = p.psychology!;
    const response = appraise(p, stimulus, knowsExpectedLoss(p, source));
    const emotion = this.emit(
      "emotion.felt",
      [{ id: p.id, role: "actor" }],
      [
        source.id,
        p.lastBy.psychology,
        p.lastBy.traits,
        p.lastBy.values,
        ...(stimulus === "fracasso" && source.type === "information.received"
          ? this.allPersonalGoals()
              .filter(
                (g) =>
                  g.owner === p.id &&
                  g.status === "failed" &&
                  g.target ===
                    this.state.events[
                      Number(String(source.data.offense).split(":")[1])
                    ].data.victim,
              )
              .map((g) => g.lastEvent)
          : []),
      ],
      [
        {
          op: "replace",
          entity: changed(
            p,
            {
              psychology: {
                ...psy,
                stress: bounded(psy.stress + response.stressDelta, 1000),
                needs: {
                  ...psy.needs,
                  seguranca: bounded(
                    psy.needs.seguranca + (stimulus === "ameaca" ? 35 : 0),
                  ),
                  vinculo: bounded(
                    psy.needs.vinculo + (stimulus === "perda" ? 25 : 0),
                  ),
                },
                lastEmotion: this.nextId(),
              },
            },
            this.nextId(),
          ),
        },
      ],
      {
        ...response,
        stressBefore: psy.stress,
        stressAfter: bounded(psy.stress + response.stressDelta, 1000),
        stimulusSource: source.id,
      },
    );
    p = getPerson(this.state, p.id);
    const facetBefore = p.traits[response.facet] || 0;
    const valueBefore = p.values[response.belief] || 0;
    if (
      bounded(facetBefore + response.change) === facetBefore &&
      Math.max(-100, Math.min(100, valueBefore + response.change)) ===
        valueBefore
    ) {
      if (
        source.type === "injury.perceived" ||
        source.type === "sequela.perceived"
      )
        this.anatomy?.reassess(p.id, emotion.id);
      return;
    }
    const transformed = this.emit(
      "person.transformed",
      [{ id: p.id, role: "actor" }],
      [emotion.id, p.lastBy.traits, p.lastBy.values],
      [
        {
          op: "replace",
          entity: changed(
            p,
            {
              traits: {
                ...p.traits,
                [response.facet]: bounded(facetBefore + response.change),
              },
              values: {
                ...p.values,
                [response.belief]: Math.max(
                  -100,
                  Math.min(100, valueBefore + response.change),
                ),
              },
            },
            this.nextId(),
          ),
        },
      ],
      {
        emotion: emotion.id,
        facet: response.facet,
        facetBefore,
        facetAfter: bounded(facetBefore + response.change),
        value: response.belief,
        valueBefore,
        valueAfter: Math.max(
          -100,
          Math.min(100, valueBefore + response.change),
        ),
      },
    );
    if (
      source.type === "injury.perceived" ||
      source.type === "sequela.perceived"
    )
      this.anatomy?.reassess(p.id, transformed.id);
  }
  private needsPeriod() {
    if (this.month === 0) return;
    const previous = new Map<string, string>();
    const socialContact = new Map<string, string>();
    for (let i = this.state.events.length - 1; i >= 0; i--) {
      const e = this.state.events[i];
      if (e.month < this.month - 1) break;
      if (
        e.month === this.month - 1 &&
        e.type === "social.responded" &&
        e.data.accepted
      ) {
        const g = this.state.entities[String(e.data.goal)] as PersonalGoal;
        if (g) {
          socialContact.set(g.owner, e.id);
          socialContact.set(g.target, e.id);
        }
      }
      if (
        e.month === this.month - 1 &&
        e.decision &&
        !previous.has(e.decision.actor)
      )
        previous.set(e.decision.actor, e.id);
    }
    for (const p of people(this.state).filter(
      (p) => p.alive && (!p.lifeStage || p.lifeStage === "adult" || p.lifeStage === "elder"),
    )) {
      const psy = p.psychology!,
        n = psy.needs;
      const last = previous.get(p.id),
        event = last
          ? this.state.events[Number(last.split(":")[1])]
          : undefined;
      const action = event?.decision?.chosen;
      const resting =
        action === "esperar" ||
        action === "recuperar" ||
        action === "isolar" ||
        (psy.isolatedUntil !== undefined && this.month <= psy.isolatedUntil);
      const social = socialContact.has(p.id);
      const expressing = action === "escrever_obra" || action === "observar";
      const needs = {
        seguranca: bounded(n.seguranca - 8),
        descanso: bounded(n.descanso + (resting ? -25 : 5)),
        vinculo: bounded(n.vinculo + (social ? -22 : 3)),
        expressao: bounded(n.expressao + (expressing ? -20 : 2)),
      };
      const pressure = Object.values(needs).reduce(
        (s, x) => s + Math.max(0, x - 60),
        0,
      );
      const stress = bounded(
        psy.stress + Math.floor(pressure / 8) - (resting ? 45 : 8),
        1000,
      );
      this.emit(
        "needs.period",
        [{ id: p.id, role: "reference" }],
        [
          p.lastBy.psychology,
          ...(last ? [last] : []),
          ...(socialContact.has(p.id) ? [socialContact.get(p.id)!] : []),
        ],
        [
          {
            op: "replace",
            entity: changed(
              p,
              { psychology: { ...psy, needs, stress } },
              this.nextId(),
            ),
          },
        ],
        {
          owner: p.id,
          periodMonths: 1,
          action: action || "ausente",
          pressure,
          stressBefore: psy.stress,
          stressAfter: stress,
          needs,
        },
      );
    }
  }
  private stressAction(
    p: Person,
    action: Action,
    target: string | undefined,
    causes: string[],
    decision: Decision,
  ) {
    const psy = p.psychology!,
      id = this.nextId();
    const effects: Effect[] = [];
    let patch: Partial<Person> = {
      psychology: {
        ...psy,
        stress: bounded(psy.stress - (action === "recuperar" ? 80 : 35), 1000),
        needs: { ...psy.needs, descanso: bounded(psy.needs.descanso - 30) },
      },
    };
    if (action === "isolar")
      patch = {
        ...patch,
        present: false,
        psychology: { ...patch.psychology!, isolatedUntil: this.month + 2 },
      };
    if (action === "hostilizar")
      patch = { ...patch, rival: target, hostility: bounded(p.hostility + 15) };
    const place = this.state.entities["place:void"] as Place;
    if (action === "abandonar_posto")
      effects.push({
        op: "replace",
        entity: { ...place, leader: undefined, leaderSource: id },
      });
    effects.push({ op: "replace", entity: changed(p, patch, id) });
    const e = this.emit(
      "stress.response",
      [
        { id: p.id, role: "actor" },
        ...(target ? [{ id: target, role: "target" as const }] : []),
      ],
      causes,
      effects,
      {
        action,
        stressBefore: psy.stress,
        stressAfter: patch.psychology!.stress,
        abstract: true,
        verbal: action === "hostilizar",
      },
      decision,
    );
    if (action === "abandonar_posto")
      for (const g of this.personalGoals(getPerson(this.state, p.id)).filter(
        (g) => g.type === "governar" && g.closed === undefined,
      ))
        this.finishPersonalGoal(
          g,
          "abandoned",
          [e.id],
          "Abandonou o posto e a ambição imediata sob estresse.",
        );
  }
  /** Local public incidents. A second breach after a warning is expelled, bounding repetition. */
  private recurrentThreat(threat: SliceEvent): boolean {
    const aggressor = getPerson(this.state, String(threat.data.aggressor));
    const place = this.state.entities["place:void"] as Place;
    const old = place.incidents?.[aggressor.id];
    const threats = [...(old?.threats || []), threat.id];
    const record = this.emit(
      "incident.recorded",
      [{ id: aggressor.id, role: "reference" }],
      [threat.id, ...(old?.threats.slice(-1) || [])],
      [
        {
          op: "replace",
          entity: {
            ...place,
            incidents: {
              ...place.incidents,
              [aggressor.id]: { ...old, threats },
            },
          },
        },
      ],
      { aggressor: aggressor.id, count: threats.length, public: true },
    );
    if (threats.length < 3) return false;
    const witnesses = people(this.state).filter(
      (p) => p.alive && p.present && p.id !== aggressor.id,
    );
    const authority =
      witnesses.find((p) => p.id === place.leader) || witnesses[0];
    if (!authority) return false;
    const utilities = {
      confronto: authority.traits.coragem + (authority.values.justica || 0),
      expulsao: authority.traits.cautela + (authority.values.lei || 0),
      perdao: (authority.traits.tolerancia || 0) + (authority.values.paz || 0),
      acordo:
        (authority.traits.confianca || 0) + (authority.values.cooperacao || 0),
    };
    const response = old?.consequence
      ? "expulsao"
      : Object.keys(utilities).sort(
          (a, b) =>
            utilities[b as keyof typeof utilities] -
              utilities[a as keyof typeof utilities] || a.localeCompare(b),
        )[0];
    const acceptance =
      aggressor.values.paz +
      (aggressor.traits.autocontrole || 0) +
      authority.skill / 5 -
      aggressor.hostility;
    const complies =
      (response === "acordo" || response === "confronto") && acceptance >= 50;
    const eid = this.nextId();
    const currentPlace = this.state.entities["place:void"] as Place;
    const patch: Partial<Person> =
      response === "expulsao"
        ? { expelled: eid, present: false, rival: undefined, hostility: 0 }
        : complies
          ? { rival: undefined, hostility: 0 }
          : {};
    const leadershipPatch =
      response === "expulsao" && currentPlace.leader === aggressor.id
        ? { leader: undefined, leaderSource: eid }
        : {};
    this.emit(
      "aggressor.consequence",
      [
        { id: authority.id, role: "actor" },
        { id: aggressor.id, role: "target" },
      ],
      [
        record.id,
        authority.lastBy.values,
        authority.lastBy.traits,
        authority.lastBy.skill,
        aggressor.lastBy.values,
        aggressor.lastBy.traits,
        aggressor.lastBy.hostility,
        ...(old?.consequence ? [old.consequence] : []),
      ],
      [
        {
          op: "replace",
          entity: {
            ...currentPlace,
            ...leadershipPatch,
            incidents: {
              ...currentPlace.incidents,
              [aggressor.id]: { threats, consequence: eid },
            },
          },
        },
        ...(Object.keys(patch).length
          ? [{ op: "replace" as const, entity: changed(aggressor, patch, eid) }]
          : []),
      ],
      {
        aggressor: aggressor.id,
        response,
        utilities,
        acceptance,
        complies,
        count: threats.length,
        escalated: !!old?.consequence,
        conditionalPardon: response === "perdao",
        threat: threat.id,
      },
    );
    return complies || response === "expulsao";
  }

  private nextId() {
    return `event:${this.state.events.length}`;
  }
  private emit(
    type: string,
    participants: SliceEvent["participants"],
    causes: string[],
    effects: Effect[] = [],
    data: Record<string, unknown> = {},
    decision?: Decision,
  ): SliceEvent {
    if (
      this.state.events.length >=
      (this.state.scenario.lifeSimulation?.fertilityPolicy
        ? 1000000
        : rules.maxEvents)
    )
      throw Error("budget_exceeded: event safety limit");
    const experiences=this.state.scenario.dailyLife?experienceParticipants(type,participants,data):[];
    if(experiences.length){
      effects=[...effects];causes=[...causes];
      for(const id of new Set(experiences)){
        const old=this.state.entities[id];if(old?.kind!=='person' || !old.alive)continue;
        if(type==='person.born' && id!==(data.parents as string[])[0] && !old.present)continue;
        const life=this.state.entities[`life:${id}`];if(life?.kind==='life' && this.month-life.birthMonth<48)continue;
        const index=effects.findIndex(f=>f.entity.id===id),current=index>=0?effects[index].entity:old;
        if(current.kind!=='person')continue;
        data={...data,personalWitnesses:[...((data.personalWitnesses as string[])||[]),id]};
        if(old.lastBy.livedFacts)causes.push(old.lastBy.livedFacts);
        const effect:Effect={op:'replace',entity:changed(current,{livedFacts:{...current.livedFacts,[type]:this.nextId()}},this.nextId())};
        if(index>=0)effects[index]=effect;else effects.push(effect);
      }
    }
    const e: SliceEvent = freeze({
      id: this.nextId(),
      seq: this.state.events.length,
      ano: Math.floor(this.month / 12),
      dia: (this.month % 12) * 30,
      month: this.month,
      type,
      participants: clone(participants),
      location: "place:void",
      causes: [...new Set(causes)].sort(
        (a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1]),
      ),
      effects: clone(effects),
      data: clone(data),
      ...(decision ? { decision: clone(decision) } : {}),
    });
    if (type !== "world.created" && !e.causes.length)
      throw Error("Missing cause");
    for (const cause of e.causes)
      if (this.state.events[Number(cause.split(":")[1])]?.id !== cause)
        throw Error(`Future/unknown cause ${cause}`);
    const encoded = this.log?.encodeEvent(e, this.state.entities);
    applyEvent(this.state.entities, e);
    if (this.log && encoded) this.log.append(encoded);
    else this.state.events.push(e);
    this.dispatch(e);
    return e;
  }
  private dispatch(e: SliceEvent) {
    if (this.state.scenario.emotionalDynamics) {
      const affect = (id: string, stimulus: Stimulus) =>
        this.enqueue({ kind: "affect", source: e.id, recipient: id, stimulus });
      if (e.type === "information.received") {
        const observer = getPerson(this.state, e.participants[0].id);
        const death =
          this.state.events[Number(String(e.data.offense).split(":")[1])];
        if (
          observer.kin.includes(String(death.data.victim)) ||
          (observer.bonds?.[String(death.data.victim)]?.trust || 0) >= 60
        )
          affect(observer.id, "perda");
        else if (
          e.data.channel === "relato" &&
          this.allPersonalGoals().some(
            (g) =>
              g.owner === observer.id &&
              g.target === death.data.victim &&
              g.status === "failed",
          )
        )
          affect(observer.id, "fracasso");
      }
      if (e.type === "threat.announced")
        affect(String(e.data.target), "ameaca");
      if (e.type === "confrontation.resolved" && e.data.winner)
        affect(String(e.data.winner), "vitoria");
      if (e.type === "betrayal.perceived")
        affect(String(e.data.beneficiary), "traicao");
      if (e.type === "personalGoal.closed") {
        const g = this.state.entities[String(e.data.goal)] as PersonalGoal;
        const owner = getPerson(this.state, g.owner);
        // A remote death is not a perceived personal failure. It is learned via information.received.
        const death = e.causes
          .map((id) => this.state.events[Number(id.split(":")[1])])
          .find((x) => x?.type === "person.died");
        if (g.status === "completed") affect(g.owner, "vitoria");
        if (
          g.status === "failed" &&
          (!death || owner.present || owner.informed.includes(death.id))
        )
          affect(g.owner, "fracasso");
      }
    }
    if (e.type === "threat.announced")
      for (const p of people(this.state).filter(
        (p) =>
          p.alive &&
          p.present &&
          p.id !== e.data.aggressor &&
          p.id !== e.data.target,
      ))
        this.enqueue({ kind: "threat", source: e.id, recipient: p.id });
    if (e.type === "person.died") {
      for (const p of people(this.state).filter((p) => p.alive && p.present))
        this.enqueue({ kind: "perceive", source: e.id, recipient: p.id });
      for (const g of goals(this.state).filter(
        (g) =>
          g.closed === undefined &&
          (g.target === e.data.victim || g.owner === e.data.victim),
      ))
        this.enqueue({ kind: "settleDeath", source: e.id, recipient: g.owner });
    }
    if (e.type === "information.shared")
      this.enqueue({
        kind: "hear",
        source: e.id,
        recipient: String(e.data.recipient),
        sender: String(e.data.sender),
      });
    if (e.type === "help.requested")
      this.enqueue({
        kind: "help",
        source: e.id,
        recipient: String(e.data.recipient),
        sender: String(e.data.sender),
      });
  }
  private enqueue(reaction: Reaction) {
    const key = `${reaction.kind}|${reaction.source}|${reaction.recipient}|${reaction.sender || ""}`;
    if (this.delivered.has(key)) return;
    this.delivered.add(key);
    this.queue.push(reaction);
  }
  private drain() {
    let count = 0;
    while (this.queue.length) {
      if (++count > 2000) throw Error("reaction_cycle");
      const r = this.queue.shift()!,
        p = getPerson(this.state, r.recipient);
      if (!p.alive) continue;
      if (
        p.lifeStage &&
        !["adult", "elder"].includes(p.lifeStage) &&
        !["affect", "perceive", "hear"].includes(r.kind)
      )
        continue;
      const e = this.state.events[Number(r.source.split(":")[1])];
      if (r.kind === "affect" && r.stimulus) this.feel(p, e, r.stimulus);
      if (r.kind === "perceive") this.learn(p, e, e.id);
      if (r.kind === "hear") {
        const offense =
          this.state.events[Number(String(e.data.offense).split(":")[1])];
        if (offense?.type === "person.died") this.learn(p, offense, e.id);
      }
      if (r.kind === "threat") this.perceiveThreat(p, e);
      if (r.kind === "help" && r.sender) {
        const sender = getPerson(this.state, r.sender);
        if (!sender.alive || !sender.present || !p.present || sender.helpedBy)
          continue;
        const willingness =
          p.values.familia +
          p.values.paz +
          p.traits.disciplina -
          p.traits.rancor;
        const id = this.nextId();
        const accepted = p.canHelp && willingness >= 70;
        this.emit(
          "help.responded",
          [
            { id: p.id, role: "actor" },
            { id: sender.id, role: "beneficiary" },
          ],
          [e.id, p.lastBy.values, p.lastBy.canHelp].filter(Boolean),
          accepted
            ? [
                {
                  op: "replace",
                  entity: changed(sender, { helpedBy: p.id }, id),
                },
              ]
            : [],
          { accepted, willingness, request: e.id },
        );
      }
      if (r.kind === "settleDeath") {
        const g = getGoal(this.state, p);
        if (g?.closed !== undefined || !g) continue;
        if (g.owner === e.data.victim)
          this.closeGoal(
            g,
            "objetivo frustrado",
            [e.id],
            "O agente morreu antes de concluir seu objetivo.",
          );
        else if (e.data.killer === g.owner)
          this.closeGoal(
            g,
            "vingança cumprida",
            [e.id],
            "O agente causou a morte do ofensor que buscava.",
          );
        else if (p.informed.includes(e.id))
          this.closeGoal(
            g,
            "alvo morto por outra causa",
            [e.id],
            "A morte do alvo foi atribuída a outro agente.",
          );
      }
    }
  }
  private learn(person: Person, death: SliceEvent, source: string) {
    let p = getPerson(this.state, person.id);
    if (
      (this.life?.get(p.id) &&
        this.month - this.life.get(p.id)!.birthMonth < 48) ||
      this.state.scenario.blockedInformation.includes(p.id) ||
      p.informed.includes(death.id)
    )
      return;
    const id = this.nextId();
    this.emit(
      "information.received",
      [
        { id: p.id, role: "actor" },
        { id: String(death.data.victim), role: "reference" },
      ],
      [source, p.lastBy.present].filter(Boolean),
      [
        {
          op: "replace",
          entity: changed(p, { informed: [...p.informed, death.id], ...(this.daily?{knownFactSources:{...p.knownFactSources,[death.id]:id}}:{}) }, id),
        },
      ],
      {
        offense: death.id,
        knownDeath: { natural: death.data.natural === true, ageYears: death.data.ageYears },
        channel: source === death.id ? "testemunho" : "relato",
        source,
      },
    );
    p = getPerson(this.state, p.id);
    const existing = getGoal(this.state, p);
    if (
      existing &&
      existing.closed === undefined &&
      existing.target === death.data.victim
    ) {
      this.closeGoal(
        existing,
        death.data.killer === p.id
          ? "vingança cumprida"
          : "alvo morto por outra causa",
        [id, death.id],
        "A notícia confirmou a morte do alvo.",
      );
      return;
    }
    if (
      (p.lifeStage && p.lifeStage !== "adult" && !(this.daily && p.lifeStage==="elder")) ||
      !p.kin.includes(String(death.data.victim)) ||
      !death.data.killer ||
      death.data.killer === p.id ||
      p.goal
    )
      return;
    const memory: Memory = {
      id: `memory:${p.id}`,
      kind: "memory",
      owner: p.id,
      victim: String(death.data.victim),
      offender: String(death.data.killer),
      source: id,
      at: this.month,
      weight: 850,
      offenderSkillEstimate: Number(death.data.killerSkill),
      rancor: p.traits.rancor,
    };
    const mid = this.nextId();
    this.emit(
      "memory.formed",
      [
        { id: p.id, role: "actor" },
        { id: memory.victim, role: "reference" },
      ],
      [id, p.lastBy.traits, p.lastBy.kin].filter(Boolean),
      [
        { op: "create", entity: memory },
        { op: "replace", entity: changed(p, { memory: memory.id }, mid) },
      ],
      { emotion: "luto", offense: death.id, weight: memory.weight },
    );
    p = getPerson(this.state, p.id);
    const desire =
      p.values.vinganca * 5 +
      p.values.familia * 2 +
      p.traits.rancor * 2 -
      p.values.paz * 5;
    const goal: Goal = {
      id: `goal:${p.id}`,
      kind: "goal",
      owner: p.id,
      target: memory.offender,
      victim: memory.victim,
      offense: death.id,
      memory: memory.id,
      adopted: this.month,
      source: this.nextId(),
    };
    const gid = this.nextId();
    this.emit(
      "goal.adopted",
      [
        { id: p.id, role: "actor" },
        { id: goal.target, role: "reference" },
      ],
      [mid, p.lastBy.values].filter(Boolean),
      [
        { op: "create", entity: goal },
        { op: "replace", entity: changed(p, { goal: goal.id }, gid) },
      ],
      { desire, reason: "Avaliar resposta à morte conhecida de um familiar." },
    );
    // Assess response through actions on the next turn, including seeking agreement.
    // Low revenge desire no longer closes the objective before alternatives can be compared.
  }
  private closeGoal(
    goal: Goal,
    outcome: Outcome,
    causes: string[],
    reason: string,
  ) {
    const current = this.state.entities[goal.id] as Goal;
    if (current.closed !== undefined) return;
    this.emit(
      "goal.closed",
      [
        {
          id: goal.owner,
          role: getPerson(this.state, goal.owner).alive ? "actor" : "reference",
        },
        { id: goal.target, role: "reference" },
      ],
      [goal.source, ...causes],
      [{ op: "replace", entity: { ...current, closed: this.month, outcome } }],
      { goal: goal.id, outcome, reason },
    );
  }
  private offerAgreement(goal: Goal): boolean {
    const owner = getPerson(this.state, goal.owner),
      target = getPerson(this.state, goal.target);
    if (
      !owner.alive ||
      !owner.present ||
      !target.alive ||
      !target.present ||
      !goal.accordIntent ||
      goal.accordRejected
    )
      return false;
    const offer = this.emit(
      "agreement.offered",
      [
        { id: owner.id, role: "actor" },
        { id: target.id, role: "target" },
      ],
      [goal.accordIntent, owner.lastBy.present, target.lastBy.present],
      [],
      { goal: goal.id },
    );
    const willingness =
      target.values.paz * 5 +
      target.traits.cautela * 2 +
      target.remorse * 2 -
      target.traits.rancor * 2 -
      target.values.vinganca * 3;
    const accepted = willingness >= 300;
    const reply = this.emit(
      "agreement.responded",
      [
        { id: target.id, role: "actor" },
        { id: owner.id, role: "target" },
      ],
      [
        offer.id,
        target.lastBy.values,
        target.lastBy.traits,
        target.lastBy.remorse,
      ].filter(Boolean),
      accepted
        ? []
        : [
            {
              op: "replace",
              entity: { ...goal, accordRejected: this.nextId() },
            },
          ],
      { goal: goal.id, accepted, willingness },
    );
    if (accepted) {
      const agreed = this.emit(
        "reconciliation.agreed",
        [
          { id: owner.id, role: "actor" },
          { id: target.id, role: "target" },
        ],
        [reply.id, goal.accordIntent],
        [],
        { goal: goal.id, accepted: true, reply: reply.id },
      );
      this.closeGoal(
        goal,
        "reconciliação",
        [agreed.id],
        "Acordo aceito pelos dois agentes após contato efetivo.",
      );
    }
    return true;
  }
  private allPersonalGoals(): PersonalGoal[] {
    return Object.values(this.state.entities).filter(
      (x): x is PersonalGoal => x.kind === "personalGoal",
    );
  }
  private personalGoals(p: Person) {
    return (p.personalGoals || []).map(
      (id) => this.state.entities[id] as PersonalGoal,
    );
  }
  private adoptPersonalGoal(
    p: Person,
    target: Person,
    type: PersonalGoal["type"],
    causes: string[],
    details: Partial<PersonalGoal> = {},
  ): PersonalGoal {
    const id = `personal:${type}:${p.id}:${target.id}${this.daily && type === "criar_obra" ? ":"+details.theme : ""}`,
      eid = this.nextId();
    const g: PersonalGoal = {
      id,
      kind: "personalGoal",
      type,
      owner: p.id,
      target: target.id,
      source: eid,
      lastEvent: eid,
      adopted: this.month,
      interventions: 0,
      rejections: 0,
      ...details,
    };
    this.emit(
      "personalGoal.adopted",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "reference" },
      ],
      causes,
      [
        { op: "create", entity: g },
        {
          op: "replace",
          entity: changed(
            p,
            { personalGoals: [...(p.personalGoals || []), id] },
            eid,
          ),
        },
      ],
      {
        goal: id,
        type,
        reason:
          type === "amizade"
            ? "Desejo de construir amizade com pessoa encontrada."
            : type === "governar"
              ? "Ambição de coordenar o grupo com apoio voluntário."
              : type === "criar_obra"
                ? "Desejo de criar uma obra motivado por arte e criatividade."
                : "Compromisso de proteger após ameaça percebida.",
      },
    );
    return g;
  }
  private finishPersonalGoal(
    g: PersonalGoal,
    status: PersonalGoal["status"],
    causes: string[],
    reason: string,
  ) {
    const current = this.state.entities[g.id] as PersonalGoal;
    if (current.closed !== undefined) return;
    this.emit(
      "personalGoal.closed",
      [
        {
          id: g.owner,
          role: getPerson(this.state, g.owner).alive ? "actor" : "reference",
        },
        { id: g.target, role: "reference" },
      ],
      [current.source, current.lastEvent, ...causes],
      [
        {
          op: "replace",
          entity: {
            ...current,
            closed: this.month,
            status,
            reason,
            ...(status === "resolved_by_other" ? { threatResolved: true } : {}),
            lastEvent: this.nextId(),
          },
        },
      ],
      { goal: g.id, status, reason },
    );
  }
  private prepareFriendship(p: Person) {
    if (
      (p.values.amizade || 0) < 35 ||
      this.personalGoals(p).some((g) => g.type === "amizade")
    )
      return;
    const target = people(this.state)
      .filter(
        (q) =>
          q.id !== p.id &&
          q.alive &&
          q.present &&
          (!this.state.scenario.friendTargets?.[p.id] ||
            q.id === this.state.scenario.friendTargets[p.id]),
      )
      .sort(
        (a, b) =>
          sample(
            this.daily ? domainSeed(this.state.scenario.seed,"friendship") : this.state.scenario.seed,
            `contact:${p.id}:${a.id}`,
            0,
            1000000,
          ) -
            sample(
              this.daily ? domainSeed(this.state.scenario.seed,"friendship") : this.state.scenario.seed,
              `contact:${p.id}:${b.id}`,
              0,
              1000000,
            ) || (a.id < b.id ? -1 : 1),
      )[0];
    if (!target) return;
    let source = p.acquaintances?.[target.id];
    if (!source) {
      const eid = this.nextId();
      const met = this.emit(
        "person.met",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "target" },
        ],
        [p.lastBy.present, target.lastBy.present],
        [
          {
            op: "replace",
            entity: changed(
              p,
              { acquaintances: { ...p.acquaintances, [target.id]: eid } },
              eid,
            ),
          },
          {
            op: "replace",
            entity: changed(
              target,
              { acquaintances: { ...target.acquaintances, [p.id]: eid } },
              eid,
            ),
          },
        ],
        { first: p.id, second: target.id },
      );
      source = met.id;
    }
    this.adoptPersonalGoal(
      getPerson(this.state, p.id),
      getPerson(this.state, target.id),
      "amizade",
      [source, p.lastBy.values],
    );
  }
  private socialize(
    p: Person,
    target: Person,
    causes: string[],
    decision: Decision,
  ) {
    const goal = this.personalGoals(p).find(
      (g) =>
        g.type === "amizade" &&
        g.closed === undefined &&
        g.target === target.id,
    );
    if (!goal) return;
    const contact = this.emit(
      "social.invited",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "target" },
      ],
      causes,
      [],
      { goal: goal.id },
      decision,
    );
    const willingness =
      (target.values.amizade || 0) +
      target.values.paz +
      target.values.familia -
      target.traits.rancor -
      Math.floor(target.traits.cautela / 2);
    const accepted = willingness >= 85,
      eid = this.nextId();
    const response = this.emit(
      "social.responded",
      [
        { id: target.id, role: "actor" },
        { id: p.id, role: "target" },
      ],
      [contact.id, target.lastBy.values, target.lastBy.traits],
      [],
      { accepted, willingness, goal: goal.id },
    );
    if (!accepted) {
      const g = {
        ...goal,
        rejections: goal.rejections + 1,
        lastEvent: this.nextId(),
      };
      this.emit(
        "friendship.rejected",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "reference" },
        ],
        [response.id],
        [{ op: "replace", entity: g }],
        { goal: goal.id },
      );
      if (g.rejections >= 3)
        this.finishPersonalGoal(
          g,
          "abandoned",
          [response.id],
          "Três convites recusados; respeitou a recusa.",
        );
      return;
    }
    const a = getPerson(this.state, p.id),
      b = getPerson(this.state, target.id),
      oldA = a.bonds?.[b.id],
      oldB = b.bonds?.[a.id],
      bid = this.nextId();
    const bond = (old: typeof oldA) => ({
      trust: Math.min(100, (old?.trust || 0) + 20),
      interactions: (old?.interactions || 0) + 1,
      source: bid,
    });
    const ba = bond(oldA),
      bb = bond(oldB);
    const interaction = this.emit(
      "relationship.strengthened",
      [
        { id: a.id, role: "actor" },
        { id: b.id, role: "target" },
      ],
      [
        response.id,
        ...[oldA?.source, oldB?.source].filter((x): x is string => !!x),
      ],
      [
        {
          op: "replace",
          entity: changed(a, { bonds: { ...a.bonds, [b.id]: ba } }, bid),
        },
        {
          op: "replace",
          entity: changed(b, { bonds: { ...b.bonds, [a.id]: bb } }, bid),
        },
      ],
      {
        first: a.id,
        second: b.id,
        firstTrust: ba.trust,
        secondTrust: bb.trust,
      },
    );
    if (ba.trust >= 60 && bb.trust >= 60) {
      const formed = this.emit(
        "friendship.formed",
        [
          { id: a.id, role: "actor" },
          { id: b.id, role: "target" },
        ],
        [interaction.id],
        [],
        { first: a.id, second: b.id, goal: goal.id },
      );
      this.finishPersonalGoal(
        goal,
        "completed",
        [formed.id],
        "Amizade recíproca construída por encontros aceitos.",
      );
    }
  }
  private perceiveThreat(p: Person, threat: SliceEvent) {
    if (this.state.scenario.blockedThreatPerception?.includes(p.id)) return;
    const target = getPerson(this.state, String(threat.data.target)),
      attacker = getPerson(this.state, String(threat.data.aggressor));
    const perception = this.emit(
      "threat.perceived",
      [
        { id: p.id, role: "witness" },
        { id: target.id, role: "reference" },
      ],
      [threat.id, p.lastBy.present],
      [],
      { threat: threat.id, observer: p.id },
    );
    const existing = this.personalGoals(p).find(
      (g) => g.type === "proteger" && g.target === target.id,
    );
    if (existing?.closed !== undefined) return;
    const related =
      p.kin.includes(target.id) || (p.bonds?.[target.id]?.trust || 0) >= 20;
    if (!existing && !related && (p.values.solidariedade || 0) < 60) return;
    if (!existing && this.state.scenario.advancedObjectives) {
      const motive =
        (p.kin.includes(target.id) ? p.values.familia * 2 : 0) +
        (p.bonds?.[target.id]?.trust || 0) +
        (p.values.solidariedade || 0) +
        ((p.traits.compaixao ?? 50) - 50) * 2;
      if (motive < 60) return;
    }

    const allies = this.knownAllies(p, target.id, attacker.id);
    const estimate = estimateProtection(
      p,
      target,
      attacker,
      allies,
      this.nextId(),
    );
    const assessment = this.emit(
      "protection.assessed",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "reference" },
      ],
      [
        perception.id,
        p.lastBy.skill,
        attacker.lastBy.skill,
        target.lastBy.skill,
        p.lastBy.values,
        ...allies.map((a) => a.lastBy.skill),
        ...allies.map(
          (a) =>
            p.acquaintances?.[a.id] || p.bonds?.[a.id]?.source || p.lastBy.kin,
        ),
        p.lastBy.acquaintances,
        p.lastBy.bonds,
        p.lastBy.kin,
      ].filter(Boolean),
      [],
      {
        estimate,
        threshold: 40,
        eligible: estimate.best >= 40,
        reason:
          "Estimativa anterior ao compromisso; não é probabilidade calibrada.",
      },
    );
    if (existing) {
      this.emit(
        "protection.renewed",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "reference" },
        ],
        [existing.lastEvent, assessment.id],
        [
          {
            op: "replace",
            entity: {
              ...existing,
              threat: threat.id,
              aggressor: attacker.id,
              perception: perception.id,
              estimate,
              threatResolved: false,
              lastEvent: this.nextId(),
            },
          },
        ],
        { goal: existing.id },
      );
      return;
    }
    if (estimate.best < 40) {
      this.emit(
        "protection.declined",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "reference" },
        ],
        [assessment.id],
        [],
        {
          reason: "Nenhum plano disponível alcançou a chance estimada mínima.",
          estimate,
        },
      );
      return;
    }
    this.adoptPersonalGoal(
      p,
      target,
      "proteger",
      [
        perception.id,
        assessment.id,
        p.lastBy.values,
        ...(p.bonds?.[target.id] ? [p.bonds[target.id].source] : []),
      ],
      {
        threat: threat.id,
        aggressor: attacker.id,
        perception: perception.id,
        estimate,
        threatResolved: false,
      },
    );
  }
  private prepareAdvancedGoals(p: Person) {
    const knownTheme=this.personalGoals(p).some(g=>g.type==="criar_obra" && g.closed===undefined)?undefined:this.daily?.theme(p);
    if (
      (p.values.poder || 0) > 30 &&
      (p.traits.ambicao || 0) > 55 &&
      !this.personalGoals(p).some((g) => g.type === "governar")
    ) {
      this.adoptPersonalGoal(
        p,
        p,
        "governar",
        [p.lastBy.values, p.lastBy.traits],
        { solicited: {} },
      );
      p = getPerson(this.state, p.id);
      const eid = this.nextId();
      this.emit(
        "support.pledged",
        [{ id: p.id, role: "actor" }],
        [this.personalGoals(p).find((g) => g.type === "governar")!.source],
        [{ op: "replace", entity: changed(p, { supportFor: p.id }, eid) }],
        {
          candidate: p.id,
          reason: "Compromisso público com a própria candidatura.",
        },
      );
      p = getPerson(this.state, p.id);
    }
    if (
      (p.values.arte || 0) > 30 &&
      (p.traits.criatividade || 0) > 35 &&
      (this.daily ? !!knownTheme && !this.personalGoals(p).some(g=>g.type==="criar_obra" && g.closed===undefined) : !this.personalGoals(p).some((g) => g.type === "criar_obra"))
    )
      this.adoptPersonalGoal(
        p,
        p,
        "criar_obra",
        [p.lastBy.values, p.lastBy.traits,...(knownTheme?[knownTheme.fact,knownTheme.evidence]:[])],
        { progress: 0, ...(knownTheme?{theme:knownTheme.fact,knowledgeSource:knownTheme.evidence}:{}) },
      );
  }
  private campaignContact(p: Person, g: PersonalGoal) {
    return people(this.state)
      .filter(
        (q) =>
          q.alive &&
          q.present &&
          q.id !== p.id &&
          (!this.daily || ["adult","elder"].includes(q.lifeStage||"adult")) &&
          q.supportFor !== p.id &&
          (!g.solicited?.[q.id] || this.month - g.solicited[q.id].month >= 12),
      )
      .sort(
        (a, b) =>
          Number(!!p.acquaintances?.[b.id]) -
            Number(!!p.acquaintances?.[a.id]) || (a.id < b.id ? -1 : 1),
      )[0];
  }
  private campaign(
    p: Person,
    voter: Person,
    causes: string[],
    decision: Decision,
  ) {
    const g = this.personalGoals(p).find(
      (g) => g.type === "governar" && g.closed === undefined,
    )!;
    let meeting = p.acquaintances?.[voter.id];
    if (!meeting) {
      const eid = this.nextId();
      meeting = this.emit(
        "person.met",
        [
          { id: p.id, role: "actor" },
          { id: voter.id, role: "target" },
        ],
        [p.lastBy.present, voter.lastBy.present],
        [
          {
            op: "replace",
            entity: changed(
              p,
              { acquaintances: { ...p.acquaintances, [voter.id]: eid } },
              eid,
            ),
          },
          {
            op: "replace",
            entity: changed(
              voter,
              { acquaintances: { ...voter.acquaintances, [p.id]: eid } },
              eid,
            ),
          },
        ],
        { first: p.id, second: voter.id },
      ).id;
    }
    p = getPerson(this.state, p.id);
    voter = getPerson(this.state, voter.id);
    const request = this.emit(
      "leadership.requested",
      [
        { id: p.id, role: "actor" },
        { id: voter.id, role: "target" },
      ],
      [...causes, meeting],
      [],
      { goal: g.id },
      decision,
    );
    const utility = (candidate: Person) =>
      (candidate.skills?.lideranca || 0) * 3 +
      (voter.bonds?.[candidate.id]?.trust || 0) * 2 +
      (voter.values.lei || 0) +
      (voter.values.paz || 0) -
      (voter.traits.ambicao || 0) * 2;
    const current = voter.supportFor
        ? getPerson(this.state, voter.supportFor)
        : undefined,
      score = utility(p),
      old = current?.alive ? utility(current) : 80,
      accepted = score >= 100 && score > old + 20;
    const eid = this.nextId();
    const response = this.emit(
      "leadership.responded",
      [
        { id: voter.id, role: "actor" },
        { id: p.id, role: "target" },
      ],
      [
        request.id,
        voter.lastBy.values,
        voter.lastBy.traits,
        ...(voter.lastBy.supportFor ? [voter.lastBy.supportFor] : []),
      ],
      [
        {
          op: "replace",
          entity: {
            ...g,
            solicited: {
              ...g.solicited,
              [voter.id]: { month: this.month, event: eid },
            },
            lastEvent: eid,
          },
        },
        ...(accepted
          ? [
              {
                op: "replace" as const,
                entity: changed(voter, { supportFor: p.id }, eid),
              },
            ]
          : []),
      ],
      { goal: g.id, accepted, score, previousScore: old },
    );
    if (accepted && this.state.scenario.emotionalDynamics) {
      const currentVoter = getPerson(this.state, voter.id);
      if (
        voter.pledge &&
        voter.pledge.to !== p.id &&
        voter.pledge.until >= this.month
      ) {
        const injured = getPerson(this.state, voter.pledge.to);
        if (injured.alive && injured.present)
          this.emit(
            "betrayal.perceived",
            [
              { id: injured.id, role: "actor" },
              { id: voter.id, role: "target" },
            ],
            [response.id, voter.pledge.source],
            [],
            {
              beneficiary: injured.id,
              brokenPledge: voter.pledge.source,
              observed: true,
            },
          );
      }
      this.emit(
        "pledge.made",
        [
          { id: voter.id, role: "actor" },
          { id: p.id, role: "target" },
        ],
        [response.id],
        [
          {
            op: "replace",
            entity: changed(
              currentVoter,
              {
                pledge: {
                  to: p.id,
                  source: this.nextId(),
                  until: this.month + 12,
                },
              },
              this.nextId(),
            ),
          },
        ],
        { durationMonths: 12, promise: "Manter apoio por doze meses." },
      );
    }
    const eligible = people(this.state).filter((q) => q.alive && q.present && (!this.daily || ["adult","elder"].includes(q.lifeStage||"adult"))),
      votes = eligible.filter((q) => q.supportFor === p.id),
      majority = Math.max(3, Math.floor(eligible.length / 2) + 1),
      place = this.state.entities["place:void"] as Place;
    if (votes.length >= majority && place.leader !== p.id) {
      const lid = this.nextId();
      const elected = this.emit(
        "leadership.changed",
        [
          { id: p.id, role: "actor" },
          ...votes
            .filter((q) => q.id !== p.id)
            .map((q) => ({ id: q.id, role: "witness" as const })),
        ],
        [
          response.id,
          ...votes.map((q) => q.lastBy.supportFor).filter(Boolean),
          ...(place.leaderSource ? [place.leaderSource] : []),
        ],
        [
          {
            op: "replace",
            entity: { ...place, leader: p.id, leaderSource: lid },
          },
        ],
        {
          goal: g.id,
          previous: place.leader || null,
          voters: votes.map((q) => q.id),
          majority,
          role: "coordenação do grupo, sem civilização ou monarquia",
        },
      );
      this.finishPersonalGoal(
        g,
        "completed",
        [elected.id],
        "Conquistou a coordenação com maioria de apoios públicos válidos.",
      );
    }
  }
  private writeWork(p: Person, causes: string[], decision: Decision) {
    let g = this.personalGoals(p).find(
      (g) => g.type === "criar_obra" && g.closed === undefined,
    )!;
    if(this.daily && (p.workedMonth===this.month || g.workLastMonth===this.month))return;
    if(this.daily && (!g.theme || !g.knowledgeSource || !this.daily.knows(p,g.theme,g.knowledgeSource))){
      const refused=this.emit('work.blocked',[{id:p.id,role:'actor'}],causes,[],{goal:g.id,reason:'Tema sem experiência ou notícia conhecida.'},decision);this.finishPersonalGoal(g,'failed',[refused.id],'Tema desconhecido.');return;
    }
    let place = this.state.entities["place:void"] as Place;
    const home=this.daily?.home(p.id);
    const stock=home ? home.writingStock : place.supplies;
    if (!g.workStarted) {
      if (
        !stock ||
        stock.paper < 3 ||
        stock.ink < 2
      ) {
        const refused = this.emit(
          "work.blocked",
          [{ id: p.id, role: "actor" }],
          [...causes,...(home?.stockSource?[home.stockSource]:[])],
          home?[{op:"replace",entity:changed(p,{blockedWritingStock:home.stockSource},this.nextId())}]:[],
          { goal: g.id, ...(home?{household:home.id}:{}), reason: "Faltam papel ou tinta." },
          decision,
        );
        this.finishPersonalGoal(
          g,
          "failed",
          [refused.id],
          "Sem materiais disponíveis para iniciar a obra.",
        );
        return;
      }
      const theme = g.theme ||
        p.informed.at(-1) ||
        (p.acquaintances && Object.values(p.acquaintances)[0]);
      const started = this.emit(
        "work.started",
        [{ id: p.id, role: "actor" }],
        [
          ...causes,
          ...(theme ? [theme] : []),
          ...(theme && p.lastBy.informed ? [p.lastBy.informed] : []),
          ...(home?.stockSource ? [home.stockSource] : place.suppliesSource ? [place.suppliesSource] : []),
          ...(g.knowledgeSource?[g.knowledgeSource]:[]),
        ],
        [
          {
            op: "replace",
            entity: home ? {...home,writingStock:{paper:stock!.paper-3,ink:stock!.ink-2},stockSource:this.nextId()} : {
              ...place,
              supplies: {paper: stock!.paper - 3, ink: stock!.ink - 2},
              suppliesSource: this.nextId(),
            },
          },
          {
            op: "replace",
            entity: {
              ...g,
              theme,
              workStarted: this.nextId(),
              lastEvent: this.nextId(),
            },
          },
        ],
        {
          goal: g.id,
          theme: theme || null,
          ...(home?{household:home.id,knowledgeSource:g.knowledgeSource}:{}),
          paper: 3,
          ink: 2,
          reason:
            "Expressão artística motivada por valores e experiência conhecida.",
        },
      );
      g = this.state.entities[g.id] as PersonalGoal;
      causes = [started.id];
    }
    const progress = (g.progress || 0) + 1,
      eid = this.nextId(),
      skills = {
        lideranca: p.skills?.lideranca || 0,
        escrita: Math.min(100, (p.skills?.escrita || 0) + 2),
      };
    const period = this.emit(
      "work.period",
      [{ id: p.id, role: "actor" }],
      [...causes, g.lastEvent, p.lastBy.skills],
      [
        { op: "replace", entity: { ...g, progress, ...(this.daily?{workLastMonth:this.month}:{}), lastEvent: eid } },
        { op: "replace", entity: changed(p, { skills, ...(this.daily?{workedMonth:this.month}:{}) }, eid) },
      ],
      { goal: g.id, action: "escrever_obra", periodMonths: 1, progress, ...(this.daily?{occupiedMonth:this.month}:{}) },
      decision,
    );
    if (progress >= 6) {
      p = getPerson(this.state, p.id);
      const wid = `work:${p.id}${this.daily?":"+g.id:""}`,
        source = this.nextId(),
        quality = Math.max(
          0,
          Math.min(
            100,
            Math.floor(
              ((p.skills?.escrita || 0) +
                (p.traits.criatividade || 0) +
                (p.traits.perseveranca || 0)) /
                3,
            ),
          ),
        );
      const work: Work = {
        id: wid,
        kind: "work",
        name: `Caderno de ${p.name}`,
        creator: p.id,
        ...(this.daily?{owner:p.id,ownerSource:source,knowledgeSource:g.knowledgeSource}:{}),
        goal: g.id,
        theme: g.theme,
        quality,
        source,
        created: this.month,
        material: "papel e tinta",
      };
      const created = this.emit(
        "work.created",
        [{ id: p.id, role: "actor" }],
        [period.id, g.workStarted!, ...(g.theme ? [g.theme] : [])],
        [
          { op: "create", entity: work },
          {
            op: "replace",
            entity: changed(p, { works: [...(p.works || []), wid] }, source),
          },
        ],
        { goal: g.id, work: wid, quality },
      );
      this.daily?.transfer(work);
      this.finishPersonalGoal(
        g,
        "completed",
        [created.id],
        "Concluiu uma obra após seis períodos de trabalho e consumo real de materiais.",
      );
    }
  }
  private knownAllies(p: Person, target: string, attacker: string) {
    return people(this.state).filter(
      (q) =>
        q.id !== p.id &&
        q.id !== target &&
        q.id !== attacker &&
        q.alive &&
        q.present &&
        !this.reactedThisMonth.has(q.id) &&
        (p.kin.includes(q.id) ||
          !!p.acquaintances?.[q.id] ||
          (p.bonds?.[q.id]?.trust || 0) >= 20),
    );
  }
  private protectiveResponse(
    p: Person,
    targetId: string,
    action: ProtectionAction,
    causes: string[],
    decision: Decision,
  ): boolean {
    if (action === "proteger")
      return this.protect(p, targetId, causes, decision);
    const g = this.personalGoals(p).find(
      (g) =>
        g.type === "proteger" &&
        g.target === targetId &&
        g.closed === undefined &&
        !g.threatResolved,
    );
    if (!g?.estimate || !g.aggressor || !g.threat) return false;
    const target = getPerson(this.state, targetId),
      attacker = getPerson(this.state, g.aggressor);
    const request = this.emit(
      action === "avisar_alvo"
        ? "protection.warning"
        : action === "pedir_aliados"
          ? "protection.support.requested"
          : "protection.escort.offered",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "target" },
      ],
      [...causes, g.estimate.assessedAt, g.perception!],
      [],
      { goal: g.id, threat: g.threat, action },
      decision,
    );
    let success = false,
      response = request.id;
    if (action === "pedir_aliados") {
      const ally = this.knownAllies(p, target.id, attacker.id).find(
        (a) => a.id === g.estimate!.ally,
      );
      if (ally) {
        const willingness =
          (ally.values.solidariedade || 0) +
          ally.values.familia +
          (ally.bonds?.[p.id]?.trust || 0) -
          ally.traits.cautela -
          Math.max(0, attacker.skill - ally.skill) / 5;
        const accepted = willingness >= 40;
        const reply = this.emit(
          "protection.support.responded",
          [
            { id: ally.id, role: "actor" },
            { id: p.id, role: "target" },
          ],
          [
            request.id,
            ally.lastBy.values,
            ally.lastBy.traits,
            ally.lastBy.skill,
          ],
          [],
          { accepted, willingness, goal: g.id },
        );
        response = reply.id;
        success =
          accepted && p.skill + ally.skill + p.traits.coragem >= attacker.skill;
        if (success) {
          const own = this.personalGoals(ally).find(
              (q) =>
                q.type === "proteger" &&
                q.closed === undefined &&
                q.target === target.id,
            ),
            aid = this.nextId();
          this.emit(
            "protection.support.contributed",
            [
              { id: ally.id, role: "actor" },
              { id: target.id, role: "reference" },
            ],
            [reply.id, ...(own ? [own.lastEvent] : [])],
            own
              ? [
                  {
                    op: "replace",
                    entity: {
                      ...own,
                      interventions: own.interventions + 1,
                      lastEvent: aid,
                    },
                  },
                ]
              : [],
            {
              requestingGoal: g.id,
              goal: own?.id || null,
              threat: g.threat,
              jointMargin:
                p.skill + ally.skill + p.traits.coragem - attacker.skill,
            },
          );
        }
        if (accepted) this.reactedThisMonth.add(ally.id);
      }
    } else {
      const trust = target.kin.includes(p.id)
        ? 60
        : target.bonds?.[p.id]?.trust || 0;
      const utility =
        action === "avisar_alvo"
          ? Math.max(0, attacker.skill - target.skill) +
            target.traits.cautela * 3 -
            target.traits.coragem * 2
          : trust +
            Math.floor(Math.max(0, attacker.skill - target.skill) / 3) +
            target.traits.cautela -
            target.traits.coragem;
      const accepted = utility >= (action === "avisar_alvo" ? 100 : 40);
      const eid = this.nextId();
      const reply = this.emit(
        "protection.target.responded",
        [
          { id: target.id, role: "actor" },
          { id: p.id, role: "target" },
        ],
        [request.id, target.lastBy.traits, target.lastBy.skill],
        [
          {
            op: "replace",
            entity: changed(
              target,
              {
                knownThreats: {
                  ...target.knownThreats,
                  [g.threat]: request.id,
                },
                ...(accepted
                  ? { present: false, shelteredUntil: this.month + 3 }
                  : {}),
              },
              eid,
            ),
          },
        ],
        {
          accepted,
          utility,
          action,
          goal: g.id,
          reason: "Aviso ou afastamento depende de resposta do próprio alvo.",
        },
      );
      response = reply.id;
      success = accepted;
    }
    const eid = this.nextId();
    this.emit(
      success ? "protection.succeeded" : "protection.attempt.failed",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "reference" },
      ],
      [response, g.lastEvent],
      [
        {
          op: "replace",
          entity: {
            ...g,
            interventions: g.interventions + (success ? 1 : 0),
            lastEvent: eid,
          },
        },
      ],
      { goal: g.id, action, success },
    );
    this.reactedThisMonth.add(p.id);
    return success;
  }
  private protect(
    p: Person,
    targetId: string,
    causes: string[],
    decision: Decision,
  ): boolean {
    const g = this.personalGoals(p).find(
      (g) =>
        g.type === "proteger" &&
        g.closed === undefined &&
        g.target === targetId &&
        !g.threatResolved,
    );
    if (!g?.aggressor || !g.threat) return false;
    const attacker = getPerson(this.state, g.aggressor),
      margin = p.skill + p.traits.coragem * 2 - attacker.skill;
    const success = margin >= 0,
      eid = this.nextId();
    this.emit(
      success ? "protection.intervened" : "protection.failed",
      [
        { id: p.id, role: "actor" },
        { id: targetId, role: "beneficiary" },
        { id: attacker.id, role: "target" },
      ],
      [...causes, g.threat, g.perception!, attacker.lastBy.skill],
      [
        {
          op: "replace",
          entity: {
            ...g,
            interventions: g.interventions + (success ? 1 : 0),
            lastEvent: eid,
          },
        },
        ...(success && attacker.rival === targetId
          ? [
              {
                op: "replace" as const,
                entity: changed(
                  attacker,
                  {
                    rival: undefined,
                    hostility: Math.max(0, attacker.hostility - 50),
                  },
                  eid,
                ),
              },
            ]
          : []),
      ],
      {
        goal: g.id,
        threat: g.threat,
        success,
        margin,
        reason: "Intervenção abstrata, sem dano corporal.",
      },
      decision,
    );
    this.reactedThisMonth.add(p.id);
    return success;
  }
  private resolveThreat(threat: string, resolution?: string) {
    for (const g of this.allPersonalGoals().filter(
      (g) => g.closed === undefined && g.threat === threat && !g.threatResolved,
    )) {
      const observer = getPerson(this.state, g.owner);
      if (
        this.state.scenario.emotionalDynamics &&
        resolution &&
        g.interventions === 0 &&
        observer.alive &&
        observer.present &&
        getPerson(this.state, g.target).alive
      ) {
        this.finishPersonalGoal(
          g,
          "resolved_by_other",
          [threat, resolution, ...(g.perception ? [g.perception] : [])],
          "Resolvido por outro: presenciou a resolução sem intervenção própria.",
        );
        continue;
      }
      this.emit(
        "threat.resolved",
        [
          { id: g.owner, role: "reference" },
          { id: g.target, role: "reference" },
        ],
        [g.lastEvent, threat],
        [
          {
            op: "replace",
            entity: { ...g, threatResolved: true, lastEvent: this.nextId() },
          },
        ],
        { goal: g.id, threat },
      );
    }
  }
  private availability() {
    for (const p of people(this.state)) {
      if (!p.alive || p.escaped) continue;
      const present =
        !p.expelled &&
        (!p.psychology?.isolatedUntil ||
          this.month >= p.psychology.isolatedUntil) &&
        (!p.shelteredUntil || this.month >= p.shelteredUntil) &&
        (this.life?.get(p.id)?.parents.length
          ? true
          : presentAt(this.state.scenario, p.id, this.month));
      if (p.present !== present) {
        const id = this.nextId();
        this.emit(
          "presence.changed",
          [{ id: p.id, role: "actor" }],
          [p.lastBy.present, "event:0"],
          [{ op: "replace", entity: changed(p, { present }, id) }],
          {
            present,
            reason: "Agenda abstrata de encontros definida na origem.",
          },
        );
      }
    }
  }
  private targetFor(p: Person) {
    const goal = getGoal(this.state, p);
    if (goal && goal.closed === undefined)
      return getPerson(this.state, goal.target);
    if (p.rival) return getPerson(this.state, p.rival);
    return undefined;
  }
  candidates(id: string, roster?: readonly string[]): Candidate[] {
    const p = getPerson(this.state, id),
      g = getGoal(this.state, p),
      active = !!g && g.closed === undefined,
      target = this.targetFor(p),
      weight = effectiveMemory(this.state, p, this.month);
    const evidence = (...ids: (string | undefined)[]) => [
      ...new Set(ids.filter((x): x is string => !!x)),
    ];
    const baseEvidence = evidence(
      this.anatomy?.body(p.id).lastEvent,
      p.lastBy.psychology,
      p.lastBy.traits,
      p.lastBy.values,
      p.lastBy.skill,
      p.lastBy.present,
      g?.source,
      g?.accordIntent,
      g?.accordRejected,
      p.memory ? (this.state.entities[p.memory] as Memory).source : undefined,
    );
    const result: Candidate[] = [];
    const add = (
      action: Action,
      factors: Record<string, number>,
      targetId?: string,
      extra: string[] = [],
    ) => {
      if (
        action === "confrontar" &&
        (this.state.scenario.bodySimulation?.singleDuel ||
          (this.anatomy && !this.anatomy.canStrike(p.id)))
      )
        return;
      if (this.state.scenario.advancedObjectives)
        factors = { ...factors, ...personalityFactors(p, action) };
      const base = Object.values(factors).reduce((a, b) => a + b, 0),
        jitter = noise(this.daily ? domainSeed(this.state.scenario.seed, "decisions:"+action) : this.state.scenario.seed, p.id, this.month, action);
      result.push({
        action,
        base,
        noise: jitter,
        score: base + jitter,
        factors,
        evidence: evidence(...baseEvidence, ...extra),
        ...(targetId ? { target: targetId } : {}),
      });
    };
    add("esperar", {
      repouso: 300,
      cautela: p.traits.cautela * 2,
      compromissoAcordo:
        active && g!.accordIntent && !g!.accordRejected
          ? 250 + p.values.paz * 2
          : 0,
    });
    if (!p.alive || !p.present) return result;
    if (this.state.scenario.emotionalDynamics && p.psychology) {
      const psy = p.psychology;
      add("recuperar", {
        necessidadeDescanso: psy.needs.descanso * 8,
        estresse: psy.stress / 2,
      });
      if (psy.stress >= 650) {
        add("isolar", {
          crise: psy.stress,
          cautela: p.traits.cautela * 4,
          sociabilidade: -(p.traits.sociabilidade || 0) * 3,
        });
        const irritant = target?.alive && target.present ? target : undefined;
        if (irritant)
          add(
            "hostilizar",
            {
              crise: psy.stress,
              agressividade: (p.traits.agressividade || 0) * 6,
              autocontrole: -(p.traits.autocontrole || 0) * 5,
            },
            irritant.id,
          );
        const place = this.state.entities["place:void"] as Place;
        if (place.leader === p.id)
          add(
            "abandonar_posto",
            {
              crise: psy.stress,
              sobrecarga: psy.needs.descanso * 5,
              disciplina: -p.traits.disciplina * 3,
            },
            undefined,
            [place.leaderSource!],
          );
      }
    }
    const rememberedSkill = p.memory
      ? (this.state.entities[p.memory] as Memory).offenderSkillEstimate
      : target
        ? this.state.scenario.people.find((q) => q.id === target.id)!.skill
        : 0;
    // Co-present activity is public in this abstract scenario. Away, only the known estimate is available.
    const perceivedSkill =
      target?.alive && target.present ? target.skill : rememberedSkill;
    const gap = target ? perceivedSkill - p.skill : 0,
      urge = active
        ? p.values.vinganca * 4 +
          p.values.familia +
          p.traits.rancor +
          Math.floor(weight / 4) -
          p.values.paz * 4
        : 0;
    if (p.trainAccess && p.skill < rules.maxSkill)
      add(
        "treinar",
        {
          pratica: active ? 380 : 100,
          disciplina: p.traits.disciplina * 3,
          preparacao: active ? Math.max(0, Math.floor((gap * 14) / 10)) : 0,
          motivo: active ? Math.floor(urge / 3) : 0,
        },
        undefined,
        evidence(p.lastBy.trainAccess, p.lastBy.helpedBy),
      );
    if (
      target?.alive &&
      target.present &&
      (!active || p.informed.includes(g!.offense))
    )
      add(
        "confrontar",
        {
          iniciativa: active ? 800 : 0,
          motivo: active ? urge : p.hostility * 12,
          poder: (p.skill - target.skill) * 4,
          perigo: -Math.max(0, gap) * 8,
          coragem: p.traits.coragem * 3,
          cautela: -p.traits.cautela * 3,
          paz: -p.values.paz * 3,
        },
        target.id,
        evidence(
          target.lastBy.skill,
          target.lastBy.present,
          p.lastBy.rival,
          p.lastBy.hostility,
        ),
      );
    if (active && target) {
      if (!target.present)
        add(
          "observar",
          {
            busca: active ? 400 : 0,
            compromisso: Math.floor(urge / 3),
            paciencia: p.traits.disciplina,
          },
          target.id,
        );
      if (!p.helpFrom) {
        const helper = people(this.state)
          .filter(
            (q) =>
              q.id !== p.id &&
              q.id !== target.id &&
              q.alive &&
              q.present &&
              q.canHelp,
          )
          .sort(
            (a, b) =>
              b.values.familia +
                b.values.paz -
                a.values.familia -
                a.values.paz || (a.id < b.id ? -1 : 1),
          )[0];
        if (helper)
          add(
            "comunicar",
            {
              pedido: 700,
              cautela: p.traits.cautela * 2,
              paz: p.values.paz * 2,
              orgulho: -p.traits.coragem,
            },
            helper.id,
          );
      }
      if (!g!.accordIntent && !g!.accordRejected)
        add(
          "buscar_acordo",
          {
            paz: p.values.paz * 10,
            familia: p.values.familia * 2,
            rancor: -p.traits.rancor * 2,
            vinganca: -p.values.vinganca * 3,
            alternativa: 300,
          },
          target.id,
        );
      add(
        "perdoar",
        {
          paz: p.values.paz * 6,
          desapego: Math.floor((850 - weight) / 2),
          rancor: -p.traits.rancor * 3,
          vinganca: -p.values.vinganca * 4,
          alternativa: 250,
          aguardarResposta: g!.accordIntent && !g!.accordRejected ? -500 : 0,
          apoio: p.helpedBy ? 100 : 0,
        },
        target.id,
      );
    }
    // Witnesses spread only facts they actually know; a recipient must be present and not already know.
    if (!active && p.informed.length) {
      const listeners = roster ? roster.map((id) => getPerson(this.state, id)) : people(this.state);
      const news = firstUnknownRecipient(p.informed, listeners);
      if (news) add("comunicar", { noticia: 900, familia: p.values.familia * 2, paz: p.values.paz }, news.recipient, [news.offense]);
    }
    if (this.state.scenario.personalObjectives) {
      for (const pg of this.personalGoals(p).filter(
        (g) => g.closed === undefined,
      )) {
        if (pg.type === "governar") {
          const contact = this.campaignContact(p, pg);
          if (contact)
            add(
              "buscar_apoio",
              {
                poder: (p.values.poder || 0) * 6,
                ambicao: (p.traits.ambicao || 0) * 4,
                competencia: (p.skills?.lideranca || 0) * 2,
                projeto: 250,
              },
              contact.id,
              [pg.source, pg.lastEvent, p.lastBy.skills].filter(Boolean),
            );
          continue;
        }
        if (pg.type === "criar_obra") {
          if(this.daily && (p.occupation!=="criador" || this.daily.ability(p.id).write<0.5))continue;
          const saturation=this.daily?.saturation(p,pg.theme);
          add(
            "escrever_obra",
            {
              arte: (p.values.arte || 0) * 6,
              criatividade: (p.traits.criatividade || 0) * 3,
              projeto: 350,
              saturacaoFormato: -(saturation?.formatPenalty||0),
              repeticaoTema: -(saturation?.topicPenalty||0),
              perseveranca: (p.traits.perseveranca || 0) * 2,
            },
            p.id,
            [pg.source, pg.lastEvent, p.lastBy.skills,...(p.works||[]).map(id=>(this.state.entities[id] as Work).source)].filter(Boolean),
          );
          continue;
        }
        const other = getPerson(this.state, pg.target);
        if (!other.alive || !other.present) continue;
        const sources = [
          pg.source,
          pg.lastEvent,
          p.acquaintances?.[other.id],
          p.bonds?.[other.id]?.source,
        ].filter((x): x is string => !!x);
        if (pg.type === "amizade")
          add(
            "conviver",
            {
              vinculo: (p.values.amizade || 0) * 6,
              familia: p.values.familia * 2,
              objetivo: 300,
              ressentimento: -p.traits.rancor,
            },
            other.id,
            sources,
          );
        if (
          pg.type === "proteger" &&
          pg.threat &&
          !pg.threatResolved &&
          pg.aggressor
        ) {
          const attacker = getPerson(this.state, pg.aggressor);
          if (attacker.alive && attacker.present && pg.estimate) {
            for (const action of [
              "proteger",
              "avisar_alvo",
              "pedir_aliados",
              "afastar_alvo",
            ] as ProtectionAction[]) {
              const chance = pg.estimate.plans[action];
              if (!chance) continue;
              if (
                action === "pedir_aliados" &&
                !this.knownAllies(p, other.id, attacker.id).some(
                  (a) => a.id === pg.estimate!.ally,
                )
              )
                continue;
              add(
                action,
                {
                  solidariedade: (p.values.solidariedade || 0) * 4,
                  vinculo: p.kin.includes(other.id)
                    ? p.values.familia * 4
                    : (p.bonds?.[other.id]?.trust || 0) * 3,
                  urgencia: 200,
                  sucessoEstimado: chance * 5,
                  risco: -(100 - chance) * 2,
                  temperamento:
                    action === "proteger"
                      ? p.traits.coragem * 2
                      : p.traits.cautela,
                  custo:
                    action === "proteger"
                      ? -90
                      : action === "pedir_aliados"
                        ? -70
                        : action === "afastar_alvo"
                          ? -100
                          : -10,
                },
                other.id,
                [...sources, pg.perception!, pg.estimate.assessedAt],
              );
            }
          }
        }
      }
    }
    return result.sort(
      (a, b) => b.score - a.score || (a.action < b.action ? -1 : 1),
    );
  }
  private act(id: string, roster?: readonly string[]) {
    let p = getPerson(this.state, id);
    if (
      !p.alive ||
      !p.present ||
      this.reactedThisMonth.has(id) ||
      (this.daily && p.workedMonth===this.month) ||
      (p.lifeStage && p.lifeStage !== "adult" && !(this.daily && p.lifeStage==="elder"))
    )
      return;
    if(this.daily){
      this.daily.choose(id);p=getPerson(this.state,id);
      if(this.daily.work(id))return;
      if(this.daily.ability(id).write<0.5)for(const g of this.personalGoals(p).filter(g=>g.type==='criar_obra' && g.closed===undefined && g.workStarted)){
        const failure=this.emit('work.blocked',[{id,role:'actor'}],[g.lastEvent,...this.daily.ability(id).sources],[],{goal:g.id,reason:'Capacidade manual insuficiente para continuar a escrita.'});
        this.finishPersonalGoal(g,'failed',[failure.id],'Projeto interrompido por limitação manual.');
      }
    }
    if (this.state.scenario.personalObjectives) {
      this.prepareFriendship(p);
      if (this.state.scenario.advancedObjectives)
        this.prepareAdvancedGoals(getPerson(this.state, p.id));
      p = getPerson(this.state, id);
    }
    let goal = getGoal(this.state, p);
    if (
      goal &&
      goal.closed === undefined &&
      effectiveMemory(this.state, p, this.month) < rules.minMemory
    ) {
      this.closeGoal(
        goal,
        "desistência",
        [(this.state.entities[goal.memory] as Memory).source],
        "A ofensa perdeu força ao longo dos períodos, conforme o rancor.",
      );
      goal = getGoal(this.state, p);
    }
    if (
      goal &&
      goal.closed === undefined &&
      goal.accordIntent &&
      !goal.accordRejected
    ) {
      if (this.offerAgreement(goal)) return;
    }
    const candidates = this.candidates(id, roster),
      chosen = candidates[0];
    const reason = [
      "recuperar",
      "isolar",
      "hostilizar",
      "abandonar_posto",
    ].includes(chosen.action)
      ? "Necessidades e estresse percebidos alteraram a escolha conforme temperamento e responsabilidades."
      : chosen.action === "buscar_apoio"
        ? "Buscar coordenação por ambição, valores de poder e apoios conhecidos."
        : chosen.action === "escrever_obra"
          ? "Criar obra por arte, criatividade, perseverança e experiências conhecidas."
          : goal && goal.closed === undefined
            ? `${chosen.action} diante da morte conhecida de ${goal.victim}, atribuída a ${goal.target}; risco, valores e capacidade comparados.`
            : chosen.action === "confrontar"
              ? "Confrontar rival conhecido por hostilidade e oportunidade."
              : chosen.action === "comunicar"
                ? "Transmitir uma morte conhecida a alguém ainda sem notícia."
                : "Rotina mensal conforme disciplina, capacidade e cautela.";
    const decision: Decision = {
      actor: id,
      chosen: chosen.action,
      target: chosen.target,
      reason,
      candidates,
    };
    const causes = chosen.evidence.length ? chosen.evidence : ["event:0"];
    if (
      ["recuperar", "isolar", "hostilizar", "abandonar_posto"].includes(
        chosen.action,
      )
    ) {
      this.stressAction(p, chosen.action, chosen.target, causes, decision);
      return;
    }
    if (chosen.action === "buscar_apoio") {
      this.campaign(p, getPerson(this.state, chosen.target!), causes, decision);
      return;
    }
    if (chosen.action === "escrever_obra") {
      this.writeWork(p, causes, decision);
      return;
    }
    if (chosen.action === "conviver") {
      this.socialize(
        p,
        getPerson(this.state, chosen.target!),
        causes,
        decision,
      );
      return;
    }
    if (
      ["proteger", "avisar_alvo", "pedir_aliados", "afastar_alvo"].includes(
        chosen.action,
      )
    ) {
      this.protectiveResponse(
        p,
        chosen.target!,
        chosen.action as ProtectionAction,
        causes,
        decision,
      );
      return;
    }
    if (chosen.action === "confrontar") {
      this.confront(p, getPerson(this.state, chosen.target!), causes, decision);
      return;
    }
    if (chosen.action === "comunicar") {
      const target = getPerson(this.state, chosen.target!),
        g = getGoal(this.state, p);
      const active = g && g.closed === undefined;
      const offense = active
        ? g.offense
        : p.informed.find((o) => !target.informed.includes(o));
      if (!offense) return;
      const eid = this.nextId();
      if (active)
        this.emit(
          "help.requested",
          [
            { id: p.id, role: "actor" },
            { id: target.id, role: "target" },
          ],
          causes,
          [{ op: "replace", entity: changed(p, { helpFrom: target.id }, eid) }],
          { sender: p.id, recipient: target.id, offense, periodMonths: 1 },
          decision,
        );
      this.emit(
        "information.shared",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "target" },
        ],
        [...causes, ...(active ? [eid] : []), offense],
        [],
        { sender: p.id, recipient: target.id, offense },
        active ? undefined : decision,
      );
      return;
    }
    if (
      chosen.action === "buscar_acordo" &&
      goal &&
      goal.closed === undefined
    ) {
      const e = this.emit(
        "agreement.sought",
        [
          { id: p.id, role: "actor" },
          { id: goal.target, role: "reference" },
        ],
        causes,
        [{ op: "replace", entity: { ...goal, accordIntent: this.nextId() } }],
        {
          goal: goal.id,
          reason: "Buscar acordo bilateral; ausência não significa recusa.",
        },
        decision,
      );
      this.offerAgreement({ ...goal, accordIntent: e.id });
      return;
    }
    if (chosen.action === "perdoar" && goal && goal.closed === undefined) {
      const e = this.emit(
        "forgiveness.chosen",
        [
          { id: p.id, role: "actor" },
          { id: goal.target, role: "reference" },
        ],
        causes,
        [],
        {
          unilateral: true,
          reason: "Renúncia pessoal, sem depender da aceitação do outro.",
        },
        decision,
      );
      this.closeGoal(
        goal,
        "desistência",
        [e.id],
        "O agente perdoou unilateralmente e encerrou sua vingança.",
      );
      return;
    }
    const gain =
      chosen.action === "treinar"
        ? Math.min(
            rules.maxSkill - p.skill,
            (goal && goal.closed === undefined ? 4 : 1) +
              Math.floor(p.traits.disciplina / 20) +
              (p.helpedBy ? 4 : 0),
          )
        : 0;
    const eid = this.nextId();
    const monitoring = this.personalGoals(p).filter(
      (g) =>
        g.type === "proteger" &&
        g.closed === undefined &&
        getPerson(this.state, g.target).alive &&
        getPerson(this.state, g.target).present,
    );
    this.emit(
      "activity.period",
      [{ id: p.id, role: "actor" }],
      [...causes, ...monitoring.map((g) => g.lastEvent)],
      [
        ...(gain
          ? [
              {
                op: "replace" as const,
                entity: changed(p, { skill: p.skill + gain }, eid),
              },
            ]
          : []),
        ...monitoring.map((g) => ({
          op: "replace" as const,
          entity: { ...g, lastMonitored: eid },
        })),
      ],
      {
        monitoringGoals: monitoring.map((g) => g.id),
        action: chosen.action,
        periodMonths: 1,
        skillBefore: p.skill,
        gain,
        skillAfter: p.skill + gain,
        memoryWeight: effectiveMemory(this.state, p, this.month),
      },
      decision,
    );
  }
  private confront(
    actor: Person,
    target: Person,
    causes: string[],
    decision: Decision,
  ) {
    if (this.state.scenario.personalObjectives) {
      const threat = this.emit(
        "threat.announced",
        [
          { id: actor.id, role: "actor" },
          { id: target.id, role: "target" },
        ],
        causes,
        [],
        { aggressor: actor.id, target: target.id },
        decision,
      );
      this.drain();
      if (
        this.state.scenario.emotionalDynamics &&
        this.recurrentThreat(threat)
      ) {
        this.resolveThreat(
          threat.id,
          this.state.events[this.state.events.length - 1].id,
        );
        return;
      }
      actor = getPerson(this.state, actor.id);
      target = getPerson(this.state, target.id);
      let interrupted = false;
      for (const protector of people(this.state).filter(
        (p) => p.alive && p.present && p.id !== actor.id && p.id !== target.id,
      )) {
        const pg = this.personalGoals(protector).find(
          (g) =>
            g.type === "proteger" &&
            g.closed === undefined &&
            g.threat === threat.id,
        );
        if (!pg) continue;
        const choices = this.candidates(protector.id),
          choice = choices[0];
        if (
          !choice ||
          ![
            "proteger",
            "avisar_alvo",
            "pedir_aliados",
            "afastar_alvo",
          ].includes(choice.action) ||
          choice.target !== target.id
        )
          continue;
        const d: Decision = {
          actor: protector.id,
          chosen: choice.action,
          target: target.id,
          candidates: choices,
          reason:
            "Intervir em ameaça que presenciei contra pessoa conhecida ou por solidariedade.",
        };
        if (
          this.protectiveResponse(
            protector,
            target.id,
            choice.action as ProtectionAction,
            choice.evidence,
            d,
          )
        ) {
          interrupted = true;
          break;
        }
      }
      if (interrupted) {
        const prevented = this.emit(
          "confrontation.prevented",
          [
            { id: actor.id, role: "actor" },
            { id: target.id, role: "target" },
          ],
          [
            threat.id,
            ...Object.values(this.state.entities)
              .filter(
                (x): x is PersonalGoal =>
                  x.kind === "personalGoal" && x.threat === threat.id,
              )
              .map((g) => g.lastEvent),
          ],
          [],
          { threat: threat.id },
        );
        this.resolveThreat(threat.id, prevented.id);
        return;
      }
      causes = [threat.id];
    }
    if (this.anatomy) {
      this.anatomy.duel(actor.id, target.id, causes);
      return;
    }
    const jitter = sample(
      this.state.scenario.seed,
      `combat:${actor.id}:${target.id}:${this.month}`,
      -30,
      30,
    );
    const advantage = actor.skill - target.skill + jitter;
    const threat =
      actor.skill -
      target.skill +
      target.traits.cautela * 3 -
      target.traits.coragem * 2;
    const flee = threat > rules.flightMargin && target.traits.cautela > 35;
    const winner = advantage >= 0 ? actor : target,
      loser = advantage >= 0 ? target : actor;
    const lethal = !flee && Math.abs(advantage) >= rules.lethalMargin;
    const resolution = flee ? "fuga" : lethal ? "morte" : "recuo";
    const eid = this.nextId();
    const effects: Effect[] = flee
      ? [
          {
            op: "replace",
            entity: changed(target, { escaped: true, present: false }, eid),
          },
        ]
      : [];
    const e = this.emit(
      "confrontation.resolved",
      [
        { id: actor.id, role: "actor" },
        { id: target.id, role: "target" },
      ],
      [...causes, target.lastBy.traits, target.lastBy.skill].filter(Boolean),
      effects,
      {
        abstract: true,
        defenderResponse: {
          actor: target.id,
          chosen: flee ? "fugir" : "resistir",
          fleeEligible: target.traits.cautela > 35,
          utilities: { fugir: threat - rules.flightMargin, resistir: 0 },
          reason:
            "Ameaça e cautela comparadas à opção de resistir; resposta abstrata, sem corpo.",
        },
        advantage,
        jitter,
        threat,
        result: resolution,
        winner: !flee ? winner.id : null,
        loser: !flee ? loser.id : target.id,
        weapon: null,
        bodyPart: null,
      },
      this.state.scenario.personalObjectives ? undefined : decision,
    );
    if (this.state.scenario.personalObjectives) {
      const threat = [...this.state.events]
        .reverse()
        .find(
          (x) =>
            x.type === "threat.announced" &&
            x.data.aggressor === actor.id &&
            x.data.target === target.id,
        );
      if (threat && (!this.state.scenario.emotionalDynamics || !lethal))
        this.resolveThreat(threat.id, e.id);
    }
    if (flee) {
      for (const g of goals(this.state).filter(
        (g) =>
          g.closed === undefined &&
          g.target === target.id &&
          g.owner === actor.id,
      ))
        this.closeGoal(
          g,
          "fuga",
          [e.id],
          "O alvo escolheu escapar diante da ameaça superior; não houve morte.",
        );
      return;
    }
    if (lethal) {
      this.die(loser, winner.id, e.id);
      if (this.state.scenario.emotionalDynamics && loser.id === actor.id) {
        const announced = [...this.state.events]
          .reverse()
          .find(
            (x) =>
              x.type === "threat.announced" &&
              x.month === this.month &&
              x.data.aggressor === actor.id &&
              x.data.target === target.id,
          );
        if (announced) this.resolveThreat(announced.id, e.id);
      }
    }
  }
  private die(
    p: Person,
    killer: string | undefined,
    cause: string,
    details: Record<string, unknown> = {},
  ) {
    const current = getPerson(this.state, p.id);
    if (!current.alive) return;
    const id = this.nextId();
    this.emit(
      "person.died",
      [
        { id: p.id, role: "victim" },
        ...(killer
          ? [
              {
                id: killer,
                role:
                  details.wound || !getPerson(this.state, killer).alive
                    ? ("reference" as const)
                    : ("actor" as const),
              },
            ]
          : []),
      ],
      [cause, current.lastBy.alive],
      [
        {
          op: "replace",
          entity: changed(current, { alive: false, death: id, killer }, id),
        },
      ],
      {
        victim: p.id,
        ageYears: this.life?.get(p.id) ? Math.floor((this.month-this.life.get(p.id)!.birthMonth)/12) : undefined,
        killer: killer || null,
        killerSkill: killer ? getPerson(this.state, killer).skill : null,
        cause: "confronto abstrato",
        weapon: null,
        bodyPart: null,
        ...details,
      },
    );
    const place = this.state.entities["place:void"] as Place;
    if (place.leader === p.id) {
      const vacant = this.nextId();
      this.emit(
        "leadership.vacated",
        [{ id: p.id, role: "reference" }],
        [id, place.leaderSource!],
        [
          {
            op: "replace",
            entity: { ...place, leader: undefined, leaderSource: vacant },
          },
        ],
        { cause: id },
      );
    }
    for (const pg of this.allPersonalGoals().filter(
      (g) => g.closed === undefined && (g.owner === p.id || g.target === p.id),
    ))
      this.finishPersonalGoal(pg, "failed", [id], gReason(pg, p.id));
    if (killer && getPerson(this.state, killer).alive) {
      const k = getPerson(this.state, killer);
      const remorse = Math.floor(
        (k.values.paz + k.values.familia + k.traits.cautela) / 3,
      );
      const rid = this.nextId();
      this.emit(
        "remorse.felt",
        [
          { id: k.id, role: "actor" },
          { id: p.id, role: "reference" },
        ],
        [id, k.lastBy.values],
        [{ op: "replace", entity: changed(k, { remorse }, rid) }],
        { remorse, reason: "Avaliação da própria morte causada." },
      );
    }
    if(this.daily)for(const work of Object.values(this.state.entities).filter((e):e is Work=>e.kind==='work' && e.owner===p.id && !e.ownerEstate)){
      this.emit('work.estate.recorded',[{id:p.id,role:'reference'}],[id,work.ownerSource||work.source],[{op:'replace',entity:{...work,ownerEstate:true,ownerSource:this.nextId()}}],{work:work.id,owner:p.id,reason:'Espólio registrado; sem herdeiro presumido.'});
    }
    this.life?.onDeath(p.id, id);
  }
  run(untilMonth = this.state.scenario.months): SliceWorld {
    this.advance(untilMonth);
    return this.legacySnapshot();
  }
  /** Advance a monthly boundary without materializing an unused full snapshot. */
  advance(untilMonth = this.state.scenario.months): void {
    const end = Math.min(untilMonth, this.state.scenario.months);
    for (this.month = this.state.nextMonth; this.month < end; this.month++) {
      this.reactedThisMonth.clear();
      this.availability();
      if (this.state.scenario.emotionalDynamics) this.needsPeriod();
      const s = this.state.scenario;
      this.life?.monthly();
      this.anatomy?.monthly();
      const scene = s.bodySimulation?.singleDuel;
      if (
        scene &&
        scene.month === this.month &&
        !Object.values(this.state.entities).some((e) => e.kind === "duel")
      ) {
        this.anatomy!.duel(
          scene.attacker,
          scene.defender,
          ["event:1"],
          scene.caregiver,
        );
      }
      if (s.externalDeathMonth === this.month) {
        const p = getPerson(this.state, s.offender);
        if (p.alive) {
          const e = this.emit(
            "external.incident",
            [{ id: p.id, role: "reference" }],
            ["event:0"],
            [],
            {
              fixture: true,
              reason: "Intervenção de teste: outra causa, não geração livre.",
            },
          );
          this.die(p, undefined, e.id);
        }
      }
      this.drain();
      // Births are settled before this action phase. Reuse only the ID order;
      // every candidate reads current entities after earlier actions/reactions.
      const roster = people(this.state).map((p) => p.id);
      for (const id of roster) {
        this.act(id, roster);
        this.drain();
      }
      this.daily?.consume();
      this.drain();
      this.state.nextMonth = this.month + 1;
    }
    if (
      this.state.nextMonth === this.state.scenario.months &&
      !this.state.complete
    ) {
      this.month = this.state.nextMonth - 1;
      for (const g of goals(this.state).filter((g) => g.closed === undefined))
        this.closeGoal(
          g,
          "objetivo frustrado",
          [g.source],
          "O horizonte terminou sem resolução.",
        );
      for (const pg of this.allPersonalGoals().filter(
        (g) => g.closed === undefined,
      )) {
        const success =
          pg.type === "proteger" &&
          getPerson(this.state, pg.owner).alive &&
          getPerson(this.state, pg.target).alive &&
          pg.interventions > 0;
        this.finishPersonalGoal(
          pg,
          success ? "completed" : "failed",
          [pg.lastEvent, ...(pg.lastMonitored ? [pg.lastMonitored] : [])],
          success
            ? "Pessoa protegida viva no horizonte e intervenção efetiva registrada."
            : "Horizonte encerrado sem satisfazer o objetivo.",
        );
      }
      this.drain();
      this.life?.balance();
      this.state.complete = true;
    }
  }
}
export function simulateSlice(scenario: Scenario) {
  // This compatibility helper explicitly returns the full v2 log; avoid a compact→full round trip.
  return new SliceSimulation(scenario, undefined, { storage: "legacy" }).run();
}
