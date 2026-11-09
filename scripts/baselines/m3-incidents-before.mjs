// scripts/m3-review-bench.ts
import { Session } from "node:inspector";
import { performance } from "node:perf_hooks";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

// src/engine/rng.ts
function hash(seed2) {
  let h = 2166136261;
  for (const c of seed2) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  return (h ^ h >>> 16) >>> 0;
}

// src/engine/v2/rules.ts
var rules = {
  monthsPerYear: 12,
  daysPerMonth: 30,
  maxSkill: 1e3,
  noise: 25,
  minMemory: 100,
  revengeThreshold: 180,
  lethalMargin: 45,
  flightMargin: 130,
  perceptionRadius: "same-abstract-place",
  maxEvents: 1e5
};
var sample = (seed2, key, min, max) => min + hash(`${seed2}|${key}`) % (max - min + 1);
var noise = (seed2, id, month, action) => sample(seed2, `decision:${id}:${month}:${action}`, -rules.noise, rules.noise);
var names = [
  "Runa",
  "Elian",
  "Skarn",
  "Mira",
  "Orin",
  "Tala",
  "Neris",
  "Doran",
  "Luma",
  "Bram",
  "Iria",
  "Zarek",
  "Syl",
  "Alda",
  "Corin",
  "Vela",
  "Thorin",
  "Mael",
  "Sora",
  "Iven"
];
var traitKeys = [
  "rancor",
  "coragem",
  "disciplina",
  "cautela"
];
var valueKeys = ["familia", "vinganca", "paz"];
var memoryWeight = (weight, rancor, elapsed) => Math.max(0, weight - Math.floor(elapsed * (105 - rancor) / 12));

// src/engine/v2/economy.ts
var lightEconomy = () => ({
  initial: { food: 96, wood: 240, fiber: 240, pigment: 160, tools: 6 },
  harvest: 48
});
var foodNeed = (stage) => stage === "child" ? 2 : 4;
function ration(stock, needs) {
  const total = needs.reduce((a, b) => a + b, 0), consumed = Math.min(stock, total);
  return { consumed, coverage: total ? consumed / total : 1 };
}
function hungerAfter(before, coverage) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(before + (1 - coverage) * 20 - (coverage === 1 ? 25 : 0))
    )
  );
}
function recipe(stock, paper, ink) {
  if (stock.tools < 4 && stock.wood >= 2)
    return {
      item: "ferramentas",
      take: { wood: 2 },
      give: { tools: 2 },
      paper: 0,
      ink: 0
    };
  if (paper < 6 && stock.fiber >= 3)
    return { item: "papel", take: { fiber: 3 }, give: {}, paper: 3, ink: 0 };
  if (ink < 4 && stock.pigment >= 2)
    return { item: "tinta", take: { pigment: 2 }, give: {}, paper: 0, ink: 2 };
  return void 0;
}
var reserveMonths = (food, demand) => demand > 0 ? food / demand : Infinity;
var cultivationNeed = (food, demand) => Math.max(0, 12 - reserveMonths(food, demand)) * 180;
var toolLifetime = 12;
var cultivationYield = (harvest, capacity, stress, hasTool) => Math.floor(
  harvest * capacity * Math.max(0.6, 1 - stress / 2500) * (hasTool ? 1 : 0.6)
);

// src/engine/v2/political-incidents.ts
function theftUtility(p, book) {
  return { take: (p.traits.ambicao || 0) + (p.traits.agressividade || 0) + (p.values.poder || 0) + (book ? Math.max(0, p.values.arte || 0) : p.hunger || 0) - (p.values.lei || 0) - (p.traits.autocontrole || 0), leave: 100 + p.traits.cautela };
}
function shortage(food, demand, hunger) {
  return demand > 0 && (food / demand < 2 || hunger >= 40);
}
var PoliticalIncidents = class {
  constructor(c) {
    this.c = c;
  }
  c;
  get w() {
    return this.c.world();
  }
  get month() {
    return this.c.month();
  }
  next() {
    return `event:${this.w.events.length}`;
  }
  person(id) {
    return this.w.entities[id];
  }
  resident(s) {
    return Object.values(this.w.entities).filter((p) => p.kind === "person" && p.alive && this.c.home(p.id)?.id === s.id);
  }
  usable(p) {
    return p.present && p.alive && ["adult", "elder"].includes(p.lifeStage || "") && !this.w.scenario.blockedInformation.includes(p.id);
  }
  busy(p) {
    return { op: "replace", entity: { ...p, workedMonth: this.month, lastBy: { ...p.lastBy, workedMonth: this.next() } } };
  }
  occupied(id) {
    return Object.values(this.w.entities).some((e) => e.kind === "politicalVisit" && e.actor === id && e.status === "travelling");
  }
  monthly() {
    if (this.month % 12 === 0) for (const from of this.c.settlements()) {
      const candidates = this.resident(from).filter((p2) => this.usable(p2) && !this.occupied(p2.id)).map((p2) => ({ id: p2.id, utility: (p2.traits.curiosidade || 0) + (p2.traits.sociabilidade || 0) + (p2.traits.ambicao || 0) - (p2.psychology?.stress || 0) / 10 })).sort((a, b) => b.utility - a.utility || a.id.localeCompare(b.id));
      if (!candidates.length || candidates[0].utility <= 80) continue;
      const neighbors = this.c.settlements().filter((s) => s.id !== from.id && this.resident(s).length);
      if (!neighbors.length) continue;
      const to = neighbors[sample(`${this.w.scenario.seed}|politics:visits`, `${from.id}:${this.month}`, 0, neighbors.length - 1)], p = this.person(candidates[0].id), id = `visit:${from.id}:${this.month}`, source = this.next();
      const distance = 30 + 30 * Math.abs(Number(from.id.split(":")[1]) - Number(to.id.split(":")[1]));
      this.c.emit("political.visit.started", [{ id: p.id, role: "actor" }], [from.source, to.source, p.lastBy.traits, p.lastBy.psychology], [{ op: "create", entity: { id, kind: "politicalVisit", actor: p.id, from: from.id, to: to.id, due: this.month + Math.ceil(distance / 60), status: "travelling", source, lastEvent: source } }, this.busy(p)], { visit: id, from: from.id, to: to.id, name: to.name, distanceKm: distance, reason: "utilidade de visitar supera permanecer", candidates, stay: 80 });
    }
    for (const v of Object.values(this.w.entities).filter((e) => e.kind === "politicalVisit" && e.status === "travelling" && e.due <= this.month)) this.arrive(v);
  }
  arrive(v) {
    let p = this.person(v.actor);
    const from = this.w.entities[v.from], to = this.w.entities[v.to];
    if (!this.usable(p) || this.c.home(p.id)?.id !== from.id) {
      this.c.emit("political.visit.ended", [{ id: p.id, role: "reference" }], [v.source, p.lastBy.alive, p.lastBy.present], [{ op: "replace", entity: { ...v, status: "finished", lastEvent: this.next() } }], { visit: v.id, reason: "viajante morreu, ficou indispon\xEDvel ou mudou de resid\xEAncia" });
      return;
    }
    const residents = this.resident(to), homes = [...new Set(residents.map((q) => this.w.entities[`life:${q.id}`].household))].map((id) => this.w.entities[id]);
    const food = homes.reduce((n, h) => n + (h.inventory?.food || 0), 0), demand = residents.reduce((n, q) => n + foodNeed(q.lifeStage), 0), hunger = Math.max(0, ...residents.map((q) => q.hunger || 0));
    const arrived = this.c.emit("political.visit.arrived", [{ id: p.id, role: "actor" }], [v.source, ...homes.map((h) => h.inventorySource || h.source)], [{ op: "replace", entity: { ...v, status: "finished", lastEvent: this.next() } }, this.busy(p)], { visit: v.id, from: from.id, to: to.id, name: to.name, food, demand, hunger, households: homes.map((h) => h.id), assumption: "Visita p\xFAblica com observa\xE7\xE3o de reservas e moradores; consumo de viagem contabilizado no domic\xEDlio de origem." });
    if (shortage(food, demand, hunger)) {
      const e = this.c.emit("scarcity.observed", [{ id: p.id, role: "actor" }], [arrived.id, ...residents.map((q) => q.lastBy.hunger).filter(Boolean)], [], { settlement: to.id, name: to.name, food, demand, hunger, criticalMonths: 2, observer: p.id, reason: hunger >= 40 ? "fome observada" : "reserva inferior a dois meses" });
      this.c.petition(e, p.id, from, to);
    }
    p = this.person(p.id);
    const victims = residents.filter((q) => q.alive && q.present && ["adult", "elder"].includes(q.lifeStage || ""));
    if (!victims.length) return;
    const works = Object.values(this.w.entities).filter((e) => e.kind === "work" && !e.ownerEstate && victims.some((q) => q.id === e.owner));
    const book = works[0];
    const victim = book ? this.person(book.owner) : victims.find((q) => {
      const h = this.w.entities[this.w.entities[`life:${q.id}`].household];
      return (h.writingStock?.paper || 0) > 0;
    });
    if (!victim) return;
    const scores = theftUtility(p, !!book);
    if (scores.take <= scores.leave) return;
    const donor = this.w.entities[this.w.entities[`life:${victim.id}`].household], receiver = this.w.entities[this.w.entities[`life:${p.id}`].household];
    if (donor.id === receiver.id) return;
    const amount = book ? 0 : Math.min(3, donor.writingStock.paper), source = this.next();
    const effects = book ? [{ op: "replace", entity: { ...book, owner: p.id, ownerSource: source } }] : [{ op: "replace", entity: { ...donor, writingStock: { ...donor.writingStock, paper: donor.writingStock.paper - amount }, stockSource: source } }, { op: "replace", entity: { ...receiver, writingStock: { ...receiver.writingStock, paper: receiver.writingStock.paper + amount }, stockSource: source } }];
    const stolen = this.c.emit("property.stolen", [{ id: p.id, role: "actor" }, { id: victim.id, role: "victim" }], [arrived.id, p.lastBy.traits, p.lastBy.values, book?.ownerSource || donor.stockSource, receiver.stockSource], effects, { work: book?.id || null, material: book ? null : "papel", amount, from: victim.id, to: p.id, fromHousehold: donor.id, toHousehold: receiver.id, utilities: scores, visit: v.id, reason: "apropria\xE7\xE3o escolhida ap\xF3s observar o bem; transfer\xEAncia conservativa" });
    const draw = sample(`${this.w.scenario.seed}|politics:detection`, v.id, 0, 99), threshold = Math.max(15, 80 - Math.floor(p.traits.cautela / 2));
    if (draw < threshold && !this.w.scenario.blockedInformation.includes(victim.id)) {
      const perceived = this.c.emit("theft.perceived", [{ id: victim.id, role: "actor" }, { id: p.id, role: "reference" }], [stolen.id], [], { incident: stolen.id, offender: p.id, work: book?.id || null, material: book ? null : "papel", amount, draw, threshold });
      this.c.petition(perceived, victim.id, to, from);
    }
  }
};

// src/engine/v2/emotions.ts
var bounded = (n, max = 100) => Math.max(0, Math.min(max, Math.round(n)));
var initialPsychology = () => ({
  stress: 0,
  needs: { seguranca: 0, descanso: 0, vinculo: 0, expressao: 0 }
});
function appraise(p, stimulus, expectedNaturalLoss = false) {
  const t2 = p.traits, v = p.values;
  const anger = t2.rancor + (t2.agressividade || 0) + Math.max(0, v.vinganca);
  const care = (t2.compaixao || 0) + Math.max(0, v.paz) + (t2.autocontrole || 0);
  const anxiety = (t2.ansiedade || 0) + t2.cautela;
  const intensity = stimulus === "vitoria" ? 25 : bounded(45 + (t2.sensibilidade || 0) / 3 - (t2.esperanca || 0) / 5);
  const delta = stimulus === "vitoria" ? -intensity : intensity * (stimulus === "perda" || stimulus === "traicao" ? 4 : 2);
  let emotion, facet, belief, change;
  if (stimulus === "vitoria") {
    emotion = "orgulho";
    facet = "esperanca";
    belief = "honra";
    change = 2;
  } else if (anger > care && anger > anxiety) {
    emotion = stimulus === "perda" ? "luto irado" : "raiva";
    facet = "rancor";
    belief = "vinganca";
    change = 3;
  } else if (anxiety > care) {
    emotion = stimulus === "perda" ? "luto temeroso" : "medo";
    facet = "cautela";
    belief = "paz";
    change = 3;
  } else {
    emotion = stimulus === "perda" ? "luto solidario" : "tristeza reflexiva";
    facet = "compaixao";
    belief = "solidariedade";
    change = 2;
  }
  return {
    stimulus,
    emotion,
    intensity,
    stressDelta: expectedNaturalLoss && stimulus === "perda" ? Math.round(delta / 2) : delta,
    facet,
    belief,
    change: expectedNaturalLoss && stimulus === "perda" ? 1 : change,
    expectedNaturalLoss,
    appraisal: { anger, care, anxiety }
  };
}
function knowsExpectedLoss(p, source) {
  const d = source.data.knownDeath;
  return source.type === "information.received" && p.informed.includes(String(source.data.offense)) && d?.natural === true && typeof d.ageYears === "number" && d.ageYears >= 60;
}

// src/data/v2/personality.ts
var traits = {
  coragem: "Coragem",
  ganancia: "Gan\xE2ncia",
  orgulho: "Orgulho",
  rancor: "Rancor",
  curiosidade: "Curiosidade",
  amabilidade: "Amabilidade",
  impulsividade: "Impulsividade",
  ansiedade: "Ansiedade",
  perseveranca: "Perseveran\xE7a",
  lealdade: "Lealdade",
  ciume: "Ci\xFAme",
  propensaoDepressiva: "Propens\xE3o depressiva",
  ambicao: "Ambi\xE7\xE3o",
  compaixao: "Compaix\xE3o",
  crueldade: "Crueldade",
  sociabilidade: "Sociabilidade",
  paciencia: "Paci\xEAncia",
  disciplina: "Disciplina",
  confianca: "Confian\xE7a",
  altruismo: "Altru\xEDsmo",
  agressividade: "Agressividade",
  cautela: "Cautela",
  esperanca: "Esperan\xE7a",
  alegria: "Alegria",
  sensibilidade: "Sensibilidade",
  independencia: "Independ\xEAncia",
  criatividade: "Criatividade",
  honestidade: "Honestidade",
  tolerancia: "Toler\xE2ncia",
  autocontrole: "Autocontrole"
};
var values = {
  lei: "Lei",
  tradicao: "Tradi\xE7\xE3o",
  poder: "Poder",
  familia: "Fam\xEDlia",
  amizade: "Amizade",
  conhecimento: "Conhecimento",
  arte: "Arte",
  trabalho: "Trabalho",
  guerra: "Guerra",
  paz: "Paz",
  vinganca: "Vingan\xE7a",
  sacrificio: "Sacrif\xEDcio",
  honra: "Honra",
  riqueza: "Riqueza",
  liberdade: "Liberdade",
  fe: "F\xE9",
  justica: "Justi\xE7a",
  natureza: "Natureza",
  cooperacao: "Coopera\xE7\xE3o",
  solidariedade: "Solidariedade"
};
var traitActions = {
  coragem: ["confrontar", "proteger"],
  ganancia: ["buscar_apoio"],
  orgulho: ["buscar_apoio"],
  rancor: ["confrontar"],
  curiosidade: ["observar", "escrever_obra"],
  amabilidade: ["conviver", "avisar_alvo"],
  impulsividade: ["confrontar"],
  ansiedade: ["esperar", "afastar_alvo"],
  perseveranca: ["escrever_obra", "buscar_apoio"],
  lealdade: ["proteger", "pedir_aliados"],
  ciume: ["buscar_apoio"],
  propensaoDepressiva: ["esperar"],
  ambicao: ["buscar_apoio"],
  compaixao: ["avisar_alvo", "proteger"],
  crueldade: ["confrontar"],
  sociabilidade: ["conviver", "buscar_apoio"],
  paciencia: ["treinar", "escrever_obra"],
  disciplina: ["treinar", "escrever_obra"],
  confianca: ["buscar_acordo", "pedir_aliados"],
  altruismo: ["proteger", "afastar_alvo"],
  agressividade: ["confrontar"],
  cautela: ["esperar", "avisar_alvo"],
  esperanca: ["escrever_obra", "buscar_acordo"],
  alegria: ["conviver"],
  sensibilidade: ["escrever_obra"],
  independencia: ["escrever_obra"],
  criatividade: ["escrever_obra"],
  honestidade: ["buscar_acordo", "buscar_apoio"],
  tolerancia: ["perdoar", "buscar_acordo"],
  autocontrole: ["esperar", "perdoar"]
};
var valueActions = {
  lei: ["buscar_apoio", "buscar_acordo"],
  tradicao: ["escrever_obra"],
  poder: ["buscar_apoio"],
  familia: ["proteger"],
  amizade: ["conviver"],
  conhecimento: ["observar", "escrever_obra"],
  arte: ["escrever_obra"],
  trabalho: ["treinar", "escrever_obra"],
  guerra: ["confrontar"],
  paz: ["buscar_acordo", "perdoar"],
  vinganca: ["confrontar"],
  sacrificio: ["proteger", "pedir_aliados"],
  honra: ["proteger", "buscar_apoio"],
  riqueza: ["escrever_obra", "buscar_apoio"],
  liberdade: ["afastar_alvo", "escrever_obra"],
  fe: ["perdoar", "escrever_obra"],
  justica: ["buscar_acordo", "proteger"],
  natureza: ["observar", "escrever_obra"],
  cooperacao: ["pedir_aliados", "buscar_apoio"],
  solidariedade: ["avisar_alvo", "proteger"]
};
function personalityFactors(p, action) {
  const factors = {};
  for (const key of Object.keys(traits))
    if (traitActions[key].includes(action))
      factors[`tra\xE7o:${key}`] = ((p.traits[key] ?? 50) - 50) * 2;
  for (const key of Object.keys(values))
    if (valueActions[key].includes(action))
      factors[`valor:${key}`] = p.values[key] || 0;
  return factors;
}

// src/engine/v2/scenario.ts
function freeScenario(seed2) {
  const people2 = Array.from({ length: 20 }, (_, i) => {
    const id = `person:${String(i).padStart(2, "0")}`;
    return {
      id,
      kind: "person",
      name: names[(i + sample(seed2, "name-offset", 0, 19)) % 20],
      born: -sample(seed2, `${id}:age`, 18, 45),
      alive: true,
      traits: Object.fromEntries(
        traitKeys.map((k) => [k, sample(seed2, `${id}:${k}`, 5, 95)])
      ),
      values: Object.fromEntries(
        valueKeys.map((k) => [k, sample(seed2, `${id}:${k}`, 0, 100)])
      ),
      skill: sample(seed2, `${id}:skill`, 50, 220),
      kin: [],
      hostility: 0,
      trainAccess: true,
      canHelp: sample(seed2, `${id}:help`, 0, 100) > 35,
      present: true,
      escaped: false,
      remorse: 0,
      informed: [],
      lastBy: {}
    };
  });
  const focal = people2[0], victim = people2[1], offender = people2[2], helper = people2[3], rival = people2[4];
  focal.kin = [victim.id];
  victim.kin = [focal.id];
  focal.skill = sample(seed2, "focal:skill", 35, 130);
  offender.rival = victim.id;
  offender.hostility = sample(seed2, "initial-hostility", 85, 100);
  offender.skill = sample(seed2, "offender:skill", 380, 520);
  offender.trainAccess = sample(seed2, "offender:training", 0, 100) > 55;
  victim.skill = sample(seed2, "victim:skill", 40, 120);
  victim.traits.cautela = sample(seed2, "victim:caution", 0, 30);
  helper.canHelp = true;
  helper.values.familia = sample(seed2, "helper:family", 45, 100);
  rival.rival = offender.id;
  rival.hostility = sample(seed2, "secondary-hostility", 15, 90);
  rival.skill = sample(seed2, "secondary-skill", 300, 750);
  const departure = sample(seed2, "departure", 2, 8), returnMonth = sample(seed2, "return", 24, 110);
  const schedules = people2.map((p) => ({
    id: p.id,
    from: 0,
    until: 239,
    period: 1,
    absentMonths: 0
  }));
  const schedule = schedules[2];
  schedule.period = returnMonth;
  schedule.absentMonths = returnMonth - departure;
  schedules[4].from = sample(seed2, "secondary-arrival", 36, 180);
  return {
    seed: seed2,
    mode: "free",
    months: 240,
    people: people2,
    schedules,
    focal: focal.id,
    victim: victim.id,
    offender: offender.id,
    helper: helper.id,
    blockedInformation: [],
    noReencounter: false
  };
}
var presentAt = (s, id, month) => {
  const schedule = s.schedules.find((x) => x.id === id);
  if (!schedule) return false;
  if (s.noReencounter && id === s.offender && month > 0) return false;
  return month >= schedule.from && month <= schedule.until && (schedule.period === 1 || month % schedule.period < schedule.period - schedule.absentMonths);
};
function personalScenario(seed2) {
  const s = freeScenario(seed2);
  s.personalObjectives = true;
  for (const p of s.people) {
    p.values.amizade = sample(seed2, `${p.id}:amizade`, 0, 100);
    p.values.solidariedade = sample(seed2, `${p.id}:solidariedade`, 0, 100);
    p.acquaintances = {};
    p.bonds = {};
    p.personalGoals = [];
  }
  return s;
}
function advancedScenario(seed2) {
  const s = personalScenario(seed2);
  s.advancedObjectives = true;
  for (const p of s.people) {
    for (const key of Object.keys(traits))
      p.traits[key] = sample(seed2, `${p.id}:facet:${key}`, 0, 100);
    for (const key of Object.keys(values))
      p.values[key] = sample(seed2, `${p.id}:belief:${key}`, -100, 100);
    p.skills = {
      lideranca: sample(seed2, `${p.id}:lideranca`, 20, 90),
      escrita: sample(seed2, `${p.id}:escrita`, 10, 80)
    };
    p.works = [];
  }
  return s;
}
function emotionalScenario(seed2) {
  const s = advancedScenario(seed2);
  s.emotionalDynamics = true;
  for (const p of s.people) p.psychology = initialPsychology();
  return s;
}

// src/engine/v2/life-scenario.ts
function lifeScenario(seed2, count = 12) {
  const s = emotionalScenario(seed2);
  s.months = 1200;
  s.personalObjectives = false;
  s.advancedObjectives = false;
  s.people = s.people.slice(0, count);
  s.schedules = s.schedules.slice(0, count);
  for (const [i, p] of s.people.entries()) {
    p.born = -sample(seed2, `${p.id}:founder-age`, 18, 35);
    p.kin = [];
    p.rival = void 0;
    p.hostility = sample(seed2, `${p.id}:duel-hostility`, 30, 100);
    p.medicalSkill = sample(seed2, `${p.id}:medicine`, 25, 95);
  }
  for (const q of s.schedules) {
    q.from = 0;
    q.until = 1199;
    q.period = 1;
    q.absentMonths = 0;
  }
  s.lifeSimulation = {};
  s.bodySimulation = {
    care: true,
    maxExchanges: 6,
    singleDuel: {
      attacker: s.people[0].id,
      defender: s.people[1].id,
      caregiver: s.people[2].id,
      month: sample(seed2, "family:duel-month", 60, 240)
    }
  };
  s.focal = s.people[3].id;
  s.victim = s.people[1].id;
  s.offender = s.people[0].id;
  s.helper = s.people[2].id;
  return s;
}

// src/engine/v2/demographic-scenario.ts
function demographicScenario(seed2, count = 12, adjusted = false) {
  if (![12, 40, 100].includes(count))
    throw Error("Expected 12, 40 or 100 founders");
  const s = lifeScenario(seed2, Math.min(count, 20));
  for (let offset = 20; offset < count; offset += 20) {
    const part = lifeScenario(
      `${seed2}:founders:${offset / 20}`,
      Math.min(20, count - offset)
    );
    const ids = Object.fromEntries(
      part.people.map((p, i) => [
        p.id,
        `person:${String(offset + i).padStart(2, "0")}`
      ])
    );
    s.people.push(
      ...part.people.map((p) => ({
        ...p,
        id: ids[p.id],
        name: `${p.name} ${offset / 20 + 1}`,
        kin: [],
        rival: void 0
      }))
    );
    s.schedules.push(...part.schedules.map((q) => ({ ...q, id: ids[q.id] })));
  }
  if (s.people.length !== count) throw Error("Wrong founder count");
  if (adjusted) s.lifeSimulation = { fertilityPolicy: "replacement-2c" };
  return s;
}

// src/engine/v2/daily-scenario.ts
function dailyScenario(seed2, count = 40) {
  const s = demographicScenario(seed2, count, true);
  s.personalObjectives = true;
  s.advancedObjectives = true;
  s.dailyLife = { initialPaper: 6, initialInk: 4 };
  return s;
}
function livelihoodScenario(seed2, count = 40) {
  const s = dailyScenario(seed2, count);
  s.dailyLife.economy = lightEconomy();
  return s;
}

