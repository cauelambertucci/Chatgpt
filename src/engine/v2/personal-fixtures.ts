import { personalScenario } from "./scenario";
export function protectionFixture() {
  const s = personalScenario("fixture-proteger");
  s.mode = "fixture";
  s.months = 12;
  for (const p of s.people) {
    p.values.amizade = 0;
    p.values.solidariedade = 0;
    p.rival = undefined;
    p.hostility = 0;
  }
  const [a, b, c, d] = s.people;
  a.kin = [];
  b.kin = []; // isolate one guardian: relatives now also have viable warning/evacuation plans
  a.skill = 40;
  c.skill = 500;
  c.rival = b.id;
  c.hostility = 100;
  c.traits.cautela = 0;
  b.skill = 50;
  b.traits.cautela = 0;
  d.skill = 800;
  d.traits.coragem = 95;
  d.traits.cautela = 0;
  d.values.solidariedade = 100;
  d.values.paz = 100;
  return s;
}
export function friendshipFixture() {
  const s = personalScenario("fixture-amizade");
  s.mode = "fixture";
  s.months = 12;
  for (const p of s.people) {
    p.values.amizade = 0;
    p.values.solidariedade = 0;
    p.rival = undefined;
    p.hostility = 0;
  }
  for (const p of s.people.slice(0, 2)) {
    p.values = {
      familia: 80,
      vinganca: 0,
      paz: 100,
      amizade: 100,
      solidariedade: 0,
    };
    p.traits.rancor = 0;
    p.traits.cautela = 0;
  }
  s.friendTargets = { [s.people[0].id]: s.people[1].id };
  return s;
}
