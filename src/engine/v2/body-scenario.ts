import { emotionalScenario } from "./scenario";
import { sample } from "./rules";
export function bodyScenario(seed: string) {
  const s = emotionalScenario(seed);
  s.months = 7;
  s.people = s.people.slice(0, 4);
  s.schedules = s.schedules
    .slice(0, 4)
    .map((x) => ({ ...x, from: 0, until: 6, period: 1, absentMonths: 0 }));
  const [a, b, h, w] = s.people;
  for (const p of s.people) {
    p.kin = [];
    p.rival = undefined;
    p.hostility = sample(seed, `${p.id}:duel-hostility`, 30, 100);
    p.medicalSkill = sample(seed, `${p.id}:medicine`, 25, 95);
  }
  b.kin = [w.id];
  w.kin = [b.id];
  a.skill = sample(seed, "duel:attackSkill", 300, 850);
  b.skill = sample(seed, "duel:defenseSkill", 300, 850);
  s.focal = w.id;
  s.victim = b.id;
  s.offender = a.id;
  s.helper = h.id;
  s.bodySimulation = {
    singleDuel: { attacker: a.id, defender: b.id, caregiver: h.id, month: 0 },
    care: true,
    maxExchanges: 6,
  };
  return s;
}
export function bodyFixture() {
  const s = bodyScenario("fixture-golpe-numerico");
  s.mode = "fixture";
  const [a, b, h, w] = s.people;
  s.bodySimulation = { ...s.bodySimulation!, fixture: true, maxExchanges: 1 };
  a.name = "Agressor";
  b.name = "Sobrevivente";
  h.name = "Cuidadora";
  w.name = "Parente";
  a.skill = 650;
  b.skill = 550;
  for (const p of s.people) {
    p.values.amizade = 0;
    p.values.poder = 0;
    p.values.arte = 0;
    p.traits.ambicao = 0;
    p.traits.cautela = 20;
    p.traits.orgulho = 50;
    p.traits.sensibilidade = 60;
    p.traits.esperanca = 40;
  }
  b.values.paz = 70;
  b.traits.rancor = 10;
  b.traits.agressividade = 10;
  b.traits.compaixao = 80;
  b.traits.autocontrole = 80;
  h.canHelp = true;
  h.medicalSkill = 80;
  h.traits.compaixao = 100;
  h.values.solidariedade = 100;
  return s;
}