// src/engine/v2/politics.ts
function settlementScenario(seed2, count = 40) {
  const s = livelihoodScenario(seed2, count);
  s.politics = { count: 3, termMonths: 60 };
  return s;
}
function warUtilities(p) {
  return {
    guerra: (p.traits.agressividade || 0) * 2 + p.traits.rancor + (p.values.poder || 0) + Math.max(0, p.values.vinganca) + p.traits.coragem - (p.psychology?.stress || 0) / 10,
    acordo: 100 + Math.max(0, p.values.paz) * 2 + (p.traits.compaixao || 0) + p.traits.cautela + (p.traits.autocontrole || 0)
  };
}
function politicalGate(w2, s, actor, incident, notice, month) {
  const p = w2.entities[actor];
  if (!s.mandate || s.leader !== actor || month >= s.termEnd || p?.kind !== "person" || !p.alive || !p.present)
    return "sem autoridade vigente";
  if (!incident || !["attack.attempted", "person.died", "scarcity.observed", "theft.perceived"].includes(incident.type) || incident.type === "person.died" && !incident.data.killer || incident.data.conflict)
    return "sem incidente pessoal v\xE1lido";
  if (!notice || notice.type !== "political.notice.received" || notice.data.incident !== incident.id || !notice.participants.some((x) => x.id === actor && x.role === "actor"))
    return "incidente n\xE3o conhecido pelo l\xEDder";
  return void 0;
}
var PoliticsSystem = class {
  constructor(c) {
    this.c = c;
    this.additions = new PoliticalIncidents({ ...c, settlements: () => this.settlements(), home: (id) => this.home(id), petition: (e, witness, from, to) => this.petition(e, witness, from, to) });
  }
  c;
  additions;
  beforeActions() {
    this.additions.monthly();
  }
  occupied(id) {
    return this.additions.occupied(id);
  }
  petition(e, witness, from, to) {
    const p = this.person(witness);
    if (!p.alive || !p.present || this.w.scenario.blockedInformation.includes(witness) || from.id === to.id) return;
    const id = `dispute:${e.id}`, distance = this.distance(from, to), due = this.month + Math.ceil(distance / 60), source = this.next();
    this.c.emit("political.notice.sent", [{ id: witness, role: "actor" }], [e.id, from.source, to.source], [{ op: "create", entity: { id, kind: "dispute", from: from.id, to: to.id, incident: e.id, witness, sent: source, due, status: "travelling", lastEvent: source } }], { incident: e.id, from: from.id, to: to.id, source: witness, distanceKm: distance, travelMonths: due - this.month });
  }
  get w() {
    return this.c.world();
  }
  get month() {
    return this.c.month();
  }
  next() {
    return `event:${this.w.events.length}`;
  }
  person(id) {
    return this.w.entities[id];
  }
  event(id) {
    return this.w.events[Number(id.slice(6))];
  }
  settlements() {
    return Array.from(
      { length: this.w.scenario.politics.count },
      (_, i) => this.w.entities[`settlement:${i}`]
    ).filter((e) => e?.kind === "settlement");
  }
  home(id) {
    const l = this.w.entities[`life:${id}`];
    return this.settlements().find((s) => s.homes.includes(l?.household || ""));
  }
  adults(s) {
    return Object.values(this.w.entities).filter(
      (p) => p.kind === "person" && p.alive && p.present && ["adult", "elder"].includes(p.lifeStage || "") && this.home(p.id)?.id === s.id
    );
  }
  distance(a, b) {
    return 30 + 30 * Math.abs(
      this.settlements().findIndex((s) => s.id === a.id) - this.settlements().findIndex((s) => s.id === b.id)
    );
  }
  initialize() {
    const names2 = ["Vale do Cedro", "Porto das Pedras", "Colina da Fonte"];
    for (let i = 0; i < this.w.scenario.politics.count; i++) {
      const id = `settlement:${i}`, source = this.next();
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
              name: names2[i],
              homes: this.w.scenario.people.filter((_, n) => n % this.w.scenario.politics.count === i).map((p) => `home:${p.id}`),
              office: "coordenador",
              termEnd: 0,
              source,
              lastEvent: source
            }
          }
        ],
        {
          name: names2[i],
          settlement: id,
          assumption: "Resid\xEAncia declarada dos fundadores; sem mapa ou hist\xF3ria anterior."
        }
      );
    }
    this.elections();
  }
  elections() {
    for (const original of this.settlements()) {
      let s = original;
      const old = s.leader ? this.person(s.leader) : void 0;
      if (old?.alive && this.month < s.termEnd) continue;
      if (s.leader) {
        const cause = old?.death || s.mandate;
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
                leader: void 0,
                mandate: void 0,
                lastEvent: this.next()
              }
            }
          ],
          {
            settlement: s.id,
            name: s.name,
            reason: old?.alive ? "fim do mandato" : "morte",
            office: s.office
          }
        );
        s = this.w.entities[s.id];
      }
      const adults = this.adults(s);
      if (!adults.length) continue;
      const scores = adults.map((p2) => {
        const supports = adults.filter(
          (v) => (p2.values.poder || 0) + (p2.skills?.lideranca || 0) + (p2.traits.confianca || 0) - Math.abs((v.values.lei || 0) - (p2.values.lei || 0)) / 2 + (v.kin.includes(p2.id) ? 30 : 0) >= 50
        ).map((v) => v.id);
        const kin = !!s.previous && p2.kin.includes(s.previous);
        return {
          id: p2.id,
          supports,
          kin,
          score: supports.length * 30 + (p2.skills?.lideranca || 0) + (p2.traits.ambicao || 0) + (kin ? 30 : 0) - (p2.psychology?.stress || 0) / 20
        };
      }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      const chosen = scores[0], p = this.person(chosen.id), source = this.next();
      this.c.emit(
        "office.appointed",
        [{ id: p.id, role: "actor" }],
        [s.lastEvent, ...adults.map((p2) => p2.lastBy.values), p.lastBy.traits],
        [
          {
            op: "replace",
            entity: {
              ...s,
              leader: p.id,
              mandate: source,
              termEnd: this.month + this.w.scenario.politics.termMonths,
              lastEvent: source
            }
          }
        ],
        {
          settlement: s.id,
          name: s.name,
          office: s.office,
          leader: p.id,
          termEnd: this.month + this.w.scenario.politics.termMonths,
          reason: chosen.kin ? "parentesco e apoio dos residentes" : "apoio dos residentes",
          candidates: scores,
          previous: s.previous || null
        }
      );
    }
  }
  incidents() {
    const recent = [];
    for (let i = this.w.events.length - 1; i >= 0; i--) {
      const e = this.w.events[i];
      if (e.month < this.month) break;
      if (e.type === "attack.attempted" || e.type === "information.received")
        recent.push(e);
    }
    for (const received of recent.reverse()) {
      const e = received.type === "information.received" ? this.event(String(received.data.offense)) : received;
      if (!e || e.type === "person.died" && (!e.data.killer || e.data.conflict))
        continue;
      const attacker = String(
        e.data.killer || e.participants.find((p) => p.role === "actor")?.id || ""
      ), victim = String(
        e.data.victim || e.participants.find((p) => p.role === "target")?.id || ""
      );
      const witnessId = received.type === "information.received" ? received.participants.find((p) => p.role === "actor")?.id : victim;
      if (!witnessId) continue;
      const witness = this.person(witnessId);
      if (e.type === "person.died" && !witness.kin.includes(victim)) continue;
      const from = this.home(witnessId), to = this.home(attacker);
      if (!from || !to || from.id === to.id) continue;
      const key = String(e.data.duel || e.id + ":" + from.id), id = `dispute:${key}`;
      if (this.w.entities[id]) continue;
      if (!witness?.alive || !witness.present || this.w.scenario.blockedInformation.includes(witness.id))
        continue;
      const distance = this.distance(from, to), due = this.month + Math.max(1, Math.ceil(distance / 60)), source = this.next();
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
              lastEvent: source
            }
          }
        ],
        {
          incident: e.id,
          from: from.id,
          to: to.id,
          distanceKm: distance,
          travelMonths: due - this.month,
          source: witness.id
        }
      );
    }
  }
  decide(d) {
    const s = this.w.entities[d.from];
    const p = s.leader ? this.person(s.leader) : void 0;
    let notice;
    if (p?.alive && p.present && !this.w.scenario.blockedInformation.includes(p.id))
      notice = this.c.emit(
        "political.notice.received",
        [
          { id: p.id, role: "actor" },
          { id: d.witness, role: "reference" }
        ],
        [d.sent, d.incident, s.mandate || s.source],
        [],
        {
          incident: d.incident,
          source: d.sent,
          witness: d.witness,
          settlement: s.id
        }
      );
    const denied = politicalGate(
      this.w,
      s,
      p?.id || "",
      this.event(d.incident),
      notice,
      this.month
    );
    const scores = p ? warUtilities(p) : void 0;
    if (!denied && scores && scores.guerra <= scores.acordo) {
      const target2 = this.w.entities[d.to];
      this.c.emit("dispute.proposed", [{ id: p.id, role: "actor" }], [notice.id, d.incident, s.mandate, p.lastBy.traits, p.lastBy.values], [{ op: "replace", entity: { ...d, status: "negotiating", leader: p.id, mandate: s.mandate, notice: notice.id, due: this.month + Math.ceil(this.distance(s, target2) / 60), lastEvent: this.next() } }], { from: s.id, to: target2.id, name: s.name, targetName: target2.name, incident: d.incident, utilities: scores, reason: "prefer\xEAncia por acordo de n\xE3o agress\xE3o; sem transfer\xEAncia presumida de bens" });
      return;
    }
    if (denied || !scores) {
      this.c.emit(
        "war.rejected",
        p ? [{ id: p.id, role: "reference" }] : [],
        [d.sent, ...notice ? [notice.id] : [], s.lastEvent],
        [
          {
            op: "replace",
            entity: { ...d, status: "closed", lastEvent: this.next() }
          }
        ],
        {
          from: d.from,
          to: d.to,
          name: s.name,
          reason: denied || "utilidade de acordo supera a guerra",
          utilities: scores || null,
          incident: d.incident
        }
      );
      return;
    }
    const target = this.w.entities[d.to];
    const due = this.month + Math.ceil(this.distance(s, target) / 30);
    const id = this.next();
    this.c.emit(
      "war.declared",
      [{ id: p.id, role: "actor" }],
      [
        notice.id,
        d.incident,
        s.mandate,
        p.lastBy.traits,
        p.lastBy.values,
        p.lastBy.psychology
      ],
      [
        {
          op: "replace",
          entity: {
            ...d,
            status: "declared",
            leader: p.id,
            mandate: s.mandate,
            notice: notice.id,
            declaration: id,
            due,
            lastEvent: id
          }
        }
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
        distanceKm: this.distance(s, target)
      }
    );
  }
  negotiate(d) {
    const a = this.w.entities[d.from], b = this.w.entities[d.to], p = b.leader ? this.person(b.leader) : void 0;
    const notice = p?.alive && p.present && !this.w.scenario.blockedInformation.includes(p.id) ? this.c.emit("political.notice.received", [{ id: p.id, role: "actor" }], [d.lastEvent, d.incident, b.mandate || b.source], [], { incident: d.incident, source: d.lastEvent, witness: d.witness, settlement: b.id }) : void 0;
    const deniedA = politicalGate(this.w, a, d.leader, this.event(d.incident), this.event(d.notice), this.month), deniedB = politicalGate(this.w, b, p?.id || "", this.event(d.incident), notice, this.month);
    const scores = p ? warUtilities(p) : void 0;
    const accepted = !deniedA && !deniedB && a.mandate === d.mandate && !!scores && scores.acordo >= scores.guerra;
    this.c.emit(accepted ? "dispute.agreed" : "dispute.unresolved", p ? [{ id: p.id, role: "reference" }] : [], [d.lastEvent, ...notice ? [notice.id] : [], a.lastEvent, b.lastEvent], [{ op: "replace", entity: { ...d, status: "closed", outcome: accepted ? "agreement" : "unresolved", lastEvent: this.next() } }], { from: a.id, to: b.id, name: a.name, targetName: b.name, incident: d.incident, accepted, utilities: scores || null, reason: accepted ? "ambos os l\xEDderes vigentes aceitam n\xE3o agress\xE3o; bens n\xE3o transferidos" : deniedA || deniedB || (a.mandate !== d.mandate ? "mandato mudou durante a negocia\xE7\xE3o" : "outro l\xEDder recusou o acordo") });
  }
  resolve(d) {
    const s = this.w.entities[d.from], t2 = this.w.entities[d.to];
    const gate = politicalGate(
      this.w,
      s,
      d.leader,
      this.event(d.incident),
      this.event(d.notice),
      this.month
    );
    if (gate || s.mandate !== d.mandate) {
      this.c.emit(
        "campaign.ended",
        [],
        [d.declaration, s.lastEvent],
        [
          {
            op: "replace",
            entity: { ...d, status: "closed", lastEvent: this.next() }
          }
        ],
        {
          conflict: d.id,
          reason: "autoridade mudou durante a viagem; campanha cancelada"
        }
      );
      return;
    }
    const attackers = this.adults(s), defenders = this.adults(t2);
    if (!attackers.length || !defenders.length) {
      this.c.emit(
        "campaign.ended",
        [],
        [d.declaration, s.lastEvent, t2.lastEvent],
        [
          {
            op: "replace",
            entity: { ...d, status: "closed", lastEvent: this.next() }
          }
        ],
        {
          conflict: d.id,
          reason: "sem adultos presentes em ambos os lados; n\xE3o houve confronto"
        }
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
        99
      ),
      threshold: Math.max(5, Math.min(45, 30 - Math.floor(p.skill / 40)))
    }));
    const dead = rolls.filter((r) => r.draw < r.threshold).map((r) => r.id);
    const e = this.c.emit(
      "campaign.resolved",
      roster.map((p) => ({ id: p.id, role: "reference" })),
      [d.declaration, s.mandate, ...roster.map((p) => p.lastBy.alive)],
      [
        {
          op: "replace",
          entity: { ...d, status: "closed", lastEvent: this.next() }
        }
      ],
      {
        conflict: d.id,
        from: s.id,
        to: t2.id,
        name: s.name,
        targetName: t2.name,
        casualties: dead,
        rolls,
        reason: "encontro armado ap\xF3s viagem; exposi\xE7\xE3o dos adultos presentes",
        assumption: "Conflito abstrato: sem executor individual presumido; crian\xE7as n\xE3o combatem."
      }
    );
    for (const id of dead) this.c.die(id, e.id, d.id);
    this.c.emit(
      "campaign.ended",
      [],
      [e.id, ...dead.map((id) => this.person(id).death)],
      [],
      {
        conflict: d.id,
        reason: "encontro encerrado; sem guerra autom\xE1tica recorrente",
        deaths: dead.length
      }
    );
  }
  monthly() {
    this.elections();
    this.incidents();
    for (const d of Object.values(this.w.entities).filter(
      (e) => e.kind === "dispute" && e.status !== "closed" && e.due <= this.month
    )) {
      if (d.status === "travelling") this.decide(d);
      else if (d.status === "negotiating") this.negotiate(d);
      else this.resolve(d);
    }
    this.elections();
  }
};

// src/engine/v2/writing.ts
function experienceParticipants(type, participants, data) {
  if (type === "person.born")
    return Array.isArray(data.parents) ? data.parents.filter((x) => typeof x === "string") : [];
  if (["partnership.formed", "friendship.formed"].includes(type))
    return participants.filter((p) => p.role !== "witness").map((p) => p.id);
  if ([
    "injury.perceived",
    "sequela.perceived",
    "family.loss.perceived",
    "care.controlled",
    "leadership.changed"
  ].includes(type))
    return participants.filter((p) => p.role === "actor").map((p) => p.id);
  return [];
}
function themeProof(actor, fact, evidence) {
  return evidence.type === "information.received" ? evidence.participants[0]?.id === actor && evidence.data.offense === fact : evidence.id === fact && Array.isArray(evidence.data.personalWitnesses) && evidence.data.personalWitnesses.includes(actor) && experienceParticipants(
    evidence.type,
    evidence.participants,
    evidence.data
  ).includes(actor);
}
function writingSaturation(works, typeOf, topic) {
  let sameTopicRun = 0;
  for (const w2 of [...works].reverse()) {
    if (!w2.theme || typeOf(w2.theme) !== topic) break;
    sameTopicRun++;
  }
  return {
    books: works.length,
    sameTopicRun,
    formatPenalty: 180 * works.length,
    topicPenalty: 120 * sameTopicRun
  };
}

// src/engine/v2/daily.ts
var domainSeed = (seed2, domain) => `${seed2}|2d1:${domain}`;
var DailySystem = class {
  constructor(c) {
    this.c = c;
  }
  c;
  get w() {
    return this.c.world();
  }
  get month() {
    return this.c.month();
  }
  next() {
    return `event:${this.w.events.length}`;
  }
  person(id) {
    return this.w.entities[id];
  }
  home(id) {
    const l = this.w.entities[`life:${id}`];
    return this.w.entities[l.household];
  }
  patch(p, fields) {
    return {
      ...p,
      ...fields,
      lastBy: {
        ...p.lastBy,
        ...Object.fromEntries(Object.keys(fields).map((k) => [k, this.next()]))
      }
    };
  }
  initialize() {
    const o = this.w.scenario.dailyLife;
    for (const h of Object.values(this.w.entities).filter(
      (e) => e.kind === "household"
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
              ...o.economy ? {
                inventory: { ...o.economy.initial },
                inventorySource: this.next()
              } : {}
            }
          }
        ],
        {
          household: h.id,
          inventory: o.economy?.initial,
          paper: o.initialPaper,
          ink: o.initialInk,
          reason: o.economy ? "Estoque inicial declarado; receitas e colheitas mensais expl\xEDcitas." : "Estoque inicial declarado; sem reposi\xE7\xE3o."
        }
      );
  }
  theme(p) {
    const home = this.home(p.id);
    if (home.stockSource && p.blockedWritingStock === home.stockSource) return;
    const previous = (p.personalGoals || []).map((id) => this.w.entities[id]).filter((e) => e.kind === "personalGoal" && e.type === "criar_obra").map((e) => e.kind === "personalGoal" ? e.theme : void 0);
    const works = (p.works || []).map((id) => this.w.entities[id]).filter((e) => e?.kind === "work");
    const candidates = [
      ...p.informed.map((fact) => ({
        fact,
        evidence: p.knownFactSources?.[fact]
      })),
      ...Object.values(p.livedFacts || {}).map((fact) => ({
        fact,
        evidence: fact
      }))
    ].filter(
      (x) => !!x.evidence && !previous.includes(x.fact) && this.knows(p, x.fact, x.evidence)
    );
    const counts = /* @__PURE__ */ new Map();
    for (const w2 of works) {
      const t2 = w2.theme ? this.eventType(w2.theme) : "unknown";
      counts.set(t2, (counts.get(t2) || 0) + 1);
    }
    candidates.sort(
      (a, b) => (counts.get(this.eventType(a.fact)) || 0) - (counts.get(this.eventType(b.fact)) || 0) || Number(b.fact.slice(6)) - Number(a.fact.slice(6))
    );
    return candidates[0];
  }
  eventType(id) {
    return this.w.events[Number(id.slice(6))]?.type || "unknown";
  }
  knows(p, fact, evidence) {
    const e = this.w.events[Number(evidence.slice(6))];
    if (!e || !themeProof(p.id, fact, e)) return false;
    if (e.type === "information.received") return p.informed.includes(fact);
    const life = this.w.entities[`life:${p.id}`];
    return !life || e.month - life.birthMonth >= 48;
  }
  saturation(p, theme) {
    return writingSaturation(
      (p.works || []).map((id) => this.w.entities[id]).filter((e) => e?.kind === "work"),
      (id) => this.eventType(id),
      theme ? this.eventType(theme) : "unknown"
    );
  }
  ability(id) {
    const b = this.c.body(), body = b.body(id), right = b.grip(id, "right"), left = b.grip(id, "left");
    return {
      farm: body.conscious ? Math.max(right, left) * (["left", "right"].reduce(
        (sum, side) => sum + (b.present(id, `leg.${side}`) ? Math.min(
          b.part(id, `leg.${side}`).bone,
          b.part(id, `leg.${side}`).nerve
        ) : 0),
        0
      ) / 2) * Math.max(0.4, 1 - (this.person(id).hunger || 0) / 125) : 0,
      craft: body.conscious ? Math.min(right, left) * Math.max(0.4, 1 - (this.person(id).hunger || 0) / 125) : 0,
      write: body.conscious ? (0.75 * right + 0.25 * left) * Math.max(0.4, 1 - (this.person(id).hunger || 0) / 125) : 0,
      care: body.conscious ? Math.max(right, left) * Math.max(0.4, 1 - (this.person(id).hunger || 0) / 125) : 0,
      sources: [
        body.lastEvent,
        ...this.person(id).lastBy.hunger ? [this.person(id).lastBy.hunger] : [],
        ...[
          "hand.left",
          "hand.right",
          "forearm.left",
          "forearm.right",
          "arm.left",
          "arm.right",
          "leg.left",
          "leg.right"
        ].map((k) => b.part(id, k).lastEvent)
      ]
    };
  }
  choose(id, urgent = false, source) {
    let p = this.person(id);
    if (!p.alive || !p.present || !["adult", "elder"].includes(p.lifeStage || "adult"))
      return;
    const a = this.ability(id), art = p.values.arte || 0, solidarity = p.values.solidariedade || 0;
    const h = this.home(id), economy = this.w.scenario.dailyLife?.economy;
    const residents = Object.values(this.w.entities).filter(
      (q) => q.kind === "person" && q.alive && this.home(q.id).id === h.id
    );
    const demand = residents.reduce((n, q) => n + foodNeed(q.lifeStage), 0);
    const craft = h.inventory && recipe(h.inventory, h.writingStock?.paper || 0, h.writingStock?.ink || 0);
    const scores = {
      criador: a.write < 0.5 ? -1e4 : Math.round(
        art * 3 + (p.traits.criatividade || 0) * 2 + (p.skills?.escrita || 0) * 2 - 350 * (1 - a.write)
      ),
      cuidador: a.care < 0.5 ? -1e4 : Math.round(
        solidarity * 2 + (p.traits.compaixao || 0) * 2 + (p.medicalSkill || 0) * 2 - 180 * (1 - a.care) + (urgent ? 500 : 0)
      ),
      cultivador: !economy || !h.inventory || a.farm < 0.1 || economy.harvest <= 0 ? -1e4 : Math.round(
        cultivationNeed(h.inventory.food, demand) + (p.traits.disciplina || 0) + this.aptitude(id, "cultivo") - 200 * (1 - a.farm)
      ),
      artes\u00E3o: !economy || !craft || a.craft < 0.5 ? -1e4 : Math.round(
        (h.inventory.tools < 2 ? 800 : 250) + (p.traits.criatividade || 0) + this.aptitude(id, "artesanato") - 200 * (1 - a.craft)
      ),
      "sem of\xEDcio": 90
    };
    if (p.blockedWritingStock === this.home(id).stockSource && p.blockedWritingStock)
      scores.criador -= 500;
    const options = Object.keys(scores).map((job) => ({
      job,
      score: scores[job] + (p.occupation === job ? 35 : 0),
      noise: sample(
        domainSeed(this.w.scenario.seed, "occupation"),
        `${id}:${this.month}:${job}`,
        0,
        4
      )
    })).sort(
      (x, y) => y.score + y.noise - x.score - x.noise || x.job.localeCompare(y.job)
    );
    const chosen = options[0].job;
    if (chosen === p.occupation) return;
    this.c.emit(
      "occupation.changed",
      [{ id, role: "actor" }],
      [
        ...a.sources,
        ...h.inventorySource ? [h.inventorySource] : [],
        ...residents.map(
          (q) => this.w.entities[`life:${q.id}`].lastEvent
        ),
        p.lastBy.traits,
        p.lastBy.values,
        ...p.lastBy.occupation ? [p.lastBy.occupation] : [],
        ...source ? [source] : []
      ],
      [{ op: "replace", entity: this.patch(p, { occupation: chosen }) }],
      {
        previous: p.occupation || null,
        occupation: chosen,
        capacity: a,
        foodReserveMonths: h.inventory ? reserveMonths(h.inventory.food, demand) : void 0,
        foodDemand: demand,
        aptitude: {
          cultivo: this.aptitude(id, "cultivo"),
          artesanato: this.aptitude(id, "artesanato")
        },
        options,
        reason: urgent ? "Ferimento presente criou oportunidade de cuidado." : "Habilidade, personalidade, valores e capacidade por tarefa; custo de trocar inclu\xEDdo."
      }
    );
  }
  aptitude(id, task) {
    return sample(
      domainSeed(this.w.scenario.seed, "livelihood"),
      `${id}:${task}`,
      20,
      80
    );
  }
  urgentFood(id) {
    const h = this.home(id), p = this.person(id);
    const demand = Object.values(this.w.entities).filter((q) => q.kind === "person" && q.alive && this.home(q.id).id === h.id).reduce((n, q) => n + foodNeed(q.lifeStage), 0);
    return p.occupation === "cultivador" && !!h.inventory && reserveMonths(h.inventory.food, demand) < 2;
  }
  work(id) {
    const p = this.person(id), o = this.w.scenario.dailyLife?.economy;
    if (!o || !p.alive || !p.present || p.workedMonth === this.month)
      return false;
    const h = this.home(id), stock = h.inventory;
    if (!stock) return false;
    const a = this.ability(id), next = { ...stock }, writing = { ...h.writingStock };
    let data, toolWear = h.toolWear || 0;
    if (p.occupation === "cultivador" && a.farm >= 0.1 && o.harvest > 0) {
      const amount = cultivationYield(
        o.harvest,
        a.farm,
        p.psychology?.stress || 0,
        stock.tools >= 1
      );
      if (!amount) return false;
      next.food += amount;
      const hasTool = stock.tools >= 1;
      const wearAfter = toolWear + (hasTool ? 1 : 0), used = wearAfter >= toolLifetime ? 1 : 0;
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
        reason: "Colheita renov\xE1vel declarada; ferramenta dura 12 per\xEDodos; trabalho manual rende 60%; estresse reduz rendimento, sem proibi\xE7\xE3o absoluta."
      };
    } else if (p.occupation === "artes\xE3o" && a.craft >= 0.5) {
      const r = recipe(stock, writing.paper, writing.ink);
      if (!r) return false;
      for (const [k, v] of Object.entries(r.take))
        next[k] -= v;
      for (const [k, v] of Object.entries(r.give))
        next[k] += v;
      writing.paper += r.paper;
      writing.ink += r.ink;
      data = {
        task: "fabricar",
        recipe: r,
        reason: "Convers\xE3o expl\xEDcita de material inicial; sem reposi\xE7\xE3o de mat\xE9ria-prima."
      };
    } else return false;
    this.c.emit(
      "livelihood.period",
      [{ id, role: "actor" }],
      [
        p.lastBy.occupation,
        p.lastBy.psychology,
        h.inventorySource,
        h.stockSource,
        ...a.sources
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
            stockSource: writing.paper !== h.writingStock.paper || writing.ink !== h.writingStock.ink ? this.next() : h.stockSource
          }
        },
        { op: "replace", entity: this.patch(p, { workedMonth: this.month }) }
      ],
      { household: h.id, periodMonths: 1, ...data }
    );
    return true;
  }
  consume() {
    if (!this.w.scenario.dailyLife?.economy) return;
    const homes = /* @__PURE__ */ new Map();
    for (const p of Object.values(this.w.entities))
      if (p.kind === "person" && p.alive) {
        const h = this.home(p.id);
        if (!homes.has(h.id)) homes.set(h.id, []);
        homes.get(h.id).push(p);
      }
    for (const [hid, residents] of homes) {
      const h = this.w.entities[hid];
      if (!h.inventory) continue;
      const needs = residents.map((p) => foodNeed(p.lifeStage)), r = ration(h.inventory.food, needs);
      const starving = [], effects = [
        {
          op: "replace",
          entity: {
            ...h,
            inventory: {
              ...h.inventory,
              food: h.inventory.food - r.consumed
            },
            inventorySource: this.next()
          }
        }
      ];
      const transitions = [];
      for (const p of residents) {
        const before = p.hunger || 0, after = hungerAfter(before, r.coverage);
        if (after >= 100) starving.push(p.id);
        if (before >= 40 !== after >= 40)
          transitions.push({ id: p.id, before, after });
        const fields = { hunger: after };
        if (after > 0 && p.psychology)
          fields.psychology = {
            ...p.psychology,
            stress: Math.min(1e3, p.psychology.stress + Math.ceil(after / 5))
          };
        if (after !== before || fields.psychology)
          effects.push({ op: "replace", entity: this.patch(p, fields) });
      }
      const e = this.c.emit(
        "household.consumption",
        [],
        [
          h.inventorySource,
          ...residents.map(
            (p) => this.w.entities[`life:${p.id}`].lastEvent
          )
        ],
        effects,
        {
          household: hid,
          periodMonths: 1,
          required: needs.reduce((a, b) => a + b, 0),
          consumed: r.consumed,
          coverage: r.coverage,
          residents: residents.map((p) => p.id)
        }
      );
      for (const t2 of transitions)
        this.c.emit(
          "hunger.changed",
          [{ id: t2.id, role: "reference" }],
          [e.id],
          [],
          t2
        );
      for (const id of starving) this.c.die(id, e.id);
    }
  }
  caregiver(owner, fallback, source) {
    const candidates = Object.values(this.w.entities).filter(
      (p2) => p2.kind === "person" && p2.id !== owner && p2.alive && p2.present && p2.canHelp && p2.workedMonth !== this.month && ["adult", "elder"].includes(p2.lifeStage || "adult")
    );
    const ranked = candidates.map((p2) => ({
      p: p2,
      ability: this.ability(p2.id).care,
      score: (p2.medicalSkill || 0) * 2 + (p2.traits.compaixao || 0) + (p2.values.solidariedade || 0)
    })).filter((x) => x.ability >= 0.5).sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id));
    const chosen = ranked[0];
    if (!chosen) return owner;
    this.choose(chosen.p.id, true, source);
    const p = this.person(chosen.p.id);
    if (p.occupation !== "cuidador") return owner;
    this.c.emit(
      "occupation.care.offered",
      [
        { id: p.id, role: "actor" },
        { id: owner, role: "beneficiary" }
      ],
      [source, p.lastBy.occupation],
      [{ op: "replace", entity: this.patch(p, { workedMonth: this.month }) }],
      {
        patient: owner,
        candidates: ranked.map((x) => ({
          id: x.p.id,
          score: x.score,
          capacity: x.ability
        })),
        score: chosen.score,
        capacity: chosen.ability,
        reason: "Ajuda presencial aceita como atividade deste per\xEDodo; o corpo ainda verifica consentimento e recursos."
      }
    );
    return p.id;
  }
  transfer(work) {
    const p = this.person(work.creator);
    if (!p.alive || work.owner !== p.id) return;
    const target = Object.values(this.w.entities).filter(
      (q) => q.kind === "person" && q.id !== p.id && q.alive && q.present && !!(p.bonds?.[q.id] || p.kin.includes(q.id))
    ).sort(
      (a, b) => (p.bonds?.[b.id]?.trust || 0) - (p.bonds?.[a.id]?.trust || 0) || a.id.localeCompare(b.id)
    )[0];
    if (!target || (p.values.amizade || 0) + (p.values.familia || 0) < 60)
      return;
    this.c.emit(
      "work.transferred",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "beneficiary" }
      ],
      [
        work.source,
        ...p.bonds?.[target.id] ? [p.bonds[target.id].source] : [p.lastBy.kin],
        p.lastBy.values
      ],
      [
        {
          op: "replace",
          entity: { ...work, owner: target.id, ownerSource: this.next() }
        }
      ],
      {
        work: work.id,
        from: p.id,
        to: target.id,
        reason: "Presente por v\xEDnculo conhecido e valor de amizade/fam\xEDlia."
      }
    );
  }
};

