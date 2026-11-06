import { initialPsychology } from "./emotions";
import { traits, values } from "../../data/v2/personality";
import type { Person, Scenario } from "./types";
import { names, sample, traitKeys, valueKeys } from "./rules";
export function freeScenario(seed: string): Scenario {
  const people: Person[] = Array.from({ length: 20 }, (_, i) => {
    const id = `person:${String(i).padStart(2, "0")}`;
    return {
      id,
      kind: "person",
      name: names[(i + sample(seed, "name-offset", 0, 19)) % 20],
      born: -sample(seed, `${id}:age`, 18, 45),
      alive: true,
      traits: Object.fromEntries(
        traitKeys.map((k) => [k, sample(seed, `${id}:${k}`, 5, 95)]),
      ) as Person["traits"],
      values: Object.fromEntries(
        valueKeys.map((k) => [k, sample(seed, `${id}:${k}`, 0, 100)]),
      ) as Person["values"],
      skill: sample(seed, `${id}:skill`, 50, 220),
      kin: [],
      hostility: 0,
      trainAccess: true,
      canHelp: sample(seed, `${id}:help`, 0, 100) > 35,
      present: true,
      escaped: false,
      remorse: 0,
      informed: [],
      lastBy: {},
    };
  });
  const focal = people[0],
    victim = people[1],
    offender = people[2],
    helper = people[3],
    rival = people[4];
  focal.kin = [victim.id];
  victim.kin = [focal.id];
  focal.skill = sample(seed, "focal:skill", 35, 130);
  offender.rival = victim.id;
  offender.hostility = sample(seed, "initial-hostility", 85, 100);
  offender.skill = sample(seed, "offender:skill", 380, 520);
  offender.trainAccess = sample(seed, "offender:training", 0, 100) > 55;
  victim.skill = sample(seed, "victim:skill", 40, 120);
  victim.traits.cautela = sample(seed, "victim:caution", 0, 30);
  helper.canHelp = true;
  helper.values.familia = sample(seed, "helper:family", 45, 100);
  rival.rival = offender.id;
  rival.hostility = sample(seed, "secondary-hostility", 15, 90);
  rival.skill = sample(seed, "secondary-skill", 300, 750);
  const departure = sample(seed, "departure", 2, 8),
    returnMonth = sample(seed, "return", 24, 110);
  const schedules = people.map((p) => ({
    id: p.id,
    from: 0,
    until: 239,
    period: 1,
    absentMonths: 0,
  }));
  const schedule = schedules[2];
  schedule.period = returnMonth;
  schedule.absentMonths = returnMonth - departure;
  // First visit, then periodic returns. The same abstract-place availability is recorded as events.
  schedules[4].from = sample(seed, "secondary-arrival", 36, 180);
  return {
    seed,
    mode: "free",
    months: 240,
    people,
    schedules,
    focal: focal.id,
    victim: victim.id,
    offender: offender.id,
    helper: helper.id,
    blockedInformation: [],
    noReencounter: false,
  };
}
export function fixtureScenario(seed = "fixture-vinganca"): Scenario {
  const s = freeScenario(seed);
  s.mode = "fixture";
  s.schedules.forEach((x) => {
    x.from = 0;
    x.until = 239;
    x.period = 1;
    x.absentMonths = 0;
  });
  const [f, v, o, h, r] = s.people;
  f.name = "Runa";
  v.name = "Elian";
  o.name = "Skarn";
  h.name = "Mira";
  f.traits = { rancor: 96, coragem: 85, disciplina: 80, cautela: 50 };
  f.values = { familia: 95, vinganca: 95, paz: 0 };
  f.skill = 70;
  o.skill = 480;
  o.trainAccess = false;
  o.traits.cautela = 0;
  o.traits.rancor = 95;
  o.values.paz = 0;
  o.values.vinganca = 90;
  o.hostility = 100;
  v.skill = 50;
  v.traits.cautela = 0;
  v.values.paz = 100;
  v.hostility = 0;
  h.values.paz = 20;
  h.canHelp = true;
  h.values.familia = 100;
  r.hostility = 0;
  r.rival = undefined;
  s.schedules[0].from = 1;
  s.schedules[2].period = 60;
  s.schedules[2].absentMonths = 57;
  return s;
}
export const presentAt = (s: Scenario, id: string, month: number) => {
  const schedule = s.schedules.find((x) => x.id === id);
  if (!schedule) return false;
  if (s.noReencounter && id === s.offender && month > 0) return false;
  return (
    month >= schedule.from &&
    month <= schedule.until &&
    (schedule.period === 1 ||
      month % schedule.period < schedule.period - schedule.absentMonths)
  );
};

/** Free 1b scenario; separate prefix/profile, so the 1a holdout remains comparable. */
export function personalScenario(seed: string): Scenario {
  const s = freeScenario(seed);
  s.personalObjectives = true;
  for (const p of s.people) {
    p.values.amizade = sample(seed, `${p.id}:amizade`, 0, 100);
    p.values.solidariedade = sample(seed, `${p.id}:solidariedade`, 0, 100);
    p.acquaintances = {};
    p.bonds = {};
    p.personalGoals = [];
  }
  return s;
}

export function advancedScenario(seed: string): Scenario {
  const s = personalScenario(seed);
  s.advancedObjectives = true;
  for (const p of s.people) {
    for (const key of Object.keys(traits))
      p.traits[key] = sample(seed, `${p.id}:facet:${key}`, 0, 100);
    for (const key of Object.keys(values))
      p.values[key] = sample(seed, `${p.id}:belief:${key}`, -100, 100);
    p.skills = {
      lideranca: sample(seed, `${p.id}:lideranca`, 20, 90),
      escrita: sample(seed, `${p.id}:escrita`, 10, 80),
    };
    p.works = [];
  }
  return s;
}

export function emotionalScenario(seed: string): Scenario {
  const s = advancedScenario(seed);
  s.emotionalDynamics = true;
  for (const p of s.people) p.psychology = initialPsychology();
  return s;
}
