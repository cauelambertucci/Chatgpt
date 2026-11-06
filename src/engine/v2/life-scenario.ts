import { emotionalScenario } from "./scenario";
import { sample } from "./rules";
export function lifeScenario(seed: string, count = 12) {
  const s = emotionalScenario(seed);
  s.months = 1200;
  s.personalObjectives = false;
  s.advancedObjectives = false;
  s.people = s.people.slice(0, count);
  s.schedules = s.schedules.slice(0, count);
  for (const [i, p] of s.people.entries()) {
    p.born = -sample(seed, `${p.id}:founder-age`, 18, 35);
    p.kin = [];
    p.rival = undefined;
    p.hostility = sample(seed, `${p.id}:duel-hostility`, 30, 100);
    p.medicalSkill = sample(seed, `${p.id}:medicine`, 25, 95);
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
      month: sample(seed, "family:duel-month", 60, 240),
    },
  };
  s.focal = s.people[3].id;
  s.victim = s.people[1].id;
  s.offender = s.people[0].id;
  s.helper = s.people[2].id;
  return s;
}