// src/engine/v2/information.ts
function firstUnknownRecipient(facts, listeners) {
  let best = facts.length, recipient;
  for (const q of listeners) {
    if (!q.alive || !q.present || best === 0) continue;
    if (q.informed.length >= facts.length) {
      let prefix = true;
      for (let i = 0; i < facts.length; i++) if (q.informed[i] !== facts[i]) {
        prefix = false;
        break;
      }
      if (prefix) continue;
    }
    const known = new Set(q.informed);
    for (let i = 0; i < best; i++) if (!known.has(facts[i])) {
      best = i;
      recipient = q.id;
      break;
    }
    if (best === 0) break;
  }
  return recipient === void 0 ? void 0 : { recipient, offense: facts[best] };
}

// src/engine/v2/demography.ts
function conceptionDiagnostic(w2, a, month) {
  if (!a.partner || a.owner > a.partner) return;
  const b = w2.entities[`life:${a.partner}`];
  if (!b) return;
  const l = a.role === "gestational" ? a : b, q = l === a ? b : a;
  const p = w2.entities[l.owner], other = w2.entities[q.owner];
  const family = p.values.familia + other.values.familia;
  const adjusted = w2.scenario.lifeSimulation?.fertilityPolicy === "replacement-2c";
  const cost = adjusted ? 30 : 60, max = adjusted ? 5 : 3;
  const desired = Math.max(0, Math.min(max, Math.round(family / cost)));
  const utility = family - l.children * cost - (p.psychology?.stress || 0) / 10 - (other.psychology?.stress || 0) / 10;
  const reasons = [];
  if (l.role !== "gestational" || q.role !== "contributor")
    reasons.push("pap\xE9is incompat\xEDveis");
  if (!p.alive || !other.alive) reasons.push("morte");
  if (!p.present || !other.present) reasons.push("aus\xEAncia");
  const age = month - l.birthMonth, otherAge = month - q.birthMonth;
  if (age < 216 || age > 540 || otherAge < 216 || otherAge > 780)
    reasons.push("idade");
  if (l.pregnancy) reasons.push("gesta\xE7\xE3o em curso");
  if (l.lastPregnancyEnd !== void 0 && month - l.lastPregnancyEnd < 24)
    reasons.push("intervalo");
  if (w2.scenario.lifeSimulation?.blockedConceptions?.includes(l.owner))
    reasons.push("bloqueio de fixture");
  if (desired === 0) reasons.push("desejo zero");
  else if (l.children >= desired) reasons.push("desejo satisfeito");
  if (utility < (adjusted ? 15 : 30)) reasons.push("utilidade insuficiente");
  if (!reasons.length && !(w2.scenario.lifeSimulation?.conceptionOverride ?? sample(
    w2.scenario.seed,
    `${l.owner}:${Math.floor(month / 12)}:conception`,
    0,
    99
  ) < 40))
    reasons.push("sorteio anual");
  return {
    reproductiveWindow: [a, b].some(
      (x) => x.role === "gestational" && month - x.birthMonth >= 216 && month - x.birthMonth <= 540
    ),
    month,
    pair: [a.owner, b.owner].sort().join("|"),
    owners: [a.owner, b.owner],
    desired,
    utility,
    reasons
  };
}

// src/engine/v2/life.ts
var stageAt = (age) => age < 144 ? "child" : age < 216 ? "youth" : age < 720 ? "adult" : "elder";
var ageCapacity = (age) => age < 216 ? Math.max(0.12, age / 216) : Math.max(0.5, 1 - Math.max(0, age - 720) / 1200);
var LifeSystem = class {
  constructor(c) {
    this.c = c;
  }
  c;
  get w() {
    return this.c.world();
  }
  get month() {
    return this.c.month();
  }
  person(id) {
    return this.w.entities[id];
  }
  all() {
    return Object.values(this.w.entities).filter(
      (e) => e.kind === "life"
    );
  }
  get(id) {
    return this.w.entities[`life:${id}`];
  }
  next() {
    return `event:${this.w.events.length}`;
  }
  replace(entity) {
    return { op: "replace", entity };
  }
  patch(p, fields) {
    return {
      ...p,
      ...fields,
      lastBy: {
        ...p.lastBy,
        ...Object.fromEntries(Object.keys(fields).map((k) => [k, this.next()]))
      }
    };
  }
  naturalDeadline(id, birth) {
    return this.w.scenario.lifeSimulation?.deathMonths?.[id] ?? birth + sample(this.w.scenario.seed, `${id}:lifespan:years`, 68, 92) * 12 + sample(this.w.scenario.seed, `${id}:lifespan:month`, 0, 11);
  }
  initialize() {
    for (const p of this.w.scenario.people) {
      const current = this.person(p.id), birth = p.born * 12, id = this.next(), home = `home:${p.id}`;
      const l = {
        id: `life:${p.id}`,
        kind: "life",
        owner: p.id,
        birthMonth: birth,
        stage: stageAt(-birth),
        parents: [],
        guardians: [],
        household: home,
        role: this.w.scenario.lifeSimulation?.roles?.[p.id] || (sample(this.w.scenario.seed, `${p.id}:reproductive-role`, 0, 1) ? "gestational" : "contributor"),
        genes: Object.fromEntries(
          Object.keys(p.traits).map((k) => [
            k,
            sample(this.w.scenario.seed, `${p.id}:founder-gene:${k}`, 15, 85)
          ])
        ),
        naturalDeathAt: this.naturalDeadline(p.id, birth),
        children: 0,
        source: id,
        lastEvent: id
      };
      this.c.emit(
        "family.founder.registered",
        [{ id: p.id, role: "reference" }],
        [current.lastBy.alive],
        [
          { op: "create", entity: { id: home, kind: "household", source: id } },
          { op: "create", entity: l },
          this.replace(
            this.patch(current, { kin: [...current.kin], lifeStage: l.stage })
          )
        ],
        {
          founder: true,
          parentsUnknown: true,
          prehistory: "n\xE3o simulada; sem mem\xF3rias fabricadas",
          heredity: "par\xE2metros fundadores independentes do fen\xF3tipo observado",
          birthMonth: birth,
          naturalDeathAt: l.naturalDeathAt
        }
      );
    }
  }
  ancestors(id, seen = /* @__PURE__ */ new Set()) {
    if (seen.has(id)) return seen;
    seen.add(id);
    for (const p of this.get(id)?.parents || []) this.ancestors(p, seen);
    return seen;
  }
  related(a, b) {
    const x = this.ancestors(a), y = this.ancestors(b);
    return [...x].some((id) => y.has(id));
  }
  link(a, b) {
    const p = this.person(a);
    return this.replace(this.patch(p, { kin: [.../* @__PURE__ */ new Set([...p.kin, b])] }));
  }
  partner(l) {
    const p = this.person(l.owner);
    if (!p.alive || !p.present || l.partner || this.month - l.birthMonth < 216)
      return;
    const candidates = this.all().filter(
      (x) => x.owner !== l.owner && !p.kin.includes(x.owner) && !x.partner && this.person(x.owner).alive && this.person(x.owner).present && this.month - x.birthMonth >= 216 && !this.related(l.owner, x.owner)
    );
    const desire = (a, b) => (a.values.familia > 40 && b.values.familia > 40 && this.get(a.id).role !== this.get(b.id).role ? 30 : 0) + a.values.familia + (a.values.amizade || 0) / 2 + (a.traits.confianca || 0) / 2 - (a.psychology?.stress || 0) / 20 - Math.abs(this.get(a.id).birthMonth - this.get(b.id).birthMonth) / 24;
    const scored = candidates.map((x) => ({
      id: x.owner,
      a: desire(p, this.person(x.owner)),
      b: desire(this.person(x.owner), p)
    })).filter((x) => x.a >= 45 && x.b >= 45).sort((a, b) => b.a + b.b - (a.a + a.b) || (a.id < b.id ? -1 : 1));
    if (!scored.length) return;
    const chosen = scored[0], q = this.get(chosen.id), e = this.next();
    this.c.emit(
      "partnership.formed",
      [
        { id: l.owner, role: "actor" },
        { id: q.owner, role: "actor" }
      ],
      [
        l.lastEvent,
        q.lastEvent,
        p.lastBy.values,
        this.person(q.owner).lastBy.values
      ],
      [
        this.replace({ ...l, partner: q.owner, lastEvent: e }),
        this.replace({
          ...q,
          partner: l.owner,
          household: l.household,
          lastEvent: e
        }),
        this.link(l.owner, q.owner),
        this.link(q.owner, l.owner)
      ],
      {
        candidates: scored,
        chosen: q.owner,
        threshold: 45,
        consent: "utilidades de ambos acima de permanecer s\xF3",
        household: l.household
      }
    );
  }
  conceive(l) {
    if (l.role !== "gestational" || !l.partner || l.pregnancy || this.w.scenario.lifeSimulation?.blockedConceptions?.includes(l.owner))
      return;
    const q = this.get(l.partner), p = this.person(l.owner), father = this.person(l.partner);
    if (!q || q.role !== "contributor" || !p.alive || !father.alive || !p.present || !father.present)
      return;
    const age = this.month - l.birthMonth, otherAge = this.month - q.birthMonth;
    if (age < 216 || age > 540 || otherAge < 216 || otherAge > 780 || this.related(l.owner, q.owner) || l.lastPregnancyEnd !== void 0 && this.month - l.lastPregnancyEnd < 24)
      return;
    const adjusted = this.w.scenario.lifeSimulation?.fertilityPolicy === "replacement-2c";
    const childCost = adjusted ? 30 : 60;
    const desired = Math.max(
      0,
      Math.min(
        adjusted ? 5 : 3,
        Math.round((p.values.familia + father.values.familia) / childCost)
      )
    );
    const utility = p.values.familia + father.values.familia - l.children * childCost - (p.psychology?.stress || 0) / 10 - (father.psychology?.stress || 0) / 10;
    if (l.children >= desired || utility < (adjusted ? 15 : 30)) return;
    const key = `${l.owner}:${Math.floor(this.month / 12)}`, draw = sample(this.w.scenario.seed, `${key}:conception`, 0, 99);
    if (!(this.w.scenario.lifeSimulation?.conceptionOverride ?? draw < 40))
      return;
    const id = `pregnancy:${key}`, source = this.next(), risk = 8 + Math.max(0, Math.floor(age / 12) - 35), lossDraw = sample(this.w.scenario.seed, `${id}:loss`, 0, 99);
    const g = {
      id,
      kind: "pregnancy",
      parents: [l.owner, q.owner],
      conceived: this.month,
      due: this.month + 9,
      status: "gestating",
      lossRisk: risk,
      draw: lossDraw,
      source,
      lastEvent: source
    };
    this.c.emit(
      "pregnancy.conceived",
      [
        { id: l.owner, role: "actor" },
        { id: q.owner, role: "actor" }
      ],
      [l.lastEvent, q.lastEvent, p.lastBy.values, father.lastBy.values],
      [
        { op: "create", entity: g },
        this.replace({ ...l, pregnancy: id, lastEvent: source })
      ],
      {
        pregnancy: id,
        ...adjusted ? {
          fertilityPolicy: "replacement-2c",
          childCost,
          utilityThreshold: 15,
          preferenceCeiling: 5
        } : {},
        utility,
        desired,
        draw,
        threshold: 40,
        gestationMonths: 9,
        lossRisk: risk,
        lossDraw,
        assumption: "suposi\xE7\xE3o de design, n\xE3o verificado"
      }
    );
  }
  resolve(g) {
    const mother = this.person(g.parents[0]), l = this.get(mother.id);
    const lost = !mother.alive || (this.w.scenario.lifeSimulation?.lossOverride ?? g.draw < g.lossRisk), source = this.next();
    if (lost) {
      const e = this.c.emit(
        "pregnancy.lost",
        g.parents.map((id) => ({ id, role: "reference" })),
        [g.source, ...!mother.alive && mother.death ? [mother.death] : []],
        [
          this.replace({ ...g, status: "lost", lastEvent: source }),
          this.replace({
            ...l,
            pregnancy: void 0,
            lastPregnancyEnd: this.month,
            lastEvent: source
          })
        ],
        {
          pregnancy: g.id,
          cause: !mother.alive ? "morte da gestante" : "complica\xE7\xE3o gestacional agendada",
          countsAsPopulationDeath: false
        }
      );
      for (const id of g.parents)
        if (this.person(id).alive && this.person(id).present && !this.w.scenario.blockedInformation.includes(id)) {
          const notice = this.c.emit(
            "family.loss.perceived",
            [{ id, role: "actor" }],
            [e.id],
            [],
            { pregnancy: g.id, source: e.id }
          );
          this.c.affect(id, notice.id);
        }
      return;
    }
    const fatherLife = this.get(g.parents[1]), father = this.person(g.parents[1]), childId = `person:birth:${g.id.slice(10)}`;
    const inheritance = {}, genes = {}, traits2 = {};
    for (const k of Object.keys(l.genes)) {
      const maternal = l.genes[k], paternal = fatherLife.genes[k], segregation = sample(
        this.w.scenario.seed,
        `${childId}:segregation:${k}`,
        -10,
        10
      ), developmentRng = sample(
        this.w.scenario.seed,
        `${childId}:development:${k}`,
        -8,
        8
      );
      genes[k] = bounded((maternal + paternal) / 2 + segregation);
      traits2[k] = bounded(genes[k] + developmentRng);
      inheritance[k] = {
        maternal,
        paternal,
        segregation,
        genetic: genes[k],
        developmentRng,
        experience: 0,
        phenotype: traits2[k]
      };
    }
    const guardians = g.parents.filter((id) => this.person(id).alive);
    const child = {
      id: childId,
      kind: "person",
      name: `${names[sample(this.w.scenario.seed, `${childId}:name`, 0, names.length - 1)]} ${Math.floor(this.month / 12)}`,
      born: Math.floor(this.month / 12),
      lifeStage: "child",
      alive: true,
      traits: traits2,
      values: Object.fromEntries(
        Object.keys(mother.values).map((k) => [k, k === "familia" ? 30 : 0])
      ),
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
      lastBy: {}
    };
    child.lastBy = Object.fromEntries(
      Object.keys(child).map((k) => [k, source])
    );
    const life = {
      id: `life:${childId}`,
      kind: "life",
      owner: childId,
      birthMonth: this.month,
      stage: "child",
      parents: [...g.parents],
      guardians,
      household: l.household,
      role: sample(this.w.scenario.seed, `${childId}:reproductive-role`, 0, 1) ? "gestational" : "contributor",
      genes,
      naturalDeathAt: this.naturalDeadline(childId, this.month),
      children: 0,
      source,
      lastEvent: source
    };
    const effects = [
      { op: "create", entity: child },
      { op: "create", entity: life },
      this.replace({ ...g, status: "born", child: childId, lastEvent: source }),
      this.replace({
        ...l,
        children: l.children + 1,
        lastPregnancyEnd: this.month,
        pregnancy: void 0,
        lastEvent: source
      }),
      this.replace({
        ...fatherLife,
        children: fatherLife.children + 1,
        lastEvent: source
      }),
      this.link(mother.id, childId),
      this.link(father.id, childId)
    ];
    this.c.emit(
      "person.born",
      [
        { id: childId, role: "reference" },
        ...g.parents.map((id) => ({ id, role: "reference" }))
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
        gestationMonths: this.month - g.conceived
      }
    );
    this.c.body(childId);
    for (const sib of this.all().filter(
      (x) => x.owner !== childId && x.parents.some((id) => g.parents.includes(id))
    ))
      this.c.emit(
        "family.siblings.registered",
        [
          { id: childId, role: "reference" },
          { id: sib.owner, role: "reference" }
        ],
        [source, sib.source],
        [this.link(childId, sib.owner), this.link(sib.owner, childId)],
        { sharedParents: g.parents.filter((id) => sib.parents.includes(id)) }
      );
  }
  onDeath(id, source) {
    const l = this.get(id);
    if (!l) return;
    if (l.partner) {
      const q = this.get(l.partner);
      this.c.emit(
        "partnership.ended",
        [
          { id, role: "reference" },
          { id: q.owner, role: "reference" }
        ],
        [source, l.lastEvent, q.lastEvent],
        [
          this.replace({ ...l, partner: void 0, lastEvent: this.next() }),
          this.replace({ ...q, partner: void 0, lastEvent: this.next() })
        ],
        { cause: "morte", death: source }
      );
    }
    for (const child of this.all().filter(
      (x) => x.guardians.includes(id) && this.person(x.owner).alive && this.month - x.birthMonth < 216
    ))
      this.custody(child, source);
    const current = this.get(id);
    if (current.pregnancy) {
      const pregnancy = this.w.entities[current.pregnancy];
      if (pregnancy.status === "gestating") this.resolve(pregnancy);
    }
    this.c.emit(
      "life.ended",
      [{ id, role: "reference" }],
      [source, this.get(id).lastEvent],
      [
        this.replace({
          ...this.get(id),
          guardians: [],
          lastEvent: this.next()
        })
      ],
      { death: source }
    );
  }
  custody(l, cause) {
    const survivors = l.guardians.filter((id) => this.person(id).alive);
    let chosen = survivors[0];
    const candidates = this.all().filter(
      (x) => this.person(x.owner).alive && this.person(x.owner).present && !this.w.scenario.blockedInformation.includes(x.owner) && this.month - x.birthMonth >= 216 && x.owner !== l.owner
    ).map((x) => {
      const p = this.person(x.owner);
      return {
        id: x.owner,
        utility: p.values.familia + p.traits.compaixao + (this.person(l.owner).kin.includes(x.owner) ? 40 : 0) - x.children * 20 - (p.psychology?.stress || 0) / 20 - 40
      };
    }).sort((a, b) => b.utility - a.utility || (a.id < b.id ? -1 : 1));
    if (!chosen) chosen = candidates.find((x) => x.utility >= 0)?.id;
    const guardians = survivors.length ? survivors : chosen ? [chosen] : [], source = this.next();
    const effects = [
      this.replace({
        ...l,
        guardians,
        household: chosen ? this.get(chosen).household : l.household,
        lastEvent: source
      })
    ];
    if (chosen && !this.person(l.owner).kin.includes(chosen)) {
      effects.push(this.link(l.owner, chosen), this.link(chosen, l.owner));
    }
    this.c.emit(
      "guardianship.decided",
      [
        { id: l.owner, role: "beneficiary" },
        ...chosen ? [
          {
            id: chosen,
            role: this.w.scenario.blockedInformation.includes(chosen) ? "reference" : "actor"
          }
        ] : []
      ],
      [
        cause,
        l.lastEvent,
        ...candidates.map((x) => this.person(x.id).lastBy.values)
      ],
      effects,
      {
        child: l.owner,
        candidates,
        chosen: chosen || null,
        guardians,
        reason: survivors.length ? "respons\xE1vel sobrevivente mant\xE9m guarda" : chosen ? "adulto presente aceita guarda por utilidade" : "nenhum adulto eleg\xEDvel aceita; guarda pendente",
        orphan: survivors.length === 0
      }
    );
  }
  grow(l) {
    const p = this.person(l.owner), age = this.month - l.birthMonth, stage = stageAt(age), source = this.next();
    const fields = { lifeStage: stage };
    const effects = [
      this.replace({
        ...l,
        stage,
        guardians: age >= 216 ? [] : l.guardians,
        lastEvent: source
      })
    ];
    if (stage === "adult" && l.stage !== "adult") {
      fields.trainAccess = true;
      fields.canHelp = true;
    }
    if (age < 216) {
      const carers = l.guardians.map((id) => this.person(id)).filter((p2) => p2.alive && p2.present);
      const observed = carers.length ? Math.round(
        carers.reduce((n, p2) => n + p2.traits.compaixao, 0) / carers.length
      ) : 0;
      fields.traits = {
        ...p.traits,
        confianca: bounded(
          (p.traits.confianca || 0) + (carers.length ? 1 : -2)
        )
      };
      fields.values = {
        ...p.values,
        familia: Math.max(
          -100,
          Math.min(100, p.values.familia + (carers.length ? 1 : -2))
        )
      };
      fields.skill = Math.min(
        150,
        p.skill + (age >= 72 && carers.length ? 5 : 0)
      );
      this.c.emit(
        "development.period",
        [{ id: p.id, role: "reference" }],
        [l.lastEvent, ...carers.map((p2) => p2.lastBy.traits)],
        [this.replace(this.patch(p, fields)), ...effects],
        {
          ageMonths: age,
          periodMonths: 12,
          caregivers: carers.map((p2) => p2.id),
          observedCompassion: observed,
          experience: { facet: "confianca", delta: carers.length ? 1 : -2 },
          genotypeUnchanged: true
        }
      );
    } else
      this.c.emit(
        "life.aged",
        [{ id: p.id, role: "reference" }],
        [l.lastEvent],
        [this.replace(this.patch(p, fields)), ...effects],
        { ageMonths: age, stage, periodMonths: 12 }
      );
    this.c.grow(p.id, age, source);
  }
  monthly() {
    for (const entry of this.all()) {
      const l = this.get(entry.owner);
      const p = this.person(l.owner);
      if (!p.alive) continue;
      if (!l.declineSource && this.month >= Math.min(l.birthMonth + 720, l.naturalDeathAt - 12)) {
        const id = this.next();
        this.c.emit(
          "mortality.condition",
          [{ id: p.id, role: "reference" }],
          [l.lastEvent],
          [this.replace({ ...l, declineSource: id, lastEvent: id })],
          {
            cause: "decl\xEDnio fisiol\xF3gico por envelhecimento",
            due: l.naturalDeathAt,
            assumption: "suposi\xE7\xE3o de design, n\xE3o verificado"
          }
        );
      }
      const current = this.get(p.id);
      if (this.month >= current.naturalDeathAt) {
        this.c.die(p.id, current.declineSource || current.lastEvent, {
          cause: "morte natural: decl\xEDnio fisiol\xF3gico",
          natural: true,
          weapon: null,
          bodyPart: null
        });
        continue;
      }
      if (this.month > 0 && (this.month - l.birthMonth) % 12 === 0)
        this.grow(this.get(p.id));
    }
    for (const g of Object.values(this.w.entities).filter(
      (e) => e.kind === "pregnancy" && e.status === "gestating"
    ))
      if (g.due <= this.month || !this.person(g.parents[0]).alive)
        this.resolve(g);
    if (this.month % 12 === 0) {
      for (const l of this.all()) this.partner(this.get(l.owner));
      for (const l of this.all()) {
        const current = this.get(l.owner);
        if (this.c.observeConception) {
          const observation = conceptionDiagnostic(this.w, current, this.month);
          if (observation) this.c.observeConception(observation);
        }
      }
      for (const l of this.all()) this.conceive(this.get(l.owner));
      for (const l of this.all().filter(
        (x) => this.person(x.owner).alive && this.month - x.birthMonth < 216 && !x.guardians.some((id) => this.person(id).alive)
      ))
        this.custody(l, l.lastEvent);
      this.balance();
    }
  }
  balance() {
    const persons = Object.values(this.w.entities).filter(
      (e) => e.kind === "person"
    );
    const births = persons.length - this.w.scenario.people.length, deaths = persons.filter((p) => !p.alive).length;
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
        month: this.month
      }
    );
  }
};

// src/engine/v2/compact-log.ts
function immutable(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) immutable(item);
  }
  return value;
}
var plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var CompactLog = class _CompactLog {
  strings = [];
  shapes = [];
  rows = [];
  stringIds = /* @__PURE__ */ new Map();
  shapeIds = /* @__PURE__ */ new Map();
  intern(text) {
    let id = this.stringIds.get(text);
    if (id === void 0) {
      id = this.strings.length;
      this.strings.push(text);
      this.stringIds.set(text, id);
    }
    return id;
  }
  shape(keys) {
    const ids = keys.map((k) => this.intern(k)), key = ids.join(",");
    let id = this.shapeIds.get(key);
    if (id === void 0) {
      id = this.shapes.length;
      this.shapes.push(immutable(ids));
      this.shapeIds.set(key, id);
    }
    return id;
  }
  encode(value) {
    if (value === null || typeof value === "boolean" || typeof value === "number")
      return value;
    if (typeof value === "string") {
      if (/^event:\d+$/.test(value)) return [-4, Number(value.slice(6))];
      return [-1, this.intern(value)];
    }
    if (Array.isArray(value)) return [-2, ...value.map((v) => this.encode(v))];
    const keys = Object.keys(value).filter((k) => value[k] !== void 0);
    return [-3, this.shape(keys), ...keys.map((k) => this.encode(value[k]))];
  }
  decode(value) {
    if (!Array.isArray(value)) return value;
    if (value[0] === -1) return this.strings[value[1]];
    if (value[0] === -4) return `event:${value[1]}`;
    if (value[0] === -2) return value.slice(1).map((v) => this.decode(v));
    if (value[0] === -3) {
      const keys = this.shapes[value[1]];
      if (!keys) throw Error("Unknown compact shape");
      return Object.fromEntries(
        keys.map((key, i) => [this.strings[key], this.decode(value[i + 2])])
      );
    }
    throw Error("Unknown compact value");
  }
  delta(before, after, path = [], result = []) {
    if (before === after) return result;
    if (plain(before) && plain(after)) {
      for (const key of /* @__PURE__ */ new Set([
        ...Object.keys(before),
        ...Object.keys(after)
      ]))
        this.delta(before[key], after[key], [...path, key], result);
    } else if (after === void 0) result.push([this.shape(path), [-5]]);
    else if (!Array.isArray(before) || !Array.isArray(after) || JSON.stringify(before) !== JSON.stringify(after))
      result.push([this.shape(path), this.encode(after)]);
    return result;
  }
  encodeEvent(e, before) {
    const effects = e.effects.map(
      (f) => f.op === "create" ? [0, this.encode(f.entity)] : [
        1,
        this.encode(f.entity.id),
        this.delta(before[f.entity.id], f.entity)
      ]
    );
    const routine = e.type === "needs.period" || e.type === "activity.period";
    const data = routine ? Object.fromEntries(
      Object.entries(e.data).filter(([key]) => key !== "periodMonths")
    ) : e.data;
    if (e.location !== "place:void")
      throw Error("Compact v1 only supports the current abstract location");
    return JSON.stringify([
      e.month,
      e.type === "needs.period" ? -1 : e.type === "activity.period" ? -2 : this.intern(e.type),
      this.encode(e.participants),
      e.causes.map((id) => Number(id.slice(6))),
      effects,
      this.encode(data),
      ...e.decision ? [this.encode(e.decision)] : []
    ]);
  }
  append(row) {
    this.rows.push(row);
  }
  row(index) {
    const encoded = this.rows[index];
    if (encoded === void 0) throw Error("Unknown compact event");
    return JSON.parse(encoded);
  }
  get length() {
    return this.rows.length;
  }
  effects(index, state) {
    const row = this.row(index);
    if (!row) throw Error("Unknown compact event");
    const result = [];
    for (const f of row[4]) {
      if (f[0] === 0) {
        const entity = immutable(this.decode(f[1]));
        if (state[entity.id]) throw Error("Duplicate compact entity");
        result.push({ op: "create", entity });
      } else {
        const id = this.decode(f[1]);
        let entity = state[id];
        if (!entity) throw Error("Missing compact patch target");
        for (const [pathId, encoded] of f[2]) {
          const path = this.shapes[pathId]?.map((k) => this.strings[k]);
          if (!path?.length || path.some(
            (k) => ["__proto__", "constructor", "prototype"].includes(k)
          ))
            throw Error("Invalid compact patch path");
          const root = { ...entity };
          let node = root, previous = entity;
          for (const key2 of path.slice(0, -1)) {
            if (!plain(previous?.[key2]))
              throw Error("Invalid compact patch parent");
            node[key2] = { ...previous[key2] };
            node = node[key2];
            previous = previous[key2];
          }
          const key = path[path.length - 1];
          if (Array.isArray(encoded) && encoded[0] === -5) delete node[key];
          else node[key] = this.decode(encoded);
          entity = immutable(root);
        }
        if (entity.id !== id) throw Error("Patch cannot change identity");
        result.push({ op: "replace", entity });
      }
    }
    for (const f of result) state[f.entity.id] = f.entity;
    return result;
  }
  lazy(value) {
    if (Array.isArray(value) && value[0] === -3) {
      const keys = this.shapes[value[1]];
      if (!keys) throw Error("Unknown compact shape");
      const object = {};
      keys.forEach(
        (key, i) => Object.defineProperty(object, this.strings[key], {
          enumerable: true,
          get: () => immutable(this.lazy(value[i + 2]))
        })
      );
      return Object.freeze(object);
    }
    return immutable(this.decode(value));
  }
  metadata(index) {
    const raw = this.rows[index];
    if (raw === void 0) throw Error("Unknown compact event");
    const header = /^\[(\d+),(-?\d+),/.exec(raw);
    if (!header) throw Error("Invalid compact header");
    const month = Number(header[1]), typeId = Number(header[2]);
    let parsed;
    const row = () => parsed ||= JSON.parse(raw);
    const e = {
      id: `event:${index}`,
      seq: index,
      month,
      ano: Math.floor(month / 12),
      dia: month % 12 * 30,
      type: typeId === -1 ? "needs.period" : typeId === -2 ? "activity.period" : this.strings[typeId],
      location: "place:void"
    };
    Object.defineProperties(e, {
      participants: {
        enumerable: true,
        get: () => immutable(this.decode(row()[2]))
      },
      causes: {
        enumerable: true,
        get: () => immutable(row()[3].map((i) => `event:${i}`))
      },
      data: {
        enumerable: true,
        get: () => {
          const data = this.lazy(row()[5]);
          return typeId < 0 ? Object.freeze({ ...data, periodMonths: 1 }) : data;
        }
      },
      decision: {
        enumerable: true,
        get: () => row().length > 6 ? this.lazy(row()[6]) : void 0
      }
    });
    return e;
  }
  event(index) {
    const e = this.metadata(index);
    Object.defineProperty(e, "effects", {
      enumerable: true,
      get: () => {
        const state = {};
        for (let i = 0; i < index; i++) this.effects(i, state);
        return immutable(this.effects(index, state));
      }
    });
    return Object.freeze(e);
  }
  view(sequentialEffects = false) {
    let cursor = -1;
    const state = {};
    let current;
    return new Proxy([], {
      get: (_target, key) => {
        if (key === "length") return this.length;
        if (typeof key === "string" && /^\d+$/.test(key)) {
          const i = Number(key);
          if (i >= this.length) return void 0;
          if (sequentialEffects && i === cursor + 1) {
            current = { ...this.metadata(i), effects: this.effects(i, state) };
            cursor = i;
            return current;
          }
          if (sequentialEffects && i === cursor) return current;
          return this.event(i);
        }
        if (key === Symbol.iterator)
          return function* () {
            const state2 = {};
            for (let i = 0; i < this.length; i++)
              yield sequentialEffects ? { ...this.metadata(i), effects: this.effects(i, state2) } : this.event(i);
          }.bind(this);
        return Reflect.get(Array.prototype, key);
      },
      has: (_target, key) => typeof key === "string" && /^\d+$/.test(key) ? Number(key) < this.length : Reflect.has(Array.prototype, key),
      set: () => {
        throw Error("Compact event history is append-only");
      }
    });
  }
  /** Sequential metadata selection; no retained index and no effect materialization. */
  *select(types) {
    for (let i = 0; i < this.rows.length; i++) {
      const header = /^\[(\d+),(-?\d+),/.exec(this.rows[i]);
      if (!header) throw Error("Invalid compact header");
      const id = Number(header[2]);
      const type = id === -1 ? "needs.period" : id === -2 ? "activity.period" : this.strings[id];
      if (types.has(type)) yield this.event(i);
    }
  }
  materialize() {
    const state = {};
    return this.rows.map((_, i) => ({
      ...this.metadata(i),
      effects: this.effects(i, state)
    }));
  }
  replay() {
    const state = {};
    for (let i = 0; i < this.length; i++) {
      const row = this.row(i);
      if (!Number.isInteger(row[0]) || row[0] < 0 || i && row[0] < this.row(i - 1)[0] || row[3].some((c) => !Number.isInteger(c) || c < 0 || c >= i))
        throw Error("Invalid compact calendar or cause");
      this.effects(i, state);
    }
    return immutable(state);
  }
  snapshot() {
    return immutable({
      format: "delta-routine-v1",
      strings: [...this.strings],
      shapes: [...this.shapes],
      rows: [...this.rows]
    });
  }
  static from(log) {
    if (log.format !== "delta-routine-v1")
      throw Error("Unknown compact format");
    const result = new _CompactLog(), data = {
      strings: [...log.strings],
      shapes: log.shapes.map((s) => [...s]),
      rows: [...log.rows]
    };
    result.strings = data.strings;
    result.shapes = data.shapes.map((shape) => immutable(shape));
    result.rows = immutable(data.rows).slice();
    result.stringIds = new Map(result.strings.map((s, i) => [s, i]));
    result.shapeIds = new Map(result.shapes.map((s, i) => [s.join(","), i]));
    return result;
  }
};

// src/engine/v2/body.ts
function vascularRule(vessel, seed2, key, minute) {
  const severity = vessel === "capillary" ? "light" : vessel === "vein" ? "moderate" : "severe";
  return {
    vessel,
    severity,
    rate: vessel === "capillary" ? 2 : vessel === "vein" ? 6 : 18,
    clotAt: vessel === "artery" ? null : minute + sample(
      seed2,
      key,
      vessel === "capillary" ? 5 : 40,
      vessel === "capillary" ? 20 : 100
    )
  };
}
var anatomy = immutable({
  torso: { parent: null, trajectory: ["skin", "muscle", "rib", "heart"] },
  head: { parent: "torso", trajectory: ["skin", "skull", "brain"] },
  "arm.left": {
    parent: "torso",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "arm.right": {
    parent: "torso",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "forearm.left": {
    parent: "arm.left",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "forearm.right": {
    parent: "arm.right",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "hand.left": {
    parent: "forearm.left",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "hand.right": {
    parent: "forearm.right",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "leg.left": {
    parent: "torso",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "leg.right": {
    parent: "torso",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "foot.left": {
    parent: "leg.left",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  },
  "foot.right": {
    parent: "leg.right",
    trajectory: ["skin", "muscle", "nerve", "bone"]
  }
});
var tissues = immutable({
  skin: 8,
  muscle: 30,
  nerve: 12,
  bone: 60,
  rib: 60,
  skull: 80,
  heart: 20,
  brain: 20
});
var blade = immutable({
  id: "blade-v1",
  material: "steel",
  massGrams: 1e3,
  reachCm: 70,
  contactMm2: 50,
  mode: "cut",
  units: "game-contact-U"
});
var bodyId = (id) => `body:${id}`;
var partId = (id, key) => `part:${id}:${key}`;
var BodySystem = class {
  constructor(c) {
    this.c = c;
  }
  c;
  get w() {
    return this.c.world();
  }
  get options() {
    return this.w.scenario.bodySimulation;
  }
  person(id) {
    return this.w.entities[id];
  }
  body(id) {
    return this.w.entities[bodyId(id)];
  }
  part(id, key) {
    return this.w.entities[partId(id, key)] || {
      id: partId(id, key),
      kind: "bodyPart",
      owner: id,
      part: key,
      present: true,
      nerve: 1,
      bone: 1,
      lastEvent: this.body(id).lastEvent
    };
  }
  present(id, key) {
    let next = key;
    while (next) {
      if (!this.part(id, next).present) return false;
      next = anatomy[next].parent;
    }
    return true;
  }
  grip(id, side, override) {
    if (!this.present(id, `hand.${side}`)) return 0;
    return (this.body(id).ageCapacity ?? 1) * Math.min(
      ...[`hand.${side}`, `forearm.${side}`, `arm.${side}`].map((k) => {
        const p = override?.part === k ? override : this.part(id, k);
        return Math.min(0.4 + 0.6 * p.nerve, p.bone);
      })
    );
  }
  canStrike(id) {
    const b = this.body(id);
    return (!this.person(id).lifeStage || ["adult", "elder"].includes(this.person(id).lifeStage)) && !!b?.weapon && b.conscious && this.grip(id, b.weapon.hand) >= 0.5 && (b.weapon.hands === 1 || Math.min(this.grip(id, "left"), this.grip(id, "right")) >= 0.8);
  }
  replace(entity) {
    return { op: "replace", entity };
  }
  next() {
    return `event:${this.w.events.length}`;
  }
  grow(id, age, source) {
    const b = this.body(id), capacity = Math.round(5e3 * ageCapacity(age)), p = this.person(id);
    this.c.emit(
      "body.developed",
      [{ id, role: "reference" }],
      [source, b.lastEvent],
      [
        this.replace({
          ...b,
          capacity,
          ageCapacity: ageCapacity(age),
          blood: Math.round(b.blood * capacity / (b.capacity || 5e3)),
          weapon: age === 216 && this.present(id, "hand.right") && this.grip(id, "right") >= 0.5 ? b.weapon || {
            id: `weapon:${id}`,
            template: "blade-v1",
            hand: "right",
            hands: 1,
            budget: sample(
              this.w.scenario.seed,
              `${id}:contact-budget`,
              65,
              175
            )
          } : age < 216 ? void 0 : b.weapon,
          lastEvent: this.next()
        })
      ],
      {
        ageMonths: age,
        capacity,
        stage: p.lifeStage,
        preservesBloodFraction: true
      }
    );
  }
  initialize(personIds) {
    const place = this.w.entities["place:void"];
    const supplies = this.options.supplies || {
      bandages: this.w.scenario.people.length * 2,
      tools: true
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
            medicalSource: this.next()
          })
        ],
        { supplies }
      );
    for (const p of Object.values(this.w.entities).filter(
      (e) => e.kind === "person" && (!personIds || personIds.includes(e.id)) && !this.body(e.id)
    )) {
      const source = this.next(), b = {
        id: bodyId(p.id),
        kind: "body",
        owner: p.id,
        template: "human-v1",
        blood: this.w.scenario.lifeSimulation ? Math.round(
          5e3 * ageCapacity(
            this.c.month() - this.w.entities[`life:${p.id}`].birthMonth
          )
        ) : 5e3,
        ...this.w.scenario.lifeSimulation ? {
          capacity: Math.round(
            5e3 * ageCapacity(
              this.c.month() - this.w.entities[`life:${p.id}`].birthMonth
            )
          ),
          ageCapacity: ageCapacity(
            this.c.month() - this.w.entities[`life:${p.id}`].birthMonth
          )
        } : {},
        pain: 0,
        conscious: true,
        minute: 0,
        weapon: p.lifeStage && !["adult", "elder"].includes(p.lifeStage) || this.options.unarmed?.includes(p.id) ? void 0 : {
          id: `weapon:${p.id}`,
          template: "blade-v1",
          hand: "right",
          hands: 1,
          budget: this.options.fixture ? 100 : sample(
            this.w.scenario.seed,
            `${p.id}:contact-budget`,
            65,
            175
          )
        },
        armor: this.options.armor?.[p.id] || (this.options.fixture ? "leather" : ["none", "leather", "mail"][sample(this.w.scenario.seed, `${p.id}:armor`, 0, 2)]),
        lastEvent: source
      };
      const effects = [{ op: "create", entity: b }];
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
            lastEvent: source
          }
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
          assumption: "suposi\xE7\xE3o de design, n\xE3o verificado"
        }
      );
      this.drop(p.id, source);
    }
  }
  ensureGoal(p, source) {
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
            description: "Retomar ou manter t\xE9cnica marcial de duas m\xE3os."
          }
        }
      ],
      { goal: id }
    );
  }
  reassess(owner, source) {
    const goal = this.w.entities[`physical:${owner}`];
    if (!goal || !this.person(owner).alive) return;
    const p = this.person(owner), left = this.grip(owner, "left"), right = this.grip(owner, "right"), viable = goal.requiredHands === 2 ? Math.min(left, right) >= goal.minGrip : Math.max(left, right) >= goal.minGrip;
    const utilities = {
      continuar: viable ? 200 : -500,
      adaptar: (p.traits.disciplina || 0) + (p.traits.esperanca || 0) + Math.max(left, right) * 80,
      abandonar: (p.traits.cautela || 0) + (p.psychology?.stress || 0) / 10
    };
    const chosen = Object.keys(utilities).sort(
      (a, b) => utilities[b] - utilities[a] || a.localeCompare(b)
    )[0];
    this.c.emit(
      "physicalGoal.reassessed",
      [{ id: owner, role: "actor" }],
      [
        source,
        goal.lastEvent,
        this.body(owner).lastEvent,
        ...[
          "forearm.left",
          "forearm.right",
          "hand.left",
          "hand.right"
        ].map((k) => this.part(owner, k).lastEvent)
      ],
      [
        this.replace({
          ...goal,
          status: chosen === "abandonar" ? "abandoned" : chosen === "adaptar" ? "adapted" : goal.status,
          requiredHands: chosen === "adaptar" ? 1 : goal.requiredHands,
          minGrip: chosen === "adaptar" ? 0.5 : goal.minGrip,
          description: chosen === "abandonar" ? "Abandonou o objetivo marcial." : chosen === "adaptar" ? "Aprender t\xE9cnica compat\xEDvel com uma m\xE3o." : goal.description,
          lastEvent: this.next()
        })
      ],
      {
        goal: goal.id,
        leftGrip: left,
        rightGrip: right,
        viableBefore: viable,
        utilities,
        chosen,
        knowledgeSource: source
      }
    );
  }
  perceive(subject, wound, source, permanent = false, recipient = subject, channel = "testemunho") {
    const p = this.person(recipient);
    if (this.w.entities[`life:${recipient}`]?.birthMonth !== void 0 && this.c.month() - this.w.entities[`life:${recipient}`].birthMonth < 48 || !p?.alive || !p.present || this.options.blockedInformation?.includes(recipient))
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
        { id: subject, role: "reference" }
      ],
      [
        source,
        p.lastBy.present,
        ...p.lastBy.knownInjuries ? [p.lastBy.knownInjuries] : []
      ],
      [
        this.replace({
          ...p,
          knownInjuries: { ...p.knownInjuries, [key]: id },
          lastBy: { ...p.lastBy, knownInjuries: id }
        })
      ],
      { subject, wound: wound.id, permanent, channel }
    );
    this.c.affect(recipient, e.id, permanent ? "perda" : "ameaca");
  }
  notify(wound, source, permanent = false) {
    for (const p of Object.values(this.w.entities).filter(
      (e) => e.kind === "person" && e.alive && e.present
    ))
      this.perceive(wound.owner, wound, source, permanent, p.id);
  }
  drop(id, source) {
    const b = this.body(id);
    if (!b.weapon) return;
    const usable = this.grip(id, b.weapon.hand) >= 0.5 && (b.weapon.hands === 1 || Math.min(this.grip(id, "left"), this.grip(id, "right")) >= 0.8);
    if (!usable)
      this.c.emit(
        "equipment.dropped",
        [{ id, role: "actor" }],
        [source, b.lastEvent],
        [this.replace({ ...b, weapon: void 0, lastEvent: this.next() })],
        {
          weapon: blade.id,
          reason: "M\xE3o ou conex\xE3o sem capacidade necess\xE1ria."
        }
      );
  }
  woundList(owner) {
    return Object.values(this.w.entities).filter(
      (e) => e.kind === "wound" && e.owner === owner
    );
  }
  loseBlood(owner, minute) {
    const p = this.person(owner), b = this.body(owner);
    if (!p.alive || minute <= b.minute) return;
    const active = this.woundList(owner).filter((w2) => w2.rate > 0);
    if (!active.length) return;
    const losses = active.map((w2) => ({
      w: w2,
      loss: Math.max(
        0,
        Math.min(minute, w2.clotAt ?? minute) - Math.max(b.minute, w2.minute)
      ) * w2.rate
    }));
    const loss = Math.round(losses.reduce((s, x) => s + x.loss, 0) * 1e6) / 1e6;
    const blood = Math.max(0, b.blood - loss);
    const source = this.c.emit(
      "blood.interval",
      [{ id: owner, role: "actor" }],
      [b.lastEvent, ...active.map((w2) => w2.lastEvent)],
      [
        this.replace({
          ...b,
          blood,
          minute,
          conscious: blood > (b.capacity || 5e3) * 0.6,
          lastEvent: this.next()
        }),
        ...losses.map(
          ({ w: w2, loss: loss2 }) => this.replace({
            ...w2,
            bloodLoss: w2.bloodLoss + loss2,
            rate: w2.clotAt !== null && w2.clotAt <= minute ? 0 : w2.rate,
            lastEvent: this.next()
          })
        )
      ],
      {
        fromMinute: b.minute,
        toMinute: minute,
        loss,
        before: b.blood,
        after: blood,
        clotted: losses.filter(({ w: w2 }) => w2.clotAt !== null && w2.clotAt <= minute).map(({ w: w2 }) => w2.id)
      }
    );
    if (blood <= (b.capacity || 5e3) * 0.6) {
      const primary = this.woundList(owner).sort(
        (a, z) => z.bloodLoss - a.bloodLoss || a.id.localeCompare(z.id)
      )[0];
      this.death(primary, source.id, "hemorragia");
    }
  }
  death(w2, source, cause) {
    if (!this.person(w2.owner).alive) return;
    const e = this.c.emit(
      "body.death",
      [
        { id: w2.owner, role: "victim" },
        { id: w2.aggressor, role: "reference" }
      ],
      [source, w2.source, w2.lastEvent],
      [
        this.replace({
          ...this.body(w2.owner),
          conscious: false,
          lastEvent: this.next()
        })
      ],
      {
        victim: w2.owner,
        aggressor: w2.aggressor,
        wound: w2.id,
        weapon: w2.weapon,
        bodyPart: w2.part,
        cause
      }
    );
    this.c.die(w2.owner, w2.aggressor, e.id, {
      cause,
      weapon: w2.weapon,
      bodyPart: w2.part,
      wound: w2.id,
      abstract: false
    });
    const physical = this.w.entities[`physical:${w2.owner}`];
    if (physical?.kind === "physicalGoal")
      this.c.emit(
        "physicalGoal.closed",
        [{ id: w2.owner, role: "reference" }],
        [this.person(w2.owner).death],
        [
          this.replace({
            ...physical,
            status: "abandoned",
            description: "Encerrado pela morte do respons\xE1vel.",
            lastEvent: this.next()
          })
        ],
        { goal: physical.id, reason: "morte" }
      );
    const death = this.person(w2.owner).death;
    const id = `kill:${w2.owner}`;
    if (!this.w.entities[id])
      this.c.emit(
        "kill.credited",
        [
          { id: w2.aggressor, role: "reference" },
          { id: w2.owner, role: "reference" }
        ],
        [death, w2.source],
        [
          {
            op: "create",
            entity: {
              id,
              kind: "kill",
              victim: w2.owner,
              killer: w2.aggressor,
              source: death,
              recordedAt: this.next(),
              wound: w2.id,
              weapon: w2.weapon,
              part: w2.part,
              cause
            }
          }
        ],
        { victim: w2.owner, killer: w2.aggressor, primary: true }
      );
  }
  hit(attacker, defender, duel, exchange) {
    const a = this.person(attacker), d = this.person(defender), b = this.body(attacker);
    this.drop(attacker, duel.lastEvent);
    const weapon = this.body(attacker).weapon;
    if (!weapon || !a.alive || !d.alive || !this.body(attacker).conscious)
      return false;
    const minute = duel.minuteStart + exchange;
    const fixture = !!this.options.fixture && exchange === 0;
    const jitterA = fixture ? -3 : sample(
      this.w.scenario.seed,
      `${duel.id}:${exchange}:attack`,
      -12,
      12
    ), jitterD = fixture ? 4 : sample(
      this.w.scenario.seed,
      `${duel.id}:${exchange}:defense`,
      -12,
      12
    );
    const attack = a.skill / 10 + 20 * this.grip(attacker, weapon.hand) + 5 + jitterA - this.body(attacker).pain / 5 - exchange * 2;
    const defense = d.skill / 10 + (this.body(defender).armor === "none" ? 0 : 10) + 5 + jitterD - this.body(defender).pain / 6;
    const attempted = this.c.emit(
      "attack.attempted",
      [
        { id: attacker, role: "actor" },
        { id: defender, role: "target" }
      ],
      [
        duel.lastEvent,
        b.lastEvent,
        this.body(defender).lastEvent,
        this.part(attacker, `hand.${weapon.hand}`).lastEvent,
        a.lastBy.skill,
        d.lastBy.skill
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
        material: blade.material
      }
    );
    if (attack <= defense) {
      this.c.emit(
        "attack.missed",
        [
          { id: attacker, role: "actor" },
          { id: defender, role: "target" }
        ],
        [attempted.id],
        [],
        { duel: duel.id, exchange }
      );
      return true;
    }
    const roll = sample(
      this.w.scenario.seed,
      `${duel.id}:${exchange}:part`,
      0,
      99
    );
    let key = fixture ? "forearm.left" : roll < 30 ? "forearm.left" : roll < 50 ? "forearm.right" : roll < 70 ? "leg.left" : roll < 90 ? "torso" : "head";
    if (!this.present(defender, key)) key = "torso";
    const armor = this.body(defender).armor, coverage = key !== "head";
    const layers = [
      ...coverage && armor !== "none" ? [
        ["cloth", 5],
        ["armor", armor === "mail" ? 45 : 15]
      ] : [],
      ...anatomy[key].trajectory.map(
        (t2) => [t2, tissues[t2]]
      )
    ];
    let remaining = weapon.budget, nerve = false, fracture = false, vital = false;
    const trace = [];
    for (const [layer, resistance] of layers) {
      if (remaining <= 0) break;
      const entering = remaining, spent = Math.min(remaining, resistance);
      remaining -= spent;
      trace.push({ layer, resistance, entering, spent, remaining });
      if (layer === "nerve" && spent >= resistance) nerve = true;
      if (["bone", "rib", "skull"].includes(layer) && spent / resistance >= 0.6)
        fracture = true;
      if (["heart", "brain"].includes(layer) && spent >= resistance)
        vital = true;
    }
    const tissueHit = trace.some(
      (t2) => [
        "skin",
        "muscle",
        "nerve",
        "bone",
        "rib",
        "skull",
        "heart",
        "brain"
      ].includes(t2.layer)
    );
    const contact = this.c.emit(
      "attack.contact",
      [
        { id: attacker, role: "actor" },
        { id: defender, role: "target" }
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
        assumption: "suposi\xE7\xE3o de design, n\xE3o verificado"
      }
    );
    if (!tissueHit) return true;
    this.loseBlood(defender, minute);
    if (!this.person(defender).alive) return true;
    const boneCrossed = trace.some(
      (t2) => t2.layer === "bone" && t2.spent >= t2.resistance
    );
    const amputation = boneCrossed && nerve && key !== "torso" && key !== "head";
    const part = this.part(defender, key), id = `wound:${contact.id}`, source = this.next();
    const w2 = {
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
        this.options.vesselOverride?.[defender] || (amputation || trace.some((t2) => ["heart", "brain"].includes(t2.layer) && t2.spent > 0) ? "artery" : trace.some((t2) => t2.layer === "muscle" && t2.spent >= t2.resistance) ? "vein" : "capillary"),
        this.w.scenario.seed,
        `${duel.id}:${exchange}:clot`,
        minute
      ),
      nerve,
      fracture,
      amputation,
      vital,
      due: this.c.month() + (nerve || fracture || amputation ? 6 : 2)
    };
    const partState = {
      ...part,
      present: !amputation,
      nerve: nerve ? 0 : part.nerve,
      bone: fracture ? 0.3 : part.bone,
      lastEvent: source
    };
    const body = this.body(defender);
    this.c.emit(
      "wound.created",
      [
        { id: defender, role: "victim" },
        { id: attacker, role: "reference" }
      ],
      [contact.id, part.lastEvent],
      [
        { op: "create", entity: w2 },
        {
          op: this.w.entities[part.id] ? "replace" : "create",
          entity: partState
        },
        this.replace({
          ...body,
          pain: Math.min(100, body.pain + (nerve ? 35 : fracture ? 30 : 12)),
          conscious: body.conscious && !vital,
          lastEvent: source
        })
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
        vessel: w2.vessel,
        severity: w2.severity,
        rate: w2.rate,
        clotAt: w2.clotAt,
        assumption: "suposi\xE7\xE3o de design, n\xE3o verificado"
      }
    );
    this.notify(w2, source);
    this.drop(defender, source);
    if (vital) this.death(w2, source, "estrutura vital destru\xEDda");
    return true;
  }
  stabilize(owner, caregiver, combatEnd) {
    let p = this.person(owner);
    if (!p.alive) return;
    let wounds = this.woundList(owner).filter((w2) => w2.rate > 0);
    if (!wounds.length) return;
    const first = Math.min(...wounds.map((w2) => w2.minute)), start = Math.max(first + 5, combatEnd, this.body(caregiver)?.minute || 0);
    this.loseBlood(owner, start);
    if (!this.person(owner).alive) return;
    wounds = this.woundList(owner).filter((w2) => w2.rate > 0);
    if (!wounds.length) return;
    caregiver = this.c.caregiver?.(owner, caregiver, wounds[0].lastEvent) ?? caregiver;
    const h = this.person(caregiver), medical = h?.medicalSkill ?? sample(this.w.scenario.seed, `${caregiver}:medicine`, 25, 95);
    const willingness = h ? (h.traits.compaixao || 0) + (h.values.solidariedade || 0) + (h.canHelp ? 80 : 0) : 0;
    const consent = p.values.paz + p.traits.cautela + this.body(owner).pain;
    const accepted = this.options.care !== false && h?.alive && h.present && h.id !== owner && h.canHelp && willingness >= 60 && consent >= 0 && this.body(h.id).conscious && Math.max(this.grip(h.id, "left"), this.grip(h.id, "right")) >= 0.5 && (this.w.entities["place:void"].medical?.bandages || 0) >= wounds.length;
    const request = this.c.emit(
      "care.requested",
      [
        { id: owner, role: "actor" },
        ...h ? [{ id: h.id, role: "reference" }] : []
      ],
      [
        this.body(owner).lastEvent,
        ...wounds.map((w2) => w2.lastEvent),
        ...h ? [
          h.lastBy.traits,
          h.lastBy.values,
          h.lastBy.canHelp,
          h.lastBy.present,
          h.lastBy.medicalSkill || "event:1",
          this.body(h.id).lastEvent
        ] : [],
        this.w.entities["place:void"].medicalSource
      ],
      [],
      { medical, willingness, consent, accepted, minute: start }
    );
    if (accepted) {
      const source = this.next();
      const stock = this.w.entities["place:void"];
      this.c.emit(
        "care.compression",
        [
          { id: h.id, role: "actor" },
          { id: owner, role: "beneficiary" }
        ],
        [request.id],
        wounds.map((w2) => {
          const current = this.w.entities[w2.id];
          return this.replace({
            ...current,
            rate: Math.round(current.rate * 0.2 * 1e6) / 1e6,
            care: source,
            lastEvent: source
          });
        }).concat([
          this.replace({
            ...this.body(h.id),
            minute: start,
            lastEvent: source
          }),
          this.replace({
            ...stock,
            medical: {
              ...stock.medical,
              bandages: stock.medical.bandages - wounds.length
            },
            medicalSource: source
          })
        ]),
        { minute: start, medical, material: "atadura", reduction: 0.2 }
      );
      const end = start + 10;
      this.loseBlood(owner, end);
      if (this.person(owner).alive && medical >= 60 && this.w.entities["place:void"].medical?.tools) {
        const stop = this.next();
        this.c.emit(
          "care.controlled",
          [
            { id: h.id, role: "actor" },
            { id: owner, role: "beneficiary" }
          ],
          [source, this.body(owner).lastEvent],
          wounds.map(
            (w2) => this.replace({
              ...this.w.entities[w2.id],
              rate: 0,
              care: stop,
              lastEvent: stop
            })
          ).concat([
            this.replace({
              ...this.body(h.id),
              minute: end,
              lastEvent: stop
            })
          ]),
          { minute: end, medical, material: "atadura e instrumental" }
        );
      }
    }
    if (!this.person(owner).alive) return;
    const active = this.woundList(owner).filter((w2) => w2.rate > 0);
    if (!active.length) return;
    let time = this.body(owner).minute;
    for (let boundary = 0; boundary < active.length + 2 && this.person(owner).alive; boundary++) {
      const current = this.woundList(owner).filter(
        (w2) => w2.rate > 0 && (w2.clotAt === null || w2.clotAt > time)
      );
      if (!current.length) break;
      const rate = current.reduce((s, w2) => s + w2.rate, 0), clot = Math.min(...current.map((w2) => w2.clotAt ?? Infinity));
      const deathAt = time + Math.ceil(
        (this.body(owner).blood - (this.body(owner).capacity || 5e3) * 0.6) / rate / 5
      ) * 5;
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
        this.woundList(owner).filter((w2) => w2.rate > 0).map((w2) => this.replace({ ...w2, rate: 0, lastEvent: settled })),
        { minute: time, reason: "Coagula\xE7\xE3o em feridas eleg\xEDveis." }
      );
    }
  }
  exitChoice(duel, source, minute) {
    const fighters = [duel.a, duel.b].sort(
      (a, b) => this.body(b).pain - this.body(a).pain || (a < b ? -1 : 1)
    );
    const third = Object.values(this.w.entities).filter(
      (e) => e.kind === "person" && !fighters.includes(e.id) && (!e.lifeStage || ["adult", "elder"].includes(e.lifeStage)) && e.alive && e.present && !this.options.blockedInformation?.includes(e.id) && this.body(e.id)?.conscious
    ).sort((a, b) => a.id < b.id ? -1 : 1);
    for (const id of [...fighters, ...third.map((p) => p.id)]) {
      const p = this.person(id), body = this.body(id), outsider = !fighters.includes(id);
      const stress = p.psychology?.stress || 0, pain = body.pain;
      const visibleWounds = Object.values(this.w.entities).filter(
        (w2) => w2.kind === "wound" && fighters.includes(w2.owner) && w2.owner !== id && !this.options.blockedInformation?.includes(id) && w2.duel === duel.id
      );
      const visibleDanger = visibleWounds.reduce(
        (n, w2) => n + (w2.severity === "severe" ? 60 : w2.severity === "moderate" ? 30 : 10),
        0
      );
      const observed = this.c.emit(
        "duel.observed",
        [{ id, role: "actor" }],
        [source, p.lastBy.present, ...visibleWounds.map((w2) => w2.source)],
        [],
        {
          duel: duel.id,
          minute,
          visibleWounds: visibleWounds.map((w2) => w2.id),
          visibleDanger,
          channel: "testemunho"
        }
      );
      source = observed.id;
      const mobile = ["leg.left", "leg.right", "foot.left", "foot.right"].every(
        (k) => this.present(id, k) && this.part(id, k).bone >= 0.5 && this.part(id, k).nerve >= 0.5
      );
      const loss = (body.capacity || 5e3) - body.blood;
      const utilities = outsider ? {
        observar: 100 + p.traits.cautela + Math.max(...fighters.map((x) => this.body(x).weapon ? 50 : 0)) - p.traits.coragem,
        interromper: p.traits.compaixao + (p.values.solidariedade || 0) / 2 + p.values.paz / 2 + visibleDanger + stress / 10
      } : {
        continuar: p.hostility + p.traits.coragem + p.traits.orgulho + p.traits.agressividade / 2 - stress / 5 - pain - loss / 20,
        render: p.traits.cautela + stress / 4 + pain + loss / 15 - p.traits.orgulho / 2,
        fugir: p.traits.cautela + stress / 5 + pain + 20 - p.traits.coragem / 2 - (p.values.honra || 0) / 3,
        interromper: p.traits.compaixao + p.values.paz + visibleDanger * 1.2 - p.hostility / 2 + stress / 10
      };
      const eligible = Object.keys(utilities).filter(
        (k) => k !== "fugir" || mobile
      );
      const chosen = eligible.sort(
        (a, b) => utilities[b] - utilities[a] || (a < b ? -1 : 1)
      )[0];
      const stopped = !["continuar", "observar"].includes(chosen);
      const role = outsider ? "terceiro" : id === duel.a ? "agressor" : "desafiado";
      const reason = chosen === "render" ? "rendi\xE7\xE3o" : chosen === "fugir" ? "fuga" : `interrup\xE7\xE3o por ${role}`;
      const e = this.c.emit(
        "duel.choice",
        [
          { id, role: "actor" },
          ...fighters.filter((x) => x !== id).map((id2) => ({ id: id2, role: "reference" }))
        ],
        [
          source,
          body.lastEvent,
          p.lastBy.psychology,
          p.lastBy.traits,
          p.lastBy.values,
          p.lastBy.present,
          ...fighters.map((x) => this.body(x).lastEvent)
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
          reason: stopped ? reason : "utilidade de continuar/observar predominou",
          convention: "rendi\xE7\xE3o/interrup\xE7\xE3o encerram o duelo consentido; persegui\xE7\xE3o fora desta fatia"
        }
      );
      source = e.id;
      if (stopped) return reason;
    }
  }
  duel(attacker, defender, causes, caregiver = this.w.scenario.helper) {
    const a = this.person(attacker), b = this.person(defender);
    if (!a.alive || !b.alive || !a.present || !b.present || [a, b].some(
      (p) => p.lifeStage && !["adult", "elder"].includes(p.lifeStage)
    ))
      return;
    const ordinal = Object.values(this.w.entities).filter(
      (e) => e.kind === "duel" && e.a === attacker && e.b === defender
    ).length;
    const id = `duel:${attacker}:${defender}:${this.c.month()}:${ordinal}`, source = this.next();
    const initiating = a.hostility + a.traits.coragem + (a.traits.orgulho || 0) - a.values.paz / 2 - a.traits.cautela / 2;
    const accepting = b.traits.coragem + (b.traits.orgulho || 0) + (b.values.honra || 0) / 2 - b.traits.cautela - b.values.paz / 4;
    const eligible = !!this.body(attacker).weapon && this.grip(attacker, this.body(attacker).weapon.hand) >= 0.5;
    const started = eligible && (this.options.fixture || initiating >= 75 && accepting >= 30);
    const minuteStart = Math.max(
      this.c.month() * 43200,
      this.body(attacker).minute,
      this.body(defender).minute,
      this.body(caregiver)?.minute || 0
    );
    const duel = {
      id,
      kind: "duel",
      a: attacker,
      b: defender,
      source,
      lastEvent: source,
      minuteStart,
      started: !!started,
      termination: started ? "em curso" : eligible ? "recusa" : "ineleg\xEDvel",
      outcome: started ? "em curso" : "sem duelo",
      wounds: []
    };
    this.c.emit(
      "duel.agreed",
      [
        { id: attacker, role: "actor" },
        { id: defender, role: "target" }
      ],
      [
        ...causes,
        this.body(attacker).lastEvent,
        this.body(defender).lastEvent,
        this.body(caregiver)?.lastEvent || "event:1",
        a.lastBy.traits,
        a.lastBy.values,
        b.lastBy.traits,
        b.lastBy.values
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
          recusar: 0
        },
        fixture: !!this.options.fixture
      }
    );
    if (!started) return;
    this.ensureGoal(a, source);
    this.ensureGoal(b, source);
    let reason = "limite de trocas", lastMinute = minuteStart;
    const steps = [];
    for (let exchange = 0; exchange < (this.options.maxExchanges ?? 6); exchange++) {
      const actor = exchange % 2 ? defender : attacker, target = exchange % 2 ? attacker : defender;
      lastMinute = minuteStart + exchange;
      if (!this.person(actor).alive || !this.person(target).alive) {
        reason = "morte";
        break;
      }
      if (!this.hit(
        actor,
        target,
        { ...duel, lastEvent: steps.at(-1) || source },
        exchange
      )) {
        reason = "incapacidade ou arma ausente";
        break;
      }
      steps.push(`event:${this.w.events.length - 1}`);
      if (!this.options.fixture && this.person(attacker).alive && this.person(defender).alive) {
        const stop = this.exitChoice(duel, steps.at(-1), lastMinute);
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
    const wounds = Object.values(this.w.entities).filter((e) => e.kind === "wound" && e.duel === id).map((w2) => w2.id);
    this.c.emit(
      "duel.ended",
      [
        { id: attacker, role: "reference" },
        { id: defender, role: "reference" }
      ],
      [
        source,
        ...steps,
        this.person(attacker).lastBy.alive,
        this.person(defender).lastBy.alive,
        this.body(attacker).lastEvent,
        this.body(defender).lastEvent,
        ...wounds.map((w2) => this.w.entities[w2].lastEvent)
      ],
      [
        this.replace({
          ...duel,
          wounds,
          termination: reason,
          lastEvent: this.next()
        }),
        ...[attacker, defender].map(
          (id2) => this.replace({
            ...this.body(id2),
            minute: Math.max(
              lastMinute,
              this.body(attacker).minute,
              this.body(defender).minute
            ),
            lastEvent: this.next()
          })
        )
      ],
      { duel: id, termination: reason, minute: lastMinute }
    );
    this.summary(id);
  }
  summary(id) {
    const d = this.w.entities[id], a = this.person(d.a), b = this.person(d.b);
    const wounds = d.wounds.map((id2) => this.w.entities[id2]);
    const credits = [
      this.w.entities[`kill:${d.a}`],
      this.w.entities[`kill:${d.b}`]
    ].filter(
      (e) => e?.kind === "kill" && this.w.entities[e.wound].duel === d.id
    );
    const killedA = credits.some((k) => k.victim === d.a), killedB = credits.some((k) => k.victim === d.b);
    const interrupted = wounds.some(
      (w2) => !this.person(w2.owner).alive && !credits.some((k) => k.victim === w2.owner)
    );
    const outcome = !d.started ? "sem duelo" : killedA && killedB ? "morte de ambos" : killedA ? "morte do desafiante" : killedB ? "morte do desafiado" : interrupted ? "evolu\xE7\xE3o interrompida por morte externa" : !wounds.length ? "sem ferimento" : wounds.some((w2) => w2.permanent) ? "sequela permanente" : wounds.every((w2) => w2.closed !== void 0) ? "recupera\xE7\xE3o" : "ferimento em recupera\xE7\xE3o";
    if (outcome === d.outcome) return;
    this.c.emit(
      "duel.summary",
      [
        { id: d.a, role: "reference" },
        { id: d.b, role: "reference" }
      ],
      [
        d.lastEvent,
        a.lastBy.alive,
        b.lastBy.alive,
        ...credits.map((k) => k.recordedAt),
        ...wounds.map((w2) => w2.lastEvent)
      ],
      [this.replace({ ...d, outcome, lastEvent: this.next() })],
      { duel: id, outcome }
    );
  }
  monthly() {
    const due = Object.values(this.w.entities).filter(
      (e) => e.kind === "wound" && e.closed === void 0 && e.due <= this.c.month() && this.person(e.owner).alive
    );
    for (const wound of due) {
      const part = this.part(wound.owner, wound.part), source = this.next();
      const permanent = wound.nerve || wound.amputation || wound.fracture;
      const nextPart = {
        ...part,
        nerve: !part.present ? 0 : wound.nerve ? wound.care && (wound.rehabMonths || 0) >= 3 ? 0.5 : 0 : part.nerve,
        bone: !part.present ? 0 : wound.fracture ? wound.care ? 0.8 : 0.6 : part.bone,
        lastEvent: source
      };
      const w2 = {
        ...wound,
        permanent,
        closed: this.c.month(),
        lastEvent: source
      };
      this.c.emit(
        permanent ? "sequela.confirmed" : "wound.healed",
        [{ id: w2.owner, role: "actor" }],
        [wound.lastEvent, wound.source, part.lastEvent],
        [
          this.replace(w2),
          this.replace(nextPart),
          this.replace({ ...this.body(w2.owner), pain: 0, lastEvent: source })
        ],
        {
          wound: w2.id,
          permanent,
          gripLeftBefore: this.grip(w2.owner, "left"),
          gripLeftAfter: this.grip(w2.owner, "left", nextPart),
          care: wound.care || null,
          rehabMonths: wound.rehabMonths || 0
        }
      );
      this.notify(w2, source, permanent);
      this.summary(w2.duel);
    }
    for (const g of Object.values(this.w.entities).filter(
      (e) => e.kind === "physicalGoal" && e.status === "adapted"
    )) {
      const p = this.person(g.owner);
      if (!p.alive || !p.present) continue;
      const wounds = this.woundList(p.id).filter(
        (w2) => w2.closed === void 0 && !!w2.care && (w2.nerve || w2.fracture)
      );
      if (!wounds.length) continue;
      const practice = p.traits.disciplina + (p.traits.esperanca || 0) + Math.max(this.grip(p.id, "left"), this.grip(p.id, "right")) * 80;
      const rest = this.body(p.id).pain + p.traits.cautela + (p.psychology?.stress || 0) / 10;
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
          ...wounds.map((w2) => w2.lastEvent)
        ],
        [
          this.replace({
            ...g,
            practiceMonths: (g.practiceMonths || 0) + 1,
            lastEvent: id
          }),
          ...wounds.map(
            (w2) => this.replace({
              ...w2,
              rehabMonths: (w2.rehabMonths || 0) + 1,
              lastEvent: id
            })
          )
        ],
        {
          goal: g.id,
          owner: p.id,
          action: "reabilitar",
          periodMonths: 1,
          practice,
          rest,
          knowledge: g.source
        }
      );
    }
    for (const wound of Object.values(this.w.entities).filter(
      (e) => e.kind === "wound"
    ))
      for (const permanent of [false, true]) {
        if (permanent && !wound.permanent) continue;
        const key = `${wound.id}:${permanent ? "permanent" : "acute"}`;
        const family = [
          .../* @__PURE__ */ new Set([wound.owner, ...this.person(wound.owner).kin])
        ].sort();
        const sender = family.map((id) => this.person(id)).find((p) => p.alive && p.present && !!p.knownInjuries?.[key]);
        if (!sender) continue;
        for (const p of this.person(wound.owner).kin.map((id) => this.person(id)).filter(
          (p2) => p2.alive && p2.present && !p2.knownInjuries?.[key] && !this.options.blockedInformation?.includes(p2.id)
        )) {
          const news = this.c.emit(
            "injury.news",
            [
              { id: sender.id, role: "actor" },
              { id: p.id, role: "beneficiary" }
            ],
            [sender.knownInjuries[key], wound.lastEvent],
            [],
            { wound: wound.id, recipient: p.id, sender: sender.id, permanent }
          );
          this.perceive(wound.owner, wound, news.id, permanent, p.id, "relato");
        }
      }
  }
};

// src/engine/v2/protection.ts
var chance = (n) => Math.max(5, Math.min(95, Math.floor(n)));
function estimateProtection(p, target, attacker, allies, assessedAt) {
  const trust = p.kin.includes(target.id) ? 60 : p.bonds?.[target.id]?.trust || 0;
  const ally = allies.sort(
    (a, b) => b.skill - a.skill || (a.id < b.id ? -1 : 1)
  )[0];
  const plans = {
    proteger: chance(
      50 + (p.skill + p.traits.coragem * 2 - attacker.skill) / 8
    ),
    avisar_alvo: chance(40 + (attacker.skill - target.skill) / 20 + trust / 5),
    pedir_aliados: ally ? chance(
      45 + (p.skill + ally.skill + p.traits.coragem - attacker.skill) / 10
    ) : 0,
    afastar_alvo: chance(45 + (p.skill - attacker.skill) / 18 + trust / 3)
  };
  return {
    assessedAt,
    ownSkill: p.skill,
    attackerSkill: attacker.skill,
    targetSkill: target.skill,
    ally: ally?.id,
    plans,
    best: Math.max(...Object.values(plans)),
    model: "heuristic-v1"
  };
}

// src/engine/v2/engine.ts
var clone = (x) => JSON.parse(JSON.stringify(x));
function freeze(x) {
  if (x && typeof x === "object" && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const child of Object.values(x)) freeze(child);
  }
  return x;
}
function applyEvent(entities, e) {
  for (const effect of e.effects) {
    const id = effect.entity.id;
    if (effect.op === "create" && entities[id])
      throw Error(`Duplicate entity ${id}`);
    if (effect.op === "replace" && !entities[id])
      throw Error(`Unknown entity ${id}`);
    entities[id] = clone(effect.entity);
  }
}
var people = (w2) => Object.values(w2.entities).filter((e) => e.kind === "person").sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
var goals = (w2) => Object.values(w2.entities).filter((e) => e.kind === "goal");
var getPerson = (w2, id) => {
  const p = w2.entities[id];
  if (!p || p.kind !== "person") throw Error(`Not a person: ${id}`);
  return p;
};
var getGoal = (w2, p) => p.goal ? w2.entities[p.goal] : void 0;
function effectiveMemory(w2, p, month) {
  const m = p.memory ? w2.entities[p.memory] : void 0;
  return m ? memoryWeight(m.weight, m.rancor, month - m.at) : 0;
}
function changed(p, patch, id) {
  return {
    ...p,
    ...patch,
    lastBy: {
      ...p.lastBy,
      ...Object.fromEntries(Object.keys(patch).map((k) => [k, id]))
    }
  };
}
var gReason = (g, id) => g.owner === id ? "O respons\xE1vel morreu." : "A pessoa-alvo morreu.";
var SliceSimulation = class {
  state;
  log;
  anatomy;
  life;
  daily;
  politics;
  attachPolitics(initialize = false) {
    if (!this.state.scenario.politics) return;
    this.politics = new PoliticsSystem({ world: () => this.state, month: () => this.month, emit: (...args) => this.emit(...args), die: (id, source, conflict) => {
      const body = this.anatomy.body(id);
      const e = this.emit("conflict.death", [{ id, role: "reference" }], [source, body.lastEvent], [{ op: "replace", entity: { ...body, conscious: false, weapon: void 0, lastEvent: this.nextId() } }], { conflict, cause: "morte em conflito entre assentamentos" });
      this.die(getPerson(this.state, id), void 0, e.id, { conflict, cause: "morte em conflito entre assentamentos", natural: false });
    } });
    if (initialize) this.politics.initialize();
  }
  attachDaily(initialize = false) {
    if (!this.state.scenario.dailyLife) return;
    this.daily = new DailySystem({ die: (id, source) => {
      const body = this.anatomy.body(id);
      const e = this.emit("hunger.death", [{ id, role: "reference" }], [source, body.lastEvent], [{ op: "replace", entity: { ...body, conscious: false, weapon: void 0, lastEvent: this.nextId() } }], { cause: "inani\xE7\xE3o prolongada" });
      this.die(getPerson(this.state, id), void 0, e.id, { cause: "inani\xE7\xE3o prolongada", natural: false });
    }, world: () => this.state, month: () => this.month, body: () => this.anatomy, emit: (...args) => this.emit(...args) });
    if (initialize) this.daily.initialize();
  }
  observeConception;
  attachLife(initialize = false) {
    if (!this.state.scenario.lifeSimulation) return;
    this.life = new LifeSystem({
      observeConception: this.observeConception,
      world: () => this.state,
      month: () => this.month,
      emit: (...args) => this.emit(...args),
      body: (id) => this.anatomy.initialize([id]),
      grow: (id, age, source) => this.anatomy.grow(id, age, source),
      affect: (id, source) => this.feel(
        getPerson(this.state, id),
        this.state.events[Number(source.slice(6))],
        "perda"
      ),
      die: (id, source, details) => {
        const body = this.anatomy.body(id);
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
                weapon: void 0,
                lastEvent: this.nextId()
              }
            }
          ],
          details
        );
        this.die(getPerson(this.state, id), void 0, e.id, details);
        this.drain();
      }
    });
    if (initialize) this.life.initialize();
  }
  attachBody(initialize = false) {
    if (!this.state.scenario.bodySimulation) return;
    this.anatomy = new BodySystem({
      caregiver: (owner, fallback, source) => this.daily?.caregiver(owner, fallback, source) ?? fallback,
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
      }
    });
    if (initialize) this.anatomy.initialize();
  }
  legacySnapshot() {
    return clone({
      ...this.state,
      events: this.log ? this.log.materialize() : this.state.events
    });
  }
  runCompact(untilMonth = this.state.scenario.months) {
    this.advance(untilMonth);
    if (!this.log) throw Error("Compact output requires compact storage");
    return freeze({
      version: 3,
      engine: this.state.engine,
      scenario: clone(this.state.scenario),
      entities: clone(this.state.entities),
      log: this.log.snapshot(),
      nextMonth: this.state.nextMonth,
      complete: this.state.complete
    });
  }
  get world() {
    return freeze(this.legacySnapshot());
  }
  month = 0;
  queue = [];
  delivered = /* @__PURE__ */ new Set();
  reactedThisMonth = /* @__PURE__ */ new Set();
  constructor(scenario2, restored, options = {}) {
    this.observeConception = options.observeConception;
    if (restored) {
      const expected = restored.scenario.politics ? "agents-slice-3-incidents" : restored.scenario.dailyLife ? restored.scenario.dailyLife.economy ? "agents-slice-2d2-recovery3" : "agents-slice-2d1-writing2" : restored.scenario.lifeSimulation ? restored.scenario.lifeSimulation.fertilityPolicy ? "agents-slice-2c" : "agents-slice-2b" : restored.scenario.bodySimulation ? "agents-slice-2.1" : restored.scenario.emotionalDynamics ? "agents-slice-1d" : restored.scenario.advancedObjectives ? "agents-slice-1c" : restored.scenario.personalObjectives ? "agents-slice-protection2" : "agents-slice-1a";
      if (!restored.complete && restored.engine !== expected)
        throw Error(
          "Vers\xE3o incompat\xEDvel para continuar; hist\xF3rico anterior dispon\xEDvel somente para leitura."
        );
      if (restored.version === 3) {
        this.state = {
          version: 2,
          engine: restored.engine,
          scenario: clone(restored.scenario),
          entities: clone(restored.entities),
          events: [],
          nextMonth: restored.nextMonth,
          complete: restored.complete
        };
        this.log = CompactLog.from(restored.log);
        this.state.events = this.log.view();
      } else {
        this.state = clone(restored);
        if (options.storage !== "legacy") {
          this.log = new CompactLog();
          const prior = {};
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
      this.attachPolitics();
      return;
    }
    if (scenario2.months < 1 || scenario2.months > (scenario2.lifeSimulation ? 1200 : 240))
      throw Error("Horizon must be 1\u2013240 months");
    this.state = {
      version: 2,
      engine: scenario2.politics ? "agents-slice-3-incidents" : scenario2.dailyLife ? scenario2.dailyLife.economy ? "agents-slice-2d2-recovery3" : "agents-slice-2d1-writing2" : scenario2.lifeSimulation ? scenario2.lifeSimulation.fertilityPolicy ? "agents-slice-2c" : "agents-slice-2b" : scenario2.bodySimulation ? "agents-slice-2.1" : scenario2.emotionalDynamics ? "agents-slice-1d" : scenario2.advancedObjectives ? "agents-slice-1c" : scenario2.personalObjectives ? "agents-slice-protection2" : "agents-slice-1a",
      scenario: clone(scenario2),
      events: [],
      entities: {},
      nextMonth: 0,
      complete: false
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
            ...scenario2.advancedObjectives ? {
              supplies: scenario2.materials || { paper: 30, ink: 60 },
              suppliesSource: "event:0"
            } : {}
          }
        }
      ],
      {
        seed: scenario2.seed,
        mode: scenario2.mode,
        calendar: "360 days, monthly periods",
        schema: 2
      }
    );
    const initial = [...scenario2.people].sort((a, b) => a.id < b.id ? -1 : 1).map((input) => {
      const p = clone(input);
      if (scenario2.emotionalDynamics) p.psychology ||= initialPsychology();
      p.present = presentAt(scenario2, p.id, 0);
      p.lastBy = Object.fromEntries(
        Object.keys(p).map((k) => [k, this.nextId()])
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
        description: "Parentesco e rivalidades iniciais criados atomicamente."
      }
    );
    if (scenario2.fixtureLeader) {
      if (scenario2.mode !== "fixture")
        throw Error("fixtureLeader is test-only");
      const leader = getPerson(this.state, scenario2.fixtureLeader);
      const place = this.state.entities["place:void"];
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
              leaderSource: this.nextId()
            }
          }
        ],
        {
          fixture: true,
          reason: "Cargo inicial declarado pela fixture; n\xE3o representa elei\xE7\xE3o gerada."
        }
      );
    }
    this.attachLife(true);
    this.attachBody(true);
    this.attachDaily(true);
    this.attachPolitics(true);
  }
  feel(person, source, stimulus) {
    let p = getPerson(this.state, person.id);
    const psy = p.psychology;
    const response = appraise(p, stimulus, knowsExpectedLoss(p, source));
    const emotion = this.emit(
      "emotion.felt",
      [{ id: p.id, role: "actor" }],
      [
        source.id,
        p.lastBy.psychology,
        p.lastBy.traits,
        p.lastBy.values,
        ...stimulus === "fracasso" && source.type === "information.received" ? this.allPersonalGoals().filter(
          (g) => g.owner === p.id && g.status === "failed" && g.target === this.state.events[Number(String(source.data.offense).split(":")[1])].data.victim
        ).map((g) => g.lastEvent) : []
      ],
      [
        {
          op: "replace",
          entity: changed(
            p,
            {
              psychology: {
                ...psy,
                stress: bounded(psy.stress + response.stressDelta, 1e3),
                needs: {
                  ...psy.needs,
                  seguranca: bounded(
                    psy.needs.seguranca + (stimulus === "ameaca" ? 35 : 0)
                  ),
                  vinculo: bounded(
                    psy.needs.vinculo + (stimulus === "perda" ? 25 : 0)
                  )
                },
                lastEmotion: this.nextId()
              }
            },
            this.nextId()
          )
        }
      ],
      {
        ...response,
        stressBefore: psy.stress,
        stressAfter: bounded(psy.stress + response.stressDelta, 1e3),
        stimulusSource: source.id
      }
    );
    p = getPerson(this.state, p.id);
    const facetBefore = p.traits[response.facet] || 0;
    const valueBefore = p.values[response.belief] || 0;
    if (bounded(facetBefore + response.change) === facetBefore && Math.max(-100, Math.min(100, valueBefore + response.change)) === valueBefore) {
      if (source.type === "injury.perceived" || source.type === "sequela.perceived")
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
                [response.facet]: bounded(facetBefore + response.change)
              },
              values: {
                ...p.values,
                [response.belief]: Math.max(
                  -100,
                  Math.min(100, valueBefore + response.change)
                )
              }
            },
            this.nextId()
          )
        }
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
          Math.min(100, valueBefore + response.change)
        )
      }
    );
    if (source.type === "injury.perceived" || source.type === "sequela.perceived")
      this.anatomy?.reassess(p.id, transformed.id);
  }
  needsPeriod() {
    if (this.month === 0) return;
    const previous = /* @__PURE__ */ new Map();
    const socialContact = /* @__PURE__ */ new Map();
    for (let i = this.state.events.length - 1; i >= 0; i--) {
      const e = this.state.events[i];
      if (e.month < this.month - 1) break;
      if (e.month === this.month - 1 && e.type === "social.responded" && e.data.accepted) {
        const g = this.state.entities[String(e.data.goal)];
        if (g) {
          socialContact.set(g.owner, e.id);
          socialContact.set(g.target, e.id);
        }
      }
      if (e.month === this.month - 1 && e.decision && !previous.has(e.decision.actor))
        previous.set(e.decision.actor, e.id);
    }
    for (const p of people(this.state).filter(
      (p2) => p2.alive && (!p2.lifeStage || p2.lifeStage === "adult" || p2.lifeStage === "elder")
    )) {
      const psy = p.psychology, n = psy.needs;
      const last = previous.get(p.id), event = last ? this.state.events[Number(last.split(":")[1])] : void 0;
      const action = event?.decision?.chosen;
      const resting = action === "esperar" || action === "recuperar" || action === "isolar" || psy.isolatedUntil !== void 0 && this.month <= psy.isolatedUntil;
      const social = socialContact.has(p.id);
      const expressing = action === "escrever_obra" || action === "observar";
      const needs = {
        seguranca: bounded(n.seguranca - 8),
        descanso: bounded(n.descanso + (resting ? -25 : 5)),
        vinculo: bounded(n.vinculo + (social ? -22 : 3)),
        expressao: bounded(n.expressao + (expressing ? -20 : 2))
      };
      const pressure = Object.values(needs).reduce(
        (s, x) => s + Math.max(0, x - 60),
        0
      );
      const stress = bounded(
        psy.stress + Math.floor(pressure / 8) - (resting ? 45 : 8),
        1e3
      );
      this.emit(
        "needs.period",
        [{ id: p.id, role: "reference" }],
        [
          p.lastBy.psychology,
          ...last ? [last] : [],
          ...socialContact.has(p.id) ? [socialContact.get(p.id)] : []
        ],
        [
          {
            op: "replace",
            entity: changed(
              p,
              { psychology: { ...psy, needs, stress } },
              this.nextId()
            )
          }
        ],
        {
          owner: p.id,
          periodMonths: 1,
          action: action || "ausente",
          pressure,
          stressBefore: psy.stress,
          stressAfter: stress,
          needs
        }
      );
    }
  }
  stressAction(p, action, target, causes, decision) {
    const psy = p.psychology, id = this.nextId();
    const effects = [];
    let patch = {
      psychology: {
        ...psy,
        stress: bounded(psy.stress - (action === "recuperar" ? 80 : 35), 1e3),
        needs: { ...psy.needs, descanso: bounded(psy.needs.descanso - 30) }
      }
    };
    if (action === "isolar")
      patch = {
        ...patch,
        present: false,
        psychology: { ...patch.psychology, isolatedUntil: this.month + 2 }
      };
    if (action === "hostilizar")
      patch = { ...patch, rival: target, hostility: bounded(p.hostility + 15) };
    const place = this.state.entities["place:void"];
    if (action === "abandonar_posto")
      effects.push({
        op: "replace",
        entity: { ...place, leader: void 0, leaderSource: id }
      });
    effects.push({ op: "replace", entity: changed(p, patch, id) });
    const e = this.emit(
      "stress.response",
      [
        { id: p.id, role: "actor" },
        ...target ? [{ id: target, role: "target" }] : []
      ],
      causes,
      effects,
      {
        action,
        stressBefore: psy.stress,
        stressAfter: patch.psychology.stress,
        abstract: true,
        verbal: action === "hostilizar"
      },
      decision
    );
    if (action === "abandonar_posto")
      for (const g of this.personalGoals(getPerson(this.state, p.id)).filter(
        (g2) => g2.type === "governar" && g2.closed === void 0
      ))
        this.finishPersonalGoal(
          g,
          "abandoned",
          [e.id],
          "Abandonou o posto e a ambi\xE7\xE3o imediata sob estresse."
        );
  }
  /** Local public incidents. A second breach after a warning is expelled, bounding repetition. */
  recurrentThreat(threat) {
    const aggressor = getPerson(this.state, String(threat.data.aggressor));
    const place = this.state.entities["place:void"];
    const old = place.incidents?.[aggressor.id];
    const threats = [...old?.threats || [], threat.id];
    const record = this.emit(
      "incident.recorded",
      [{ id: aggressor.id, role: "reference" }],
      [threat.id, ...old?.threats.slice(-1) || []],
      [
        {
          op: "replace",
          entity: {
            ...place,
            incidents: {
              ...place.incidents,
              [aggressor.id]: { ...old, threats }
            }
          }
        }
      ],
      { aggressor: aggressor.id, count: threats.length, public: true }
    );
    if (threats.length < 3) return false;
    const witnesses = people(this.state).filter(
      (p) => p.alive && p.present && p.id !== aggressor.id
    );
    const authority = witnesses.find((p) => p.id === place.leader) || witnesses[0];
    if (!authority) return false;
    const utilities = {
      confronto: authority.traits.coragem + (authority.values.justica || 0),
      expulsao: authority.traits.cautela + (authority.values.lei || 0),
      perdao: (authority.traits.tolerancia || 0) + (authority.values.paz || 0),
      acordo: (authority.traits.confianca || 0) + (authority.values.cooperacao || 0)
    };
    const response = old?.consequence ? "expulsao" : Object.keys(utilities).sort(
      (a, b) => utilities[b] - utilities[a] || a.localeCompare(b)
    )[0];
    const acceptance = aggressor.values.paz + (aggressor.traits.autocontrole || 0) + authority.skill / 5 - aggressor.hostility;
    const complies = (response === "acordo" || response === "confronto") && acceptance >= 50;
    const eid = this.nextId();
    const currentPlace = this.state.entities["place:void"];
    const patch = response === "expulsao" ? { expelled: eid, present: false, rival: void 0, hostility: 0 } : complies ? { rival: void 0, hostility: 0 } : {};
    const leadershipPatch = response === "expulsao" && currentPlace.leader === aggressor.id ? { leader: void 0, leaderSource: eid } : {};
    this.emit(
      "aggressor.consequence",
      [
        { id: authority.id, role: "actor" },
        { id: aggressor.id, role: "target" }
      ],
      [
        record.id,
        authority.lastBy.values,
        authority.lastBy.traits,
        authority.lastBy.skill,
        aggressor.lastBy.values,
        aggressor.lastBy.traits,
        aggressor.lastBy.hostility,
        ...old?.consequence ? [old.consequence] : []
      ],
      [
        {
          op: "replace",
          entity: {
            ...currentPlace,
            ...leadershipPatch,
            incidents: {
              ...currentPlace.incidents,
              [aggressor.id]: { threats, consequence: eid }
            }
          }
        },
        ...Object.keys(patch).length ? [{ op: "replace", entity: changed(aggressor, patch, eid) }] : []
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
        threat: threat.id
      }
    );
    return complies || response === "expulsao";
  }
  nextId() {
    return `event:${this.state.events.length}`;
  }
  emit(type, participants, causes, effects = [], data = {}, decision) {
    if (this.state.events.length >= (this.state.scenario.lifeSimulation?.fertilityPolicy ? 1e6 : rules.maxEvents))
      throw Error("budget_exceeded: event safety limit");
    const experiences = this.state.scenario.dailyLife ? experienceParticipants(type, participants, data) : [];
    if (experiences.length) {
      effects = [...effects];
      causes = [...causes];
      for (const id of new Set(experiences)) {
        const old = this.state.entities[id];
        if (old?.kind !== "person" || !old.alive) continue;
        if (type === "person.born" && id !== data.parents[0] && !old.present) continue;
        const life = this.state.entities[`life:${id}`];
        if (life?.kind === "life" && this.month - life.birthMonth < 48) continue;
        const index = effects.findIndex((f) => f.entity.id === id), current = index >= 0 ? effects[index].entity : old;
        if (current.kind !== "person") continue;
        data = { ...data, personalWitnesses: [...data.personalWitnesses || [], id] };
        if (old.lastBy.livedFacts) causes.push(old.lastBy.livedFacts);
        const effect = { op: "replace", entity: changed(current, { livedFacts: { ...current.livedFacts, [type]: this.nextId() } }, this.nextId()) };
        if (index >= 0) effects[index] = effect;
        else effects.push(effect);
      }
    }
    const e = freeze({
      id: this.nextId(),
      seq: this.state.events.length,
      ano: Math.floor(this.month / 12),
      dia: this.month % 12 * 30,
      month: this.month,
      type,
      participants: clone(participants),
      location: "place:void",
      causes: [...new Set(causes)].sort(
        (a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1])
      ),
      effects: clone(effects),
      data: clone(data),
      ...decision ? { decision: clone(decision) } : {}
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
  dispatch(e) {
    if (this.state.scenario.emotionalDynamics) {
      const affect = (id, stimulus) => this.enqueue({ kind: "affect", source: e.id, recipient: id, stimulus });
      if (e.type === "information.received") {
        const observer = getPerson(this.state, e.participants[0].id);
        const death = this.state.events[Number(String(e.data.offense).split(":")[1])];
        if (observer.kin.includes(String(death.data.victim)) || (observer.bonds?.[String(death.data.victim)]?.trust || 0) >= 60)
          affect(observer.id, "perda");
        else if (e.data.channel === "relato" && this.allPersonalGoals().some(
          (g) => g.owner === observer.id && g.target === death.data.victim && g.status === "failed"
        ))
          affect(observer.id, "fracasso");
      }
      if (e.type === "threat.announced")
        affect(String(e.data.target), "ameaca");
      if (e.type === "confrontation.resolved" && e.data.winner)
        affect(String(e.data.winner), "vitoria");
      if (e.type === "betrayal.perceived")
        affect(String(e.data.beneficiary), "traicao");
      if (e.type === "personalGoal.closed") {
        const g = this.state.entities[String(e.data.goal)];
        const owner = getPerson(this.state, g.owner);
        const death = e.causes.map((id) => this.state.events[Number(id.split(":")[1])]).find((x) => x?.type === "person.died");
        if (g.status === "completed") affect(g.owner, "vitoria");
        if (g.status === "failed" && (!death || owner.present || owner.informed.includes(death.id)))
          affect(g.owner, "fracasso");
      }
    }
    if (e.type === "threat.announced")
      for (const p of people(this.state).filter(
        (p2) => p2.alive && p2.present && p2.id !== e.data.aggressor && p2.id !== e.data.target
      ))
        this.enqueue({ kind: "threat", source: e.id, recipient: p.id });
    if (e.type === "person.died") {
      for (const p of people(this.state).filter((p2) => p2.alive && p2.present))
        this.enqueue({ kind: "perceive", source: e.id, recipient: p.id });
      for (const g of goals(this.state).filter(
        (g2) => g2.closed === void 0 && (g2.target === e.data.victim || g2.owner === e.data.victim)
      ))
        this.enqueue({ kind: "settleDeath", source: e.id, recipient: g.owner });
    }
    if (e.type === "information.shared")
      this.enqueue({
        kind: "hear",
        source: e.id,
        recipient: String(e.data.recipient),
        sender: String(e.data.sender)
      });
    if (e.type === "help.requested")
      this.enqueue({
        kind: "help",
        source: e.id,
        recipient: String(e.data.recipient),
        sender: String(e.data.sender)
      });
  }
  enqueue(reaction) {
    const key = `${reaction.kind}|${reaction.source}|${reaction.recipient}|${reaction.sender || ""}`;
    if (this.delivered.has(key)) return;
    this.delivered.add(key);
    this.queue.push(reaction);
  }
  drain() {
    let count = 0;
    while (this.queue.length) {
      if (++count > 2e3) throw Error("reaction_cycle");
      const r = this.queue.shift(), p = getPerson(this.state, r.recipient);
      if (!p.alive) continue;
      if (p.lifeStage && !["adult", "elder"].includes(p.lifeStage) && !["affect", "perceive", "hear"].includes(r.kind))
        continue;
      const e = this.state.events[Number(r.source.split(":")[1])];
      if (r.kind === "affect" && r.stimulus) this.feel(p, e, r.stimulus);
      if (r.kind === "perceive") this.learn(p, e, e.id);
      if (r.kind === "hear") {
        const offense = this.state.events[Number(String(e.data.offense).split(":")[1])];
        if (offense?.type === "person.died") this.learn(p, offense, e.id);
      }
      if (r.kind === "threat") this.perceiveThreat(p, e);
      if (r.kind === "help" && r.sender) {
        const sender = getPerson(this.state, r.sender);
        if (!sender.alive || !sender.present || !p.present || sender.helpedBy)
          continue;
        const willingness = p.values.familia + p.values.paz + p.traits.disciplina - p.traits.rancor;
        const id = this.nextId();
        const accepted = p.canHelp && willingness >= 70;
        this.emit(
          "help.responded",
          [
            { id: p.id, role: "actor" },
            { id: sender.id, role: "beneficiary" }
          ],
          [e.id, p.lastBy.values, p.lastBy.canHelp].filter(Boolean),
          accepted ? [
            {
              op: "replace",
              entity: changed(sender, { helpedBy: p.id }, id)
            }
          ] : [],
          { accepted, willingness, request: e.id }
        );
      }
      if (r.kind === "settleDeath") {
        const g = getGoal(this.state, p);
        if (g?.closed !== void 0 || !g) continue;
        if (g.owner === e.data.victim)
          this.closeGoal(
            g,
            "objetivo frustrado",
            [e.id],
            "O agente morreu antes de concluir seu objetivo."
          );
        else if (e.data.killer === g.owner)
          this.closeGoal(
            g,
            "vingan\xE7a cumprida",
            [e.id],
            "O agente causou a morte do ofensor que buscava."
          );
        else if (p.informed.includes(e.id))
          this.closeGoal(
            g,
            "alvo morto por outra causa",
            [e.id],
            "A morte do alvo foi atribu\xEDda a outro agente."
          );
      }
    }
  }
  learn(person, death, source) {
    let p = getPerson(this.state, person.id);
    if (this.life?.get(p.id) && this.month - this.life.get(p.id).birthMonth < 48 || this.state.scenario.blockedInformation.includes(p.id) || p.informed.includes(death.id))
      return;
    const id = this.nextId();
    this.emit(
      "information.received",
      [
        { id: p.id, role: "actor" },
        { id: String(death.data.victim), role: "reference" }
      ],
      [source, p.lastBy.present].filter(Boolean),
      [
        {
          op: "replace",
          entity: changed(p, { informed: [...p.informed, death.id], ...this.daily ? { knownFactSources: { ...p.knownFactSources, [death.id]: id } } : {} }, id)
        }
      ],
      {
        offense: death.id,
        knownDeath: { natural: death.data.natural === true, ageYears: death.data.ageYears },
        channel: source === death.id ? "testemunho" : "relato",
        source
      }
    );
    p = getPerson(this.state, p.id);
    const existing = getGoal(this.state, p);
    if (existing && existing.closed === void 0 && existing.target === death.data.victim) {
      this.closeGoal(
        existing,
        death.data.killer === p.id ? "vingan\xE7a cumprida" : "alvo morto por outra causa",
        [id, death.id],
        "A not\xEDcia confirmou a morte do alvo."
      );
      return;
    }
    if (p.lifeStage && p.lifeStage !== "adult" && !(this.daily && p.lifeStage === "elder") || !p.kin.includes(String(death.data.victim)) || !death.data.killer || death.data.killer === p.id || p.goal)
      return;
    const memory2 = {
      id: `memory:${p.id}`,
      kind: "memory",
      owner: p.id,
      victim: String(death.data.victim),
      offender: String(death.data.killer),
      source: id,
      at: this.month,
      weight: 850,
      offenderSkillEstimate: Number(death.data.killerSkill),
      rancor: p.traits.rancor
    };
    const mid = this.nextId();
    this.emit(
      "memory.formed",
      [
        { id: p.id, role: "actor" },
        { id: memory2.victim, role: "reference" }
      ],
      [id, p.lastBy.traits, p.lastBy.kin].filter(Boolean),
      [
        { op: "create", entity: memory2 },
        { op: "replace", entity: changed(p, { memory: memory2.id }, mid) }
      ],
      { emotion: "luto", offense: death.id, weight: memory2.weight }
    );
    p = getPerson(this.state, p.id);
    const desire = p.values.vinganca * 5 + p.values.familia * 2 + p.traits.rancor * 2 - p.values.paz * 5;
    const goal = {
      id: `goal:${p.id}`,
      kind: "goal",
      owner: p.id,
      target: memory2.offender,
      victim: memory2.victim,
      offense: death.id,
      memory: memory2.id,
      adopted: this.month,
      source: this.nextId()
    };
    const gid = this.nextId();
    this.emit(
      "goal.adopted",
      [
        { id: p.id, role: "actor" },
        { id: goal.target, role: "reference" }
      ],
      [mid, p.lastBy.values].filter(Boolean),
      [
        { op: "create", entity: goal },
        { op: "replace", entity: changed(p, { goal: goal.id }, gid) }
      ],
      { desire, reason: "Avaliar resposta \xE0 morte conhecida de um familiar." }
    );
  }
  closeGoal(goal, outcome, causes, reason) {
    const current = this.state.entities[goal.id];
    if (current.closed !== void 0) return;
    this.emit(
      "goal.closed",
      [
        {
          id: goal.owner,
          role: getPerson(this.state, goal.owner).alive ? "actor" : "reference"
        },
        { id: goal.target, role: "reference" }
      ],
      [goal.source, ...causes],
      [{ op: "replace", entity: { ...current, closed: this.month, outcome } }],
      { goal: goal.id, outcome, reason }
    );
  }
  offerAgreement(goal) {
    const owner = getPerson(this.state, goal.owner), target = getPerson(this.state, goal.target);
    if (!owner.alive || !owner.present || !target.alive || !target.present || !goal.accordIntent || goal.accordRejected)
      return false;
    const offer = this.emit(
      "agreement.offered",
      [
        { id: owner.id, role: "actor" },
        { id: target.id, role: "target" }
      ],
      [goal.accordIntent, owner.lastBy.present, target.lastBy.present],
      [],
      { goal: goal.id }
    );
    const willingness = target.values.paz * 5 + target.traits.cautela * 2 + target.remorse * 2 - target.traits.rancor * 2 - target.values.vinganca * 3;
    const accepted = willingness >= 300;
    const reply = this.emit(
      "agreement.responded",
      [
        { id: target.id, role: "actor" },
        { id: owner.id, role: "target" }
      ],
      [
        offer.id,
        target.lastBy.values,
        target.lastBy.traits,
        target.lastBy.remorse
      ].filter(Boolean),
      accepted ? [] : [
        {
          op: "replace",
          entity: { ...goal, accordRejected: this.nextId() }
        }
      ],
      { goal: goal.id, accepted, willingness }
    );
    if (accepted) {
      const agreed = this.emit(
        "reconciliation.agreed",
        [
          { id: owner.id, role: "actor" },
          { id: target.id, role: "target" }
        ],
        [reply.id, goal.accordIntent],
        [],
        { goal: goal.id, accepted: true, reply: reply.id }
      );
      this.closeGoal(
        goal,
        "reconcilia\xE7\xE3o",
        [agreed.id],
        "Acordo aceito pelos dois agentes ap\xF3s contato efetivo."
      );
    }
    return true;
  }
  allPersonalGoals() {
    return Object.values(this.state.entities).filter(
      (x) => x.kind === "personalGoal"
    );
  }
  personalGoals(p) {
    return (p.personalGoals || []).map(
      (id) => this.state.entities[id]
    );
  }
  adoptPersonalGoal(p, target, type, causes, details = {}) {
    const id = `personal:${type}:${p.id}:${target.id}${this.daily && type === "criar_obra" ? ":" + details.theme : ""}`, eid = this.nextId();
    const g = {
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
      ...details
    };
    this.emit(
      "personalGoal.adopted",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "reference" }
      ],
      causes,
      [
        { op: "create", entity: g },
        {
          op: "replace",
          entity: changed(
            p,
            { personalGoals: [...p.personalGoals || [], id] },
            eid
          )
        }
      ],
      {
        goal: id,
        type,
        reason: type === "amizade" ? "Desejo de construir amizade com pessoa encontrada." : type === "governar" ? "Ambi\xE7\xE3o de coordenar o grupo com apoio volunt\xE1rio." : type === "criar_obra" ? "Desejo de criar uma obra motivado por arte e criatividade." : "Compromisso de proteger ap\xF3s amea\xE7a percebida."
      }
    );
    return g;
  }
  finishPersonalGoal(g, status, causes, reason) {
    const current = this.state.entities[g.id];
    if (current.closed !== void 0) return;
    this.emit(
      "personalGoal.closed",
      [
        {
          id: g.owner,
          role: getPerson(this.state, g.owner).alive ? "actor" : "reference"
        },
        { id: g.target, role: "reference" }
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
            ...status === "resolved_by_other" ? { threatResolved: true } : {},
            lastEvent: this.nextId()
          }
        }
      ],
      { goal: g.id, status, reason }
    );
  }
  prepareFriendship(p) {
    if ((p.values.amizade || 0) < 35 || this.personalGoals(p).some((g) => g.type === "amizade"))
      return;
    const target = people(this.state).filter(
      (q) => q.id !== p.id && q.alive && q.present && (!this.state.scenario.friendTargets?.[p.id] || q.id === this.state.scenario.friendTargets[p.id])
    ).sort(
      (a, b) => sample(
        this.daily ? domainSeed(this.state.scenario.seed, "friendship") : this.state.scenario.seed,
        `contact:${p.id}:${a.id}`,
        0,
        1e6
      ) - sample(
        this.daily ? domainSeed(this.state.scenario.seed, "friendship") : this.state.scenario.seed,
        `contact:${p.id}:${b.id}`,
        0,
        1e6
      ) || (a.id < b.id ? -1 : 1)
    )[0];
    if (!target) return;
    let source = p.acquaintances?.[target.id];
    if (!source) {
      const eid = this.nextId();
      const met = this.emit(
        "person.met",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "target" }
        ],
        [p.lastBy.present, target.lastBy.present],
        [
          {
            op: "replace",
            entity: changed(
              p,
              { acquaintances: { ...p.acquaintances, [target.id]: eid } },
              eid
            )
          },
          {
            op: "replace",
            entity: changed(
              target,
              { acquaintances: { ...target.acquaintances, [p.id]: eid } },
              eid
            )
          }
        ],
        { first: p.id, second: target.id }
      );
      source = met.id;
    }
    this.adoptPersonalGoal(
      getPerson(this.state, p.id),
      getPerson(this.state, target.id),
      "amizade",
      [source, p.lastBy.values]
    );
  }
  socialize(p, target, causes, decision) {
    const goal = this.personalGoals(p).find(
      (g) => g.type === "amizade" && g.closed === void 0 && g.target === target.id
    );
    if (!goal) return;
    const contact = this.emit(
      "social.invited",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "target" }
      ],
      causes,
      [],
      { goal: goal.id },
      decision
    );
    const willingness = (target.values.amizade || 0) + target.values.paz + target.values.familia - target.traits.rancor - Math.floor(target.traits.cautela / 2);
    const accepted = willingness >= 85, eid = this.nextId();
    const response = this.emit(
      "social.responded",
      [
        { id: target.id, role: "actor" },
        { id: p.id, role: "target" }
      ],
      [contact.id, target.lastBy.values, target.lastBy.traits],
      [],
      { accepted, willingness, goal: goal.id }
    );
    if (!accepted) {
      const g = {
        ...goal,
        rejections: goal.rejections + 1,
        lastEvent: this.nextId()
      };
      this.emit(
        "friendship.rejected",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "reference" }
        ],
        [response.id],
        [{ op: "replace", entity: g }],
        { goal: goal.id }
      );
      if (g.rejections >= 3)
        this.finishPersonalGoal(
          g,
          "abandoned",
          [response.id],
          "Tr\xEAs convites recusados; respeitou a recusa."
        );
      return;
    }
    const a = getPerson(this.state, p.id), b = getPerson(this.state, target.id), oldA = a.bonds?.[b.id], oldB = b.bonds?.[a.id], bid = this.nextId();
    const bond = (old) => ({
      trust: Math.min(100, (old?.trust || 0) + 20),
      interactions: (old?.interactions || 0) + 1,
      source: bid
    });
    const ba = bond(oldA), bb = bond(oldB);
    const interaction = this.emit(
      "relationship.strengthened",
      [
        { id: a.id, role: "actor" },
        { id: b.id, role: "target" }
      ],
      [
        response.id,
        ...[oldA?.source, oldB?.source].filter((x) => !!x)
      ],
      [
        {
          op: "replace",
          entity: changed(a, { bonds: { ...a.bonds, [b.id]: ba } }, bid)
        },
        {
          op: "replace",
          entity: changed(b, { bonds: { ...b.bonds, [a.id]: bb } }, bid)
        }
      ],
      {
        first: a.id,
        second: b.id,
        firstTrust: ba.trust,
        secondTrust: bb.trust
      }
    );
    if (ba.trust >= 60 && bb.trust >= 60) {
      const formed = this.emit(
        "friendship.formed",
        [
          { id: a.id, role: "actor" },
          { id: b.id, role: "target" }
        ],
        [interaction.id],
        [],
        { first: a.id, second: b.id, goal: goal.id }
      );
      this.finishPersonalGoal(
        goal,
        "completed",
        [formed.id],
        "Amizade rec\xEDproca constru\xEDda por encontros aceitos."
      );
    }
  }
  perceiveThreat(p, threat) {
    if (this.state.scenario.blockedThreatPerception?.includes(p.id)) return;
    const target = getPerson(this.state, String(threat.data.target)), attacker = getPerson(this.state, String(threat.data.aggressor));
    const perception = this.emit(
      "threat.perceived",
      [
        { id: p.id, role: "witness" },
        { id: target.id, role: "reference" }
      ],
      [threat.id, p.lastBy.present],
      [],
      { threat: threat.id, observer: p.id }
    );
    const existing = this.personalGoals(p).find(
      (g) => g.type === "proteger" && g.target === target.id
    );
    if (existing?.closed !== void 0) return;
    const related = p.kin.includes(target.id) || (p.bonds?.[target.id]?.trust || 0) >= 20;
    if (!existing && !related && (p.values.solidariedade || 0) < 60) return;
    if (!existing && this.state.scenario.advancedObjectives) {
      const motive = (p.kin.includes(target.id) ? p.values.familia * 2 : 0) + (p.bonds?.[target.id]?.trust || 0) + (p.values.solidariedade || 0) + ((p.traits.compaixao ?? 50) - 50) * 2;
      if (motive < 60) return;
    }
    const allies = this.knownAllies(p, target.id, attacker.id);
    const estimate = estimateProtection(
      p,
      target,
      attacker,
      allies,
      this.nextId()
    );
    const assessment = this.emit(
      "protection.assessed",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "reference" }
      ],
      [
        perception.id,
        p.lastBy.skill,
        attacker.lastBy.skill,
        target.lastBy.skill,
        p.lastBy.values,
        ...allies.map((a) => a.lastBy.skill),
        ...allies.map(
          (a) => p.acquaintances?.[a.id] || p.bonds?.[a.id]?.source || p.lastBy.kin
        ),
        p.lastBy.acquaintances,
        p.lastBy.bonds,
        p.lastBy.kin
      ].filter(Boolean),
      [],
      {
        estimate,
        threshold: 40,
        eligible: estimate.best >= 40,
        reason: "Estimativa anterior ao compromisso; n\xE3o \xE9 probabilidade calibrada."
      }
    );
    if (existing) {
      this.emit(
        "protection.renewed",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "reference" }
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
              lastEvent: this.nextId()
            }
          }
        ],
        { goal: existing.id }
      );
      return;
    }
    if (estimate.best < 40) {
      this.emit(
        "protection.declined",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "reference" }
        ],
        [assessment.id],
        [],
        {
          reason: "Nenhum plano dispon\xEDvel alcan\xE7ou a chance estimada m\xEDnima.",
          estimate
        }
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
        ...p.bonds?.[target.id] ? [p.bonds[target.id].source] : []
      ],
      {
        threat: threat.id,
        aggressor: attacker.id,
        perception: perception.id,
        estimate,
        threatResolved: false
      }
    );
  }
  prepareAdvancedGoals(p) {
    const knownTheme = this.personalGoals(p).some((g) => g.type === "criar_obra" && g.closed === void 0) ? void 0 : this.daily?.theme(p);
    if ((p.values.poder || 0) > 30 && (p.traits.ambicao || 0) > 55 && !this.personalGoals(p).some((g) => g.type === "governar")) {
      this.adoptPersonalGoal(
        p,
        p,
        "governar",
        [p.lastBy.values, p.lastBy.traits],
        { solicited: {} }
      );
      p = getPerson(this.state, p.id);
      const eid = this.nextId();
      this.emit(
        "support.pledged",
        [{ id: p.id, role: "actor" }],
        [this.personalGoals(p).find((g) => g.type === "governar").source],
        [{ op: "replace", entity: changed(p, { supportFor: p.id }, eid) }],
        {
          candidate: p.id,
          reason: "Compromisso p\xFAblico com a pr\xF3pria candidatura."
        }
      );
      p = getPerson(this.state, p.id);
    }
    if ((p.values.arte || 0) > 30 && (p.traits.criatividade || 0) > 35 && (this.daily ? !!knownTheme && !this.personalGoals(p).some((g) => g.type === "criar_obra" && g.closed === void 0) : !this.personalGoals(p).some((g) => g.type === "criar_obra")))
      this.adoptPersonalGoal(
        p,
        p,
        "criar_obra",
        [p.lastBy.values, p.lastBy.traits, ...knownTheme ? [knownTheme.fact, knownTheme.evidence] : []],
        { progress: 0, ...knownTheme ? { theme: knownTheme.fact, knowledgeSource: knownTheme.evidence } : {} }
      );
  }
  campaignContact(p, g) {
    return people(this.state).filter(
      (q) => q.alive && q.present && q.id !== p.id && (!this.daily || ["adult", "elder"].includes(q.lifeStage || "adult")) && q.supportFor !== p.id && (!g.solicited?.[q.id] || this.month - g.solicited[q.id].month >= 12)
    ).sort(
      (a, b) => Number(!!p.acquaintances?.[b.id]) - Number(!!p.acquaintances?.[a.id]) || (a.id < b.id ? -1 : 1)
    )[0];
  }
  campaign(p, voter, causes, decision) {
    const g = this.personalGoals(p).find(
      (g2) => g2.type === "governar" && g2.closed === void 0
    );
    let meeting = p.acquaintances?.[voter.id];
    if (!meeting) {
      const eid2 = this.nextId();
      meeting = this.emit(
        "person.met",
        [
          { id: p.id, role: "actor" },
          { id: voter.id, role: "target" }
        ],
        [p.lastBy.present, voter.lastBy.present],
        [
          {
            op: "replace",
            entity: changed(
              p,
              { acquaintances: { ...p.acquaintances, [voter.id]: eid2 } },
              eid2
            )
          },
          {
            op: "replace",
            entity: changed(
              voter,
              { acquaintances: { ...voter.acquaintances, [p.id]: eid2 } },
              eid2
            )
          }
        ],
        { first: p.id, second: voter.id }
      ).id;
    }
    p = getPerson(this.state, p.id);
    voter = getPerson(this.state, voter.id);
    const request = this.emit(
      "leadership.requested",
      [
        { id: p.id, role: "actor" },
        { id: voter.id, role: "target" }
      ],
      [...causes, meeting],
      [],
      { goal: g.id },
      decision
    );
    const utility = (candidate) => (candidate.skills?.lideranca || 0) * 3 + (voter.bonds?.[candidate.id]?.trust || 0) * 2 + (voter.values.lei || 0) + (voter.values.paz || 0) - (voter.traits.ambicao || 0) * 2;
    const current = voter.supportFor ? getPerson(this.state, voter.supportFor) : void 0, score = utility(p), old = current?.alive ? utility(current) : 80, accepted = score >= 100 && score > old + 20;
    const eid = this.nextId();
    const response = this.emit(
      "leadership.responded",
      [
        { id: voter.id, role: "actor" },
        { id: p.id, role: "target" }
      ],
      [
        request.id,
        voter.lastBy.values,
        voter.lastBy.traits,
        ...voter.lastBy.supportFor ? [voter.lastBy.supportFor] : []
      ],
      [
        {
          op: "replace",
          entity: {
            ...g,
            solicited: {
              ...g.solicited,
              [voter.id]: { month: this.month, event: eid }
            },
            lastEvent: eid
          }
        },
        ...accepted ? [
          {
            op: "replace",
            entity: changed(voter, { supportFor: p.id }, eid)
          }
        ] : []
      ],
      { goal: g.id, accepted, score, previousScore: old }
    );
    if (accepted && this.state.scenario.emotionalDynamics) {
      const currentVoter = getPerson(this.state, voter.id);
      if (voter.pledge && voter.pledge.to !== p.id && voter.pledge.until >= this.month) {
        const injured = getPerson(this.state, voter.pledge.to);
        if (injured.alive && injured.present)
          this.emit(
            "betrayal.perceived",
            [
              { id: injured.id, role: "actor" },
              { id: voter.id, role: "target" }
            ],
            [response.id, voter.pledge.source],
            [],
            {
              beneficiary: injured.id,
              brokenPledge: voter.pledge.source,
              observed: true
            }
          );
      }
      this.emit(
        "pledge.made",
        [
          { id: voter.id, role: "actor" },
          { id: p.id, role: "target" }
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
                  until: this.month + 12
                }
              },
              this.nextId()
            )
          }
        ],
        { durationMonths: 12, promise: "Manter apoio por doze meses." }
      );
    }
    const eligible = people(this.state).filter((q) => q.alive && q.present && (!this.daily || ["adult", "elder"].includes(q.lifeStage || "adult"))), votes = eligible.filter((q) => q.supportFor === p.id), majority = Math.max(3, Math.floor(eligible.length / 2) + 1), place = this.state.entities["place:void"];
    if (votes.length >= majority && place.leader !== p.id) {
      const lid = this.nextId();
      const elected = this.emit(
        "leadership.changed",
        [
          { id: p.id, role: "actor" },
          ...votes.filter((q) => q.id !== p.id).map((q) => ({ id: q.id, role: "witness" }))
        ],
        [
          response.id,
          ...votes.map((q) => q.lastBy.supportFor).filter(Boolean),
          ...place.leaderSource ? [place.leaderSource] : []
        ],
        [
          {
            op: "replace",
            entity: { ...place, leader: p.id, leaderSource: lid }
          }
        ],
        {
          goal: g.id,
          previous: place.leader || null,
          voters: votes.map((q) => q.id),
          majority,
          role: "coordena\xE7\xE3o do grupo, sem civiliza\xE7\xE3o ou monarquia"
        }
      );
      this.finishPersonalGoal(
        g,
        "completed",
        [elected.id],
        "Conquistou a coordena\xE7\xE3o com maioria de apoios p\xFAblicos v\xE1lidos."
      );
    }
  }
  writeWork(p, causes, decision) {
    let g = this.personalGoals(p).find(
      (g2) => g2.type === "criar_obra" && g2.closed === void 0
    );
    if (this.daily && (p.workedMonth === this.month || g.workLastMonth === this.month)) return;
    if (this.daily && (!g.theme || !g.knowledgeSource || !this.daily.knows(p, g.theme, g.knowledgeSource))) {
      const refused = this.emit("work.blocked", [{ id: p.id, role: "actor" }], causes, [], { goal: g.id, reason: "Tema sem experi\xEAncia ou not\xEDcia conhecida." }, decision);
      this.finishPersonalGoal(g, "failed", [refused.id], "Tema desconhecido.");
      return;
    }
    let place = this.state.entities["place:void"];
    const home = this.daily?.home(p.id);
    const stock = home ? home.writingStock : place.supplies;
    if (!g.workStarted) {
      if (!stock || stock.paper < 3 || stock.ink < 2) {
        const refused = this.emit(
          "work.blocked",
          [{ id: p.id, role: "actor" }],
          [...causes, ...home?.stockSource ? [home.stockSource] : []],
          home ? [{ op: "replace", entity: changed(p, { blockedWritingStock: home.stockSource }, this.nextId()) }] : [],
          { goal: g.id, ...home ? { household: home.id } : {}, reason: "Faltam papel ou tinta." },
          decision
        );
        this.finishPersonalGoal(
          g,
          "failed",
          [refused.id],
          "Sem materiais dispon\xEDveis para iniciar a obra."
        );
        return;
      }
      const theme = g.theme || p.informed.at(-1) || p.acquaintances && Object.values(p.acquaintances)[0];
      const started = this.emit(
        "work.started",
        [{ id: p.id, role: "actor" }],
        [
          ...causes,
          ...theme ? [theme] : [],
          ...theme && p.lastBy.informed ? [p.lastBy.informed] : [],
          ...home?.stockSource ? [home.stockSource] : place.suppliesSource ? [place.suppliesSource] : [],
          ...g.knowledgeSource ? [g.knowledgeSource] : []
        ],
        [
          {
            op: "replace",
            entity: home ? { ...home, writingStock: { paper: stock.paper - 3, ink: stock.ink - 2 }, stockSource: this.nextId() } : {
              ...place,
              supplies: { paper: stock.paper - 3, ink: stock.ink - 2 },
              suppliesSource: this.nextId()
            }
          },
          {
            op: "replace",
            entity: {
              ...g,
              theme,
              workStarted: this.nextId(),
              lastEvent: this.nextId()
            }
          }
        ],
        {
          goal: g.id,
          theme: theme || null,
          ...home ? { household: home.id, knowledgeSource: g.knowledgeSource } : {},
          paper: 3,
          ink: 2,
          reason: "Express\xE3o art\xEDstica motivada por valores e experi\xEAncia conhecida."
        }
      );
      g = this.state.entities[g.id];
      causes = [started.id];
    }
    const progress = (g.progress || 0) + 1, eid = this.nextId(), skills = {
      lideranca: p.skills?.lideranca || 0,
      escrita: Math.min(100, (p.skills?.escrita || 0) + 2)
    };
    const period = this.emit(
      "work.period",
      [{ id: p.id, role: "actor" }],
      [...causes, g.lastEvent, p.lastBy.skills],
      [
        { op: "replace", entity: { ...g, progress, ...this.daily ? { workLastMonth: this.month } : {}, lastEvent: eid } },
        { op: "replace", entity: changed(p, { skills, ...this.daily ? { workedMonth: this.month } : {} }, eid) }
      ],
      { goal: g.id, action: "escrever_obra", periodMonths: 1, progress, ...this.daily ? { occupiedMonth: this.month } : {} },
      decision
    );
    if (progress >= 6) {
      p = getPerson(this.state, p.id);
      const wid = `work:${p.id}${this.daily ? ":" + g.id : ""}`, source = this.nextId(), quality = Math.max(
        0,
        Math.min(
          100,
          Math.floor(
            ((p.skills?.escrita || 0) + (p.traits.criatividade || 0) + (p.traits.perseveranca || 0)) / 3
          )
        )
      );
      const work = {
        id: wid,
        kind: "work",
        name: `Caderno de ${p.name}`,
        creator: p.id,
        ...this.daily ? { owner: p.id, ownerSource: source, knowledgeSource: g.knowledgeSource } : {},
        goal: g.id,
        theme: g.theme,
        quality,
        source,
        created: this.month,
        material: "papel e tinta"
      };
      const created = this.emit(
        "work.created",
        [{ id: p.id, role: "actor" }],
        [period.id, g.workStarted, ...g.theme ? [g.theme] : []],
        [
          { op: "create", entity: work },
          {
            op: "replace",
            entity: changed(p, { works: [...p.works || [], wid] }, source)
          }
        ],
        { goal: g.id, work: wid, quality }
      );
      this.daily?.transfer(work);
      this.finishPersonalGoal(
        g,
        "completed",
        [created.id],
        "Concluiu uma obra ap\xF3s seis per\xEDodos de trabalho e consumo real de materiais."
      );
    }
  }
  knownAllies(p, target, attacker) {
    return people(this.state).filter(
      (q) => q.id !== p.id && q.id !== target && q.id !== attacker && q.alive && q.present && !this.reactedThisMonth.has(q.id) && (p.kin.includes(q.id) || !!p.acquaintances?.[q.id] || (p.bonds?.[q.id]?.trust || 0) >= 20)
    );
  }
  protectiveResponse(p, targetId, action, causes, decision) {
    if (action === "proteger")
      return this.protect(p, targetId, causes, decision);
    const g = this.personalGoals(p).find(
      (g2) => g2.type === "proteger" && g2.target === targetId && g2.closed === void 0 && !g2.threatResolved
    );
    if (!g?.estimate || !g.aggressor || !g.threat) return false;
    const target = getPerson(this.state, targetId), attacker = getPerson(this.state, g.aggressor);
    const request = this.emit(
      action === "avisar_alvo" ? "protection.warning" : action === "pedir_aliados" ? "protection.support.requested" : "protection.escort.offered",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "target" }
      ],
      [...causes, g.estimate.assessedAt, g.perception],
      [],
      { goal: g.id, threat: g.threat, action },
      decision
    );
    let success = false, response = request.id;
    if (action === "pedir_aliados") {
      const ally = this.knownAllies(p, target.id, attacker.id).find(
        (a) => a.id === g.estimate.ally
      );
      if (ally) {
        const willingness = (ally.values.solidariedade || 0) + ally.values.familia + (ally.bonds?.[p.id]?.trust || 0) - ally.traits.cautela - Math.max(0, attacker.skill - ally.skill) / 5;
        const accepted = willingness >= 40;
        const reply = this.emit(
          "protection.support.responded",
          [
            { id: ally.id, role: "actor" },
            { id: p.id, role: "target" }
          ],
          [
            request.id,
            ally.lastBy.values,
            ally.lastBy.traits,
            ally.lastBy.skill
          ],
          [],
          { accepted, willingness, goal: g.id }
        );
        response = reply.id;
        success = accepted && p.skill + ally.skill + p.traits.coragem >= attacker.skill;
        if (success) {
          const own = this.personalGoals(ally).find(
            (q) => q.type === "proteger" && q.closed === void 0 && q.target === target.id
          ), aid = this.nextId();
          this.emit(
            "protection.support.contributed",
            [
              { id: ally.id, role: "actor" },
              { id: target.id, role: "reference" }
            ],
            [reply.id, ...own ? [own.lastEvent] : []],
            own ? [
              {
                op: "replace",
                entity: {
                  ...own,
                  interventions: own.interventions + 1,
                  lastEvent: aid
                }
              }
            ] : [],
            {
              requestingGoal: g.id,
              goal: own?.id || null,
              threat: g.threat,
              jointMargin: p.skill + ally.skill + p.traits.coragem - attacker.skill
            }
          );
        }
        if (accepted) this.reactedThisMonth.add(ally.id);
      }
    } else {
      const trust = target.kin.includes(p.id) ? 60 : target.bonds?.[p.id]?.trust || 0;
      const utility = action === "avisar_alvo" ? Math.max(0, attacker.skill - target.skill) + target.traits.cautela * 3 - target.traits.coragem * 2 : trust + Math.floor(Math.max(0, attacker.skill - target.skill) / 3) + target.traits.cautela - target.traits.coragem;
      const accepted = utility >= (action === "avisar_alvo" ? 100 : 40);
      const eid2 = this.nextId();
      const reply = this.emit(
        "protection.target.responded",
        [
          { id: target.id, role: "actor" },
          { id: p.id, role: "target" }
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
                  [g.threat]: request.id
                },
                ...accepted ? { present: false, shelteredUntil: this.month + 3 } : {}
              },
              eid2
            )
          }
        ],
        {
          accepted,
          utility,
          action,
          goal: g.id,
          reason: "Aviso ou afastamento depende de resposta do pr\xF3prio alvo."
        }
      );
      response = reply.id;
      success = accepted;
    }
    const eid = this.nextId();
    this.emit(
      success ? "protection.succeeded" : "protection.attempt.failed",
      [
        { id: p.id, role: "actor" },
        { id: target.id, role: "reference" }
      ],
      [response, g.lastEvent],
      [
        {
          op: "replace",
          entity: {
            ...g,
            interventions: g.interventions + (success ? 1 : 0),
            lastEvent: eid
          }
        }
      ],
      { goal: g.id, action, success }
    );
    this.reactedThisMonth.add(p.id);
    return success;
  }
  protect(p, targetId, causes, decision) {
    const g = this.personalGoals(p).find(
      (g2) => g2.type === "proteger" && g2.closed === void 0 && g2.target === targetId && !g2.threatResolved
    );
    if (!g?.aggressor || !g.threat) return false;
    const attacker = getPerson(this.state, g.aggressor), margin = p.skill + p.traits.coragem * 2 - attacker.skill;
    const success = margin >= 0, eid = this.nextId();
    this.emit(
      success ? "protection.intervened" : "protection.failed",
      [
        { id: p.id, role: "actor" },
        { id: targetId, role: "beneficiary" },
        { id: attacker.id, role: "target" }
      ],
      [...causes, g.threat, g.perception, attacker.lastBy.skill],
      [
        {
          op: "replace",
          entity: {
            ...g,
            interventions: g.interventions + (success ? 1 : 0),
            lastEvent: eid
          }
        },
        ...success && attacker.rival === targetId ? [
          {
            op: "replace",
            entity: changed(
              attacker,
              {
                rival: void 0,
                hostility: Math.max(0, attacker.hostility - 50)
              },
              eid
            )
          }
        ] : []
      ],
      {
        goal: g.id,
        threat: g.threat,
        success,
        margin,
        reason: "Interven\xE7\xE3o abstrata, sem dano corporal."
      },
      decision
    );
    this.reactedThisMonth.add(p.id);
    return success;
  }
  resolveThreat(threat, resolution) {
    for (const g of this.allPersonalGoals().filter(
      (g2) => g2.closed === void 0 && g2.threat === threat && !g2.threatResolved
    )) {
      const observer = getPerson(this.state, g.owner);
      if (this.state.scenario.emotionalDynamics && resolution && g.interventions === 0 && observer.alive && observer.present && getPerson(this.state, g.target).alive) {
        this.finishPersonalGoal(
          g,
          "resolved_by_other",
          [threat, resolution, ...g.perception ? [g.perception] : []],
          "Resolvido por outro: presenciou a resolu\xE7\xE3o sem interven\xE7\xE3o pr\xF3pria."
        );
        continue;
      }
      this.emit(
        "threat.resolved",
        [
          { id: g.owner, role: "reference" },
          { id: g.target, role: "reference" }
        ],
        [g.lastEvent, threat],
        [
          {
            op: "replace",
            entity: { ...g, threatResolved: true, lastEvent: this.nextId() }
          }
        ],
        { goal: g.id, threat }
      );
    }
  }
  availability() {
    for (const p of people(this.state)) {
      if (!p.alive || p.escaped) continue;
      const present = !p.expelled && (!p.psychology?.isolatedUntil || this.month >= p.psychology.isolatedUntil) && (!p.shelteredUntil || this.month >= p.shelteredUntil) && (this.life?.get(p.id)?.parents.length ? true : presentAt(this.state.scenario, p.id, this.month));
      if (p.present !== present) {
        const id = this.nextId();
        this.emit(
          "presence.changed",
          [{ id: p.id, role: "actor" }],
          [p.lastBy.present, "event:0"],
          [{ op: "replace", entity: changed(p, { present }, id) }],
          {
            present,
            reason: "Agenda abstrata de encontros definida na origem."
          }
        );
      }
    }
  }
  targetFor(p) {
    const goal = getGoal(this.state, p);
    if (goal && goal.closed === void 0)
      return getPerson(this.state, goal.target);
    if (p.rival) return getPerson(this.state, p.rival);
    return void 0;
  }
  candidates(id, roster) {
    const p = getPerson(this.state, id), g = getGoal(this.state, p), active = !!g && g.closed === void 0, target = this.targetFor(p), weight = effectiveMemory(this.state, p, this.month);
    const evidence = (...ids) => [
      ...new Set(ids.filter((x) => !!x))
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
      p.memory ? this.state.entities[p.memory].source : void 0
    );
    const result = [];
    const add = (action, factors, targetId, extra = []) => {
      if (action === "confrontar" && (this.state.scenario.bodySimulation?.singleDuel || this.anatomy && !this.anatomy.canStrike(p.id)))
        return;
      if (this.state.scenario.advancedObjectives)
        factors = { ...factors, ...personalityFactors(p, action) };
      const base = Object.values(factors).reduce((a, b) => a + b, 0), jitter = noise(this.daily ? domainSeed(this.state.scenario.seed, "decisions:" + action) : this.state.scenario.seed, p.id, this.month, action);
      result.push({
        action,
        base,
        noise: jitter,
        score: base + jitter,
        factors,
        evidence: evidence(...baseEvidence, ...extra),
        ...targetId ? { target: targetId } : {}
      });
    };
    add("esperar", {
      repouso: 300,
      cautela: p.traits.cautela * 2,
      compromissoAcordo: active && g.accordIntent && !g.accordRejected ? 250 + p.values.paz * 2 : 0
    });
    if (!p.alive || !p.present) return result;
    if (this.state.scenario.emotionalDynamics && p.psychology) {
      const psy = p.psychology;
      add("recuperar", {
        necessidadeDescanso: psy.needs.descanso * 8,
        estresse: psy.stress / 2
      });
      if (psy.stress >= 650) {
        add("isolar", {
          crise: psy.stress,
          cautela: p.traits.cautela * 4,
          sociabilidade: -(p.traits.sociabilidade || 0) * 3
        });
        const irritant = target?.alive && target.present ? target : void 0;
        if (irritant)
          add(
            "hostilizar",
            {
              crise: psy.stress,
              agressividade: (p.traits.agressividade || 0) * 6,
              autocontrole: -(p.traits.autocontrole || 0) * 5
            },
            irritant.id
          );
        const place = this.state.entities["place:void"];
        if (place.leader === p.id)
          add(
            "abandonar_posto",
            {
              crise: psy.stress,
              sobrecarga: psy.needs.descanso * 5,
              disciplina: -p.traits.disciplina * 3
            },
            void 0,
            [place.leaderSource]
          );
      }
    }
    const rememberedSkill = p.memory ? this.state.entities[p.memory].offenderSkillEstimate : target ? this.state.scenario.people.find((q) => q.id === target.id).skill : 0;
    const perceivedSkill = target?.alive && target.present ? target.skill : rememberedSkill;
    const gap = target ? perceivedSkill - p.skill : 0, urge = active ? p.values.vinganca * 4 + p.values.familia + p.traits.rancor + Math.floor(weight / 4) - p.values.paz * 4 : 0;
    if (p.trainAccess && p.skill < rules.maxSkill)
      add(
        "treinar",
        {
          pratica: active ? 380 : 100,
          disciplina: p.traits.disciplina * 3,
          preparacao: active ? Math.max(0, Math.floor(gap * 14 / 10)) : 0,
          motivo: active ? Math.floor(urge / 3) : 0
        },
        void 0,
        evidence(p.lastBy.trainAccess, p.lastBy.helpedBy)
      );
    if (target?.alive && target.present && (!active || p.informed.includes(g.offense)))
      add(
        "confrontar",
        {
          iniciativa: active ? 800 : 0,
          motivo: active ? urge : p.hostility * 12,
          poder: (p.skill - target.skill) * 4,
          perigo: -Math.max(0, gap) * 8,
          coragem: p.traits.coragem * 3,
          cautela: -p.traits.cautela * 3,
          paz: -p.values.paz * 3
        },
        target.id,
        evidence(
          target.lastBy.skill,
          target.lastBy.present,
          p.lastBy.rival,
          p.lastBy.hostility
        )
      );
    if (active && target) {
      if (!target.present)
        add(
          "observar",
          {
            busca: active ? 400 : 0,
            compromisso: Math.floor(urge / 3),
            paciencia: p.traits.disciplina
          },
          target.id
        );
      if (!p.helpFrom) {
        const helper = people(this.state).filter(
          (q) => q.id !== p.id && q.id !== target.id && q.alive && q.present && q.canHelp
        ).sort(
          (a, b) => b.values.familia + b.values.paz - a.values.familia - a.values.paz || (a.id < b.id ? -1 : 1)
        )[0];
        if (helper)
          add(
            "comunicar",
            {
              pedido: 700,
              cautela: p.traits.cautela * 2,
              paz: p.values.paz * 2,
              orgulho: -p.traits.coragem
            },
            helper.id
          );
      }
      if (!g.accordIntent && !g.accordRejected)
        add(
          "buscar_acordo",
          {
            paz: p.values.paz * 10,
            familia: p.values.familia * 2,
            rancor: -p.traits.rancor * 2,
            vinganca: -p.values.vinganca * 3,
            alternativa: 300
          },
          target.id
        );
      add(
        "perdoar",
        {
          paz: p.values.paz * 6,
          desapego: Math.floor((850 - weight) / 2),
          rancor: -p.traits.rancor * 3,
          vinganca: -p.values.vinganca * 4,
          alternativa: 250,
          aguardarResposta: g.accordIntent && !g.accordRejected ? -500 : 0,
          apoio: p.helpedBy ? 100 : 0
        },
        target.id
      );
    }
    if (!active && p.informed.length) {
      const listeners = roster ? roster.map((id2) => getPerson(this.state, id2)) : people(this.state);
      const news = firstUnknownRecipient(p.informed, listeners);
      if (news) add("comunicar", { noticia: 900, familia: p.values.familia * 2, paz: p.values.paz }, news.recipient, [news.offense]);
    }
    if (this.state.scenario.personalObjectives) {
      for (const pg of this.personalGoals(p).filter(
        (g2) => g2.closed === void 0
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
                projeto: 250
              },
              contact.id,
              [pg.source, pg.lastEvent, p.lastBy.skills].filter(Boolean)
            );
          continue;
        }
        if (pg.type === "criar_obra") {
          if (this.daily && (p.occupation !== "criador" || this.daily.ability(p.id).write < 0.5)) continue;
          const saturation = this.daily?.saturation(p, pg.theme);
          add(
            "escrever_obra",
            {
              arte: (p.values.arte || 0) * 6,
              criatividade: (p.traits.criatividade || 0) * 3,
              projeto: 350,
              saturacaoFormato: -(saturation?.formatPenalty || 0),
              repeticaoTema: -(saturation?.topicPenalty || 0),
              perseveranca: (p.traits.perseveranca || 0) * 2
            },
            p.id,
            [pg.source, pg.lastEvent, p.lastBy.skills, ...(p.works || []).map((id2) => this.state.entities[id2].source)].filter(Boolean)
          );
          continue;
        }
        const other = getPerson(this.state, pg.target);
        if (!other.alive || !other.present) continue;
        const sources = [
          pg.source,
          pg.lastEvent,
          p.acquaintances?.[other.id],
          p.bonds?.[other.id]?.source
        ].filter((x) => !!x);
        if (pg.type === "amizade")
          add(
            "conviver",
            {
              vinculo: (p.values.amizade || 0) * 6,
              familia: p.values.familia * 2,
              objetivo: 300,
              ressentimento: -p.traits.rancor
            },
            other.id,
            sources
          );
        if (pg.type === "proteger" && pg.threat && !pg.threatResolved && pg.aggressor) {
          const attacker = getPerson(this.state, pg.aggressor);
          if (attacker.alive && attacker.present && pg.estimate) {
            for (const action of [
              "proteger",
              "avisar_alvo",
              "pedir_aliados",
              "afastar_alvo"
            ]) {
              const chance2 = pg.estimate.plans[action];
              if (!chance2) continue;
              if (action === "pedir_aliados" && !this.knownAllies(p, other.id, attacker.id).some(
                (a) => a.id === pg.estimate.ally
              ))
                continue;
              add(
                action,
                {
                  solidariedade: (p.values.solidariedade || 0) * 4,
                  vinculo: p.kin.includes(other.id) ? p.values.familia * 4 : (p.bonds?.[other.id]?.trust || 0) * 3,
                  urgencia: 200,
                  sucessoEstimado: chance2 * 5,
                  risco: -(100 - chance2) * 2,
                  temperamento: action === "proteger" ? p.traits.coragem * 2 : p.traits.cautela,
                  custo: action === "proteger" ? -90 : action === "pedir_aliados" ? -70 : action === "afastar_alvo" ? -100 : -10
                },
                other.id,
                [...sources, pg.perception, pg.estimate.assessedAt]
              );
            }
          }
        }
      }
    }
    return result.sort(
      (a, b) => b.score - a.score || (a.action < b.action ? -1 : 1)
    );
  }
  act(id, roster) {
    let p = getPerson(this.state, id);
    if (!p.alive || !p.present || this.politics?.occupied(id) || this.reactedThisMonth.has(id) || this.daily && p.workedMonth === this.month || p.lifeStage && p.lifeStage !== "adult" && !(this.daily && p.lifeStage === "elder"))
      return;
    if (this.daily) {
      this.daily.choose(id);
      p = getPerson(this.state, id);
      const preferred = this.candidates(id, roster)[0].action;
      const recovery = ["recuperar", "isolar", "abandonar_posto"].includes(preferred);
      if ((!recovery || this.daily.urgentFood(id)) && this.daily.work(id)) return;
      if (this.daily.ability(id).write < 0.5) for (const g of this.personalGoals(p).filter((g2) => g2.type === "criar_obra" && g2.closed === void 0 && g2.workStarted)) {
        const failure = this.emit("work.blocked", [{ id, role: "actor" }], [g.lastEvent, ...this.daily.ability(id).sources], [], { goal: g.id, reason: "Capacidade manual insuficiente para continuar a escrita." });
        this.finishPersonalGoal(g, "failed", [failure.id], "Projeto interrompido por limita\xE7\xE3o manual.");
      }
    }
    if (this.state.scenario.personalObjectives) {
      this.prepareFriendship(p);
      if (this.state.scenario.advancedObjectives)
        this.prepareAdvancedGoals(getPerson(this.state, p.id));
      p = getPerson(this.state, id);
    }
    let goal = getGoal(this.state, p);
    if (goal && goal.closed === void 0 && effectiveMemory(this.state, p, this.month) < rules.minMemory) {
      this.closeGoal(
        goal,
        "desist\xEAncia",
        [this.state.entities[goal.memory].source],
        "A ofensa perdeu for\xE7a ao longo dos per\xEDodos, conforme o rancor."
      );
      goal = getGoal(this.state, p);
    }
    if (goal && goal.closed === void 0 && goal.accordIntent && !goal.accordRejected) {
      if (this.offerAgreement(goal)) return;
    }
    const candidates = this.candidates(id, roster), chosen = candidates[0];
    const reason = [
      "recuperar",
      "isolar",
      "hostilizar",
      "abandonar_posto"
    ].includes(chosen.action) ? "Necessidades e estresse percebidos alteraram a escolha conforme temperamento e responsabilidades." : chosen.action === "buscar_apoio" ? "Buscar coordena\xE7\xE3o por ambi\xE7\xE3o, valores de poder e apoios conhecidos." : chosen.action === "escrever_obra" ? "Criar obra por arte, criatividade, perseveran\xE7a e experi\xEAncias conhecidas." : goal && goal.closed === void 0 ? `${chosen.action} diante da morte conhecida de ${goal.victim}, atribu\xEDda a ${goal.target}; risco, valores e capacidade comparados.` : chosen.action === "confrontar" ? "Confrontar rival conhecido por hostilidade e oportunidade." : chosen.action === "comunicar" ? "Transmitir uma morte conhecida a algu\xE9m ainda sem not\xEDcia." : "Rotina mensal conforme disciplina, capacidade e cautela.";
    const decision = {
      actor: id,
      chosen: chosen.action,
      target: chosen.target,
      reason,
      candidates
    };
    const causes = chosen.evidence.length ? chosen.evidence : ["event:0"];
    if (["recuperar", "isolar", "hostilizar", "abandonar_posto"].includes(
      chosen.action
    )) {
      this.stressAction(p, chosen.action, chosen.target, causes, decision);
      return;
    }
    if (chosen.action === "buscar_apoio") {
      this.campaign(p, getPerson(this.state, chosen.target), causes, decision);
      return;
    }
    if (chosen.action === "escrever_obra") {
      this.writeWork(p, causes, decision);
      return;
    }
    if (chosen.action === "conviver") {
      this.socialize(
        p,
        getPerson(this.state, chosen.target),
        causes,
        decision
      );
      return;
    }
    if (["proteger", "avisar_alvo", "pedir_aliados", "afastar_alvo"].includes(
      chosen.action
    )) {
      this.protectiveResponse(
        p,
        chosen.target,
        chosen.action,
        causes,
        decision
      );
      return;
    }
    if (chosen.action === "confrontar") {
      this.confront(p, getPerson(this.state, chosen.target), causes, decision);
      return;
    }
    if (chosen.action === "comunicar") {
      const target = getPerson(this.state, chosen.target), g = getGoal(this.state, p);
      const active = g && g.closed === void 0;
      const offense = active ? g.offense : p.informed.find((o) => !target.informed.includes(o));
      if (!offense) return;
      const eid2 = this.nextId();
      if (active)
        this.emit(
          "help.requested",
          [
            { id: p.id, role: "actor" },
            { id: target.id, role: "target" }
          ],
          causes,
          [{ op: "replace", entity: changed(p, { helpFrom: target.id }, eid2) }],
          { sender: p.id, recipient: target.id, offense, periodMonths: 1 },
          decision
        );
      this.emit(
        "information.shared",
        [
          { id: p.id, role: "actor" },
          { id: target.id, role: "target" }
        ],
        [...causes, ...active ? [eid2] : [], offense],
        [],
        { sender: p.id, recipient: target.id, offense },
        active ? void 0 : decision
      );
      return;
    }
    if (chosen.action === "buscar_acordo" && goal && goal.closed === void 0) {
      const e = this.emit(
        "agreement.sought",
        [
          { id: p.id, role: "actor" },
          { id: goal.target, role: "reference" }
        ],
        causes,
        [{ op: "replace", entity: { ...goal, accordIntent: this.nextId() } }],
        {
          goal: goal.id,
          reason: "Buscar acordo bilateral; aus\xEAncia n\xE3o significa recusa."
        },
        decision
      );
      this.offerAgreement({ ...goal, accordIntent: e.id });
      return;
    }
    if (chosen.action === "perdoar" && goal && goal.closed === void 0) {
      const e = this.emit(
        "forgiveness.chosen",
        [
          { id: p.id, role: "actor" },
          { id: goal.target, role: "reference" }
        ],
        causes,
        [],
        {
          unilateral: true,
          reason: "Ren\xFAncia pessoal, sem depender da aceita\xE7\xE3o do outro."
        },
        decision
      );
      this.closeGoal(
        goal,
        "desist\xEAncia",
        [e.id],
        "O agente perdoou unilateralmente e encerrou sua vingan\xE7a."
      );
      return;
    }
    const gain = chosen.action === "treinar" ? Math.min(
      rules.maxSkill - p.skill,
      (goal && goal.closed === void 0 ? 4 : 1) + Math.floor(p.traits.disciplina / 20) + (p.helpedBy ? 4 : 0)
    ) : 0;
    const eid = this.nextId();
    const monitoring = this.personalGoals(p).filter(
      (g) => g.type === "proteger" && g.closed === void 0 && getPerson(this.state, g.target).alive && getPerson(this.state, g.target).present
    );
    this.emit(
      "activity.period",
      [{ id: p.id, role: "actor" }],
      [...causes, ...monitoring.map((g) => g.lastEvent)],
      [
        ...gain ? [
          {
            op: "replace",
            entity: changed(p, { skill: p.skill + gain }, eid)
          }
        ] : [],
        ...monitoring.map((g) => ({
          op: "replace",
          entity: { ...g, lastMonitored: eid }
        }))
      ],
      {
        monitoringGoals: monitoring.map((g) => g.id),
        action: chosen.action,
        periodMonths: 1,
        skillBefore: p.skill,
        gain,
        skillAfter: p.skill + gain,
        memoryWeight: effectiveMemory(this.state, p, this.month)
      },
      decision
    );
  }
  confront(actor, target, causes, decision) {
    if (this.state.scenario.personalObjectives) {
      const threat2 = this.emit(
        "threat.announced",
        [
          { id: actor.id, role: "actor" },
          { id: target.id, role: "target" }
        ],
        causes,
        [],
        { aggressor: actor.id, target: target.id },
        decision
      );
      this.drain();
      if (this.state.scenario.emotionalDynamics && this.recurrentThreat(threat2)) {
        this.resolveThreat(
          threat2.id,
          this.state.events[this.state.events.length - 1].id
        );
        return;
      }
      actor = getPerson(this.state, actor.id);
      target = getPerson(this.state, target.id);
      let interrupted = false;
      for (const protector of people(this.state).filter(
        (p) => p.alive && p.present && p.id !== actor.id && p.id !== target.id
      )) {
        const pg = this.personalGoals(protector).find(
          (g) => g.type === "proteger" && g.closed === void 0 && g.threat === threat2.id
        );
        if (!pg) continue;
        const choices = this.candidates(protector.id), choice = choices[0];
        if (!choice || ![
          "proteger",
          "avisar_alvo",
          "pedir_aliados",
          "afastar_alvo"
        ].includes(choice.action) || choice.target !== target.id)
          continue;
        const d = {
          actor: protector.id,
          chosen: choice.action,
          target: target.id,
          candidates: choices,
          reason: "Intervir em amea\xE7a que presenciei contra pessoa conhecida ou por solidariedade."
        };
        if (this.protectiveResponse(
          protector,
          target.id,
          choice.action,
          choice.evidence,
          d
        )) {
          interrupted = true;
          break;
        }
      }
      if (interrupted) {
        const prevented = this.emit(
          "confrontation.prevented",
          [
            { id: actor.id, role: "actor" },
            { id: target.id, role: "target" }
          ],
          [
            threat2.id,
            ...Object.values(this.state.entities).filter(
              (x) => x.kind === "personalGoal" && x.threat === threat2.id
            ).map((g) => g.lastEvent)
          ],
          [],
          { threat: threat2.id }
        );
        this.resolveThreat(threat2.id, prevented.id);
        return;
      }
      causes = [threat2.id];
    }
    if (this.anatomy) {
      this.anatomy.duel(actor.id, target.id, causes);
      return;
    }
    const jitter = sample(
      this.state.scenario.seed,
      `combat:${actor.id}:${target.id}:${this.month}`,
      -30,
      30
    );
    const advantage = actor.skill - target.skill + jitter;
    const threat = actor.skill - target.skill + target.traits.cautela * 3 - target.traits.coragem * 2;
    const flee = threat > rules.flightMargin && target.traits.cautela > 35;
    const winner = advantage >= 0 ? actor : target, loser = advantage >= 0 ? target : actor;
    const lethal = !flee && Math.abs(advantage) >= rules.lethalMargin;
    const resolution = flee ? "fuga" : lethal ? "morte" : "recuo";
    const eid = this.nextId();
    const effects = flee ? [
      {
        op: "replace",
        entity: changed(target, { escaped: true, present: false }, eid)
      }
    ] : [];
    const e = this.emit(
      "confrontation.resolved",
      [
        { id: actor.id, role: "actor" },
        { id: target.id, role: "target" }
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
          reason: "Amea\xE7a e cautela comparadas \xE0 op\xE7\xE3o de resistir; resposta abstrata, sem corpo."
        },
        advantage,
        jitter,
        threat,
        result: resolution,
        winner: !flee ? winner.id : null,
        loser: !flee ? loser.id : target.id,
        weapon: null,
        bodyPart: null
      },
      this.state.scenario.personalObjectives ? void 0 : decision
    );
    if (this.state.scenario.personalObjectives) {
      const threat2 = [...this.state.events].reverse().find(
        (x) => x.type === "threat.announced" && x.data.aggressor === actor.id && x.data.target === target.id
      );
      if (threat2 && (!this.state.scenario.emotionalDynamics || !lethal))
        this.resolveThreat(threat2.id, e.id);
    }
    if (flee) {
      for (const g of goals(this.state).filter(
        (g2) => g2.closed === void 0 && g2.target === target.id && g2.owner === actor.id
      ))
        this.closeGoal(
          g,
          "fuga",
          [e.id],
          "O alvo escolheu escapar diante da amea\xE7a superior; n\xE3o houve morte."
        );
      return;
    }
    if (lethal) {
      this.die(loser, winner.id, e.id);
      if (this.state.scenario.emotionalDynamics && loser.id === actor.id) {
        const announced = [...this.state.events].reverse().find(
          (x) => x.type === "threat.announced" && x.month === this.month && x.data.aggressor === actor.id && x.data.target === target.id
        );
        if (announced) this.resolveThreat(announced.id, e.id);
      }
    }
  }
  die(p, killer, cause, details = {}) {
    const current = getPerson(this.state, p.id);
    if (!current.alive) return;
    const id = this.nextId();
    this.emit(
      "person.died",
      [
        { id: p.id, role: "victim" },
        ...killer ? [
          {
            id: killer,
            role: details.wound || !getPerson(this.state, killer).alive ? "reference" : "actor"
          }
        ] : []
      ],
      [cause, current.lastBy.alive],
      [
        {
          op: "replace",
          entity: changed(current, { alive: false, death: id, killer }, id)
        }
      ],
      {
        victim: p.id,
        ageYears: this.life?.get(p.id) ? Math.floor((this.month - this.life.get(p.id).birthMonth) / 12) : void 0,
        killer: killer || null,
        killerSkill: killer ? getPerson(this.state, killer).skill : null,
        cause: "confronto abstrato",
        weapon: null,
        bodyPart: null,
        ...details
      }
    );
    const place = this.state.entities["place:void"];
    if (place.leader === p.id) {
      const vacant = this.nextId();
      this.emit(
        "leadership.vacated",
        [{ id: p.id, role: "reference" }],
        [id, place.leaderSource],
        [
          {
            op: "replace",
            entity: { ...place, leader: void 0, leaderSource: vacant }
          }
        ],
        { cause: id }
      );
    }
    for (const pg of this.allPersonalGoals().filter(
      (g) => g.closed === void 0 && (g.owner === p.id || g.target === p.id)
    ))
      this.finishPersonalGoal(pg, "failed", [id], gReason(pg, p.id));
    if (killer && getPerson(this.state, killer).alive) {
      const k = getPerson(this.state, killer);
      const remorse = Math.floor(
        (k.values.paz + k.values.familia + k.traits.cautela) / 3
      );
      const rid = this.nextId();
      this.emit(
        "remorse.felt",
        [
          { id: k.id, role: "actor" },
          { id: p.id, role: "reference" }
        ],
        [id, k.lastBy.values],
        [{ op: "replace", entity: changed(k, { remorse }, rid) }],
        { remorse, reason: "Avalia\xE7\xE3o da pr\xF3pria morte causada." }
      );
    }
    if (this.daily) for (const work of Object.values(this.state.entities).filter((e) => e.kind === "work" && e.owner === p.id && !e.ownerEstate)) {
      this.emit("work.estate.recorded", [{ id: p.id, role: "reference" }], [id, work.ownerSource || work.source], [{ op: "replace", entity: { ...work, ownerEstate: true, ownerSource: this.nextId() } }], { work: work.id, owner: p.id, reason: "Esp\xF3lio registrado; sem herdeiro presumido." });
    }
    this.life?.onDeath(p.id, id);
  }
  run(untilMonth = this.state.scenario.months) {
    this.advance(untilMonth);
    return this.legacySnapshot();
  }
  /** Advance a monthly boundary without materializing an unused full snapshot. */
  advance(untilMonth = this.state.scenario.months) {
    const end = Math.min(untilMonth, this.state.scenario.months);
    for (this.month = this.state.nextMonth; this.month < end; this.month++) {
      this.reactedThisMonth.clear();
      this.availability();
      if (this.state.scenario.emotionalDynamics) this.needsPeriod();
      const s = this.state.scenario;
      this.life?.monthly();
      this.anatomy?.monthly();
      const scene = s.bodySimulation?.singleDuel;
      if (scene && scene.month === this.month && !Object.values(this.state.entities).some((e) => e.kind === "duel")) {
        this.anatomy.duel(
          scene.attacker,
          scene.defender,
          ["event:1"],
          scene.caregiver
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
              reason: "Interven\xE7\xE3o de teste: outra causa, n\xE3o gera\xE7\xE3o livre."
            }
          );
          this.die(p, void 0, e.id);
        }
      }
      this.drain();
      this.politics?.beforeActions();
      const roster = people(this.state).map((p) => p.id);
      for (const id of roster) {
        this.act(id, roster);
        this.drain();
      }
      this.daily?.consume();
      this.politics?.monthly();
      this.drain();
      this.state.nextMonth = this.month + 1;
    }
    if (this.state.nextMonth === this.state.scenario.months && !this.state.complete) {
      this.month = this.state.nextMonth - 1;
      for (const g of goals(this.state).filter((g2) => g2.closed === void 0))
        this.closeGoal(
          g,
          "objetivo frustrado",
          [g.source],
          "O horizonte terminou sem resolu\xE7\xE3o."
        );
      for (const pg of this.allPersonalGoals().filter(
        (g) => g.closed === void 0
      )) {
        const success = pg.type === "proteger" && getPerson(this.state, pg.owner).alive && getPerson(this.state, pg.target).alive && pg.interventions > 0;
        this.finishPersonalGoal(
          pg,
          success ? "completed" : "failed",
          [pg.lastEvent, ...pg.lastMonitored ? [pg.lastMonitored] : []],
          success ? "Pessoa protegida viva no horizonte e interven\xE7\xE3o efetiva registrada." : "Horizonte encerrado sem satisfazer o objetivo."
        );
      }
      this.drain();
      this.life?.balance();
      this.state.complete = true;
    }
  }
};

// scripts/m3-review-bench.ts
var tag = process.argv[2] || "before";
var seed = process.argv[3] || "reservado-2b-006";
mkdirSync("reports/m3-review", { recursive: true });
var scenario = settlementScenario(seed, 40);
var warm = structuredClone(scenario);
warm.months = 12;
new SliceSimulation(warm).advance();
globalThis.gc?.();
var session = new Session();
var post = (method) => new Promise((resolve, reject) => session.post(method, (e, r) => e ? reject(e) : resolve(r)));
var profile = process.argv.includes("--profile");
if (profile) {
  session.connect();
  await post("Profiler.enable");
  await post("Profiler.start");
}
var t = performance.now();
var sim = new SliceSimulation(scenario);
sim.advance();
var ms = performance.now() - t;
var memory = { rssPeak: process.resourceUsage().maxRSS * 1024, ...process.memoryUsage() };
if (profile) {
  const r = await post("Profiler.stop");
  writeFileSync(`reports/m3-review/${tag}.cpuprofile`, JSON.stringify(r.profile));
  session.disconnect();
}
var w = sim.runCompact();
var json = JSON.stringify(w);
var hash2 = createHash("sha256").update(json).digest("hex");
writeFileSync(`reports/m3-review/${tag}.bench.json`, JSON.stringify({ seed, ms, memory, hash: hash2, events: w.log.rows.length, jsonBytes: Buffer.byteLength(json), profile }, null, 2));
console.log({ tag, seed, ms, hash: hash2, memory, events: w.log.rows.length });
